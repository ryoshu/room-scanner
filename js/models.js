// Model management and configuration
import { logger } from './logger.js';

export class ModelManager {
  constructor() {
    // Model configurations: [resolution, filename, expectedSize, priority, type, description]
    this.RES_TO_MODEL = [
      [[640, 640], 'yolov10n.onnx', 9309375, 'high', 'yolo-standard', 'YOLOv10n 640x640'],
      [[256, 256], 'yolov7-tiny_256x256.onnx', 24943827, 'medium', 'yolo-standard', 'YOLOv7-Tiny 256x256'],
      [[320, 320], 'yolov7-tiny_320x320.onnx', 24949875, 'medium', 'yolo-standard', 'YOLOv7-Tiny 320x320'],
      [[640, 640], 'yolov7-tiny_640x640.onnx', 25000320, 'low', 'yolo-standard', 'YOLOv7-Tiny 640x640'],
    ];
    
    this.currentModelIndex = 0;
    this.currentSession = null;
    this.isLoading = false;
    this.loadedModels = new Map(); // Cache for loaded models
    this.fallbackAttempted = false;
    
    // Progress tracking
    this.progressCallback = null;
    this.loadingProgress = 0;
  }

  getCurrentModelConfig() {
    const model = this.RES_TO_MODEL[this.currentModelIndex];
    return {
      resolution: model[0],
      filename: model[1],
      expectedSize: model[2],
      priority: model[3],
      type: model[4] || 'yolo-standard',
      description: model[5] || model[1],
      name: model[1],
      isYoloWorld: model[4] === 'yolo-world-sim' || model[4] === 'yolo-world'
    };
  }




  async runInference(preprocessedData) {
    if (!this.currentSession) {
      throw new Error('No model loaded');
    }

    try {
      const feeds = {};
      feeds[this.currentSession.inputNames[0]] = preprocessedData;
      
      const start = Date.now();
      const outputData = await this.currentSession.run(feeds);
      const end = Date.now();
      
      const inferenceTime = end - start;
      const output = outputData[this.currentSession.outputNames[0]];
      
      return [output, inferenceTime];
    } catch (error) {
      logger.error('Inference failed:', error);
      throw new Error(`Inference failed: ${error.message}`);
    }
  }

  isModelLoading() {
    return this.isLoading;
  }

  getSession() {
    return this.currentSession;
  }


  /**
   * Clear model cache
   */
  clearCache() {
    this.loadedModels.clear();
    logger.debug('🗑️ Model cache cleared');
  }

  /**
   * Manage memory pressure by clearing cache when needed
   */
  manageMemoryPressure() {
    if (performance.memory) {
      const memInfo = performance.memory;
      const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
      
      if (usageRatio > 0.8) {
        logger.warn('🧠 Memory pressure detected, clearing model cache');
        this.clearCache();
        
        // Force garbage collection if available (Chrome DevTools)
        if (typeof gc === 'function') {
          gc();
        }
        
        return true;
      }
    }
    return false;
  }

  /**
   * Set progress callback for loading updates
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Update loading progress (only if callback is set)
   */
  updateProgress(percentage, message) {
    this.loadingProgress = Math.max(0, Math.min(100, percentage));
    if (this.progressCallback) {
      this.progressCallback(this.loadingProgress, message);
    }
  }

  /**
   * Get current loading progress
   */
  getLoadingProgress() {
    return this.loadingProgress;
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo() {
    const info = {
      cachedModels: this.loadedModels.size,
      currentModel: this.getCurrentModelConfig().filename
    };
    
    if (performance.memory) {
      info.memoryUsage = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
        usageRatio: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
      };
    }
    
    return info;
  }

}