// Model management and configuration
export class ModelManager {
  constructor() {
    // Model configurations: [resolution, filename]
    this.RES_TO_MODEL = [
      [[256, 256], 'yolov10n.onnx'],
      [[256, 256], 'yolov7-tiny_256x256.onnx'],
      [[320, 320], 'yolov7-tiny_320x320.onnx'],
      [[640, 640], 'yolov7-tiny_640x640.onnx'],
    ];
    
    this.currentModelIndex = 0;
    this.currentSession = null;
    this.isLoading = false;
  }

  getCurrentModelConfig() {
    return {
      resolution: this.RES_TO_MODEL[this.currentModelIndex][0],
      filename: this.RES_TO_MODEL[this.currentModelIndex][1],
      name: this.RES_TO_MODEL[this.currentModelIndex][1]
    };
  }

  async loadCurrentModel() {
    const config = this.getCurrentModelConfig();
    const modelPath = `./models/${config.filename}`;
    
    try {
      this.isLoading = true;
      console.log(`Loading model: ${config.filename} from ${modelPath}`);
      
      // Check if file exists first
      const response = await fetch(modelPath, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Model file not found: ${modelPath} (HTTP ${response.status})`);
      }
      
      console.log(`Model file found, creating ONNX session...`);
      
      // Set ONNX Runtime configuration  
      ort.env.wasm.wasmPaths = './js/';
      
      // Create ONNX inference session
      this.currentSession = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      
      console.log(`Model loaded successfully: ${config.filename}`);
      console.log('Input names:', this.currentSession.inputNames);
      console.log('Output names:', this.currentSession.outputNames);
      
      return this.currentSession;
    } catch (error) {
      console.error(`Failed to load model ${config.filename}:`, error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      let errorMessage = `Failed to load model ${config.filename}`;
      if (error.message) {
        errorMessage += `: ${error.message}`;
      } else if (typeof error === 'number') {
        errorMessage += ` (Error code: ${error})`;
      }
      
      throw new Error(errorMessage);
    } finally {
      this.isLoading = false;
    }
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
}