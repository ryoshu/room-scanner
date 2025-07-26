// Dependency loader with CDN fallback for critical runtime dependencies
import { AssetManager } from './assetManager.js';

export class DependencyLoader {
  constructor() {
    this.assetManager = new AssetManager();
    this.loadedDependencies = new Set();
    this.loadingPromises = new Map();
  }

  /**
   * Load ONNX Runtime with comprehensive fallback strategy
   */
  async loadOnnxRuntime() {
    const depKey = 'onnxruntime';
    
    // Return cached promise if already loading
    if (this.loadingPromises.has(depKey)) {
      return this.loadingPromises.get(depKey);
    }

    // Return immediately if already loaded
    if (this.loadedDependencies.has(depKey) && typeof ort !== 'undefined') {
      return { source: 'cached', version: ort.version || 'unknown' };
    }

    const loadPromise = this._loadOnnxRuntimeInternal();
    this.loadingPromises.set(depKey, loadPromise);

    try {
      const result = await loadPromise;
      this.loadedDependencies.add(depKey);
      return result;
    } finally {
      this.loadingPromises.delete(depKey);
    }
  }

  async _loadOnnxRuntimeInternal() {
    const strategies = [
      {
        name: 'CDN Primary',
        url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js',
        source: 'CDN-Primary'
      },
      {
        name: 'CDN Fallback',
        url: 'https://unpkg.com/onnxruntime-web@1.18.0/dist/ort.min.js',
        source: 'CDN-Fallback'
      },
      {
        name: 'Local Fallback',
        url: './lib/ort.min.js',
        source: 'Local'
      }
    ];

    for (const strategy of strategies) {
      try {
        console.log(`🔄 Loading ONNX Runtime from ${strategy.name}: ${strategy.url}`);
        
        await this._loadScript(strategy.url);
        
        // Verify ONNX Runtime is available and functional
        if (typeof ort === 'undefined') {
          throw new Error('ONNX Runtime object not available after script load');
        }
        
        // Test basic functionality
        await this._verifyOnnxRuntime();
        
        console.log(`✅ ONNX Runtime loaded successfully from ${strategy.name}`);
        
        // Configure WASM paths
        this._configureOnnxRuntime();
        
        return {
          source: strategy.source,
          url: strategy.url,
          version: ort.version || 'unknown'
        };
        
      } catch (error) {
        console.warn(`❌ Failed to load ONNX Runtime from ${strategy.name}:`, error.message);
        continue;
      }
    }
    
    throw new Error('Failed to load ONNX Runtime from all available sources');
  }

  /**
   * Load script with timeout and error handling
   */
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        // Script exists, but check if it loaded successfully
        if (typeof ort !== 'undefined') {
          resolve();
          return;
        } else {
          // Remove failed script
          existingScript.remove();
        }
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error(`Script load timeout: ${src}`));
      }, 15000); // 15 second timeout for large files
      
      script.onload = () => {
        clearTimeout(timeout);
        console.log(`📦 Script loaded: ${src}`);
        resolve();
      };
      
      script.onerror = (event) => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error(`Failed to load script: ${src} - ${event.message || 'Unknown error'}`));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Verify ONNX Runtime functionality
   */
  async _verifyOnnxRuntime() {
    try {
      // Test basic ONNX Runtime functionality
      if (!ort.InferenceSession) {
        throw new Error('InferenceSession not available');
      }
      
      if (!ort.Tensor) {
        throw new Error('Tensor not available');
      }
      
      // Test WASM backend availability
      const backends = ort.env.webgl ? ['webgl', 'wasm'] : ['wasm'];
      console.log(`🔧 Available ONNX backends: ${backends.join(', ')}`);
      
      return true;
    } catch (error) {
      throw new Error(`ONNX Runtime verification failed: ${error.message}`);
    }
  }

  /**
   * Configure ONNX Runtime paths and settings
   */
  _configureOnnxRuntime() {
    try {
      // Set WASM paths to local directory
      ort.env.wasm.wasmPaths = './js/';
      
      // Configure other ONNX Runtime settings
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
      ort.env.wasm.simd = true;
      
      // Enable logging in development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        ort.env.logLevel = 'warning';
      }
      
      console.log('⚙️ ONNX Runtime configured successfully');
      
    } catch (error) {
      console.warn('⚠️ ONNX Runtime configuration warning:', error.message);
    }
  }

  /**
   * Preload all dependencies
   */
  async preloadDependencies() {
    console.log('🚀 Preloading dependencies...');
    
    const results = [];
    
    try {
      const onnxResult = await this.loadOnnxRuntime();
      results.push({ 
        dependency: 'ONNX Runtime', 
        success: true, 
        ...onnxResult 
      });
    } catch (error) {
      results.push({ 
        dependency: 'ONNX Runtime', 
        success: false, 
        error: error.message 
      });
    }
    
    return results;
  }

  /**
   * Get dependency loading status
   */
  getStatus() {
    return {
      loadedDependencies: Array.from(this.loadedDependencies),
      onnxRuntimeAvailable: typeof ort !== 'undefined',
      onnxRuntimeVersion: typeof ort !== 'undefined' ? (ort.version || 'unknown') : null,
      activeLoads: Array.from(this.loadingPromises.keys())
    };
  }

  /**
   * Check if all critical dependencies are loaded
   */
  allDependenciesLoaded() {
    return this.loadedDependencies.has('onnxruntime') && typeof ort !== 'undefined';
  }
}