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
      
      // Get video display dimensions
      const rect = this.video.getBoundingClientRect();
      
      // Store dimensions for coordinate calculations
      this.displayWidth = rect.width;
      this.displayHeight = rect.height;
      this.videoWidth = videoWidth;
      this.videoHeight = videoHeight;
      
      // Set canvas display size to match video element
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      
      // Set canvas buffer size to display size for 1:1 coordinate mapping
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      
      // Position canvas to overlay video
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.pointerEvents = 'none';
      
      // Reset any existing transforms
      this.context.setTransform(1, 0, 0, 1, 0, 0);
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
    
    // Clear canvas with full dimensions
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save current state
    context.save();
    
    // Handle front camera mirroring
    if (this.facingMode === 'user') {
      context.scale(-1, 1);
      context.translate(-canvas.width, 0);
    }

    // Note: We don't draw the video frame here anymore
    // The overlay canvas is just for bounding boxes
    
    // Restore state
    context.restore();

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

  getDisplayDimensions() {
    return {
      width: this.displayWidth || 0,
      height: this.displayHeight || 0,
      devicePixelRatio: this.devicePixelRatio || 1
    };
  }

  getVideoAspectRatio() {
    if (!this.video || !this.video.videoWidth || !this.video.videoHeight) {
      return 16/9; // Default aspect ratio
    }
    return this.video.videoWidth / this.video.videoHeight;
  }
}