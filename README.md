# Vanilla HTML/CSS/JS Object Detection

This is a vanilla JavaScript implementation of the real-time object detection web app, converted from the original Next.js React version.

## Features

- **Pure vanilla web technologies** - No build process required
- **Real-time object detection** using YOLO models (YOLOv7, YOLOv10)
- **Camera integration** with front/back camera switching
- **Live detection mode** and single capture mode
- **Performance metrics** showing inference time and FPS
- **Responsive design** that works on desktop and mobile
- **Multiple YOLO model support** (4 models) with easy switching

## Quick Start

1. **Serve the files** using any HTTP server:
   ```bash
   # Using Python 3
   cd vanilla
   python3 -m http.server 8080
   
   # Using Node.js (if you have http-server installed)
   cd vanilla
   npx http-server -p 8080
   
   # Using PHP
   cd vanilla
   php -S localhost:8080
   ```

2. **Open in browser**: Navigate to `http://localhost:8080`

3. **Allow camera access** when prompted

## File Structure

```
vanilla/
├── index.html          # Main HTML file
├── styles/
│   └── main.css        # All styling (replaces Tailwind)
├── js/
│   ├── main.js         # Main application orchestrator
│   ├── camera.js       # Camera handling with getUserMedia
│   ├── models.js       # Model loading and management
│   ├── inference.js    # Image preprocessing and tensor operations
│   └── postprocess.js  # YOLO postprocessing for all model types
├── models/
│   ├── yolov10n.onnx   # YOLOv10 nano model
│   └── yolov7-tiny_*.onnx # YOLOv7 tiny variants (3 sizes)
└── data/
    └── yolo_classes.js # COCO class labels
```

## Dependencies

The app loads these libraries from CDN:
- **ONNX Runtime Web** (v1.18.0) - For running YOLO models

All other operations including tensor processing and utility functions are implemented natively in JavaScript without external dependencies.

## Controls

- **Capture Photo**: Process single frame from camera
- **Live Detection**: Toggle continuous real-time detection
- **Switch Camera**: Switch between front and back camera
- **Change Model**: Cycle through different YOLO models
- **Reset**: Clear overlay and stop detection

## Performance

The app displays real-time metrics:
- **Model Inference Time**: Time spent running the YOLO model
- **Total Time**: Complete processing time including pre/post-processing
- **Overhead Time**: Additional time for image processing
- **FPS calculations**: For all timing metrics

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS Safari requires HTTPS for camera)
- **Mobile browsers**: Responsive design with touch support

## Deployment

For production deployment:

1. **Copy the `vanilla/` directory** to your web server
2. **Serve over HTTPS** (required for camera access)
3. **No build process needed** - files can be served directly

## Differences from React Version

- **No build process**: Files are served directly
- **Smaller bundle size**: No React/Next.js overhead
- **ES6 modules**: Modern JavaScript with clean imports
- **Direct DOM manipulation**: No virtual DOM layer
- **Same functionality**: All features preserved from original

## Development

To modify the app:

1. **Edit files directly** - no compilation needed
2. **Refresh browser** to see changes
3. **Use browser DevTools** for debugging
4. **All original functionality preserved** - same model switching, preprocessing, postprocessing logic

## Troubleshooting

- **Camera not working**: Check browser permissions and ensure HTTPS
- **Models not loading**: Verify model files are in `models/` directory
- **CORS errors**: Serve files through HTTP server, don't open `index.html` directly
- **Performance issues**: Try switching to smaller models (256x256 variants)