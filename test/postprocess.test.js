// Test file for PostProcessor
import { PostProcessor } from '../js/postprocess.js';
import { CONSTANTS } from '../js/constants.js';

// Mock YOLO classes
window.yoloClasses = ['person', 'bicycle', 'car', 'motorcycle', 'airplane'];

const { testRunner, assertEqual, assertArrayEqual, assertApproximateEqual, assertTrue, assertFalse } = window;

testRunner.test('PostProcessor - Constructor initializes correctly', () => {
  const processor = new PostProcessor();
  assertTrue(processor instanceof PostProcessor, 'Should create PostProcessor instance');
});

testRunner.test('PostProcessor - Validates input parameters', () => {
  const processor = new PostProcessor();
  
  // Mock canvas context
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Test with invalid parameters
  const result = processor.postprocess(null, 100, ctx, [640, 640], 'test.onnx', () => 'red', {});
  assertArrayEqual(result, [], 'Should return empty array with null tensor');
  
  // Test with empty tensor data
  const emptyTensor = { data: [], dims: [1, 6] };
  const result2 = processor.postprocess(emptyTensor, 100, ctx, [640, 640], 'test.onnx', () => 'red', {});
  assertArrayEqual(result2, [], 'Should return empty array with empty tensor data');
});

testRunner.test('PostProcessor - YOLOv10 tensor processing', () => {
  const processor = new PostProcessor();
  
  // Create mock canvas
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  
  // Mock tensor data for YOLOv10 (stride of 6: x0, y0, x1, y1, score, cls_id)
  const mockTensor = {
    data: new Float32Array([
      100, 100, 200, 200, 0.8, 0,  // person with high confidence
      300, 300, 400, 400, 0.6, 2,  // car with medium confidence
      500, 500, 600, 600, 0.2, 1   // bicycle with low confidence (should be filtered)
    ]),
    dims: [1, 18] // 3 detections × 6 values each
  };
  
  const mockConf2Color = (conf) => `rgb(${Math.round(255 * (1 - conf))}, ${Math.round(255 * conf)}, 0)`;
  
  const results = processor.postprocessYolov10(
    ctx,
    [640, 640],
    mockTensor,
    mockConf2Color,
    { width: 640, height: 640 }
  );
  
  // Should return only detections above confidence threshold
  assertEqual(results.length, 2, 'Should return 2 detections above threshold');
  assertTrue(results.includes('person'), 'Should detect person');
  assertTrue(results.includes('car'), 'Should detect car');
  assertFalse(results.includes('bicycle'), 'Should filter low confidence bicycle');
});

testRunner.test('PostProcessor - YOLOv7 tensor processing', () => {
  const processor = new PostProcessor();
  
  // Create mock canvas
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  
  // Mock tensor data for YOLOv7 (stride of 7: batch_id, x0, y0, x1, y1, cls_id, score)
  const mockTensor = {
    data: new Float32Array([
      0, 50, 50, 100, 100, 0, 0.9,   // person with high confidence
      0, 150, 150, 200, 200, 3, 0.7, // motorcycle with good confidence
      0, 250, 250, 300, 300, 4, 0.1  // airplane with low confidence (should be filtered)
    ]),
    dims: [3] // 3 detections
  };
  
  const mockConf2Color = (conf) => `rgb(${Math.round(255 * (1 - conf))}, ${Math.round(255 * conf)}, 0)`;
  
  const results = processor.postprocessYolov7(
    ctx,
    [320, 320],
    mockTensor,
    mockConf2Color,
    { width: 320, height: 320 }
  );
  
  // Should return only detections above confidence threshold
  assertEqual(results.length, 2, 'Should return 2 detections above threshold');
  assertTrue(results.includes('person'), 'Should detect person');
  assertTrue(results.includes('motorcycle'), 'Should detect motorcycle');
  assertFalse(results.includes('airplane'), 'Should filter low confidence airplane');
});

testRunner.test('PostProcessor - Model dispatcher works correctly', () => {
  const processor = new PostProcessor();
  
  // Create mock canvas
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  
  // Mock YOLOv10 tensor
  const yolov10Tensor = {
    data: new Float32Array([100, 100, 200, 200, 0.8, 0]),
    dims: [1, 6]
  };
  
  const mockConf2Color = () => 'red';
  
  // Test YOLOv10 dispatch
  const yolov10Results = processor.postprocess(
    yolov10Tensor,
    100,
    ctx,
    [640, 640],
    'yolov10n.onnx',
    mockConf2Color,
    { width: 640, height: 640 }
  );
  
  assertTrue(Array.isArray(yolov10Results), 'Should return array for YOLOv10');
  
  // Test YOLOv7 dispatch (any other model name)
  const yolov7Results = processor.postprocess(
    yolov10Tensor,
    100,
    ctx,
    [640, 640],
    'yolov7-tiny.onnx',
    mockConf2Color,
    { width: 640, height: 640 }
  );
  
  assertTrue(Array.isArray(yolov7Results), 'Should return array for YOLOv7');
});

testRunner.test('PostProcessor - Handles invalid class IDs gracefully', () => {
  const processor = new PostProcessor();
  
  // Create mock canvas
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  
  // Mock tensor with invalid class ID
  const mockTensor = {
    data: new Float32Array([
      100, 100, 200, 200, 0.8, 999  // Invalid class ID (999)
    ]),
    dims: [1, 6]
  };
  
  const mockConf2Color = () => 'red';
  
  const results = processor.postprocessYolov10(
    ctx,
    [640, 640],
    mockTensor,
    mockConf2Color,
    { width: 640, height: 640 }
  );
  
  assertEqual(results.length, 0, 'Should return empty array for invalid class ID');
});

testRunner.test('PostProcessor - Coordinate scaling works correctly', () => {
  const processor = new PostProcessor();
  
  // Create smaller canvas to test scaling
  const canvas = document.createElement('canvas');
  canvas.width = 320;  // Half of model resolution
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  
  // Mock drawing methods to capture calls
  const drawCalls = [];
  ctx.strokeRect = (...args) => drawCalls.push(['strokeRect', ...args]);
  ctx.fillRect = (...args) => drawCalls.push(['fillRect', ...args]);
  ctx.fillText = (...args) => drawCalls.push(['fillText', ...args]);
  
  // Mock tensor with coordinates in 640x640 space
  const mockTensor = {
    data: new Float32Array([
      0, 0, 640, 640, 0.8, 0  // Full image detection
    ]),
    dims: [1, 6]
  };
  
  const mockConf2Color = () => 'red';
  
  processor.postprocessYolov10(
    ctx,
    [640, 640],  // Model resolution
    mockTensor,
    mockConf2Color,
    { width: 320, height: 320 }  // Display resolution
  );
  
  // Check that coordinates were scaled correctly (640→320 = 0.5 scale)
  const strokeCall = drawCalls.find(call => call[0] === 'strokeRect');
  assertTrue(strokeCall !== undefined, 'Should have stroke rect call');
  assertEqual(strokeCall[1], 0, 'X coordinate should be scaled to 0');
  assertEqual(strokeCall[2], 0, 'Y coordinate should be scaled to 0');
  assertEqual(strokeCall[3], 320, 'Width should be scaled to 320');
  assertEqual(strokeCall[4], 320, 'Height should be scaled to 320');
});