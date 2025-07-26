// Main application orchestrator
import { CameraManager } from './camera.js';
import { ModelManager } from './models.js';
import { InferenceEngine } from './inference.js';
import { PostProcessor } from './postprocess.js';

class ObjectDetectionApp {
  constructor() {
    this.camera = new CameraManager();
    this.modelManager = new ModelManager();
    this.inferenceEngine = new InferenceEngine();
    this.postProcessor = new PostProcessor();
    
    this.isLiveDetection = false;
    this.animationId = null;
    this.inferenceTime = 0;
    this.totalTime = 0;
    
    this.elements = {};
  }

  async initialize() {
    try {
      // Get DOM elements
      this.elements = {
        video: document.getElementById('webcam'),
        canvas: document.getElementById('detection-canvas'),
        loading: document.getElementById('loading'),
        captureBtn: document.getElementById('capture-btn'),
        liveBtn: document.getElementById('live-btn'),
        switchCameraBtn: document.getElementById('switch-camera-btn'),
        changeModelBtn: document.getElementById('change-model-btn'),
        resetBtn: document.getElementById('reset-btn'),
        currentModel: document.getElementById('current-model'),
        modelInferenceTime: document.getElementById('model-inference-time'),
        totalTime: document.getElementById('total-time'),
        overheadTime: document.getElementById('overhead-time'),
        modelFps: document.getElementById('model-fps'),
        totalFps: document.getElementById('total-fps'),
        overheadFps: document.getElementById('overhead-fps')
      };

      // Initialize camera
      await this.camera.initialize(this.elements.video, this.elements.canvas);
      
      // Load initial model
      await this.modelManager.loadCurrentModel();
      this.updateModelDisplay();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Hide loading
      this.elements.loading.style.display = 'none';
      
      console.log('Application initialized successfully');
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

    // Change model button
    this.elements.changeModelBtn.addEventListener('click', async () => {
      await this.changeModel();
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
    if (!this.camera.isReady()) return;

    try {
      const startTime = Date.now();
      await this.runSingleDetection();
      this.totalTime = Date.now() - startTime;
      this.updatePerformanceMetrics();
    } catch (error) {
      console.error('Capture failed:', error);
      this.showError('Capture failed: ' + error.message);
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
      this.postProcessor.postprocess(
        outputTensor,
        inferenceTime,
        overlayCtx,
        config.resolution,
        config.name,
        this.inferenceEngine.conf2color.bind(this.inferenceEngine)
      );
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
    if (!this.camera.isReady() || this.isLiveDetection) return;

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
      this.updatePerformanceMetrics();
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
    try {
      this.reset();
      await this.camera.switchCamera();
    } catch (error) {
      console.error('Failed to switch camera:', error);
      this.showError('Failed to switch camera: ' + error.message);
    }
  }

  async changeModel() {
    try {
      this.reset();
      this.elements.currentModel.textContent = 'Loading...';
      
      await this.modelManager.switchToNextModel();
      this.updateModelDisplay();
    } catch (error) {
      console.error('Failed to change model:', error);
      this.showError('Failed to change model: ' + error.message);
      this.updateModelDisplay(); // Restore previous model name
    }
  }

  reset() {
    this.stopLiveDetection();
    this.camera.reset();
    this.inferenceTime = 0;
    this.totalTime = 0;
    this.updatePerformanceMetrics();
  }

  updateModelDisplay() {
    const config = this.modelManager.getCurrentModelConfig();
    this.elements.currentModel.textContent = config.name;
  }

  updatePerformanceMetrics() {
    // Update time metrics
    this.elements.modelInferenceTime.textContent = `Model Inference Time: ${this.inferenceTime.toFixed()}ms`;
    this.elements.totalTime.textContent = `Total Time: ${this.totalTime.toFixed()}ms`;
    this.elements.overheadTime.textContent = `Overhead Time: +${(this.totalTime - this.inferenceTime).toFixed(2)}ms`;

    // Update FPS metrics
    const modelFps = this.inferenceTime > 0 ? (1000 / this.inferenceTime).toFixed(2) : '0';
    const totalFps = this.totalTime > 0 ? (1000 / this.totalTime).toFixed(2) : '0';
    const overheadFps = this.totalTime > 0 && this.inferenceTime > 0 
      ? (1000 * (1 / this.totalTime - 1 / this.inferenceTime)).toFixed(2) 
      : '0';

    this.elements.modelFps.textContent = `Model FPS: ${modelFps}fps`;
    this.elements.totalFps.textContent = `Total FPS: ${totalFps}fps`;
    this.elements.overheadFps.textContent = `Overhead FPS: ${overheadFps}fps`;
  }

  showError(message) {
    // Simple error display - could be enhanced with a proper modal
    alert(message);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Check for required APIs
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera access is not supported in this browser');
    return;
  }

  if (typeof ort === 'undefined') {
    alert('ONNX Runtime is not loaded');
    return;
  }


  // Initialize the application
  const app = new ObjectDetectionApp();
  await app.initialize();
});