// Test file for CameraManager
import { CameraManager } from '../js/camera.js';
import { CONSTANTS } from '../js/constants.js';

const { testRunner, assertEqual, assertArrayEqual, assertApproximateEqual, assertTrue, assertFalse } = window;

// Simple mock functions for testing
const createSimpleMock = () => {
  const calls = [];
  const mockFn = (...args) => {
    calls.push(args);
    return Promise.resolve();
  };
  mockFn.calls = calls;
  mockFn.mockResolvedValue = (value) => {
    mockFn.mockReturnValue = Promise.resolve(value);
    return mockFn;
  };
  return mockFn;
};

testRunner.test('CameraManager - Constructor initializes correctly', () => {
  const camera = new CameraManager();
  
  assertEqual(camera.facingMode, 'environment', 'Should default to back camera');
  assertEqual(camera.isVideoReady, false, 'Should not be ready initially');
  assertTrue(camera.video === null, 'Video element should be null initially');
  assertTrue(camera.canvas === null, 'Canvas element should be null initially');
  assertTrue(camera.stream === null, 'Stream should be null initially');
});

testRunner.test('CameraManager - Display dimensions calculation', () => {
  const camera = new CameraManager();
  
  // Test default dimensions when not initialized
  const defaultDims = camera.getDisplayDimensions();
  assertEqual(defaultDims.width, 0, 'Default width should be 0');
  assertEqual(defaultDims.height, 0, 'Default height should be 0');
  
  // Set mock dimensions
  camera.displayWidth = 640;
  camera.displayHeight = 480;
  
  const dims = camera.getDisplayDimensions();
  assertEqual(dims.width, 640, 'Should return correct width');
  assertEqual(dims.height, 480, 'Should return correct height');
});

testRunner.test('CameraManager - Video aspect ratio calculation', () => {
  const camera = new CameraManager();
  
  // Test default aspect ratio when no video
  const defaultRatio = camera.getVideoAspectRatio();
  assertEqual(defaultRatio, CONSTANTS.DEFAULT_ASPECT_RATIO, 'Should return default aspect ratio');
  
  // Create mock video element
  const mockVideo = {
    videoWidth: 1920,
    videoHeight: 1080
  };
  
  camera.video = mockVideo;
  
  const ratio = camera.getVideoAspectRatio();
  assertApproximateEqual(ratio, 1920/1080, 0.001, 'Should calculate correct aspect ratio');
});

testRunner.test('CameraManager - Camera switching logic', () => {
  const camera = new CameraManager();
  
  // Test initial facing mode
  assertEqual(camera.facingMode, 'environment', 'Should start with back camera');
  
  // Test switching
  camera.facingMode = camera.facingMode === 'user' ? 'environment' : 'user';
  assertEqual(camera.facingMode, 'user', 'Should switch to front camera');
  
  camera.facingMode = camera.facingMode === 'user' ? 'environment' : 'user';
  assertEqual(camera.facingMode, 'environment', 'Should switch back to back camera');
});

testRunner.test('CameraManager - Ready state management', () => {
  const camera = new CameraManager();
  
  assertFalse(camera.isReady(), 'Should not be ready initially');
  
  camera.isVideoReady = true;
  assertTrue(camera.isReady(), 'Should be ready when video is ready');
  
  camera.isVideoReady = false;
  assertFalse(camera.isReady(), 'Should not be ready when video is not ready');
});

testRunner.test('CameraManager - Canvas size updates', () => {
  const camera = new CameraManager();
  
  // Create mock elements
  const mockVideo = document.createElement('video');
  const mockCanvas = document.createElement('canvas');
  
  // Mock getBoundingClientRect
  mockVideo.getBoundingClientRect = () => ({
    width: 640,
    height: 480
  });
  
  // Mock video dimensions
  Object.defineProperty(mockVideo, 'videoWidth', { value: 1920 });
  Object.defineProperty(mockVideo, 'videoHeight', { value: 1080 });
  
  camera.video = mockVideo;
  camera.canvas = mockCanvas;
  camera.context = mockCanvas.getContext('2d');
  
  camera.updateCanvasSize();
  
  assertEqual(camera.displayWidth, 640, 'Should set display width');
  assertEqual(camera.displayHeight, 480, 'Should set display height');
  assertEqual(camera.videoWidth, 1920, 'Should store video width');
  assertEqual(camera.videoHeight, 1080, 'Should store video height');
  assertEqual(mockCanvas.width, 640, 'Canvas width should match display');
  assertEqual(mockCanvas.height, 480, 'Canvas height should match display');
});

testRunner.test('CameraManager - Processing canvas creation', () => {
  const camera = new CameraManager();
  
  // Test when not ready
  const nullResult = camera.createProcessingCanvas(256, 256);
  assertTrue(nullResult === null, 'Should return null when not ready');
  
  // Setup mock video
  const mockVideo = document.createElement('video');
  camera.video = mockVideo;
  camera.isVideoReady = true;
  
  const processingCtx = camera.createProcessingCanvas(256, 256);
  
  assertTrue(processingCtx !== null, 'Should return context when ready');
  assertEqual(processingCtx.canvas.width, 256, 'Processing canvas should have correct width');
  assertEqual(processingCtx.canvas.height, 256, 'Processing canvas should have correct height');
});

testRunner.test('CameraManager - Reset functionality', () => {
  const camera = new CameraManager();
  
  // Create mock canvas and context
  const mockCanvas = document.createElement('canvas');
  const mockContext = mockCanvas.getContext('2d');
  
  // Mock clearRect method to track calls
  let clearRectCalled = false;
  mockContext.clearRect = () => { clearRectCalled = true; };
  
  camera.canvas = mockCanvas;
  camera.context = mockContext;
  
  camera.reset();
  
  assertTrue(clearRectCalled, 'Should call clearRect on reset');
});

testRunner.test('CameraManager - Element getters', () => {
  const camera = new CameraManager();
  
  const mockVideo = document.createElement('video');
  const mockCanvas = document.createElement('canvas');
  
  camera.video = mockVideo;
  camera.canvas = mockCanvas;
  
  assertTrue(camera.getVideoElement() === mockVideo, 'Should return video element');
  assertTrue(camera.getCanvasElement() === mockCanvas, 'Should return canvas element');
});

testRunner.test('CameraManager - Frame capture with mirroring', () => {
  const camera = new CameraManager();
  
  // Setup mock elements
  const mockCanvas = document.createElement('canvas');
  const mockContext = mockCanvas.getContext('2d');
  const mockVideo = document.createElement('video');
  
  // Mock context methods
  let saveCalled = false;
  let restoreCalled = false;
  let scaleCalled = false;
  let translateCalled = false;
  
  mockContext.save = () => { saveCalled = true; };
  mockContext.restore = () => { restoreCalled = true; };
  mockContext.scale = () => { scaleCalled = true; };
  mockContext.translate = () => { translateCalled = true; };
  mockContext.clearRect = () => {};
  
  mockCanvas.width = 640;
  mockCanvas.height = 480;
  
  camera.video = mockVideo;
  camera.canvas = mockCanvas;
  camera.context = mockContext;
  camera.isVideoReady = true;
  
  // Test front camera (should mirror)
  camera.facingMode = 'user';
  const frontResult = camera.captureFrame();
  
  assertTrue(saveCalled, 'Should save context state');
  assertTrue(restoreCalled, 'Should restore context state');
  assertTrue(scaleCalled, 'Should apply scaling for mirroring');
  assertTrue(translateCalled, 'Should apply translation for mirroring');
  assertTrue(frontResult === mockContext, 'Should return context');
  
  // Reset flags
  saveCalled = restoreCalled = scaleCalled = translateCalled = false;
  
  // Test back camera (should not mirror)
  camera.facingMode = 'environment';
  const backResult = camera.captureFrame();
  
  assertTrue(saveCalled, 'Should save context state');
  assertTrue(restoreCalled, 'Should restore context state');
  assertTrue(backResult === mockContext, 'Should return context');
});