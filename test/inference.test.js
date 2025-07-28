// Test file for InferenceEngine
import { InferenceEngine } from '../js/inference.js';
import { CONSTANTS } from '../js/constants.js';

// Mock ONNX Runtime
window.ort = {
  Tensor: class {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
  }
};

const { testRunner, assertEqual, assertArrayEqual, assertApproximateEqual, assertTrue, assertFalse } = window;

testRunner.test('InferenceEngine - Constructor initializes correctly', () => {
  const engine = new InferenceEngine();
  assertTrue(engine.processingCanvasCache instanceof Map, 'Should initialize canvas cache as Map');
  assertEqual(engine.maxCacheSize, CONSTANTS.CANVAS_MAX_CACHE_SIZE, 'Should set correct max cache size');
});

testRunner.test('InferenceEngine - Canvas caching works correctly', () => {
  const engine = new InferenceEngine();
  
  // First call should create new canvas
  const canvas1 = engine.getCachedCanvas(256, 256);
  assertTrue(canvas1 instanceof HTMLCanvasElement, 'Should return canvas element');
  assertEqual(canvas1.width, 256, 'Canvas width should match');
  assertEqual(canvas1.height, 256, 'Canvas height should match');
  
  // Second call should return cached canvas
  const canvas2 = engine.getCachedCanvas(256, 256);
  assertTrue(canvas1 === canvas2, 'Should return same cached canvas');
  
  // Different dimensions should create new canvas
  const canvas3 = engine.getCachedCanvas(512, 512);
  assertFalse(canvas1 === canvas3, 'Different dimensions should create new canvas');
});

testRunner.test('InferenceEngine - Cache size limit is enforced', () => {
  const engine = new InferenceEngine();
  
  // Fill cache to limit
  for (let i = 0; i < CONSTANTS.CANVAS_MAX_CACHE_SIZE; i++) {
    engine.getCachedCanvas(i * 100, i * 100);
  }
  
  assertEqual(engine.processingCanvasCache.size, CONSTANTS.CANVAS_MAX_CACHE_SIZE, 'Cache should be at max size');
  
  // Adding one more should remove oldest
  engine.getCachedCanvas(999, 999);
  assertEqual(engine.processingCanvasCache.size, CONSTANTS.CANVAS_MAX_CACHE_SIZE, 'Cache should still be at max size');
});

testRunner.test('InferenceEngine - Color generation works correctly', () => {
  const engine = new InferenceEngine();
  
  // Test low confidence (red)
  const lowConf = engine.conf2color(0.1);
  assertTrue(lowConf.includes('rgb('), 'Should return RGB color string');
  assertTrue(lowConf.includes('229'), 'Low confidence should be mostly red');
  
  // Test high confidence (green)
  const highConf = engine.conf2color(0.9);
  assertTrue(highConf.includes('25'), 'High confidence should be mostly green');
  assertTrue(highConf.includes('229'), 'High confidence should have high green value');
});

testRunner.test('InferenceEngine - Preprocess creates correct tensor format', () => {
  const engine = new InferenceEngine();
  
  // Create mock canvas context with test data
  const mockCanvas = document.createElement('canvas');
  mockCanvas.width = 2;
  mockCanvas.height = 2;
  const mockCtx = mockCanvas.getContext('2d');
  
  // Mock getImageData to return predictable data
  const originalGetImageData = mockCtx.getImageData;
  mockCtx.getImageData = () => ({
    data: new Uint8ClampedArray([
      255, 0, 0, 255,    // Red pixel
      0, 255, 0, 255,    // Green pixel  
      0, 0, 255, 255,    // Blue pixel
      128, 128, 128, 255 // Gray pixel
    ]),
    width: 2,
    height: 2
  });
  
  const tensor = engine.preprocess(mockCtx, [2, 2]);
  
  // Verify tensor structure
  assertEqual(tensor.type, 'float32', 'Tensor should be float32');
  assertArrayEqual(tensor.dims, [CONSTANTS.TENSOR_BATCH_SIZE, CONSTANTS.RGB_CHANNELS, 2, 2], 'Tensor dimensions should be correct');
  
  // Verify tensor data (normalized to 0-1)
  const expectedData = new Float32Array([
    1, 0, 0, 0.5,      // Red channel: [255/255, 0/255, 0/255, 128/255]
    0, 1, 0, 0.5,      // Green channel: [0/255, 255/255, 0/255, 128/255]
    0, 0, 1, 0.5       // Blue channel: [0/255, 0/255, 255/255, 128/255]
  ]);
  
  assertEqual(tensor.data.length, expectedData.length, 'Tensor data length should match');
  
  for (let i = 0; i < expectedData.length; i++) {
    assertApproximateEqual(tensor.data[i], expectedData[i], 0.001, `Tensor data at index ${i} should match`);
  }
  
  // Restore original method
  mockCtx.getImageData = originalGetImageData;
});

testRunner.test('InferenceEngine - Cleanup clears cache', () => {
  const engine = new InferenceEngine();
  
  // Add some cached canvases
  engine.getCachedCanvas(256, 256);
  engine.getCachedCanvas(512, 512);
  
  assertTrue(engine.processingCanvasCache.size > 0, 'Cache should have entries before cleanup');
  
  engine.cleanup();
  
  assertEqual(engine.processingCanvasCache.size, 0, 'Cache should be empty after cleanup');
});