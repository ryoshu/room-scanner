// Model management and configuration with CDN fallback support
import { AssetManager } from './assetManager.js';

export class ModelManager {
  constructor() {
    // Model configurations: [resolution, filename, expectedSize, priority]
    this.RES_TO_MODEL = [
      [[256, 256], 'yolov10n.onnx', 9309375, 'high'],      // Smallest, fastest
      [[256, 256], 'yolov7-tiny_256x256.onnx', 24943827, 'high'],
      [[320, 320], 'yolov7-tiny_320x320.onnx', 24949875, 'medium'],
      [[640, 640], 'yolov7-tiny_640x640.onnx', 25000320, 'low'], // Largest, slowest
    ];
    
    this.currentModelIndex = 0;
    this.currentSession = null;
    this.isLoading = false;
    this.assetManager = new AssetManager();
    this.loadedModels = new Map(); // Cache for loaded models
    this.fallbackAttempted = false;
  }

  getCurrentModelConfig() {
    const model = this.RES_TO_MODEL[this.currentModelIndex];
    return {
      resolution: model[0],
      filename: model[1],
      expectedSize: model[2],
      priority: model[3],
      name: model[1]
    };
  }

  async loadCurrentModel() {
    const config = this.getCurrentModelConfig();
    
    try {
      this.isLoading = true;
      console.log(`🚀 Loading model: ${config.filename}`);
      
      // Check if model is already cached
      const cacheKey = config.filename;
      if (this.loadedModels.has(cacheKey)) {
        console.log(`📋 Using cached model: ${config.filename}`);
        this.currentSession = this.loadedModels.get(cacheKey);
        return this.currentSession;
      }
      
      // Get model URL with CDN-first, local fallback strategy
      const modelUrl = await this.assetManager.loadAsset('models', config.filename, {
        expectedSize: config.expectedSize
      });
      
      console.log(`📦 Model URL resolved: ${modelUrl}`);
      console.log(`⚙️ Creating ONNX session...`);
      
      // Set ONNX Runtime configuration  
      ort.env.wasm.wasmPaths = './js/';
      
      // Create ONNX inference session
      this.currentSession = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      
      // Cache the loaded model
      this.loadedModels.set(cacheKey, this.currentSession);
      
      console.log(`✅ Model loaded successfully: ${config.filename}`);
      console.log('📥 Input names:', this.currentSession.inputNames);
      console.log('📤 Output names:', this.currentSession.outputNames);
      
      return this.currentSession;
      
    } catch (error) {
      console.error(`❌ Failed to load model ${config.filename}:`, error);
      
      // Try fallback strategy if not already attempted
      if (!this.fallbackAttempted) {
        console.log(`🔄 Attempting fallback strategy...`);
        return await this.attemptFallbackLoading(config, error);
      }
      
      // Format error message
      let errorMessage = `Failed to load model ${config.filename}`;
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Attempt fallback loading strategies
   */
  async attemptFallbackLoading(config, originalError) {
    this.fallbackAttempted = true;
    
    try {
      console.log(`🔄 Trying smaller fallback models...`);
      
      // Try loading the smallest available model instead
      const smallestModelIndex = this.findSmallestAvailableModel();
      if (smallestModelIndex !== this.currentModelIndex) {
        const originalIndex = this.currentModelIndex;
        this.currentModelIndex = smallestModelIndex;
        
        try {
          const result = await this.loadCurrentModel();
          console.log(`✅ Fallback successful with smaller model`);
          return result;
        } catch (fallbackError) {
          // Restore original index if fallback failed
          this.currentModelIndex = originalIndex;
          throw fallbackError;
        }
      }
      
      throw originalError;
      
    } catch (error) {
      console.error(`❌ All fallback strategies failed:`, error);
      throw new Error(`Unable to load any YOLO models. Please check your internet connection and try again.`);
    }
  }

  /**
   * Find the smallest available model for fallback
   */
  findSmallestAvailableModel() {
    // Sort by expected size and return the index of the smallest
    let smallestIndex = 0;
    let smallestSize = this.RES_TO_MODEL[0][2];
    
    for (let i = 1; i < this.RES_TO_MODEL.length; i++) {
      const size = this.RES_TO_MODEL[i][2];
      if (size < smallestSize) {
        smallestSize = size;
        smallestIndex = i;
      }
    }
    
    return smallestIndex;
  }

  async switchToNextModel() {
    // Move to next model in the array
    this.currentModelIndex = (this.currentModelIndex + 1) % this.RES_TO_MODEL.length;
    
    // Load the new model
    await this.loadCurrentModel();
    
    return this.getCurrentModelConfig();
  }

  async runInference(preprocessedData) {
    if (!this.currentSession) {
      throw new Error('No model loaded');
    }

    try {
      const feeds = {};
      feeds[this.currentSession.inputNames[0]] = preprocessedData;
      
      const start = Date.now();
      const outputData = await this.currentSession.run(feeds);
      const end = Date.now();
      
      const inferenceTime = end - start;
      const output = outputData[this.currentSession.outputNames[0]];
      
      return [output, inferenceTime];
    } catch (error) {
      console.error('Inference failed:', error);
      throw new Error(`Inference failed: ${error.message}`);
    }
  }

  isModelLoading() {
    return this.isLoading;
  }

  getSession() {
    return this.currentSession;
  }

  /**
   * Get loading statistics from asset manager
   */
  getLoadingStats() {
    return this.assetManager.getLoadingStats();
  }

  /**
   * Preload high-priority models
   */
  async preloadModels() {
    const highPriorityModels = this.RES_TO_MODEL
      .map((model, index) => ({ ...model, index }))
      .filter(model => model[3] === 'high') // Filter by priority
      .sort((a, b) => a[2] - b[2]); // Sort by size (smallest first)
    
    console.log(`🚀 Preloading ${highPriorityModels.length} high-priority models...`);
    
    const results = [];
    for (const model of highPriorityModels) {
      try {
        await this.assetManager.loadAsset('models', model[1], {
          expectedSize: model[2]
        });
        results.push({ filename: model[1], success: true });
      } catch (error) {
        console.warn(`⚠️ Failed to preload ${model[1]}:`, error.message);
        results.push({ filename: model[1], success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Clear model cache
   */
  clearCache() {
    this.loadedModels.clear();
    console.log('🗑️ Model cache cleared');
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo() {
    const info = {
      cachedModels: this.loadedModels.size,
      currentModel: this.getCurrentModelConfig().filename,
      loadingStats: this.getLoadingStats()
    };
    
    if (performance.memory) {
      info.memoryUsage = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    
    return info;
  }
}