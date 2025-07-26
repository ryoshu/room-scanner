# Real-Time Object Detection - Vanilla JavaScript

A high-performance, browser-based object detection application using YOLO models and ONNX Runtime Web. Built with pure vanilla JavaScript for maximum compatibility and performance.

![Object Detection Demo](https://img.shields.io/badge/Demo-Live-brightgreen) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow) ![YOLO](https://img.shields.io/badge/YOLO-v7%20%7C%20v10-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 🎯 **Core Functionality**
- **Real-time object detection** using state-of-the-art YOLO models (YOLOv7, YOLOv10)
- **Live camera integration** with front/back camera switching
- **Multiple detection modes**: Single capture and continuous live detection
- **4 optimized YOLO models** with different resolutions (256×256 to 640×640)

### 🚀 **Technical Excellence**
- **Pure vanilla JavaScript** - No frameworks, no dependencies, no build required
- **Responsive design** - Works seamlessly on desktop, tablet, and mobile
- **Performance monitoring** - Real-time FPS and inference time metrics
- **Modern browser APIs** - Camera access, Canvas 2D, WebAssembly
- **Progressive enhancement** - Optional Vite build system for development

### 🛡️ **Production Ready**
- **Cross-browser compatibility** - Chrome, Firefox, Safari, Edge
- **Touch-optimized controls** - Mobile-first responsive design
- **Error handling** - Comprehensive error boundaries and user feedback
- **Accessibility** - ARIA labels, keyboard navigation, screen reader support

## 🚀 Quick Start

### Option 1: Vanilla Development (No Setup Required)
```bash
# Clone or download the repository
cd vanilla

# Serve using any HTTP server
python3 -m http.server 8080
# or
npx http-server -p 8080
# or  
php -S localhost:8080
```

### Option 2: Enhanced Development (With Vite)
```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build optimized production version
npm run build
```

### 🌐 Access the Application
1. **Open browser**: Navigate to `http://localhost:8080` (or `http://localhost:3000` for Vite)
2. **Allow camera access** when prompted
3. **Start detecting**: Click "Capture Photo" or "Live Detection"

> **📱 Mobile Users**: Ensure you're using HTTPS for camera access on mobile devices

## 📁 Project Structure

```
vanilla/
├── 📄 index.html              # Main HTML entry point
├── 📁 js/                     # JavaScript modules
│   ├── main.js                # Application orchestrator 
│   ├── camera.js              # Camera management & canvas handling
│   ├── models.js              # ONNX model loading & switching
│   ├── inference.js           # Image preprocessing & tensor ops
│   └── postprocess.js         # YOLO postprocessing & visualization
├── 📁 styles/
│   └── main.css               # Responsive CSS (mobile-first)
├── 📁 models/                 # YOLO model files
│   ├── yolov10n.onnx          # YOLOv10 nano (256×256)
│   ├── yolov7-tiny_256x256.onnx
│   ├── yolov7-tiny_320x320.onnx
│   └── yolov7-tiny_640x640.onnx
├── 📁 data/
│   └── yolo_classes.js        # COCO dataset class labels
├── 📁 scripts/                # Build utilities (optional)
│   ├── build-prod.js
│   ├── dev-server.js
│   └── verify-build.js
├── 📦 package.json            # Build system config
├── ⚙️ vite.config.js          # Vite configuration
├── 📚 BUILD.md                # Build system documentation
├── 📚 CLAUDE.md               # Development guidelines
└── 📁 dist/                   # Production build output (generated)
```

## 🔗 Dependencies

### Runtime Dependencies
- **ONNX Runtime Web** (v1.18.0) - Loaded from CDN for YOLO model execution
- **No other runtime dependencies** - Pure vanilla JavaScript implementation

### Build Dependencies (Optional)
- **Vite** (v5.0.0) - Modern build tool for development and production optimization
- **No framework dependencies** - Maintains vanilla architecture

### Browser Requirements
- **ES6+ support** - Modern JavaScript features (2020+)
- **WebAssembly** - Required for ONNX Runtime
- **getUserMedia API** - Camera access
- **Canvas 2D API** - Image processing and visualization

## 🎮 Controls & Interface

### Main Controls
| Control | Function | Description |
|---------|----------|-------------|
| **📸 Capture Photo** | Single detection | Process one frame from camera |
| **🎥 Live Detection** | Continuous mode | Real-time object detection stream |
| **🔄 Switch Camera** | Camera toggle | Switch between front/back camera |
| **⚙️ Change Model** | Model cycling | Switch between 4 YOLO models |
| **🔄 Reset** | Clear state | Stop detection and clear overlay |

### Performance Metrics
Real-time performance monitoring displayed on screen:

| Metric | Description |
|--------|-------------|
| **Model Inference Time** | Pure YOLO model execution time |
| **Total Processing Time** | Complete pipeline including pre/post-processing |
| **Overhead Time** | Additional processing beyond model inference |
| **FPS Calculations** | Frames per second for each timing category |

### Keyboard Navigation
- **Tab** - Navigate between controls
- **Enter/Space** - Activate buttons
- **Escape** - Stop live detection

## 🌐 Browser Compatibility

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| **Chrome** | ✅ Full | ✅ Full | Recommended for best performance |
| **Firefox** | ✅ Full | ✅ Full | Excellent WebAssembly support |
| **Safari** | ✅ Full | ✅ Full | Requires HTTPS for camera on iOS |
| **Edge** | ✅ Full | ✅ Full | Chromium-based, full compatibility |

### Mobile-Specific Features
- **📱 Touch-optimized controls** - 48px minimum touch targets
- **🔄 Orientation handling** - Adaptive layouts for portrait/landscape
- **📐 Responsive design** - Scales from 320px to 1400px+ screens
- **⚡ Performance optimization** - Efficient canvas rendering

## 🚀 Deployment

### Option 1: Static Hosting (Vanilla)
```bash
# No build required - deploy source files directly
cp -r vanilla/ /var/www/html/
# Ensure HTTPS for camera access
```

### Option 2: Optimized Build (Vite)
```bash
# Build optimized production version
npm run build

# Deploy dist/ directory
cp -r dist/ /var/www/html/
```

### Popular Hosting Platforms
- **Netlify**: Drag & drop the `vanilla/` folder or `dist/` folder
- **Vercel**: Connect Git repository, auto-deploy on push
- **GitHub Pages**: Enable Pages in repository settings
- **Firebase Hosting**: `firebase deploy` with build files

## 🛠️ Development Workflows

### Vanilla Development (Zero Setup)
```bash
# 1. Edit files directly in your IDE
# 2. Refresh browser to see changes  
# 3. Use browser DevTools for debugging
# 4. No compilation or build step needed
```

### Enhanced Development (Vite)
```bash
# 1. Start development server
npm run dev

# 2. Hot reload automatically applies changes
# 3. Enhanced debugging with source maps
# 4. Build production version when ready
npm run build
```

### Available Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run verify` | Verify build integrity |
| `npm run clean` | Remove build artifacts |

## 🔧 Troubleshooting

### Common Issues

**🚫 Camera not working**
- Check browser permissions (🔒 icon in address bar)
- Ensure HTTPS for production deployment
- Try switching cameras with the "Switch Camera" button
- Verify camera isn't being used by another application

**📦 Models not loading**
- Verify all `.onnx` files are in the `models/` directory
- Check browser console for download errors
- Ensure HTTP server is serving files (not opening `index.html` directly)
- Large model files may take time to download

**🌐 CORS errors**
- Always serve files through an HTTP server
- Don't open `index.html` directly in browser
- Use `python3 -m http.server` or similar

**⚡ Performance issues**
- Try smaller models (256×256 variants) on slower devices
- Check "Change Model" to switch to faster models
- Ensure hardware acceleration is enabled in browser
- Close other tabs/applications to free up resources

**📱 Mobile issues**
- Ensure HTTPS on mobile devices
- Grant camera permissions when prompted
- Try both front and back cameras
- Check that touch targets are responsive

### Debug Information
Check browser console for detailed error messages and performance information. The app logs model loading progress and inference timing data.

## 🏗️ Architecture Overview

### Core Components
- **Application Orchestrator** (`main.js`) - Coordinates all modules and handles UI events
- **Camera Manager** (`camera.js`) - Handles video stream, canvas overlay, and responsive sizing
- **Model Manager** (`models.js`) - ONNX model loading, switching, and inference execution
- **Inference Engine** (`inference.js`) - Image preprocessing and tensor operations
- **Post Processor** (`postprocess.js`) - YOLO output parsing and bounding box visualization

### Data Flow
```
Camera Stream → Canvas Processing → Model Inference → Post Processing → Visual Output
     ↓              ↓                    ↓               ↓              ↓
Video Element → Image Tensor → ONNX Runtime → Detections → Bounding Boxes
```

### Design Patterns
- **Module Pattern** - Each component is a self-contained ES6 module
- **Observer Pattern** - Event-driven architecture with ResizeObserver
- **Strategy Pattern** - Different YOLO model processing strategies
- **Factory Pattern** - Canvas and tensor creation utilities

## 🎨 Customization

### Adding New YOLO Models
1. Add model file to `models/` directory
2. Update model configuration in `models.js`:
```javascript
this.RES_TO_MODEL = [
  [[256, 256], 'your-model.onnx'],
  // ... existing models
];
```

### Modifying Detection Classes
Edit `data/yolo_classes.js` to customize object classes:
```javascript
export const yoloClasses = [
  "custom-class-1",
  "custom-class-2",
  // ... your classes
];
```

### Styling Customization
The responsive CSS in `styles/main.css` uses CSS custom properties:
```css
:root {
  --space-sm: clamp(0.5rem, 2vw, 1rem);
  --text-base: clamp(1rem, 3vw, 1.125rem);
  /* Modify these values for different styling */
}
```

## 📊 Performance Optimization

### Model Selection Guidelines
| Model | Resolution | Size | Speed | Accuracy | Best For |
|-------|------------|------|-------|----------|----------|
| YOLOv7-tiny 256×256 | 256×256 | ~12MB | Fastest | Good | Mobile devices |
| YOLOv10n | 256×256 | ~5MB | Fast | Better | Balanced performance |
| YOLOv7-tiny 320×320 | 320×320 | ~12MB | Medium | Better | Desktop |
| YOLOv7-tiny 640×640 | 640×640 | ~12MB | Slower | Best | High accuracy needs |

### Browser Performance Tips
- **Enable hardware acceleration** in browser settings
- **Close unnecessary tabs** to free up GPU/CPU resources
- **Use Chromium-based browsers** for best WebAssembly performance
- **Ensure good lighting** for better detection accuracy

## 📋 TODO / Roadmap

### Potential Enhancements
- [ ] **WebGPU support** for faster inference when available
- [ ] **WebRTC integration** for remote camera streams
- [ ] **Custom model upload** interface
- [ ] **Detection history** and export functionality
- [ ] **Advanced filtering** options (confidence threshold adjustment)
- [ ] **TypeScript migration** for better type safety
- [ ] **Progressive Web App** features (offline support, install prompt)
- [ ] **WebCodecs API** integration for better video processing

### Build System Improvements
- [ ] **Bundle analyzer** integration
- [ ] **Automated testing** setup
- [ ] **CI/CD pipeline** configuration
- [ ] **Docker containerization**
- [ ] **Performance benchmarking** automation

## 🤝 Contributing

### Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Test both vanilla and built versions
4. Ensure responsive design works across devices
5. Submit a pull request

### Code Style
- **ES6+ features** - Use modern JavaScript
- **No external dependencies** - Keep it vanilla
- **Mobile-first CSS** - Responsive design principles
- **Comprehensive error handling** - User-friendly messages
- **Performance conscious** - Efficient canvas operations

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **ONNX Runtime team** for WebAssembly implementation
- **YOLO authors** for the object detection models
- **MDN Web Docs** for excellent API documentation
- **Vite team** for the excellent build tool

---

<div align="center">

**Built with ❤️ using Vanilla JavaScript**

[🚀 Live Demo](#) • [📚 Documentation](BUILD.md) • [🐛 Report Bug](issues) • [💡 Request Feature](issues)

</div>