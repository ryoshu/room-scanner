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

    await this.startCamera();
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
      throw new Error('Failed to access camera. Please ensure camera permissions are granted.');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isVideoReady = false;
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
      // Set canvas size to match video display size
      const rect = this.video.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      
      // Position canvas to overlay video
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.pointerEvents = 'none';
    }
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