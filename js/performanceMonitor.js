// Performance monitoring system for FPS and metrics tracking
import { logger } from './logger.js';
import { CONSTANTS } from './constants.js';

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      frameCount: 0,
      startTime: Date.now(),
      lastFrameTime: Date.now(),
      fps: 0,
      averageFps: 0,
      inferenceTime: 0,
      totalProcessingTime: 0,
      memoryUsage: 0
    };
    
    this.frameHistory = [];
    this.maxHistorySize = 60; // Keep last 60 frames
    this.lastUpdateTime = 0;
    this.updateInterval = 1000; // Update display every second
    
    this.isMonitoring = false;
    this.displayElement = null;
  }

  /**
   * Start performance monitoring
   */
  start() {
    this.isMonitoring = true;
    this.metrics.startTime = Date.now();
    this.metrics.frameCount = 0;
    this.frameHistory = [];
    logger.debug('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    this.isMonitoring = false;
    logger.debug('Performance monitoring stopped');
  }

  /**
   * Record a frame and update metrics
   */
  recordFrame(inferenceTime = 0, totalProcessingTime = 0) {
    if (!this.isMonitoring) return;

    const currentTime = Date.now();
    const frameDuration = currentTime - this.metrics.lastFrameTime;
    
    this.metrics.frameCount++;
    this.metrics.lastFrameTime = currentTime;
    this.metrics.inferenceTime = inferenceTime;
    this.metrics.totalProcessingTime = totalProcessingTime;
    
    // Calculate instantaneous FPS
    if (frameDuration > 0) {
      this.metrics.fps = 1000 / frameDuration;
    }
    
    // Add to frame history
    this.frameHistory.push({
      timestamp: currentTime,
      duration: frameDuration,
      fps: this.metrics.fps,
      inferenceTime,
      totalProcessingTime
    });
    
    // Limit history size
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }
    
    // Calculate average FPS
    this.calculateAverageFps();
    
    // Update memory usage if available
    this.updateMemoryUsage();
    
    // Update display if enough time has passed
    if (currentTime - this.lastUpdateTime > this.updateInterval) {
      this.updateDisplay();
      this.lastUpdateTime = currentTime;
    }
  }

  /**
   * Calculate average FPS from frame history
   */
  calculateAverageFps() {
    if (this.frameHistory.length < 2) return;
    
    const recentFrames = this.frameHistory.slice(-30); // Last 30 frames
    const totalDuration = recentFrames.reduce((sum, frame) => sum + frame.duration, 0);
    const avgFrameDuration = totalDuration / recentFrames.length;
    
    if (avgFrameDuration > 0) {
      this.metrics.averageFps = 1000 / avgFrameDuration;
    }
  }

  /**
   * Update memory usage metrics
   */
  updateMemoryUsage() {
    if (performance.memory) {
      this.metrics.memoryUsage = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
        usagePercent: Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100)
      };
    }
  }

  /**
   * Create and show performance display overlay
   */
  createDisplay() {
    if (this.displayElement) return;

    this.displayElement = document.createElement('div');
    this.displayElement.id = 'performance-monitor';
    this.displayElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      min-width: 200px;
      backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(this.displayElement);
    this.updateDisplay();
  }

  /**
   * Hide and remove performance display
   */
  hideDisplay() {
    if (this.displayElement) {
      this.displayElement.remove();
      this.displayElement = null;
    }
  }

  /**
   * Update the performance display
   */
  updateDisplay() {
    if (!this.displayElement) return;

    const runtime = Date.now() - this.metrics.startTime;
    const runtimeSeconds = Math.round(runtime / 1000);
    
    let html = `
      <div style="font-weight: bold; margin-bottom: 5px;">⚡ Performance Monitor</div>
      <div>FPS: ${this.metrics.fps.toFixed(1)} (avg: ${this.metrics.averageFps.toFixed(1)})</div>
      <div>Frames: ${this.metrics.frameCount}</div>
      <div>Runtime: ${runtimeSeconds}s</div>
    `;
    
    if (this.metrics.inferenceTime > 0) {
      html += `<div>Inference: ${this.metrics.inferenceTime}ms</div>`;
    }
    
    if (this.metrics.totalProcessingTime > 0) {
      const overhead = this.metrics.totalProcessingTime - this.metrics.inferenceTime;
      html += `<div>Processing: ${this.metrics.totalProcessingTime}ms</div>`;
      html += `<div>Overhead: ${overhead}ms</div>`;
    }
    
    if (this.metrics.memoryUsage && typeof this.metrics.memoryUsage === 'object') {
      html += `
        <div style="margin-top: 5px; border-top: 1px solid #333; padding-top: 5px;">
          <div>Memory: ${this.metrics.memoryUsage.used}MB / ${this.metrics.memoryUsage.total}MB</div>
          <div>Usage: ${this.metrics.memoryUsage.usagePercent}%</div>
        </div>
      `;
    }
    
    this.displayElement.innerHTML = html;
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      runtime: Date.now() - this.metrics.startTime,
      frameHistory: this.frameHistory.slice() // Copy of history
    };
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const metrics = this.getMetrics();
    const runtime = metrics.runtime / 1000;
    
    return {
      averageFps: metrics.averageFps,
      totalFrames: metrics.frameCount,
      runtimeSeconds: runtime,
      averageInferenceTime: this.getAverageInferenceTime(),
      memoryUsage: metrics.memoryUsage
    };
  }

  /**
   * Calculate average inference time from frame history
   */
  getAverageInferenceTime() {
    if (this.frameHistory.length === 0) return 0;
    
    const framesWithInference = this.frameHistory.filter(frame => frame.inferenceTime > 0);
    if (framesWithInference.length === 0) return 0;
    
    const totalInferenceTime = framesWithInference.reduce((sum, frame) => sum + frame.inferenceTime, 0);
    return totalInferenceTime / framesWithInference.length;
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded() {
    return this.metrics.averageFps < CONSTANTS.INFERENCE_THROTTLE_FPS * 0.7; // 70% of target FPS
  }

  /**
   * Log performance summary
   */
  logSummary() {
    const summary = this.getSummary();
    logger.info('📊 Performance Summary:', summary);
    
    if (this.isPerformanceDegraded()) {
      logger.warn('⚠️ Performance degraded - FPS below target');
    }
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      frameCount: 0,
      startTime: Date.now(),
      lastFrameTime: Date.now(),
      fps: 0,
      averageFps: 0,
      inferenceTime: 0,
      totalProcessingTime: 0,
      memoryUsage: 0
    };
    
    this.frameHistory = [];
    this.lastUpdateTime = 0;
    
    logger.debug('Performance monitor reset');
  }
}