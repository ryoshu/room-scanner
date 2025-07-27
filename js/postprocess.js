// Postprocessing functions for different YOLO models
import { yoloClasses } from '../data/yolo_classes.js';
// YOLO-World functionality commented out
// import { yoloWorldConfig } from '../data/yolo_world_classes.js';

export class PostProcessor {
  constructor() {
    // No dependencies needed
  }

  // Main postprocessing dispatcher
  postprocess(tensor, inferenceTime, ctx, modelResolution, modelName, conf2color, displayDimensions /* yoloWorldConfig = null */) {
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
      // Check if this is YOLO-World mode - COMMENTED OUT
      /* const isYoloWorld = yoloWorldConfig && yoloWorldConfig.isEnabled; */
      
      // Different YOLO versions have different output formats
      if (modelName === 'yolov10n.onnx') {
        /* YOLO-World functionality commented out
        if (isYoloWorld) {
          this.postprocessYoloWorld(ctx, modelResolution, tensor, conf2color, displayDimensions, yoloWorldConfig);
        } else {
        */
          this.postprocessYolov10(ctx, modelResolution, tensor, conf2color, displayDimensions);
        /* } */
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

  /*
  // YOLO-World functionality commented out
  
  // Postprocessing for YOLO-World models (simulated)
  postprocessYoloWorld(ctx, modelResolution, tensor, conf2color, displayDimensions, yoloWorldConfig) {
    console.log('🌍 YOLO-World postprocessing with prompts:', yoloWorldConfig.currentPrompts);
    
    // Clear previous drawings
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    const { width: canvasWidth, height: canvasHeight } = displayDimensions;
    const [modelWidth, modelHeight] = modelResolution;
    
    // Scale factors for coordinate conversion
    const scaleX = canvasWidth / modelWidth;
    const scaleY = canvasHeight / modelHeight;
    
    // Parse tensor data (same format as YOLOv10 but with YOLO-World filtering)
    const numDetections = tensor.data.length / 6; // [x1, y1, x2, y2, confidence, class_id]
    const detections = [];
    
    for (let i = 0; i < numDetections; i++) {
      const startIdx = i * 6;
      const x1 = tensor.data[startIdx];
      const y1 = tensor.data[startIdx + 1];
      const x2 = tensor.data[startIdx + 2];
      const y2 = tensor.data[startIdx + 3];
      const confidence = tensor.data[startIdx + 4];
      const classId = Math.round(tensor.data[startIdx + 5]);
      
      // Use YOLO-World confidence threshold (lower than standard YOLO)
      if (confidence < yoloWorldConfig.confidenceThreshold) continue;
      
      // Get class name
      const className = yoloClasses[classId] || `class_${classId}`;
      
      // Filter by YOLO-World prompts (simulated)
      if (yoloWorldConfig.customClasses.length > 0) {
        if (!yoloWorldConfig.customClasses.includes(className)) {
          continue; // Skip classes not in current prompts
        }
      }
      
      detections.push({
        x1, y1, x2, y2, confidence, classId, className
      });
    }
    
    // Apply NMS (Non-Maximum Suppression)
    const nmsDetections = this.applyNMS(detections, yoloWorldConfig.nmsThreshold);
    
    // Limit detections
    const finalDetections = nmsDetections.slice(0, yoloWorldConfig.maxDetections);
    
    console.log(`🌍 YOLO-World found ${finalDetections.length} objects matching prompts`);
    
    // Draw detections with YOLO-World styling
    finalDetections.forEach(det => {
      const rectX = Math.round(det.x1 * scaleX);
      const rectY = Math.round(det.y1 * scaleY);
      const rectWidth = Math.round((det.x2 - det.x1) * scaleX);
      const rectHeight = Math.round((det.y2 - det.y1) * scaleY);
      
      // Get color for this detection
      const color = conf2color(det.confidence);
      
      // YOLO-World specific styling
      this.drawYoloWorldDetection(ctx, {
        rectX, rectY, rectWidth, rectHeight,
        className: det.className,
        confidence: det.confidence,
        color,
        isPromptMatch: yoloWorldConfig.currentPrompts.includes(det.className.toLowerCase())
      });
    });
    
    // Draw YOLO-World status
    this.drawYoloWorldStatus(ctx, yoloWorldConfig, finalDetections.length, canvasWidth, canvasHeight);
  }

  // Draw individual YOLO-World detection with enhanced styling
  drawYoloWorldDetection(ctx, detection) {
    const { rectX, rectY, rectWidth, rectHeight, className, confidence, color, isPromptMatch } = detection;
    
    // Enhanced border for prompt matches
    ctx.strokeStyle = color;
    ctx.lineWidth = isPromptMatch ? 3 : 2;
    
    // Dashed border for non-prompt matches
    if (!isPromptMatch) {
      ctx.setLineDash([5, 5]);
    } else {
      ctx.setLineDash([]);
    }
    
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    ctx.setLineDash([]); // Reset dash
    
    // Label with confidence and prompt indicator
    const fontSize = Math.max(12, Math.min(18, rectWidth / 10));
    const label = `${className} ${(confidence * 100).toFixed(1)}%${isPromptMatch ? ' ✨' : ''}`;
    
    // Label background
    ctx.fillStyle = color;
    const textMetrics = ctx.measureText(label);
    const labelWidth = textMetrics.width + 8;
    const labelHeight = fontSize + 6;
    const labelY = rectY > labelHeight ? rectY - labelHeight : rectY + rectHeight;
    
    ctx.fillRect(rectX, labelY, labelWidth, labelHeight);
    
    // Label text
    ctx.fillStyle = 'white';
    ctx.font = `${fontSize}px Arial`;
    ctx.fillText(label, rectX + 4, labelY + fontSize + 2);
    
    // Semi-transparent fill with different opacity for prompt matches
    const opacity = isPromptMatch ? 0.2 : 0.1;
    ctx.fillStyle = color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
  }

  // Draw YOLO-World status information
  drawYoloWorldStatus(ctx, yoloWorldConfig, detectionCount, canvasWidth, canvasHeight) {
    // Status panel
    const panelHeight = 80;
    const panelY = canvasHeight - panelHeight;
    
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, panelY, canvasWidth, panelHeight);
    
    // Title
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('🌍 YOLO-World Open Vocabulary Detection', 10, panelY + 20);
    
    // Prompts
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    const promptText = `Prompts: ${yoloWorldConfig.currentPrompts.join(', ')}`;
    ctx.fillText(promptText, 10, panelY + 40);
    
    // Detection count
    const countText = `Detections: ${detectionCount} | Confidence: ${(yoloWorldConfig.confidenceThreshold * 100).toFixed(0)}%`;
    ctx.fillText(countText, 10, panelY + 60);
  }

  // Apply Non-Maximum Suppression for YOLO-World
  applyNMS(detections, nmsThreshold) {
    // Sort by confidence
    detections.sort((a, b) => b.confidence - a.confidence);
    
    const keep = [];
    const suppressed = new Set();
    
    for (let i = 0; i < detections.length; i++) {
      if (suppressed.has(i)) continue;
      
      keep.push(detections[i]);
      
      for (let j = i + 1; j < detections.length; j++) {
        if (suppressed.has(j)) continue;
        
        // Calculate IoU (Intersection over Union)
        const iou = this.calculateIoU(detections[i], detections[j]);
        
        if (iou > nmsThreshold) {
          suppressed.add(j);
        }
      }
    }
    
    return keep;
  }

  // Calculate Intersection over Union (IoU)
  calculateIoU(det1, det2) {
    const x1 = Math.max(det1.x1, det2.x1);
    const y1 = Math.max(det1.y1, det2.y1);
    const x2 = Math.min(det1.x2, det2.x2);
    const y2 = Math.min(det1.y2, det2.y2);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = (det1.x2 - det1.x1) * (det1.y2 - det1.y1);
    const area2 = (det2.x2 - det2.x1) * (det2.y2 - det2.y1);
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }
  
  END OF YOLO-World functionality comment block
  */
}