import { defineConfig } from 'vite';

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
          // Separate vendor chunk for ONNX Runtime (loaded via CDN, so this won't apply)
          // Keep all app code together since it's relatively small
        }
      }
    },

    // Asset handling
    assetsDir: 'assets',
    copyPublicDir: true,

    // Terser options for better minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    }
  },

  // Asset optimization
  assetsInclude: ['**/*.onnx'], // Include ONNX model files as assets

  // Base path (useful for deployment to subdirectories)
  base: './',

  // Plugin configuration
  plugins: [],

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