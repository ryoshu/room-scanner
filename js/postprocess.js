// Postprocessing functions for different YOLO models
import { yoloClasses } from '../data/yolo_classes.js';

export class PostProcessor {
  constructor() {
    // No dependencies needed
  }

  // Main postprocessing dispatcher
  postprocess(tensor, inferenceTime, ctx, modelResolution, modelName, conf2color, displayDimensions) {
    // Validate inputs
    if (!tensor || !ctx || !modelResolution || !modelName || !conf2color) {
      console.warn('Invalid postprocessing parameters:', {
        tensor: !!tensor,
        ctx: !!ctx,
        modelResolution: !!modelResolution,
        modelName: !!modelName,
        conf2color: !!conf2color
      });
      return;
    }
    
    if (!tensor.data || tensor.data.length === 0) {
      console.warn('Empty tensor data received');
      return;
    }
    
    try {
      // Different YOLO versions have different output formats
      if (modelName === 'yolov10n.onnx') {
        this.postprocessYolov10(ctx, modelResolution, tensor, conf2color, displayDimensions);
      } else {
        this.postprocessYolov7(ctx, modelResolution, tensor, conf2color, displayDimensions);
      }
    } catch (error) {
      console.error('Postprocessing failed:', error);
      // Clear canvas on error
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }

  // Postprocessing for YOLOv10 models
  postprocessYolov10(ctx, modelResolution, tensor, conf2color, displayDimensions) {
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Get canvas dimensions (should match display dimensions)
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // Calculate scaling from model resolution to canvas size
    const scaleX = canvasWidth / modelResolution[0];
    const scaleY = canvasHeight / modelResolution[1];

    let x0, y0, x1, y1, cls_id, score;

    for (let i = 0; i < tensor.dims[1]; i += 6) {
      [x0, y0, x1, y1, score, cls_id] = tensor.data.slice(i, i + 6);

      if (score < 0.25) {
        break;
      }

      // Ensure cls_id is within bounds
      cls_id = Math.floor(cls_id);
      if (cls_id < 0 || cls_id >= yoloClasses.length) {
        console.warn('Invalid class ID:', cls_id);
        continue;
      }

      // Transform coordinates from model space to canvas space
      const scaledX0 = x0 * scaleX;
      const scaledY0 = y0 * scaleY;
      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;

      // Round for pixel alignment
      const rectX = Math.round(scaledX0);
      const rectY = Math.round(scaledY0);
      const rectWidth = Math.round(scaledX1 - scaledX0);
      const rectHeight = Math.round(scaledY1 - scaledY0);

      // Format score
      score = Math.round(score * 1000) / 10;
      const className = yoloClasses[cls_id];
      const label = className.charAt(0).toUpperCase() + className.substring(1) + ' ' + score + '%';
      const color = conf2color(score / 100);

      // Responsive styling based on canvas size
      const lineWidth = Math.max(1, Math.round(canvasWidth / 300));
      const fontSize = Math.max(10, Math.round(canvasWidth / 40));

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
      
      // Draw label
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = color;
      
      // Smart label positioning
      const labelY = rectY > fontSize + 5 ? rectY - 5 : rectY + fontSize + 5;
      ctx.fillText(label, rectX, labelY);

      // Draw semi-transparent fill
      ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    }
  }

  // Postprocessing for YOLOv7 models
  postprocessYolov7(ctx, modelResolution, tensor, conf2color, displayDimensions) {
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Get canvas dimensions (should match display dimensions)
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // Calculate scaling from model resolution to canvas size
    const scaleX = canvasWidth / modelResolution[0];
    const scaleY = canvasHeight / modelResolution[1];

    let batch_id, x0, y0, x1, y1, cls_id, score;
    
    for (let i = 0; i < tensor.dims[0]; i++) {
      [batch_id, x0, y0, x1, y1, cls_id, score] = tensor.data.slice(
        i * 7,
        i * 7 + 7
      );

      if (score < 0.25) {
        continue;
      }

      // Ensure cls_id is within bounds
      cls_id = Math.floor(cls_id);
      if (cls_id < 0 || cls_id >= yoloClasses.length) {
        console.warn('Invalid class ID:', cls_id);
        continue;
      }

      // Transform coordinates from model space to canvas space
      const scaledX0 = x0 * scaleX;
      const scaledY0 = y0 * scaleY;
      const scaledX1 = x1 * scaleX;
      const scaledY1 = y1 * scaleY;

      // Round for pixel alignment
      const rectX = Math.round(scaledX0);
      const rectY = Math.round(scaledY0);
      const rectWidth = Math.round(scaledX1 - scaledX0);
      const rectHeight = Math.round(scaledY1 - scaledY0);

      // Format score
      score = Math.round(score * 1000) / 10;
      const className = yoloClasses[cls_id];
      const label = className.charAt(0).toUpperCase() + className.substring(1) + ' ' + score + '%';
      const color = conf2color(score / 100);

      // Responsive styling based on canvas size
      const lineWidth = Math.max(1, Math.round(canvasWidth / 300));
      const fontSize = Math.max(10, Math.round(canvasWidth / 40));

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
      
      // Draw label
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = color;
      
      // Smart label positioning
      const labelY = rectY > fontSize + 5 ? rectY - 5 : rectY + fontSize + 5;
      ctx.fillText(label, rectX, labelY);

      // Draw semi-transparent fill
      ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    }
  }
}