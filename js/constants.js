// Application constants
export const CONSTANTS = {
  // Detection confidence thresholds
  CONFIDENCE_THRESHOLD: 0.25,
  
  // Progress and UI timing
  PROGRESS_THROTTLE_MS: 100,
  ERROR_TOAST_TIMEOUT_MS: 5000,
  LOADING_OVERLAY_FADE_MS: 500,
  
  // Cache and memory management
  CACHE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  MEMORY_PRESSURE_THRESHOLD: 0.8,
  DOWNLOAD_TIMEOUT_MS: 30000, // 30 seconds
  
  // Camera switching
  CAMERA_SWITCH_TIMEOUT_MS: 10000, // 10 seconds
  CAMERA_SWITCH_COOLDOWN_MS: 1000, // 1 second between switches
  
  // Touch and accessibility
  TOUCH_TARGET_MIN: 44,
  TOUCH_TARGET_COMFORTABLE: 48,
  
  // Performance optimization
  INFERENCE_THROTTLE_FPS: 30,
  DOM_UPDATE_THROTTLE_MS: 16, // ~60fps
  
  // Error handling
  MAX_CONSECUTIVE_ERRORS: 5,
  ERROR_RECOVERY_DELAY_MS: 2000,
  COMPONENT_RECOVERY_TIMEOUT_MS: 10000,
  
  // ONNX Runtime configuration
  WASM_PATHS: './js/',
  EXECUTION_PROVIDERS: ['wasm'],
  GRAPH_OPTIMIZATION_LEVEL: 'all',
  
  // Model configuration weights for progress tracking
  ONNX_RUNTIME_PROGRESS_WEIGHT: 20, // 0-20%
  MODEL_PROGRESS_WEIGHT: 80, // 20-100%
  
  // Camera settings
  CAMERA_IDEAL_WIDTH: 640,
  CAMERA_IDEAL_HEIGHT: 480,
  DEFAULT_ASPECT_RATIO: 16/9,
  
  // Image processing constants
  PIXEL_NORMALIZATION_FACTOR: 255,
  CONFIDENCE_DISPLAY_MULTIPLIER: 1000,
  CONFIDENCE_DISPLAY_DIVISOR: 10,
  PERCENT_MULTIPLIER: 100,
  
  // YOLO model tensor dimensions
  YOLOV10_TENSOR_STRIDE: 6, // x0, y0, x1, y1, score, cls_id
  YOLOV7_TENSOR_STRIDE: 7,  // batch_id, x0, y0, x1, y1, cls_id, score
  
  // Array indices
  RESOLUTION_WIDTH_INDEX: 0,
  RESOLUTION_HEIGHT_INDEX: 1,
  
  // String manipulation
  FIRST_CHAR_INDEX: 0,
  SECOND_CHAR_INDEX: 1,
  
  // Image processing
  CANVAS_MAX_CACHE_SIZE: 5,
  RGB_CHANNELS: 3,
  RGBA_STRIDE: 4, // RGBA has 4 components per pixel
  TENSOR_BATCH_SIZE: 1,
  
  // RGBA channel indices
  RED_CHANNEL: 0,
  GREEN_CHANNEL: 1,
  BLUE_CHANNEL: 2,
  ALPHA_CHANNEL: 3,
  
  // Canvas and rendering
  CANVAS_LINE_WIDTH_DIVISOR: 300,
  CANVAS_FONT_SIZE_DIVISOR: 40,
  MIN_LINE_WIDTH: 1,
  MIN_FONT_SIZE: 10,
  FILL_OPACITY: 0.15,
  LABEL_OFFSET: 5,
  
  // UI styling
  DISABLED_OPACITY: 0.5,
  FULL_OPACITY: 1.0,
  PROGRESS_MAX: 100
};