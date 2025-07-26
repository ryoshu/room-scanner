// Postprocessing functions for different YOLO models
import { yoloClasses } from '../data/yolo_classes.js';

export class PostProcessor {
  constructor() {
    // No dependencies needed
  }

  // Main postprocessing dispatcher
  postprocess(tensor, inferenceTime, ctx, modelResolution, modelName, conf2color) {
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
        this.postprocessYolov10(ctx, modelResolution, tensor, conf2color);
      } else {
        this.postprocessYolov7(ctx, modelResolution, tensor, conf2color);
      }
    } catch (error) {
      console.error('Postprocessing failed:', error);
      // Clear canvas on error
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }

  // Postprocessing for YOLOv10 models
  postprocessYolov10(ctx, modelResolution, tensor, conf2color) {
    const dx = ctx.canvas.width / modelResolution[0];
    const dy = ctx.canvas.height / modelResolution[1];

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

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

      // Scale to canvas size
      [x0, x1] = [x0, x1].map(x => x * dx);
      [y0, y1] = [y0, y1].map(x => x * dy);

      [x0, y0, x1, y1] = [x0, y0, x1, y1].map(x => Math.round(x));

      score = Math.round(score * 1000) / 10;
      const className = yoloClasses[cls_id];
      const label = className.charAt(0).toUpperCase() + className.substring(1) + ' ' + score + '%';
      const color = conf2color(score / 100);

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      
      // Draw label
      ctx.font = '20px Arial';
      ctx.fillStyle = color;
      ctx.fillText(label, x0, y0 - 5);

      // Fill rectangle with transparent color
      ctx.fillStyle = color.replace(')', ', 0.2)').replace('rgb', 'rgba');
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Postprocessing for YOLOv7 models
  postprocessYolov7(ctx, modelResolution, tensor, conf2color) {
    const dx = ctx.canvas.width / modelResolution[0];
    const dy = ctx.canvas.height / modelResolution[1];

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

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

      // Scale to canvas size
      [x0, x1] = [x0, x1].map(x => x * dx);
      [y0, y1] = [y0, y1].map(x => x * dy);

      [x0, y0, x1, y1] = [x0, y0, x1, y1].map(x => Math.round(x));

      score = Math.round(score * 1000) / 10;
      const className = yoloClasses[cls_id];
      const label = className.charAt(0).toUpperCase() + className.substring(1) + ' ' + score + '%';
      const color = conf2color(score / 100);

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      
      // Draw label
      ctx.font = '20px Arial';
      ctx.fillStyle = color;
      ctx.fillText(label, x0, y0 - 5);

      // Fill rectangle with transparent color
      ctx.fillStyle = color.replace(')', ', 0.2)').replace('rgb', 'rgba');
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
}