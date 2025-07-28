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
    this.maxCacheAge = 300000; // 5 minutes
    
    // Periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldAttempts();
    }, 60000); // Cleanup every minute
  }

  /**
   * Verify if asset is available for download before showing loading UI
   * @param {string} assetType - 'models' or 'onnxRuntime'
   * @param {string} filename - Asset filename
   * @param {Object} options - Loading options
   * @returns {Promise<{url: string, source: string, isDownloadable: boolean}>}
   */
  async verifyAssetAvailability(assetType, filename, options = {}) {
    const attemptKey = `${assetType}:${filename}`;
    
    // Check cache first
    if (this.loadAttempts.has(attemptKey)) {
      const previousAttempt = this.loadAttempts.get(attemptKey);
      if (previousAttempt.success) {
        return {
          url: previousAttempt.url,
          source: previousAttempt.source,
          isDownloadable: !previousAttempt.url.startsWith('./')
        };
      }
    }

    const urls = this.getAssetUrls(assetType, filename);
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const source = i === 0 ? 'CDN' : 'Local';
      const isLocal = url.startsWith('./') || url.startsWith('/');
      
      try {
        console.log(`🔍 Verifying ${assetType}/${filename} from ${source}: ${url}`);
        
        // For local files, assume they exist (can't verify without download)
        if (isLocal) {
          console.log(`✅ Local ${assetType}/${filename} assumed available`);
          return {
            url,
            source,
            isDownloadable: false // Local files don't need download progress
          };
        }
        
        // For CDN files, verify with HEAD request
        const success = await this.checkAssetHead(url, options);
        
        if (success) {
          console.log(`✅ CDN ${assetType}/${filename} verified available`);
          return {
            url,
            source,
            isDownloadable: true // CDN files show download progress
          };
        }
        
      } catch (error) {
        console.warn(`❌ Failed to verify ${assetType}/${filename} from ${source}:`, error.message);
      }
    }
    
    throw new Error(`No available source found for ${assetType}/${filename}`);
  }

  /**
   * Download asset with real progress tracking
   * @param {string} url - Asset URL to download
   * @param {Object} options - Download options
   * @returns {Promise<ArrayBuffer>} - Downloaded asset data
   */
  async downloadAssetWithProgress(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 3); // Longer timeout for downloads
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'force-cache',
        headers: {
          'Accept': 'application/octet-stream, */*',
          'Cache-Control': 'max-age=3600'
        },
        ...options.fetchOptions
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      const reader = response.body?.getReader();
      
      if (!reader || contentLength === 0) {
        // Fallback for streams without progress
        clearTimeout(timeoutId);
        return await response.arrayBuffer();
      }
      
      // Track download progress
      const chunks = [];
      let receivedLength = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Report progress
        if (options.onProgress && contentLength > 0) {
          const progress = (receivedLength / contentLength) * 100;
          options.onProgress(progress, receivedLength, contentLength);
        }
      }
      
      clearTimeout(timeoutId);
      
      // Combine chunks into single ArrayBuffer
      const allChunks = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      
      return allChunks.buffer;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Download timeout after ${this.timeout * 3}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Load asset with CDN-first, local fallback strategy
   * @param {string} assetType - 'models' or 'onnxRuntime'
   * @param {string} filename - Asset filename
   * @param {Object} options - Loading options
   * @returns {Promise<string|ArrayBuffer>} - Final asset URL or data
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
        
        // For local files, skip verification and trust they exist
        // ONNX Runtime will give us a better error if the file doesn't exist
        if (url.startsWith('./') || url.startsWith('/')) {
          console.log(`✅ Using local ${assetType}/${filename} without verification`);
          
          this.loadAttempts.set(attemptKey, {
            url,
            source,
            success: true,
            timestamp: Date.now()
          });
          
          return url; // Return URL for local files
        }
        
        // For CDN files, download with progress if requested
        if (options.downloadWithProgress && options.onProgress) {
          console.log(`📋 Downloading ${assetType}/${filename} with progress tracking`);
          const data = await this.downloadAssetWithProgress(url, options);
          
          this.loadAttempts.set(attemptKey, {
            url,
            source,
            success: true,
            timestamp: Date.now()
          });
          
          return data; // Return ArrayBuffer for CDN files with progress
        }
        
        // For CDN files without progress, verify availability
        const success = await this.verifyAssetAvailabilityLegacy(url, options);
        
        if (success) {
          console.log(`✅ Successfully verified ${assetType}/${filename} from ${source}`);
          
          this.loadAttempts.set(attemptKey, {
            url,
            source,
            success: true,
            timestamp: Date.now()
          });
          
          return url; // Return URL for CDN files without progress
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
   * Check asset availability with HEAD request
   */
  async checkAssetHead(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'force-cache',
        headers: {
          'Accept': 'application/octet-stream, */*',
          'Cache-Control': 'max-age=3600'
        },
        ...options.fetchOptions
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check content length if specified
      if (options.expectedSize) {
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        const tolerance = options.sizeTolerance || 0.1;
        
        if (contentLength > 0) {
          const sizeDiff = Math.abs(contentLength - options.expectedSize) / options.expectedSize;
          if (sizeDiff > tolerance) {
            console.warn(`⚠️ Size difference detected: expected ~${options.expectedSize}, got ${contentLength} (${(sizeDiff * 100).toFixed(1)}% difference)`);
            // Don't fail on size mismatch for CDN, just warn
          }
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
   * Verify asset availability and size (legacy method)
   */
  async verifyAssetAvailabilityLegacy(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      // For local files, try a simpler GET request to check if accessible
      const method = url.startsWith('./') || url.startsWith('/') ? 'GET' : 'HEAD';
      
      const response = await fetch(url, {
        method: method,
        signal: controller.signal,
        cache: 'force-cache',
        headers: {
          'Accept': 'application/octet-stream, */*',
          'Cache-Control': 'max-age=3600',
          // Only add range header for local files to minimize download
          ...(method === 'GET' && url.startsWith('./') ? { 'Range': 'bytes=0-1023' } : {})
        },
        ...options.fetchOptions
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check content length if specified
      if (options.expectedSize) {
        const contentLength = parseInt(response.headers.get('content-length') || response.headers.get('content-range')?.split('/')[1] || '0');
        const tolerance = options.sizeTolerance || 0.1;
        
        if (contentLength > 0) {
          const sizeDiff = Math.abs(contentLength - options.expectedSize) / options.expectedSize;
          if (sizeDiff > tolerance) {
            console.warn(`⚠️ Size difference detected: expected ~${options.expectedSize}, got ${contentLength} (${(sizeDiff * 100).toFixed(1)}% difference)`);
            // Don't fail on size mismatch for local files, just warn
            if (!url.startsWith('./')) {
              throw new Error(`Size mismatch: expected ~${options.expectedSize}, got ${contentLength} (${(sizeDiff * 100).toFixed(1)}% difference)`);
            }
          }
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
   * Clean up old load attempts to prevent memory leaks
   */
  cleanupOldAttempts() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, attempt] of this.loadAttempts) {
      if (now - attempt.timestamp > this.maxCacheAge) {
        this.loadAttempts.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old asset load attempts`);
    }
  }

  /**
   * Destroy asset manager and cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.loadAttempts.clear();
  }

  /**
   * Preload critical assets
   */
  async preloadCriticalAssets() {
    const criticalAssets = [
      { type: 'models', filename: 'yolov10n.onnx', expectedSize: 9309375 }
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