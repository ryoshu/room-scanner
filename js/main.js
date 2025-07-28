// Main application orchestrator
import { CameraManager } from './camera.js';
import { ModelManager } from './models.js';
import { InferenceEngine } from './inference.js';
import { PostProcessor } from './postprocess.js';
import { DependencyLoader } from './dependencyLoader.js';
import { UnifiedAssetLoader } from './unifiedLoader.js';
import { logger } from './logger.js';
import { CONSTANTS } from './constants.js';
import { ErrorBoundary } from './errorBoundary.js';
import { PerformanceMonitor } from './performanceMonitor.js';
import { ServiceWorkerManager } from './serviceWorkerManager.js';

class ObjectDetectionApp {
  constructor() {
    this.dependencyLoader = new DependencyLoader();
    this.camera = new CameraManager();
    this.modelManager = new ModelManager();
    this.inferenceEngine = new InferenceEngine();
    this.postProcessor = new PostProcessor();
    
    // Initialize service worker manager
    this.serviceWorkerManager = new ServiceWorkerManager();
    this.unifiedLoader = new UnifiedAssetLoader(this.serviceWorkerManager);
    
    this.isLiveDetection = false;
    this.animationId = null;
    this.inferenceTime = 0;
    this.totalTime = 0;
    
    // Detection log tracking
    this.detectedObjects = new Set();
    
    // Debouncing states
    this.isSwitchingCamera = false;
    this.isCapturing = false;
    this.isLoading = false;
    this.lastCameraSwitchTime = 0;
    
    this.elements = {};
    
    // Error boundaries for critical components
    this.errorBoundaries = {
      camera: new ErrorBoundary('CameraComponent', this.recoverCamera.bind(this)),
      inference: new ErrorBoundary('InferenceComponent', this.recoverInference.bind(this)),
      detection: new ErrorBoundary('DetectionComponent', this.recoverDetection.bind(this))
    };
    
    // Performance monitoring
    this.performanceMonitor = new PerformanceMonitor();
  }

  async initialize() {
    try {
      // Get DOM elements
      this.elements = {
        video: document.getElementById('webcam'),
        canvas: document.getElementById('detection-canvas'),
        loading: document.getElementById('loading'),
        modelLoading: document.getElementById('model-loading'),
        loadingProgress: document.getElementById('loading-progress'),
        loadingPercentage: document.getElementById('loading-percentage'),
        loadingDetails: document.getElementById('loading-details'),
        captureBtn: document.getElementById('capture-btn'),
        liveBtn: document.getElementById('live-btn'),
        switchCameraBtn: document.getElementById('switch-camera-btn'),
        resetBtn: document.getElementById('reset-btn'),
        detectionList: document.getElementById('detection-list'),
        
        // Cache UI elements
        cacheStatus: document.getElementById('cache-status'),
        cacheClose: document.getElementById('cache-close'),
        swStatus: document.getElementById('sw-status'),
        offlineStatus: document.getElementById('offline-status'),
        modelsCached: document.getElementById('models-cached'),
        cacheSize: document.getElementById('cache-size'),
        clearCacheBtn: document.getElementById('clear-cache-btn'),
        updateCacheBtn: document.getElementById('update-cache-btn')
      };
      
      // Initialize service worker first
      logger.info('🔧 Initializing Service Worker...');
      const swInitialized = await this.serviceWorkerManager.initialize();
      
      if (swInitialized) {
        this.setupServiceWorkerCallbacks();
        logger.info('✅ Service Worker initialized successfully');
      } else {
        logger.warn('⚠️ Service Worker initialization failed - continuing without PWA features');
      }
      
      // Set up unified loader progress callback
      this.unifiedLoader.setProgressCallback((progress, message) => {
        this.updateLoadingProgress(progress, message);
      });

      // Start loading sequence
      this.isLoading = true;
      this.disableAllButtons();
      this.showModelLoadingBar();
      
      logger.info('🚀 Starting unified asset loading...');
      
      // Load ONNX Runtime with progress
      await this.unifiedLoader.loadOnnxRuntime();
      
      // Initialize camera (no progress needed)
      await this.camera.initialize(this.elements.video, this.elements.canvas);
      
      // Load initial model with progress
      const config = this.modelManager.getCurrentModelConfig();
      const modelData = await this.unifiedLoader.loadModel(config.filename, config.expectedSize);
      
      // Create ONNX session from loaded data
      await this.createOnnxSession(modelData, config);
      
      // Set up event listeners
      this.setupEventListeners();
      this.setupCacheUI();
      
      // Finish loading
      this.isLoading = false;
      this.enableAllButtons();
      this.hideModelLoadingBar();
      this.hideLoadingOverlay();
      
      // Clean up progress tracking
      this.lastProgress = undefined;
      this.lastMessage = '';
      
      logger.info('✅ Application initialized successfully');
      this.logDependencyStatus();
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      this.showError('Failed to initialize application: ' + error.message);
    }
  }

  setupEventListeners() {
    // Capture photo button
    this.elements.captureBtn.addEventListener('click', () => {
      this.capturePhoto();
    });

    // Live detection toggle button
    this.elements.liveBtn.addEventListener('click', () => {
      this.toggleLiveDetection();
    });

    // Switch camera button
    this.elements.switchCameraBtn.addEventListener('click', async () => {
      await this.switchCamera();
    });


    // Reset button
    this.elements.resetBtn.addEventListener('click', () => {
      this.reset();
    });

    // Handle window visibility change (pause when tab is hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isLiveDetection) {
        this.stopLiveDetection();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      // Press 'P' to toggle performance monitor
      if (event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        this.togglePerformanceMonitor();
        event.preventDefault();
      }
      // Press 'R' to reset error boundaries
      if (event.key.toLowerCase() === 'r' && event.ctrlKey) {
        this.resetErrorBoundaries();
        event.preventDefault();
      }
      // Press 'S' to show service worker status
      if (event.key.toLowerCase() === 's' && event.ctrlKey && event.shiftKey) {
        console.log('🔧 Service Worker Status:', this.serviceWorkerManager.getStatus());
        console.log('📱 App Status:', this.getAppStatus());
        this.showError('Service worker status logged to console - Ctrl+Shift+S');
        event.preventDefault();
      }
      // Press 'C' to toggle cache status UI
      if (event.key.toLowerCase() === 'c' && event.ctrlKey && !event.altKey && !event.metaKey) {
        this.toggleCacheStatus();
        event.preventDefault();
      }
    });
  }

  async capturePhoto() {
    if (!this.camera.isReady() || this.isCapturing || this.isLoading) return;

    const boundCapturePhoto = this.errorBoundaries.detection.wrap(async () => {
      this.isCapturing = true;
      this.elements.captureBtn.disabled = true;
      this.elements.captureBtn.textContent = 'Processing...';
      
      const startTime = Date.now();
      await this.runSingleDetection();
      this.totalTime = Date.now() - startTime;
    }, this);

    const result = await boundCapturePhoto();
    
    // Always reset button state
    this.isCapturing = false;
    this.elements.captureBtn.disabled = false;
    this.elements.captureBtn.textContent = 'Capture Photo';
    
    if (result === null) {
      this.showError('Capture failed - please try again');
    }
  }

  async runSingleDetection() {
    const config = this.modelManager.getCurrentModelConfig();
    
    // Create processing canvas
    const processingCtx = this.camera.createProcessingCanvas(
      config.resolution[0], 
      config.resolution[1]
    );
    
    if (!processingCtx) return;

    // Preprocess image
    const preprocessedData = this.inferenceEngine.preprocess(
      processingCtx, 
      config.resolution
    );

    // Run inference
    const [outputTensor, inferenceTime] = await this.modelManager.runInference(preprocessedData);
    this.inferenceTime = inferenceTime;

    // Postprocess and draw results
    const overlayCtx = this.camera.captureFrame(); // Get overlay canvas context
    if (overlayCtx) {
      // Get display dimensions for proper coordinate scaling
      const displayDimensions = this.camera.getDisplayDimensions();
      
      
      const detectedObjectNames = this.postProcessor.postprocess(
        outputTensor,
        inferenceTime,
        overlayCtx,
        config.resolution,
        config.name,
        this.inferenceEngine.conf2color.bind(this.inferenceEngine),
        displayDimensions
      );
      
      // Update detection log with newly detected objects
      if (detectedObjectNames && detectedObjectNames.length > 0) {
        this.updateDetectionLog(detectedObjectNames);
      }
    }
  }

  toggleLiveDetection() {
    if (this.isLiveDetection) {
      this.stopLiveDetection();
    } else {
      this.startLiveDetection();
    }
  }

  startLiveDetection() {
    if (!this.camera.isReady() || this.isLiveDetection || this.isLoading) return;

    this.isLiveDetection = true;
    this.elements.liveBtn.textContent = 'Stop Live Detection';
    this.elements.liveBtn.classList.add('active');
    
    // Start performance monitoring for live detection
    this.performanceMonitor.start();
    this.performanceMonitor.createDisplay();
    
    this.runLiveDetectionLoop();
  }

  stopLiveDetection() {
    this.isLiveDetection = false;
    this.elements.liveBtn.textContent = 'Live Detection';
    this.elements.liveBtn.classList.remove('active');
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Stop performance monitoring and log summary
    this.performanceMonitor.stop();
    this.performanceMonitor.logSummary();
    this.performanceMonitor.hideDisplay();
  }

  async runLiveDetectionLoop() {
    if (!this.isLiveDetection) return;

    try {
      const startTime = Date.now();
      await this.runSingleDetection();
      this.totalTime = Date.now() - startTime;
      
      // Record frame for performance monitoring
      this.performanceMonitor.recordFrame(this.inferenceTime, this.totalTime);
    } catch (error) {
      logger.error('Live detection error:', error);
    }

    // Continue loop
    if (this.isLiveDetection) {
      this.animationId = requestAnimationFrame(() => {
        this.runLiveDetectionLoop();
      });
    }
  }

  async switchCamera() {
    // Check if already switching or loading
    if (this.isSwitchingCamera || this.isLoading) return;
    
    // Check cooldown period
    const now = Date.now();
    const timeSinceLastSwitch = now - this.lastCameraSwitchTime;
    if (timeSinceLastSwitch < CONSTANTS.CAMERA_SWITCH_COOLDOWN_MS) {
      logger.debug('Camera switch blocked due to cooldown');
      return;
    }

    const boundSwitchCamera = this.errorBoundaries.camera.wrap(async () => {
      this.isSwitchingCamera = true;
      this.lastCameraSwitchTime = now;
      this.elements.switchCameraBtn.disabled = true;
      this.elements.switchCameraBtn.textContent = 'Switching...';
      
      this.reset();
      
      // Add timeout protection for camera switching
      const switchPromise = this.camera.switchCamera();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Camera switch timeout')), CONSTANTS.CAMERA_SWITCH_TIMEOUT_MS);
      });
      
      await Promise.race([switchPromise, timeoutPromise]);
    }, this);

    const result = await boundSwitchCamera();
    
    // Always reset button state
    this.isSwitchingCamera = false;
    this.elements.switchCameraBtn.disabled = false;
    this.elements.switchCameraBtn.textContent = 'Switch Camera';
    
    if (result === null) {
      this.showError('Failed to switch camera - please try again');
    }
  }


  reset() {
    this.stopLiveDetection();
    this.camera.reset();
    this.inferenceTime = 0;
    this.totalTime = 0;
    this.clearDetectionLog();
  }

  /**
   * Update the detection log with newly detected objects
   */
  updateDetectionLog(detectedObjectNames) {
    let newObjectsAdded = false;
    
    // Add new objects to the set
    for (const objectName of detectedObjectNames) {
      if (!this.detectedObjects.has(objectName)) {
        this.detectedObjects.add(objectName);
        newObjectsAdded = true;
      }
    }
    
    // Update the UI if new objects were added
    if (newObjectsAdded) {
      this.renderDetectionLog();
    }
  }

  /**
   * Render the detection log in the UI
   */
  renderDetectionLog() {
    if (!this.elements.detectionList) return;
    
    // Clear existing content
    this.elements.detectionList.innerHTML = '';
    
    if (this.detectedObjects.size === 0) {
      // Show "no detections" message
      const noDetectionsItem = document.createElement('li');
      noDetectionsItem.className = 'no-detections';
      noDetectionsItem.textContent = 'No objects detected yet';
      this.elements.detectionList.appendChild(noDetectionsItem);
    } else {
      // Create list items for each detected object
      const sortedObjects = Array.from(this.detectedObjects).sort();
      for (const objectName of sortedObjects) {
        const listItem = document.createElement('li');
        listItem.className = 'detection-item';
        listItem.textContent = objectName;
        listItem.setAttribute('title', `Detected: ${objectName}`);
        this.elements.detectionList.appendChild(listItem);
      }
    }
  }

  /**
   * Clear the detection log
   */
  clearDetectionLog() {
    this.detectedObjects.clear();
    this.renderDetectionLog();
  }


  showLoadingOverlay() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'block';
      this.elements.loading.style.opacity = '1';
    }
  }

  showLoadingBar() {
    this.loadingBarActive = true;
    if (this.elements.loadingProgress && this.elements.loadingPercentage) {
      this.elements.loadingProgress.parentElement.style.display = 'flex';
      this.elements.loadingPercentage.style.display = 'block';
    }
  }

  hideLoadingBar() {
    this.loadingBarActive = false;
    if (this.elements.loadingProgress && this.elements.loadingPercentage) {
      this.elements.loadingProgress.parentElement.style.display = 'none';
      this.elements.loadingPercentage.style.display = 'none';
    }
  }

  hideLoadingOverlay() {
    if (this.elements.loading) {
      // Reset progress callback when hiding
      this.modelManager.setProgressCallback(null);
      this.loadingBarActive = false;
      
      // Add fade out animation
      this.elements.loading.style.transition = 'opacity 0.5s ease-out';
      this.elements.loading.style.opacity = '0';
      
      // Hide completely after animation
      setTimeout(() => {
        this.elements.loading.style.display = 'none';
        this.elements.loading.style.transition = '';
      }, CONSTANTS.LOADING_OVERLAY_FADE_MS);
    }
  }

  /**
   * Create ONNX session from model data
   */
  async createOnnxSession(modelData, config) {
    // Set ONNX Runtime configuration  
    window.ort.env.wasm.wasmPaths = CONSTANTS.WASM_PATHS;
    
    // Create session from data or URL
    this.modelManager.currentSession = await window.ort.InferenceSession.create(modelData, {
      executionProviders: CONSTANTS.EXECUTION_PROVIDERS,
      graphOptimizationLevel: CONSTANTS.GRAPH_OPTIMIZATION_LEVEL,
    });
    
    // Cache the session
    this.modelManager.loadedModels.set(config.filename, this.modelManager.currentSession);
    
    logger.info(`✅ Model loaded successfully: ${config.filename}`);
    logger.debug('📥 Input names:', this.modelManager.currentSession.inputNames);
    logger.debug('📤 Output names:', this.modelManager.currentSession.outputNames);
  }

  /**
   * Update loading progress in model info area (optimized)
   */
  updateLoadingProgress(percentage, message) {
    // Cache last values to avoid unnecessary DOM updates
    if (this.lastProgress === undefined) {
      this.lastProgress = -1;
      this.lastMessage = '';
    }
    
    const roundedPercentage = Math.round(percentage);
    
    // Only update if values actually changed
    if (roundedPercentage !== this.lastProgress || message !== this.lastMessage) {
      // Batch DOM updates in next frame
      requestAnimationFrame(() => {
        if (this.elements.loadingDetails && message !== this.lastMessage) {
          this.elements.loadingDetails.textContent = message;
        }
        if (this.elements.loadingProgress && roundedPercentage !== this.lastProgress) {
          this.elements.loadingProgress.style.width = `${percentage}%`;
        }
        if (this.elements.loadingPercentage && roundedPercentage !== this.lastProgress) {
          this.elements.loadingPercentage.textContent = `${roundedPercentage}%`;
        }
      });
      
      this.lastProgress = roundedPercentage;
      this.lastMessage = message;
    }
  }

  showModelLoadingBar() {
    if (this.elements.modelLoading) {
      this.elements.modelLoading.style.display = 'block';
    }
  }

  hideModelLoadingBar() {
    if (this.elements.modelLoading) {
      this.elements.modelLoading.style.display = 'none';
    }
  }

  /**
   * Optimized button state management
   */
  disableAllButtons() {
    if (!this.buttonElements) {
      // Cache button elements for performance
      this.buttonElements = [
        this.elements.captureBtn,
        this.elements.liveBtn,
        this.elements.switchCameraBtn,
        this.elements.resetBtn
      ].filter(Boolean); // Remove null/undefined elements
    }
    
    // Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
      this.buttonElements.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = CONSTANTS.DISABLED_OPACITY;
        btn.style.cursor = 'not-allowed';
      });
    });
  }

  enableAllButtons() {
    if (!this.buttonElements) return; // Safety check
    
    // Use requestAnimationFrame to batch DOM updates
    requestAnimationFrame(() => {
      this.buttonElements.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = CONSTANTS.FULL_OPACITY;
        btn.style.cursor = 'pointer';
      });
    });
  }

  /**
   * Cleanup resources to prevent memory leaks
   */
  cleanup() {
    // Stop any ongoing live detection
    this.stopLiveDetection();
    
    // Clean up camera resources
    if (this.camera) {
      this.camera.reset();
    }
    
    // Clean up model resources
    if (this.modelManager && this.modelManager.currentSession) {
      // ONNX sessions are automatically cleaned up by the runtime
      this.modelManager.currentSession = null;
    }
    
    // Clean up unified loader
    if (this.unifiedLoader) {
      this.unifiedLoader.cleanup();
    }
    
    // Reset progress tracking
    this.lastProgress = undefined;
    this.lastMessage = '';
    this.buttonElements = null;
    
    logger.debug('🧹 Application resources cleaned up');
  }

  logDependencyStatus() {
    const status = this.dependencyLoader.getStatus();
    logger.debug('📊 Dependency Status:', status);
    
    if (status.onnxRuntimeAvailable) {
      logger.info(`✅ ONNX Runtime ${status.onnxRuntimeVersion} loaded successfully`);
    } else {
      logger.warn('⚠️ ONNX Runtime not available');
    }
  }

  showError(message) {
    // Remove any existing error messages
    const existingError = document.querySelector('.error-toast');
    if (existingError) {
      existingError.remove();
    }

    // Create error toast
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">${message}</span>
        <button class="error-close" aria-label="Close error message">×</button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Add close functionality
    const closeBtn = errorDiv.querySelector('.error-close');
    closeBtn.addEventListener('click', () => errorDiv.remove());
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, CONSTANTS.ERROR_TOAST_TIMEOUT_MS);
    
    // Announce to screen readers
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');
  }

  /**
   * Recovery methods for error boundaries
   */
  async recoverCamera(error) {
    logger.info('Attempting camera recovery...');
    
    try {
      // Stop current operations
      this.stopLiveDetection();
      
      // Reinitialize camera
      await this.camera.initialize(this.elements.video, this.elements.canvas);
      
      logger.info('Camera recovery successful');
      return true;
    } catch (recoveryError) {
      logger.error('Camera recovery failed:', recoveryError);
      throw recoveryError;
    }
  }

  async recoverInference(error) {
    logger.info('Attempting inference recovery...');
    
    try {
      // Clean up inference engine cache
      this.inferenceEngine.cleanup();
      
      // Try to reload the current model
      const config = this.modelManager.getCurrentModelConfig();
      if (config) {
        // Clear model cache and try to reload
        this.modelManager.clearCache();
        
        // Force garbage collection if available
        if (typeof gc === 'function') {
          gc();
        }
      }
      
      logger.info('Inference recovery successful');
      return true;
    } catch (recoveryError) {
      logger.error('Inference recovery failed:', recoveryError);
      throw recoveryError;
    }
  }

  async recoverDetection(error) {
    logger.info('Attempting detection recovery...');
    
    try {
      // Stop live detection and reset
      this.reset();
      
      // Clear detection log
      this.clearDetectionLog();
      
      // Ensure camera is still ready
      if (!this.camera.isReady()) {
        await this.camera.initialize(this.elements.video, this.elements.canvas);
      }
      
      logger.info('Detection recovery successful');
      return true;
    } catch (recoveryError) {
      logger.error('Detection recovery failed:', recoveryError);
      throw recoveryError;
    }
  }

  /**
   * Get error boundary statistics for debugging
   */
  getErrorStats() {
    const stats = {};
    for (const [name, boundary] of Object.entries(this.errorBoundaries)) {
      stats[name] = boundary.getStats();
    }
    return stats;
  }

  /**
   * Toggle performance monitor display
   */
  togglePerformanceMonitor() {
    if (this.performanceMonitor.displayElement) {
      this.performanceMonitor.hideDisplay();
      logger.info('Performance monitor hidden (Press P to show)');
    } else {
      this.performanceMonitor.createDisplay();
      logger.info('Performance monitor shown (Press P to hide)');
    }
  }

  /**
   * Reset all error boundaries
   */
  resetErrorBoundaries() {
    for (const [name, boundary] of Object.entries(this.errorBoundaries)) {
      boundary.reset();
    }
    logger.info('All error boundaries reset');
    this.showError('Error boundaries reset - Ctrl+R pressed');
  }

  /**
   * Set up service worker event callbacks
   */
  setupServiceWorkerCallbacks() {
    // Handle app updates
    this.serviceWorkerManager.onUpdateAvailable = () => {
      logger.info('🔄 App update available');
      this.serviceWorkerManager.showUpdateNotification();
    };

    // Handle offline ready state
    this.serviceWorkerManager.onOfflineReady = () => {
      logger.info('🔒 App is ready for offline use');
      this.serviceWorkerManager.showOfflineReadyNotification();
    };

    // Handle cache status changes
    this.serviceWorkerManager.onCacheStatusChange = (cacheStats) => {
      logger.debug('📊 Cache status updated:', cacheStats);
      
      // Update performance monitor if available
      if (this.performanceMonitor) {
        this.performanceMonitor.cacheStats = cacheStats;
      }
    };
  }

  /**
   * Get comprehensive app status including service worker
   */
  getAppStatus() {
    return {
      app: {
        isLiveDetection: this.isLiveDetection,
        isLoading: this.isLoading,
        modelLoaded: !!this.modelManager.currentSession
      },
      serviceWorker: this.serviceWorkerManager.getStatus(),
      performance: this.performanceMonitor.getMetrics(),
      errorBoundaries: this.getErrorStats()
    };
  }

  /**
   * Set up cache UI event listeners
   */
  setupCacheUI() {
    if (!this.elements.cacheClose || !this.elements.clearCacheBtn || !this.elements.updateCacheBtn) {
      return; // Cache UI not available
    }

    // Close button
    this.elements.cacheClose.addEventListener('click', () => {
      this.hideCacheStatus();
    });

    // Clear cache button
    this.elements.clearCacheBtn.addEventListener('click', async () => {
      await this.clearCache();
    });

    // Update cache button
    this.elements.updateCacheBtn.addEventListener('click', async () => {
      await this.updateCache();
    });

    // Update cache status initially
    this.updateCacheStatusUI();
  }

  /**
   * Toggle cache status UI visibility
   */
  toggleCacheStatus() {
    if (!this.elements.cacheStatus) return;

    if (this.elements.cacheStatus.style.display === 'none' || !this.elements.cacheStatus.style.display) {
      // this.showCacheStatus();
      this.hideCacheStatus();
    } else {
      this.hideCacheStatus();
    }
  }

  /**
   * Show cache status UI
   */
  showCacheStatus() {
    if (!this.elements.cacheStatus) return;

    this.elements.cacheStatus.style.display = 'block';
    this.updateCacheStatusUI();
    logger.info('📱 Cache status UI shown (Press Ctrl+C to hide)');
  }

  /**
   * Hide cache status UI
   */
  hideCacheStatus() {
    if (!this.elements.cacheStatus) return;

    this.elements.cacheStatus.style.display = 'none';
    logger.info('📱 Cache status UI hidden');
  }

  /**
   * Update cache status UI with current data
   */
  async updateCacheStatusUI() {
    if (!this.serviceWorkerManager.isSupported) {
      this.elements.swStatus.textContent = 'Not Supported';
      this.elements.offlineStatus.textContent = 'No';
      this.elements.modelsCached.textContent = '0';
      this.elements.cacheSize.textContent = '0 MB';
      return;
    }

    try {
      const status = this.serviceWorkerManager.getStatus();
      const cacheStats = await this.serviceWorkerManager.updateCacheStats();

      // Update UI elements
      this.elements.swStatus.textContent = status.isRegistered ? 'Active' : 'Loading...';
      this.elements.offlineStatus.textContent = status.isOfflineReady ? 'Yes' : 'No';
      this.elements.modelsCached.textContent = status.cacheStats.modelsCount.toString();
      this.elements.cacheSize.textContent = `${status.estimatedCacheSize.toFixed(1)} MB`;

      // Update button states
      this.elements.clearCacheBtn.disabled = !status.isRegistered || status.cacheStats.modelsCount === 0;
      this.elements.updateCacheBtn.disabled = !status.isRegistered;

    } catch (error) {
      logger.error('Failed to update cache status UI:', error);
    }
  }

  /**
   * Clear cache
   */
  async clearCache() {
    if (!this.serviceWorkerManager.isSupported) return;

    try {
      this.elements.clearCacheBtn.disabled = true;
      this.elements.clearCacheBtn.textContent = 'Clearing...';

      await this.serviceWorkerManager.clearModelCache();
      await this.updateCacheStatusUI();

      this.showError('Cache cleared successfully');
      logger.info('🗑️ Cache cleared by user');

    } catch (error) {
      logger.error('Failed to clear cache:', error);
      this.showError('Failed to clear cache: ' + error.message);
    } finally {
      this.elements.clearCacheBtn.disabled = false;
      this.elements.clearCacheBtn.textContent = 'Clear Cache';
    }
  }

  /**
   * Update cache (check for updates)
   */
  async updateCache() {
    if (!this.serviceWorkerManager.isSupported) return;

    try {
      this.elements.updateCacheBtn.disabled = true;
      this.elements.updateCacheBtn.textContent = 'Updating...';

      await this.serviceWorkerManager.checkForUpdates();
      await this.updateCacheStatusUI();

      if (this.serviceWorkerManager.updateAvailable) {
        this.showError('App update available - refresh to update');
      } else {
        this.showError('Cache is up to date');
      }

      logger.info('🔄 Cache update check completed');

    } catch (error) {
      logger.error('Failed to update cache:', error);
      this.showError('Failed to update cache: ' + error.message);
    } finally {
      this.elements.updateCacheBtn.disabled = false;
      this.elements.updateCacheBtn.textContent = 'Update Cache';
    }
  }
}

// Validate browser capabilities
function validateBrowserSupport() {
  const errors = [];
  
  // Check for required APIs
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    errors.push('Camera access (getUserMedia) is not supported in this browser');
  }
  
  if (!window.OffscreenCanvas && !document.createElement('canvas').getContext) {
    errors.push('Canvas API is not supported');
  }
  
  if (!window.WebAssembly) {
    errors.push('WebAssembly is not supported (required for ONNX Runtime)');
  }
  
  // Note: ONNX Runtime check moved to dependency loading phase
  
  if (!window.requestAnimationFrame) {
    errors.push('RequestAnimationFrame is not supported');
  }
  
  return errors;
}

// Show browser compatibility error
function showCompatibilityError(errors) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'compatibility-error';
  errorDiv.innerHTML = `
    <div class="error-content">
      <h2>Browser Compatibility Issues</h2>
      <p>Your browser does not support the following required features:</p>
      <ul>
        ${errors.map(error => `<li>${error}</li>`).join('')}
      </ul>
      <p>Please try using a modern browser like Chrome, Firefox, Safari, or Edge.</p>
    </div>
  `;
  
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Validate browser support (ONNX Runtime check moved to app initialization)
    const compatibilityErrors = validateBrowserSupport();
    if (compatibilityErrors.length > 0) {
      showCompatibilityError(compatibilityErrors);
      return;
    }

    // Initialize the application with error boundary
    const app = new ObjectDetectionApp();
    await app.initialize();
    
    // Add global error handler for unhandled errors
    window.addEventListener('error', (event) => {
      logger.error('Global error:', event.error);
      app.showError('An unexpected error occurred. Please refresh the page.');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      logger.error('Unhandled promise rejection:', event.reason);
      app.showError('An unexpected error occurred. Please refresh the page.');
      event.preventDefault();
    });
    
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    
    // Fallback error display if app.showError is not available
    const errorDiv = document.createElement('div');
    errorDiv.className = 'init-error';
    errorDiv.innerHTML = `
      <div class="error-content">
        <h2>Initialization Failed</h2>
        <p>${error.message}</p>
        <button onclick="location.reload()">Reload Page</button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
  }
});