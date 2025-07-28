// Unified Asset Loader with Real Progress Tracking
export class UnifiedAssetLoader {
  constructor() {
    this.isLoading = false;
    this.progressCallback = null;
    this.totalSteps = 100;
    this.currentStep = 0;
    this.lastProgressUpdate = 0;
    this.progressThrottle = 100; // Throttle progress updates to 100ms
    
    // Cache for availability checks
    this.availabilityCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Asset configuration
    this.assets = {
      onnxRuntime: {
        cdnUrl: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js',
        localUrl: './lib/ort.min.js',
        progressWeight: 20 // 0-20% of total progress
      },
      models: {
        cdnBaseUrl: 'https://example-cdn.com/models/',
        localBaseUrl: './models/',
        progressWeight: 80 // 20-100% of total progress
      }
    };
    
    this.timeout = 30000; // 30 seconds for downloads
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Update progress with weighted calculations
   */
  updateProgress(localProgress, stage, message) {
    if (!this.progressCallback) return;
    
    // Throttle progress updates to avoid DOM thrashing
    const now = Date.now();
    if (now - this.lastProgressUpdate < this.progressThrottle) {
      return;
    }
    this.lastProgressUpdate = now;
    
    let totalProgress = 0;
    
    if (stage === 'onnx') {
      // ONNX Runtime: 0-20%
      totalProgress = (localProgress * this.assets.onnxRuntime.progressWeight) / 100;
    } else if (stage === 'model') {
      // Model: 20-100%
      totalProgress = this.assets.onnxRuntime.progressWeight + 
                     (localProgress * this.assets.models.progressWeight) / 100;
    }
    
    this.currentStep = Math.min(100, totalProgress);
    this.progressCallback(this.currentStep, message);
  }

  /**
   * Download asset with real progress tracking
   */
  async downloadWithProgress(url, onProgress, expectedSize = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'force-cache'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentLength = parseInt(response.headers.get('content-length') || expectedSize || '0');
      const reader = response.body?.getReader();
      
      if (!reader) {
        // Fallback for responses without readable stream
        const data = await response.arrayBuffer();
        onProgress && onProgress(100, data.byteLength, data.byteLength);
        clearTimeout(timeoutId);
        return data;
      }
      
      // Track download progress with memory-efficient streaming
      const chunks = [];
      let receivedLength = 0;
      let lastProgressReport = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Throttle progress reports to avoid callback overhead
        if (onProgress && contentLength > 0) {
          const progress = Math.min(100, (receivedLength / contentLength) * 100);
          if (progress - lastProgressReport >= 1) { // Report every 1% change
            onProgress(progress, receivedLength, contentLength);
            lastProgressReport = progress;
          }
        }
      }
      
      clearTimeout(timeoutId);
      
      // More memory-efficient chunk assembly
      if (chunks.length === 1) {
        return chunks[0].buffer.slice(chunks[0].byteOffset, chunks[0].byteOffset + chunks[0].byteLength);
      }
      
      // Only create new buffer if multiple chunks
      const result = new ArrayBuffer(receivedLength);
      const view = new Uint8Array(result);
      let position = 0;
      for (const chunk of chunks) {
        view.set(chunk, position);
        position += chunk.length;
      }
      
      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Download timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Load ONNX Runtime with progress
   */
  async loadOnnxRuntime() {
    this.updateProgress(0, 'onnx', 'Loading ONNX Runtime...');
    
    // Check if already loaded
    if (typeof window.ort !== 'undefined') {
      this.updateProgress(100, 'onnx', 'ONNX Runtime already loaded');
      return true;
    }
    
    const urls = [this.assets.onnxRuntime.cdnUrl, this.assets.onnxRuntime.localUrl];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const source = i === 0 ? 'CDN' : 'Local';
      
      try {
        this.updateProgress(10, 'onnx', `Loading ONNX Runtime from ${source}...`);
        
        if (url.startsWith('./')) {
          // Local file - load as script
          await this.loadScript(url);
          this.updateProgress(100, 'onnx', 'ONNX Runtime loaded successfully');
          return true;
        } else {
          // CDN file - download with progress then execute
          const scriptContent = await this.downloadWithProgress(url, (progress) => {
            this.updateProgress(10 + (progress * 0.8), 'onnx', 
              `Downloading ONNX Runtime... ${Math.round(progress)}%`);
          });
          
          this.updateProgress(95, 'onnx', 'Executing ONNX Runtime...');
          
          // Execute script content
          const script = document.createElement('script');
          script.textContent = new TextDecoder().decode(scriptContent);
          document.head.appendChild(script);
          
          this.updateProgress(100, 'onnx', 'ONNX Runtime loaded successfully');
          return true;
        }
        
      } catch (error) {
        console.warn(`Failed to load ONNX Runtime from ${source}:`, error.message);
        if (i === urls.length - 1) {
          throw new Error('Failed to load ONNX Runtime from all sources');
        }
      }
    }
  }

  /**
   * Load script file (for local ONNX Runtime)
   */
  async loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error(`Script load timeout: ${src}`));
      }, this.timeout);
      
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error(`Failed to load script: ${src}`));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Load model with progress
   */
  async loadModel(filename, expectedSize) {
    this.updateProgress(0, 'model', `Loading model: ${filename}`);
    
    const urls = [
      this.assets.models.cdnBaseUrl + filename,
      this.assets.models.localBaseUrl + filename
    ];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const source = i === 0 ? 'CDN' : 'Local';
      const isLocal = url.startsWith('./');
      
      try {
        this.updateProgress(5, 'model', `Connecting to ${source}...`);
        
        if (isLocal) {
          // Local file - just return URL for ONNX Runtime to load
          this.updateProgress(100, 'model', 'Model loaded from local storage');
          return url;
        } else {
          // CDN file - download with progress
          this.updateProgress(10, 'model', 'Starting download...');
          
          const modelData = await this.downloadWithProgress(url, (progress, received, total) => {
            const mbReceived = (received / 1024 / 1024).toFixed(1);
            const mbTotal = (total / 1024 / 1024).toFixed(1);
            this.updateProgress(10 + (progress * 0.8), 'model', 
              `Downloading model... ${mbReceived}MB / ${mbTotal}MB`);
          }, expectedSize);
          
          this.updateProgress(95, 'model', 'Download complete');
          this.updateProgress(100, 'model', 'Model ready for loading');
          return modelData;
        }
        
      } catch (error) {
        console.warn(`Failed to load model from ${source}:`, error.message);
        if (i === urls.length - 1) {
          throw new Error(`Failed to load model ${filename} from all sources`);
        }
      }
    }
  }

  /**
   * Check if URL is available (quick HEAD request with caching)
   */
  async checkAvailability(url) {
    // Check cache first
    const cached = this.availabilityCache.get(url);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.available;
    }
    
    try {
      const response = await fetch(url, { 
        method: 'HEAD', 
        cache: 'force-cache',
        signal: AbortSignal.timeout(5000)
      });
      const available = response.ok;
      
      // Cache result
      this.availabilityCache.set(url, {
        available,
        timestamp: Date.now()
      });
      
      return available;
    } catch {
      // Cache negative result too
      this.availabilityCache.set(url, {
        available: false,
        timestamp: Date.now()
      });
      return false;
    }
  }

  /**
   * Get loading status
   */
  getLoadingStatus() {
    return {
      isLoading: this.isLoading,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps
    };
  }

  /**
   * Cleanup resources to prevent memory leaks
   */
  cleanup() {
    this.progressCallback = null;
    this.isLoading = false;
    this.currentStep = 0;
    this.lastProgressUpdate = 0;
    this.availabilityCache.clear();
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [url, data] of this.availabilityCache.entries()) {
      if (now - data.timestamp > this.cacheTimeout) {
        this.availabilityCache.delete(url);
      }
    }
  }
}