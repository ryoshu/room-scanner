// Service Worker Manager - handles registration, updates, and communication
import { logger } from './logger.js';
import { CONSTANTS } from './constants.js';

export class ServiceWorkerManager {
  constructor() {
    this.registration = null;
    this.isSupported = 'serviceWorker' in navigator;
    this.updateAvailable = false;
    this.cacheStats = {
      staticAssets: 0,
      modelsCount: 0,
      totalSize: 0
    };
    
    // Event callbacks
    this.onUpdateAvailable = null;
    this.onCacheStatusChange = null;
    this.onOfflineReady = null;
  }

  /**
   * Initialize and register service worker
   */
  async initialize() {
    if (!this.isSupported) {
      logger.warn('Service Worker not supported in this browser');
      return false;
    }

    try {
      logger.info('🔧 Registering Service Worker...');
      
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      logger.info('✅ Service Worker registered successfully');

      // Set up event listeners
      this.setupEventListeners();
      
      // Check for updates
      await this.checkForUpdates();
      
      // Get initial cache status
      await this.updateCacheStats();
      
      return true;
    } catch (error) {
      logger.error('❌ Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * Set up service worker event listeners
   */
  setupEventListeners() {
    if (!this.registration) return;

    // Listen for service worker updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is available
          this.updateAvailable = true;
          logger.info('🔄 App update available');
          
          if (this.onUpdateAvailable) {
            this.onUpdateAvailable();
          }
        }
      });
    });

    // Listen for controller changes (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      logger.info('🔄 Service Worker updated, reloading...');
      window.location.reload();
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', event => {
      this.handleServiceWorkerMessage(event);
    });
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(event) {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'CACHE_UPDATED':
        logger.info('📦 Cache updated:', payload);
        this.updateCacheStats();
        break;
        
      case 'OFFLINE_READY':
        logger.info('🔒 App ready for offline use');
        if (this.onOfflineReady) {
          this.onOfflineReady();
        }
        break;
        
      case 'MODEL_CACHED':
        logger.info('🎯 Model cached:', payload.modelUrl);
        this.updateCacheStats();
        break;
        
      default:
        logger.debug('Unknown SW message:', type, payload);
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates() {
    if (!this.registration) return;

    try {
      await this.registration.update();
      logger.debug('✅ Update check completed');
    } catch (error) {
      logger.error('❌ Update check failed:', error);
    }
  }

  /**
   * Apply available update (reload page with new SW)
   */
  applyUpdate() {
    if (!this.updateAvailable || !this.registration) return;

    const waitingWorker = this.registration.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Request model to be cached
   */
  async cacheModel(modelUrl) {
    if (!this.isSupported) return false;

    try {
      const messageChannel = new MessageChannel();
      
      const promise = new Promise((resolve, reject) => {
        messageChannel.port1.onmessage = event => {
          if (event.data.success) {
            resolve(true);
          } else {
            reject(new Error(event.data.error));
          }
        };
      });

      navigator.serviceWorker.controller?.postMessage({
        type: 'CACHE_MODEL',
        payload: { modelUrl }
      }, [messageChannel.port2]);

      await promise;
      logger.info('✅ Model cache requested:', modelUrl);
      return true;
    } catch (error) {
      logger.error('❌ Failed to cache model:', error);
      return false;
    }
  }

  /**
   * Clear model cache
   */
  async clearModelCache() {
    if (!this.isSupported) return false;

    try {
      const messageChannel = new MessageChannel();
      
      const promise = new Promise(resolve => {
        messageChannel.port1.onmessage = () => resolve();
      });

      navigator.serviceWorker.controller?.postMessage({
        type: 'CLEAR_MODEL_CACHE'
      }, [messageChannel.port2]);

      await promise;
      await this.updateCacheStats();
      logger.info('✅ Model cache cleared');
      return true;
    } catch (error) {
      logger.error('❌ Failed to clear model cache:', error);
      return false;
    }
  }

  /**
   * Get cache status from service worker
   */
  async updateCacheStats() {
    if (!this.isSupported || !navigator.serviceWorker.controller) return;

    try {
      const messageChannel = new MessageChannel();
      
      const promise = new Promise(resolve => {
        messageChannel.port1.onmessage = event => {
          resolve(event.data);
        };
      });

      navigator.serviceWorker.controller.postMessage({
        type: 'GET_CACHE_STATUS'
      }, [messageChannel.port2]);

      this.cacheStats = await promise;
      
      if (this.onCacheStatusChange) {
        this.onCacheStatusChange(this.cacheStats);
      }
      
      return this.cacheStats;
    } catch (error) {
      logger.error('❌ Failed to get cache status:', error);
      return this.cacheStats;
    }
  }

  /**
   * Check if app is ready for offline use
   */
  isOfflineReady() {
    return this.cacheStats.staticAssets > 0 && this.cacheStats.modelsCount > 0;
  }

  /**
   * Get estimated cache size
   */
  getEstimatedCacheSize() {
    // Rough estimates based on known file sizes
    const modelSizes = {
      'yolov10n.onnx': 9.3, // MB
      'yolov7-tiny_256x256.onnx': 24.9,
      'yolov7-tiny_320x320.onnx': 24.9,
      'yolov7-tiny_640x640.onnx': 25.0
    };
    
    let totalSize = 5; // Static assets estimate (MB)
    
    if (this.cacheStats.modelsCached) {
      this.cacheStats.modelsCached.forEach(url => {
        const filename = url.split('/').pop();
        totalSize += modelSizes[filename] || 20; // Default estimate
      });
    }
    
    return totalSize;
  }

  /**
   * Show update notification to user
   */
  showUpdateNotification() {
    if (!this.updateAvailable) return;

    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <div class="update-content">
        <span class="update-icon">🔄</span>
        <span class="update-message">App update available!</span>
        <button class="update-btn" id="apply-update">Update</button>
        <button class="update-dismiss" id="dismiss-update">×</button>
      </div>
    `;
    
    // Style the notification
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(notification);
    
    // Add event listeners
    notification.querySelector('#apply-update').addEventListener('click', () => {
      this.applyUpdate();
      notification.remove();
    });
    
    notification.querySelector('#dismiss-update').addEventListener('click', () => {
      notification.remove();
    });
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  /**
   * Show offline ready notification
   */
  showOfflineReadyNotification() {
    const notification = document.createElement('div');
    notification.className = 'offline-notification';
    notification.innerHTML = `
      <div class="offline-content">
        <span class="offline-icon">🔒</span>
        <span class="offline-message">App ready for offline use!</span>
        <button class="offline-dismiss" id="dismiss-offline">×</button>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
      padding: 15px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transform: translateX(400px);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Add dismiss handler
    notification.querySelector('#dismiss-offline').addEventListener('click', () => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  /**
   * Get service worker status for debugging
   */
  getStatus() {
    return {
      isSupported: this.isSupported,
      isRegistered: !!this.registration,
      updateAvailable: this.updateAvailable,
      isOfflineReady: this.isOfflineReady(),
      cacheStats: this.cacheStats,
      estimatedCacheSize: this.getEstimatedCacheSize()
    };
  }

  /**
   * Unregister service worker (for debugging)
   */
  async unregister() {
    if (!this.registration) return false;

    try {
      await this.registration.unregister();
      logger.info('🗑️ Service Worker unregistered');
      return true;
    } catch (error) {
      logger.error('❌ Failed to unregister Service Worker:', error);
      return false;
    }
  }
}