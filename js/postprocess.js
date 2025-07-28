// Postprocessing functions for different YOLO models
import { yoloClasses } from '../data/yolo_classes.js';
import { CONSTANTS } from './constants.js';
import { logger } from './logger.js';

export class PostProcessor {
  constructor() {
    // No dependencies needed
  }

  // Main postprocessing dispatcher
  postprocess(tensor, inferenceTime, ctx, modelResolution, modelName, conf2color, displayDimensions) {
    // Validate inputs
    if (!tensor || !ctx || !modelResolution || !modelName || !conf2color) {
      logger.warn('Invalid postprocessing parameters:', {
        tensor: !!tensor,
        ctx: !!ctx,
        modelResolution: !!modelResolution,
        modelName: !!modelName,
        conf2color: !!conf2color
      });
      return [];
    }
    
    if (!tensor.data || tensor.data.length === 0) {
      logger.warn('Empty tensor data received');
      return [];
    }
    
    try {
      // Different YOLO versions have different output formats
      if (modelName === 'yolov10n.onnx') {
        return this.postprocessYolov10(ctx, modelResolution, tensor, conf2color, displayDimensions);
      } else {
        return this.postprocessYolov7(ctx, modelResolution, tensor, conf2color, displayDimensions);
      }
    } catch (error) {
      logger.error('Postprocessing failed:', error);
      // Clear canvas on error
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return [];
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
    const scaleX = canvasWidth / modelResolution[CONSTANTS.RESOLUTION_WIDTH_INDEX];
    const scaleY = canvasHeight / modelResolution[CONSTANTS.RESOLUTION_HEIGHT_INDEX];

    // Track detected object names
    const detectedObjects = new Set();
    
    let x0, y0, x1, y1, cls_id, score;

    for (let i = 0; i < tensor.dims[1]; i += CONSTANTS.YOLOV10_TENSOR_STRIDE) {
      [x0, y0, x1, y1, score, cls_id] = tensor.data.slice(i, i + CONSTANTS.YOLOV10_TENSOR_STRIDE);

      if (score < CONSTANTS.CONFIDENCE_THRESHOLD) {
        break;
      }

      // Ensure cls_id is within bounds
      cls_id = Math.floor(cls_id);
      if (cls_id < 0 || cls_id >= yoloClasses.length) {
        logger.warn('Invalid class ID:', cls_id);
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
      score = Math.round(score * CONSTANTS.CONFIDENCE_DISPLAY_MULTIPLIER) / CONSTANTS.CONFIDENCE_DISPLAY_DIVISOR;
      const className = yoloClasses[cls_id];
      const label = className.charAt(CONSTANTS.FIRST_CHAR_INDEX).toUpperCase() + className.substring(CONSTANTS.SECOND_CHAR_INDEX) + ' ' + score + '%';
      const color = conf2color(score / CONSTANTS.PERCENT_MULTIPLIER);
      
      // Add to detected objects set
      detectedObjects.add(className);

      // Responsive styling based on canvas size
      const lineWidth = Math.max(CONSTANTS.MIN_LINE_WIDTH, Math.round(canvasWidth / CONSTANTS.CANVAS_LINE_WIDTH_DIVISOR));
      const fontSize = Math.max(CONSTANTS.MIN_FONT_SIZE, Math.round(canvasWidth / CONSTANTS.CANVAS_FONT_SIZE_DIVISOR));

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
      
      // Draw label
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = color;
      
      // Smart label positioning
      const labelY = rectY > fontSize + CONSTANTS.LABEL_OFFSET ? rectY - CONSTANTS.LABEL_OFFSET : rectY + fontSize + CONSTANTS.LABEL_OFFSET;
      ctx.fillText(label, rectX, labelY);

      // Draw semi-transparent fill
      ctx.fillStyle = color.replace(')', ', ' + CONSTANTS.FILL_OPACITY + ')').replace('rgb', 'rgba');
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    }
    
    // Return array of detected object names
    return Array.from(detectedObjects);
  }

  // Postprocessing for YOLOv7 models
  postprocessYolov7(ctx, modelResolution, tensor, conf2color, displayDimensions) {
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Get canvas dimensions (should match display dimensions)
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // Calculate scaling from model resolution to canvas size
    const scaleX = canvasWidth / modelResolution[CONSTANTS.RESOLUTION_WIDTH_INDEX];
    const scaleY = canvasHeight / modelResolution[CONSTANTS.RESOLUTION_HEIGHT_INDEX];

    // Track detected object names
    const detectedObjects = new Set();
    
    let batch_id, x0, y0, x1, y1, cls_id, score;
    
    for (let i = 0; i < tensor.dims[0]; i++) {
      [batch_id, x0, y0, x1, y1, cls_id, score] = tensor.data.slice(
        i * CONSTANTS.YOLOV7_TENSOR_STRIDE,
        i * CONSTANTS.YOLOV7_TENSOR_STRIDE + CONSTANTS.YOLOV7_TENSOR_STRIDE
      );

      if (score < CONSTANTS.CONFIDENCE_THRESHOLD) {
        continue;
      }

      // Ensure cls_id is within bounds
      cls_id = Math.floor(cls_id);
      if (cls_id < 0 || cls_id >= yoloClasses.length) {
        logger.warn('Invalid class ID:', cls_id);
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
      score = Math.round(score * CONSTANTS.CONFIDENCE_DISPLAY_MULTIPLIER) / CONSTANTS.CONFIDENCE_DISPLAY_DIVISOR;
      const className = yoloClasses[cls_id];
      const label = className.charAt(CONSTANTS.FIRST_CHAR_INDEX).toUpperCase() + className.substring(CONSTANTS.SECOND_CHAR_INDEX) + ' ' + score + '%';
      const color = conf2color(score / CONSTANTS.PERCENT_MULTIPLIER);
      
      // Add to detected objects set
      detectedObjects.add(className);

      // Responsive styling based on canvas size
      const lineWidth = Math.max(CONSTANTS.MIN_LINE_WIDTH, Math.round(canvasWidth / CONSTANTS.CANVAS_LINE_WIDTH_DIVISOR));
      const fontSize = Math.max(CONSTANTS.MIN_FONT_SIZE, Math.round(canvasWidth / CONSTANTS.CANVAS_FONT_SIZE_DIVISOR));

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
      
      // Draw label
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = color;
      
      // Smart label positioning
      const labelY = rectY > fontSize + CONSTANTS.LABEL_OFFSET ? rectY - CONSTANTS.LABEL_OFFSET : rectY + fontSize + CONSTANTS.LABEL_OFFSET;
      ctx.fillText(label, rectX, labelY);

      // Draw semi-transparent fill
      ctx.fillStyle = color.replace(')', ', ' + CONSTANTS.FILL_OPACITY + ')').replace('rgb', 'rgba');
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    }
    
    // Return array of detected object names
    return Array.from(detectedObjects);
  }

}