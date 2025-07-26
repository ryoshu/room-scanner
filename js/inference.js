// Image preprocessing and tensor operations
export class InferenceEngine {
  constructor() {
    // No external dependencies needed
  }

  // Resize canvas context to target dimensions
  resizeCanvasContext(ctx, targetWidth, targetHeight) {
    // Create a new canvas with target dimensions
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const newContext = canvas.getContext('2d');
    
    // Draw the source canvas into the target canvas
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
    
    // Convert image data to tensor format manually
    // Input: RGBA pixel data (data[0] = R, data[1] = G, data[2] = B, data[3] = A)
    // Output: Float32 tensor in format [1, 3, height, width] with values 0-1
    
    const tensorData = new Float32Array(width * height * 3);
    
    // Extract RGB channels and normalize to 0-1
    // Tensor format: [batch, channels, height, width] = [1, 3, height, width]
    const channelSize = width * height;
    
    for (let i = 0; i < width * height; i++) {
      const pixelIndex = i * 4; // RGBA format
      
      // Red channel (index 0)
      tensorData[i] = data[pixelIndex] / 255.0;
      
      // Green channel (index 1) 
      tensorData[channelSize + i] = data[pixelIndex + 1] / 255.0;
      
      // Blue channel (index 2)
      tensorData[channelSize * 2 + i] = data[pixelIndex + 2] / 255.0;
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
}