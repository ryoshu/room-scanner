// Asset management system with CDN-first, local fallback strategy
export class AssetManager {
  constructor() {
    this.cdnConfig = {
      baseUrls: {
        // Example CDN URLs (will fallback to local if not available)
        models: 'https://example-cdn.com/models/',
        onnxRuntime: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/'
      },
      fallbackUrls: {
        models: './models/',
        onnxRuntime: './lib/'
      }
    };
    
    this.loadAttempts = new Map();
    this.maxRetries = 2;
    this.timeout = 10000; // 10 seconds
  }

  /**
   * Load asset with CDN-first, local fallback strategy
   * @param {string} assetType - 'models' or 'onnxRuntime'
   * @param {string} filename - Asset filename
   * @param {Object} options - Loading options
   * @returns {Promise<string>} - Final asset URL that worked
   */
  async loadAsset(assetType, filename, options = {}) {
    const attemptKey = `${assetType}:${filename}`;
    
    // Check if we've already tried this asset
    if (this.loadAttempts.has(attemptKey)) {
      const previousAttempt = this.loadAttempts.get(attemptKey);
      if (previousAttempt.success) {
        return previousAttempt.url;
      }
    }

    const urls = this.getAssetUrls(assetType, filename);
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const source = i === 0 ? 'CDN' : 'Local';
      
      try {
        console.log(`📦 Loading ${assetType}/${filename} from ${source}: ${url}`);
        
        const success = await this.verifyAssetAvailability(url, options);
        
        if (success) {
          console.log(`✅ Successfully loaded ${assetType}/${filename} from ${source}`);
          
          this.loadAttempts.set(attemptKey, {
            url,
            source,
            success: true,
            timestamp: Date.now()
          });
          
          return url;
        }
        
      } catch (error) {
        console.warn(`❌ Failed to load ${assetType}/${filename} from ${source}:`, error.message);
        
        // Record failed attempt
        this.loadAttempts.set(attemptKey, {
          url,
          source,
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }
    
    throw new Error(`Failed to load ${assetType}/${filename} from all sources`);
  }

  /**
   * Get prioritized URLs for an asset (CDN first, then local)
   */
  getAssetUrls(assetType, filename) {
    const cdnUrl = this.cdnConfig.baseUrls[assetType] + filename;
    const localUrl = this.cdnConfig.fallbackUrls[assetType] + filename;
    
    // If CDN and local URLs are the same, only return one
    if (cdnUrl === localUrl) {
      return [localUrl];
    }
    
    return [cdnUrl, localUrl];
  }

  /**
   * Verify asset availability and size
   */
  async verifyAssetAvailability(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        ...options.fetchOptions
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check content length if specified
      if (options.expectedSize) {
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        if (contentLength > 0 && Math.abs(contentLength - options.expectedSize) > options.expectedSize * 0.1) {
          throw new Error(`Size mismatch: expected ~${options.expectedSize}, got ${contentLength}`);
        }
      }
      
      return true;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Load ONNX Runtime with fallback
   */
  async loadOnnxRuntime() {
    try {
      // Try CDN first
      await this.loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js');
      console.log('✅ ONNX Runtime loaded from CDN');
      return 'CDN';
      
    } catch (error) {
      console.warn('❌ CDN failed, trying local fallback:', error.message);
      
      try {
        // Fallback to local version
        await this.loadScript('./lib/ort.min.js');
        console.log('✅ ONNX Runtime loaded from local fallback');
        return 'Local';
        
      } catch (localError) {
        console.error('❌ Local fallback also failed:', localError.message);
        throw new Error('Failed to load ONNX Runtime from both CDN and local sources');
      }
    }
  }

  /**
   * Dynamically load a script with timeout
   */
  async loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
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
   * Get loading statistics
   */
  getLoadingStats() {
    const stats = {
      total: 0,
      cdnSuccess: 0,
      localSuccess: 0,
      failures: 0,
      assets: []
    };
    
    for (const [key, attempt] of this.loadAttempts) {
      stats.total++;
      stats.assets.push({
        asset: key,
        source: attempt.source,
        success: attempt.success,
        url: attempt.url,
        timestamp: attempt.timestamp
      });
      
      if (attempt.success) {
        if (attempt.source === 'CDN') {
          stats.cdnSuccess++;
        } else {
          stats.localSuccess++;
        }
      } else {
        stats.failures++;
      }
    }
    
    return stats;
  }

  /**
   * Preload critical assets
   */
  async preloadCriticalAssets() {
    const criticalAssets = [
      { type: 'models', filename: 'yolov10n.onnx', expectedSize: 5000000 }
    ];
    
    const results = [];
    
    for (const asset of criticalAssets) {
      try {
        const url = await this.loadAsset(asset.type, asset.filename, {
          expectedSize: asset.expectedSize
        });
        results.push({ ...asset, success: true, url });
      } catch (error) {
        results.push({ ...asset, success: false, error: error.message });
      }
    }
    
    return results;
  }
}