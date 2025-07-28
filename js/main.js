// Main application orchestrator
import { CameraManager } from './camera.js';
import { ModelManager } from './models.js';
import { InferenceEngine } from './inference.js';
import { PostProcessor } from './postprocess.js';
import { DependencyLoader } from './dependencyLoader.js';
import { UnifiedAssetLoader } from './unifiedLoader.js';

class ObjectDetectionApp {
  constructor() {
    this.dependencyLoader = new DependencyLoader();
    this.camera = new CameraManager();
    this.modelManager = new ModelManager();
    this.inferenceEngine = new InferenceEngine();
    this.postProcessor = new PostProcessor();
    this.unifiedLoader = new UnifiedAssetLoader();
    
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
    
    this.elements = {};
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
        detectionList: document.getElementById('detection-list')
      };
      
      // Set up unified loader progress callback
      this.unifiedLoader.setProgressCallback((progress, message) => {
        this.updateLoadingProgress(progress, message);
      });

      // Start loading sequence
      this.isLoading = true;
      this.disableAllButtons();
      this.showModelLoadingBar();
      
      console.log('🚀 Starting unified asset loading...');
      
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
      
      // Finish loading
      this.isLoading = false;
      this.enableAllButtons();
      this.hideModelLoadingBar();
      this.hideLoadingOverlay();
      
      // Clean up progress tracking
      this.lastProgress = undefined;
      this.lastMessage = '';
      
      console.log('✅ Application initialized successfully');
      this.logDependencyStatus();
    } catch (error) {
      console.error('Failed to initialize application:', error);
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
  }

  async capturePhoto() {
    if (!this.camera.isReady() || this.isCapturing || this.isLoading) return;

    try {
      this.isCapturing = true;
      this.elements.captureBtn.disabled = true;
      this.elements.captureBtn.textContent = 'Processing...';
      
      const startTime = Date.now();
      await this.runSingleDetection();
      this.totalTime = Date.now() - startTime;
    } catch (error) {
      console.error('Capture failed:', error);
      this.showError('Capture failed: ' + error.message);
    } finally {
      this.isCapturing = false;
      this.elements.captureBtn.disabled = false;
      this.elements.captureBtn.textContent = 'Capture Photo';
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
      
      // Get YOLO-World configuration if applicable
      /* YOLO-World functionality commented out
      const yoloWorldConfig = this.modelManager.isCurrentModelYoloWorld() 
        ? this.modelManager.getYoloWorldConfig() 
        : null;
      */
      
      const detectedObjectNames = this.postProcessor.postprocess(
        outputTensor,
        inferenceTime,
        overlayCtx,
        config.resolution,
        config.name,
        this.inferenceEngine.conf2color.bind(this.inferenceEngine),
        displayDimensions
        /* yoloWorldConfig */
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
  }

  async runLiveDetectionLoop() {
    if (!this.isLiveDetection) return;

    try {
      const startTime = Date.now();
      await this.runSingleDetection();
      this.totalTime = Date.now() - startTime;
    } catch (error) {
      console.error('Live detection error:', error);
    }

    // Continue loop
    if (this.isLiveDetection) {
      this.animationId = requestAnimationFrame(() => {
        this.runLiveDetectionLoop();
      });
    }
  }

  async switchCamera() {
    if (this.isSwitchingCamera || this.isLoading) return;

    try {
      this.isSwitchingCamera = true;
      this.elements.switchCameraBtn.disabled = true;
      this.elements.switchCameraBtn.textContent = 'Switching...';
      
      this.reset();
      await this.camera.switchCamera();
    } catch (error) {
      console.error('Failed to switch camera:', error);
      this.showError('Failed to switch camera: ' + error.message);
    } finally {
      this.isSwitchingCamera = false;
      this.elements.switchCameraBtn.disabled = false;
      this.elements.switchCameraBtn.textContent = 'Switch Camera';
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

  /**
   * Update loading progress in model info area (optimized)
   */
  updateLoadingProgress(percentage, message) {
    // Always update the message
    if (this.elements.loadingDetails) {
      this.elements.loadingDetails.textContent = message;
    }
    
    // Only update progress bar if it's active
    if (this.loadingBarActive) {
      if (this.elements.loadingProgress) {
        this.elements.loadingProgress.style.width = `${percentage}%`;
      }
      if (this.elements.loadingPercentage) {
        this.elements.loadingPercentage.textContent = `${Math.round(percentage)}%`;
      }
    }
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
      }, 500);
    }
  }

  /**
   * Create ONNX session from model data
   */
  async createOnnxSession(modelData, config) {
    // Set ONNX Runtime configuration  
    ort.env.wasm.wasmPaths = './js/';
    
    // Create session from data or URL
    this.modelManager.currentSession = await ort.InferenceSession.create(modelData, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    
    // Cache the session
    this.modelManager.loadedModels.set(config.filename, this.modelManager.currentSession);
    
    console.log(`✅ Model loaded successfully: ${config.filename}`);
    console.log('📥 Input names:', this.modelManager.currentSession.inputNames);
    console.log('📤 Output names:', this.modelManager.currentSession.outputNames);
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

  /**
   * Show/hide loading states
   */
  showLoadingOverlay() {
    if (this.elements.loading) {
      this.elements.loading.style.display = 'block';
      this.elements.loading.style.opacity = '1';
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

  hideLoadingOverlay() {
    if (this.elements.loading) {
      this.elements.loading.style.transition = 'opacity 0.5s ease-out';
      this.elements.loading.style.opacity = '0';
      
      setTimeout(() => {
        this.elements.loading.style.display = 'none';
        this.elements.loading.style.transition = '';
      }, 500);
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
        btn.style.opacity = '0.5';
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
        btn.style.opacity = '1';
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
    
    console.log('🧹 Application resources cleaned up');
  }

  logDependencyStatus() {
    const status = this.dependencyLoader.getStatus();
    console.log('📊 Dependency Status:', status);
    
    if (status.onnxRuntimeAvailable) {
      console.log(`✅ ONNX Runtime ${status.onnxRuntimeVersion} loaded successfully`);
    } else {
      console.warn('⚠️ ONNX Runtime not available');
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
    }, 5000);
    
    // Announce to screen readers
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');
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
      console.error('Global error:', event.error);
      app.showError('An unexpected error occurred. Please refresh the page.');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      app.showError('An unexpected error occurred. Please refresh the page.');
      event.preventDefault();
    });
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
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