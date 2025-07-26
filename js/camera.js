// Camera handling with getUserMedia API
export class CameraManager {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.context = null;
    this.stream = null;
    this.facingMode = 'environment'; // 'user' for front camera, 'environment' for back
    this.isVideoReady = false;
  }

  async initialize(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.context = canvasElement.getContext('2d', { willReadFrequently: true });
    
    // Set up video event listeners
    this.video.addEventListener('loadedmetadata', () => {
      this.onVideoReady();
    });

    // Check camera permissions before attempting to access
    const hasPermission = await this.checkCameraPermissions();
    if (!hasPermission) {
      throw new Error('Camera permission denied. Please allow camera access and refresh the page.');
    }

    await this.startCamera();
  }

  async checkCameraPermissions() {
    try {
      // Check if Permissions API is supported
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'camera' });
        return result.state === 'granted' || result.state === 'prompt';
      }
      
      // Fallback: try to enumerate devices (requires permission in some browsers)
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(device => device.kind === 'videoinput');
        return hasVideoInput;
      }
      
      // Final fallback: assume permission available if getUserMedia exists
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    } catch (error) {
      console.warn('Could not check camera permissions:', error);
      return true; // Assume permission available and let getUserMedia handle the error
    }
  }

  async startCamera() {
    try {
      // Stop existing stream if any
      if (this.stream) {
        this.stopCamera();
      }

      const constraints = {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      return new Promise((resolve) => {
        this.video.addEventListener('loadedmetadata', () => {
          resolve();
        }, { once: true });
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to access camera. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera access and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera device found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else {
        errorMessage += 'Please ensure camera permissions are granted.';
      }
      
      throw new Error(errorMessage);
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isVideoReady = false;
  }

  destroy() {
    this.stopCamera();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeTimeout) {
      cancelAnimationFrame(this.resizeTimeout);
      this.resizeTimeout = null;
    }
  }

  async switchCamera() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    await this.startCamera();
  }

  onVideoReady() {
    this.isVideoReady = true;
    this.updateCanvasSize();
  }

  updateCanvasSize() {
    if (!this.video || !this.canvas) return;
    
    const videoWidth = this.video.videoWidth;
    const videoHeight = this.video.videoHeight;
    
    if (videoWidth > 0 && videoHeight > 0) {
      // Use ResizeObserver for efficient resize handling if available
      if (!this.resizeObserver && window.ResizeObserver) {
        this.setupResizeObserver();
      }
      
      // Set canvas size to match video display size with device pixel ratio
      const rect = this.video.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set display size
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      
      // Set actual canvas size for crisp rendering
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      
      // Scale context to handle device pixel ratio
      this.context.scale(dpr, dpr);
      
      // Position canvas to overlay video
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.pointerEvents = 'none';
    }
  }

  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to throttle resize events
      if (this.resizeTimeout) return;
      
      this.resizeTimeout = requestAnimationFrame(() => {
        this.updateCanvasSize();
        this.resizeTimeout = null;
      });
    });
    
    this.resizeObserver.observe(this.video);
  }

  captureFrame() {
    if (!this.isVideoReady || !this.video || !this.context) {
      return null;
    }

    const canvas = this.canvas;
    const context = this.context;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Handle front camera mirroring
    if (this.facingMode === 'user') {
      context.setTransform(-1, 0, 0, 1, canvas.width, 0);
    }

    // Draw video frame to canvas
    context.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    
    // Reset transform
    if (this.facingMode === 'user') {
      context.setTransform(1, 0, 0, 1, 0, 0);
    }

    return context;
  }

  // Create a separate canvas for processing (to avoid interference with overlay)
  createProcessingCanvas(targetWidth, targetHeight) {
    if (!this.isVideoReady || !this.video) {
      return null;
    }

    const processingCanvas = document.createElement('canvas');
    processingCanvas.width = targetWidth;
    processingCanvas.height = targetHeight;
    const processingContext = processingCanvas.getContext('2d', { willReadFrequently: true });
    
    // Draw video frame to processing canvas
    processingContext.drawImage(this.video, 0, 0, targetWidth, targetHeight);
    
    return processingContext;
  }

  reset() {
    if (this.context && this.canvas) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  getVideoElement() {
    return this.video;
  }

  getCanvasElement() {
    return this.canvas;
  }

  isReady() {
    return this.isVideoReady;
  }
}