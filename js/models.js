// Model management and configuration with CDN fallback support
import { AssetManager } from './assetManager.js';
// YOLO-World functionality commented out
// import { yoloWorldClasses, classCategories, defaultPrompts, yoloWorldConfig } from '../data/yolo_world_classes.js';

export class ModelManager {
  constructor() {
    // Model configurations: [resolution, filename, expectedSize, priority, type, description]
    this.RES_TO_MODEL = [
      [[640, 640], 'yolov10n.onnx', 9309375, 'high', 'yolo-standard', 'YOLOv10n 640x640'],
      [[256, 256], 'yolov7-tiny_256x256.onnx', 24943827, 'medium', 'yolo-standard', 'YOLOv7-Tiny 256x256'],
      [[320, 320], 'yolov7-tiny_320x320.onnx', 24949875, 'medium', 'yolo-standard', 'YOLOv7-Tiny 320x320'],
      [[640, 640], 'yolov7-tiny_640x640.onnx', 25000320, 'low', 'yolo-standard', 'YOLOv7-Tiny 640x640'],
    ];
    
    this.currentModelIndex = 0;
    this.currentSession = null;
    this.isLoading = false;
    this.assetManager = new AssetManager();
    this.loadedModels = new Map(); // Cache for loaded models
    this.fallbackAttempted = false;
    
    // Progress tracking
    this.progressCallback = null;
    this.loadingProgress = 0;
    
    // YOLO-World specific properties - commented out
    /*
    this.currentPrompts = [...defaultPrompts];
    this.isYoloWorld = false;
    this.textEmbeddings = new Map(); // Cache for text embeddings
    this.customClasses = [...yoloWorldClasses];
    */
  }

  getCurrentModelConfig() {
    const model = this.RES_TO_MODEL[this.currentModelIndex];
    return {
      resolution: model[0],
      filename: model[1],
      expectedSize: model[2],
      priority: model[3],
      type: model[4] || 'yolo-standard',
      description: model[5] || model[1],
      name: model[1],
      isYoloWorld: model[4] === 'yolo-world-sim' || model[4] === 'yolo-world'
    };
  }

  async loadCurrentModel() {
    const config = this.getCurrentModelConfig();
    
    try {
      this.isLoading = true;
      this.loadingProgress = 0;
      console.log(`🚀 Loading model: ${config.filename}`);
      
      // First, silently verify if the model is available for download
      console.log(`🔍 Checking model availability...`);
      
      // Check if model is already cached
      const cacheKey = config.filename;
      if (this.loadedModels.has(cacheKey)) {
        console.log(`📋 Using cached model: ${config.filename}`);
        // For cached models, show progress briefly then complete
        this.updateProgress(0, 'Loading from cache...');
        setTimeout(() => this.updateProgress(100, 'Model loaded from cache'), 100);
        this.currentSession = this.loadedModels.get(cacheKey);
        return this.currentSession;
      }
      
      // Verify asset availability first (this determines if we show progress)
      const verification = await this.assetManager.verifyAssetAvailability('models', config.filename, {
        expectedSize: config.expectedSize
      });
      
      // Only start showing progress if this is a downloadable asset
      if (verification.isDownloadable) {
        this.updateProgress(0, 'Starting model download...');
        this.updateProgress(5, 'Connecting to server...');
      } else {
        // For local files, show minimal progress
        this.updateProgress(0, 'Loading local model...');
      }
      
      console.log(`📦 Model URL resolved: ${verification.url}`);
      console.log(`⚙️ Creating ONNX session...`);
      
      // Set ONNX Runtime configuration  
      ort.env.wasm.wasmPaths = './js/';
      
      let modelData;
      
      if (verification.isDownloadable) {
        this.updateProgress(10, 'Downloading model...');
        
        // Download with real progress tracking
        modelData = await this.assetManager.loadAsset('models', config.filename, {
          expectedSize: config.expectedSize,
          downloadWithProgress: true,
          onProgress: (progress, received, total) => {
            // Map download progress to 10-70% of total progress
            const mappedProgress = 10 + (progress * 0.6);
            const mbReceived = (received / 1024 / 1024).toFixed(1);
            const mbTotal = (total / 1024 / 1024).toFixed(1);
            this.updateProgress(mappedProgress, `Downloading model... ${mbReceived}MB / ${mbTotal}MB`);
          }
        });
        
        this.updateProgress(75, 'Download complete, initializing model...');
        
        // Create ONNX session from downloaded data
        this.currentSession = await ort.InferenceSession.create(modelData, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
      } else {
        // For local files, load without detailed progress
        this.updateProgress(50, 'Loading model...');
        modelData = await this.assetManager.loadAsset('models', config.filename, {
          expectedSize: config.expectedSize
        });
        
        this.currentSession = await ort.InferenceSession.create(modelData, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
      }
      
      if (verification.isDownloadable) {
        this.updateProgress(90, 'Finalizing model setup...');
      }
      
      // Check memory pressure before caching
      this.manageMemoryPressure();
      
      // Cache the loaded model
      this.loadedModels.set(cacheKey, this.currentSession);
      
      // Update YOLO-World state - commented out
      /*
      this.isYoloWorld = config.isYoloWorld;
      */
      
      this.updateProgress(100, 'Model loaded successfully!');
      console.log(`✅ Model loaded successfully: ${config.filename}`);
      console.log('📥 Input names:', this.currentSession.inputNames);
      console.log('📤 Output names:', this.currentSession.outputNames);
      
      /*
      if (this.isYoloWorld) {
        console.log('🌍 YOLO-World mode enabled with prompts:', this.currentPrompts);
        console.log('🔧 Using confidence threshold:', yoloWorldConfig.confidenceThreshold);
      }
      */
      
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
      this.loadingProgress = 100;
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
   * Manage memory pressure by clearing cache when needed
   */
  manageMemoryPressure() {
    if (performance.memory) {
      const memInfo = performance.memory;
      const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
      
      if (usageRatio > 0.8) {
        console.warn('🧠 Memory pressure detected, clearing model cache');
        this.clearCache();
        
        // Force garbage collection if available (Chrome DevTools)
        if (typeof gc === 'function') {
          gc();
        }
        
        return true;
      }
    }
    return false;
  }

  /**
   * Set progress callback for loading updates
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Update loading progress (only if callback is set)
   */
  updateProgress(percentage, message) {
    this.loadingProgress = Math.max(0, Math.min(100, percentage));
    if (this.progressCallback) {
      this.progressCallback(this.loadingProgress, message);
    }
  }


  // Removed createSessionWithProgress - now using real download progress

  /**
   * Get current loading progress
   */
  getLoadingProgress() {
    return this.loadingProgress;
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
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
        usageRatio: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
      };
    }
    
    return info;
  }

  /**
   * YOLO-World specific methods - COMMENTED OUT
   */

  /*
  // Update text prompts for YOLO-World
  setTextPrompts(prompts) {
    if (!Array.isArray(prompts)) {
      prompts = [prompts];
    }
    
    this.currentPrompts = prompts.filter(p => p && p.trim().length > 0);
    console.log('🌍 Updated YOLO-World prompts:', this.currentPrompts);
    
    // For simulation, map prompts to existing COCO classes
    this.customClasses = this.mapPromptsToClasses(this.currentPrompts);
    
    return this.currentPrompts;
  }

  // Get current text prompts
  getTextPrompts() {
    return [...this.currentPrompts];
  }

  // Add a new text prompt
  addTextPrompt(prompt) {
    if (prompt && prompt.trim().length > 0) {
      const cleanPrompt = prompt.trim().toLowerCase();
      if (!this.currentPrompts.includes(cleanPrompt)) {
        this.currentPrompts.push(cleanPrompt);
        this.customClasses = this.mapPromptsToClasses(this.currentPrompts);
        console.log('🌍 Added prompt:', cleanPrompt);
      }
    }
    return this.currentPrompts;
  }

  // Remove a text prompt
  removeTextPrompt(prompt) {
    const index = this.currentPrompts.indexOf(prompt);
    if (index > -1) {
      this.currentPrompts.splice(index, 1);
      this.customClasses = this.mapPromptsToClasses(this.currentPrompts);
      console.log('🌍 Removed prompt:', prompt);
    }
    return this.currentPrompts;
  }

  // Get class categories for UI
  getClassCategories() {
    return classCategories;
  }

  // Set prompts from category
  setPromptsFromCategory(category) {
    if (classCategories[category]) {
      this.setTextPrompts(classCategories[category]);
    }
    return this.currentPrompts;
  }

  // Check if current model is YOLO-World
  isCurrentModelYoloWorld() {
    return this.isYoloWorld;
  }

  // Get YOLO-World configuration
  getYoloWorldConfig() {
    return {
      ...yoloWorldConfig,
      isEnabled: this.isYoloWorld,
      currentPrompts: this.currentPrompts,
      customClasses: this.customClasses
    };
  }

  // Map text prompts to existing COCO classes for simulation
  // In a real YOLO-World implementation, this would use text embeddings
  mapPromptsToClasses(prompts) {
    const cocoClasses = [
      'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
      'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
      'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
      'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
      'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
      'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
      'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
      'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
      'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
      'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ];

    // Map prompts to COCO classes using fuzzy matching
    const mappedClasses = [];
    
    for (const prompt of prompts) {
      const lowerPrompt = prompt.toLowerCase();
      
      // Direct match
      const directMatch = cocoClasses.find(cls => cls.toLowerCase() === lowerPrompt);
      if (directMatch) {
        mappedClasses.push(directMatch);
        continue;
      }
      
      // Partial match
      const partialMatch = cocoClasses.find(cls => 
        cls.toLowerCase().includes(lowerPrompt) || lowerPrompt.includes(cls.toLowerCase())
      );
      if (partialMatch) {
        mappedClasses.push(partialMatch);
        continue;
      }
      
      // Synonym mapping for common cases
      const synonymMap = {
        'man': 'person', 'woman': 'person', 'people': 'person',
        'vehicle': 'car', 'auto': 'car', 'automobile': 'car',
        'phone': 'cell phone', 'mobile': 'cell phone',
        'computer': 'laptop', 'notebook': 'laptop',
        'food': 'sandwich', 'meal': 'sandwich'
      };
      
      if (synonymMap[lowerPrompt]) {
        mappedClasses.push(synonymMap[lowerPrompt]);
      }
    }
    
    // Remove duplicates
    return [...new Set(mappedClasses)];
  }
  */
}