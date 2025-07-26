# Build System Documentation

This project supports both **vanilla development** (no build required) and **optimized production builds** using Vite.

## 🚀 Quick Start

### Development (Choose One)

```bash
# Option 1: Vanilla development (no dependencies)
python3 -m http.server 8080
# or
npx http-server -p 8080

# Option 2: Vite development server (with hot reload)
npm install
npm run dev
```

### Production Build

```bash
# Install dependencies
npm install

# Build optimized version
npm run build

# Serve production build
npm run serve
```

## 📁 Directory Structure

```
vanilla/
├── index.html              # Main HTML (works standalone)
├── js/                     # Vanilla JavaScript modules
├── styles/                 # CSS files
├── models/                 # ONNX model files
├── data/                   # Data files
├── dist/                   # Built production files (generated)
├── package.json            # Build configuration
├── vite.config.js          # Vite settings
└── scripts/                # Build scripts
```

## 🛠️ Available Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run dev:custom` | Custom dev server with enhanced logging |
| `npm run serve:vanilla` | Serve vanilla files without build |

### Production

| Command | Description |
|---------|-------------|
| `npm run build` | Build optimized production version |
| `npm run build:prod` | Build with detailed stats and analysis |
| `npm run preview` | Preview production build locally |
| `npm run serve` | Serve production build on port 8080 |

### Utilities

| Command | Description |
|---------|-------------|
| `npm run clean` | Remove dist directory |
| `npm run analyze` | Build with bundle analysis |

## 🎯 Build Features

### Development Benefits
- ⚡ **Hot Module Reload**: Instant updates without page refresh
- 🔍 **Source Maps**: Better debugging experience
- 🌐 **Network Access**: Test on mobile devices
- 📦 **Module Resolution**: Enhanced import handling

### Production Optimizations
- 🗜️ **Minification**: Terser optimization with console removal
- 📦 **Bundling**: Optimized asset loading
- 🎨 **CSS Processing**: Optimized stylesheets
- 📊 **Source Maps**: Optional debugging in production
- 🚀 **Asset Optimization**: Compressed images and files

## 🔧 Configuration

### Vite Configuration (`vite.config.js`)

```javascript
// Key settings
server: {
  port: 3000,
  host: true,    // Network access
  open: true     // Auto-open browser
},

build: {
  outDir: 'dist',
  sourcemap: true,
  minify: 'terser',
  target: 'es2020'
}
```

### Environment Variables

Create `.env` files for different environments:

```bash
# .env.development
VITE_API_URL=http://localhost:3000

# .env.production  
VITE_API_URL=https://your-domain.com
```

## 📈 Performance

### Vanilla vs Built Comparison

| Metric | Vanilla | Built |
|--------|---------|-------|
| **Bundle Size** | ~50KB | ~35KB (minified) |
| **Load Time** | Direct | Optimized |
| **Caching** | Manual | Automatic |
| **Development** | Manual refresh | Hot reload |

## 🚀 Deployment

### Static Hosting (Recommended)
```bash
npm run build
# Upload ./dist/ to your hosting provider
```

### CDN Deployment
```bash
npm run build
# Deploy ./dist/ to CDN with proper cache headers
```

### Docker
```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
```

## 🔍 Troubleshooting

### Common Issues

**Build fails with module errors:**
```bash
npm run clean
npm install
npm run build
```

**Development server won't start:**
```bash
# Check if port 3000 is available
lsof -ti:3000
# Or use different port
npm run dev -- --port 3001
```

**Vanilla version works but built doesn't:**
- Check browser console for errors
- Verify all assets are correctly copied
- Ensure HTTPS for camera access if needed

## 🎨 Customization

### Adding New Build Targets

Edit `vite.config.js`:
```javascript
build: {
  rollupOptions: {
    input: {
      main: 'index.html',
      // Add new entry points here
    }
  }
}
```

### Custom Plugins

```javascript
import { defineConfig } from 'vite';
import somePlugin from 'vite-plugin-example';

export default defineConfig({
  plugins: [
    somePlugin({
      // plugin options
    })
  ]
});
```

## 📝 Notes

- **Vanilla source remains unchanged** - Always runnable without build
- **ONNX models** are large files, consider CDN hosting for production
- **Camera access** requires HTTPS in production environments
- **Build output** is optimized for modern browsers (ES2020+)