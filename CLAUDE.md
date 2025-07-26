# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a vanilla JavaScript application that requires no build process. Development is done directly with the source files:

### Local Development
```bash
# Serve the application using any HTTP server:

# Using Python 3
python3 -m http.server 8080

# Using Node.js
npx http-server -p 8080

# Using PHP  
php -S localhost:8080
```

Access the application at `http://localhost:8080`

### Testing
- No automated test framework configured
- Manual testing is done via browser DevTools
- Test camera functionality in different browsers
- Verify model loading and inference performance

## Architecture Overview

This is a vanilla JavaScript real-time object detection web application that runs YOLO models in the browser using ONNX Runtime Web.

### Core Architecture Pattern
The application follows a modular class-based architecture with clear separation of concerns:

- **Main Application Orchestrator** (`js/main.js`): `ObjectDetectionApp` class manages the overall application lifecycle, coordinates between modules, and handles UI events
- **Camera Management** (`js/camera.js`): `CameraManager` handles getUserMedia API, camera switching, video stream management, and canvas operations
- **Model Management** (`js/models.js`): `ModelManager` handles ONNX model loading, model switching, and inference execution
- **Image Processing** (`js/inference.js`): `InferenceEngine` handles image preprocessing, tensor creation, and canvas operations
- **Detection Processing** (`js/postprocess.js`): `PostProcessor` handles YOLO output parsing and bounding box rendering

### Key Technical Details

**Model Support**: 4 different YOLO models with automatic output format detection:
- YOLOv10n (256x256) - different output format requiring specialized postprocessing
- YOLOv7-tiny variants (256x256, 320x320, 640x640) - standard YOLO format

**Canvas Architecture**: Dual canvas system:
- Video element displays camera feed
- Overlay canvas positioned absolutely for detection rendering  
- Separate processing canvas created dynamically for model input

**Performance Monitoring**: Real-time metrics tracking:
- Model inference time vs total processing time
- FPS calculations for different processing stages
- Overhead time measurement

**Camera Handling**: Full camera lifecycle management:
- Front/back camera switching with `facingMode` constraints
- Proper stream cleanup and reinitialization
- Video mirroring for front camera display

### Dependencies

**Runtime Dependencies**:
- ONNX Runtime Web (v1.18.0) loaded from CDN
- YOLO class labels imported from `data/yolo_classes.js`

**No Build Dependencies**: Application runs directly in browser with ES6 modules

## File Organization

**Entry Points**:
- `index.html` - Single page application entry point
- `js/main.js` - Main application class and DOM initialization

**Core Modules**:
- `js/camera.js` - Camera and video stream management
- `js/models.js` - ONNX model loading and inference
- `js/inference.js` - Image preprocessing and tensor operations  
- `js/postprocess.js` - YOLO output parsing and visualization

**Assets**:
- `models/` - ONNX model files (.onnx)
- `data/yolo_classes.js` - COCO dataset class labels
- `styles/main.css` - Complete CSS styling (replaces Tailwind from original React version)

## Development Patterns

**ES6 Module System**: Clean imports/exports between modules
**Class-Based Architecture**: Each major concern encapsulated in a dedicated class
**Canvas API Usage**: Heavy use of 2D canvas context for image processing and rendering
**Async/Await**: Modern async patterns for model loading and camera operations
**Error Handling**: Comprehensive try/catch with user-friendly error messaging

**Performance Considerations**:
- `willReadFrequently: true` on canvas contexts used for pixel data access
- Separate processing canvas to avoid interference with display overlay
- RequestAnimationFrame for smooth live detection loop
- Proper cleanup of video streams and animation frames

## Browser Requirements

**HTTPS Required**: Camera access requires secure context (HTTPS) in production
**WebAssembly Support**: Required for ONNX Runtime Web execution
**ES6 Module Support**: Required for application module system
**Canvas API**: Required for image processing and visualization

**Tested Browsers**:
- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support (iOS requires HTTPS)
- Mobile browsers: Responsive design with touch support