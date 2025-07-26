// Image preprocessing and tensor operations
export class InferenceEngine {
  constructor() {
    // Canvas cache for different resolutions to avoid repeated creation
    this.processingCanvasCache = new Map();
    this.maxCacheSize = 5; // Limit cache size to prevent memory leaks
  }

  // Get or create cached canvas for target dimensions
  getCachedCanvas(targetWidth, targetHeight) {
    const key = `${targetWidth}x${targetHeight}`;
    
    if (!this.processingCanvasCache.has(key)) {
      // Check cache size limit
      if (this.processingCanvasCache.size >= this.maxCacheSize) {
        // Remove oldest entry (first one in Map)
        const oldestKey = this.processingCanvasCache.keys().next().value;
        this.processingCanvasCache.delete(oldestKey);
      }
      
      // Create new canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      this.processingCanvasCache.set(key, canvas);
    }
    
    return this.processingCanvasCache.get(key);
  }

  // Resize canvas context to target dimensions (optimized with caching)
  resizeCanvasContext(ctx, targetWidth, targetHeight) {
    const cachedCanvas = this.getCachedCanvas(targetWidth, targetHeight);
    const newContext = cachedCanvas.getContext('2d', { willReadFrequently: true });
    
    // Clear previous content
    newContext.clearRect(0, 0, targetWidth, targetHeight);
    
    // Draw the source canvas into the cached canvas
    newContext.drawImage(ctx.canvas, 0, 0, targetWidth, targetHeight);
    
    return newContext;
  }

  // Preprocess image data for YOLO models
  preprocess(ctx, modelResolution) {
    const [targetWidth, targetHeight] = modelResolution;
    
    // Resize to model input size
    const resizedCtx = this.resizeCanvasContext(ctx, targetWidth, targetHeight);
    
    // Get image data
    const imageData = resizedCtx.getImageData(0, 0, targetWidth, targetHeight);
    const { data, width, height } = imageData;
    
    // Convert image data to tensor format (optimized)
    // Input: RGBA pixel data (data[0] = R, data[1] = G, data[2] = B, data[3] = A)
    // Output: Float32 tensor in format [1, 3, height, width] with values 0-1
    
    const pixelCount = width * height;
    const tensorData = new Float32Array(pixelCount * 3);
    
    // Extract RGB channels and normalize to 0-1 (optimized loop)
    // Tensor format: [batch, channels, height, width] = [1, 3, height, width]
    const channelSize = pixelCount;
    
    // Batch process pixels for better performance
    for (let i = 0, j = 0; i < pixelCount; i++, j += 4) {
      const inv255 = 1 / 255; // Avoid repeated division
      
      // Process all channels in one iteration
      tensorData[i] = data[j] * inv255;                           // R
      tensorData[i + channelSize] = data[j + 1] * inv255;         // G  
      tensorData[i + channelSize * 2] = data[j + 2] * inv255;     // B
    }

    // Create ONNX tensor
    const tensor = new ort.Tensor(
      'float32', 
      tensorData, 
      [1, 3, height, width]
    );
    
    return tensor;
  }

  // Generate color based on confidence score
  conf2color(conf) {
    const r = Math.round(255 * (1 - conf));
    const g = Math.round(255 * conf);
    return `rgb(${r},${g},0)`;
  }

  // Cleanup method to free memory
  cleanup() {
    this.processingCanvasCache.clear();
  }
}