import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  // Development server configuration
  server: {
    port: 3000,
    host: true, // Allow access from network
    open: true, // Auto-open browser
    https: false // Enable HTTPS if needed for camera access
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'es2020',
    
    // Optimize chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep all app code together since it's relatively small
        },
        // Preserve asset structure for CDN fallback system
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.onnx')) {
            return 'models/[name][extname]';
          }
          if (assetInfo.name.endsWith('.wasm')) {
            return 'js/[name][extname]';
          }
          if (assetInfo.name === 'ort.min.js') {
            return 'lib/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },

    // Asset handling for CDN fallback system
    assetsDir: 'assets',
    copyPublicDir: true,

    // Terser options for better minification
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.logs for CDN fallback debugging
        drop_debugger: true
      }
    }
  },

  // Asset optimization
  assetsInclude: ['**/*.onnx'], // Include ONNX model files as assets

  // Base path (useful for deployment to subdirectories)
  base: './',

  // Plugin configuration
  plugins: [
    // Custom plugin to handle CDN fallback assets
    {
      name: 'cdn-fallback-assets',
      writeBundle() {
        // Ensure directories exist
        const distDir = 'dist';
        const libDir = join(distDir, 'lib');
        const modelsDir = join(distDir, 'models');
        const jsDir = join(distDir, 'js');
        
        if (!existsSync(libDir)) mkdirSync(libDir, { recursive: true });
        if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true });
        if (!existsSync(jsDir)) mkdirSync(jsDir, { recursive: true });
        
        // Copy CDN fallback assets
        try {
          // Copy ONNX Runtime for local fallback
          if (existsSync('lib/ort.min.js')) {
            copyFileSync('lib/ort.min.js', join(libDir, 'ort.min.js'));
            console.log('✅ Copied ONNX Runtime for CDN fallback');
          }
          
          // Copy WASM files for ONNX Runtime
          const wasmFiles = [
            'ort-wasm.wasm',
            'ort-wasm-simd.wasm', 
            'ort-wasm-threaded.wasm',
            'ort-wasm-simd-threaded.wasm'
          ];
          
          wasmFiles.forEach(file => {
            const srcPath = join('js', file);
            const destPath = join(jsDir, file);
            if (existsSync(srcPath)) {
              copyFileSync(srcPath, destPath);
            }
          });
          console.log('✅ Copied WASM files for ONNX Runtime');
          
          // Copy model files
          const modelFiles = [
            'yolov10n.onnx',
            'yolov7-tiny_256x256.onnx',
            'yolov7-tiny_320x320.onnx', 
            'yolov7-tiny_640x640.onnx'
          ];
          
          modelFiles.forEach(file => {
            const srcPath = join('models', file);
            const destPath = join(modelsDir, file);
            if (existsSync(srcPath)) {
              copyFileSync(srcPath, destPath);
            }
          });
          console.log('✅ Copied model files for local fallback');
          
        } catch (error) {
          console.warn('⚠️ Warning copying CDN fallback assets:', error.message);
        }
      }
    }
  ],

  // Preserve the vanilla structure - no automatic transformations
  optimizeDeps: {
    exclude: [] // Don't pre-bundle anything to keep it vanilla
  },

  // CSS configuration
  css: {
    devSourcemap: true
  },

  // Define environment variables
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
});