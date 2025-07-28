// Service Worker for Object Detection App
const CACHE_VERSION = 'v1.2.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const MODELS_CACHE = `models-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Detect development mode
const isDevelopment = self.location.hostname === 'localhost' || self.location.port === '5173';

// Files to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/js/main.js',
  '/js/camera.js',
  '/js/models.js',
  '/js/inference.js',
  '/js/postprocess.js',
  '/js/constants.js',
  '/js/logger.js',
  '/js/errorBoundary.js',
  '/js/performanceMonitor.js',
  '/js/serviceWorkerManager.js',
  '/js/dependencyLoader.js',
  '/js/unifiedLoader.js',
  '/js/assetManager.js',
  '/data/yolo_classes.js',
  '/data/yolo_world_classes.js',
  '/lib/ort.min.js',
  '/manifest.json'
];

// ONNX models to cache (large files)
const MODEL_FILES = [
  '/models/yolov10n.onnx',
  '/models/yolov7-tiny_256x256.onnx',
  '/models/yolov7-tiny_320x320.onnx',
  '/models/yolov7-tiny_640x640.onnx'
];

// WASM files for ONNX Runtime
const WASM_FILES = [
  '/js/ort-wasm.wasm',
  '/js/ort-wasm-simd.wasm',
  '/js/ort-wasm-threaded.wasm',
  '/js/ort-wasm-simd-threaded.wasm'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...', isDevelopment ? '(Development Mode)' : '(Production Mode)');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets immediately
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      }),
      
      // Cache WASM files (smaller, cache immediately)
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Caching WASM files...');
        return cache.addAll(WASM_FILES);
      })
    ]).then(() => {
      console.log('✅ Service Worker installed successfully');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.includes('static-') && cacheName !== STATIC_CACHE) {
              console.log('🗑️ Deleting old static cache:', cacheName);
              return caches.delete(cacheName);
            }
            if (cacheName.includes('models-') && cacheName !== MODELS_CACHE) {
              console.log('🗑️ Deleting old models cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated');
      
      // Start background model caching
      cacheModelsInBackground();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle requests from our origin
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // In development mode, be more selective about what we cache
  if (isDevelopment) {
    // Skip service worker for Vite dev server assets and HMR
    if (url.pathname.includes('/@vite') || 
        url.pathname.includes('?import') || 
        url.pathname.includes('.ts') ||
        url.pathname.includes('__vite_ping') ||
        url.searchParams.has('t')) {
      console.log('⚡ Bypassing SW for Vite dev asset:', url.pathname);
      return;
    }
    
    // Only handle models in development mode, let everything else pass through
    if (isModelRequest(request)) {
      console.log('🎯 Dev: Handling model request:', url.pathname);
      event.respondWith(handleModelRequest(request));
      return;
    } else {
      console.log('🔄 Dev: Bypassing SW for:', url.pathname);
      return;
    }
  }
  
  // Production mode - handle all requests
  console.log('🌐 SW handling request:', url.pathname, 'Type:', request.destination);
  
  if (isModelRequest(request)) {
    console.log('🎯 Handling as model request:', url.pathname);
    event.respondWith(handleModelRequest(request));
  } else if (isStaticAsset(request)) {
    console.log('📁 Handling as static request:', url.pathname, 'isStaticAsset=true');
    event.respondWith(handleStaticRequest(request));
  } else {
    console.log('🔄 Handling as runtime request:', url.pathname, 'isStaticAsset=false');
    event.respondWith(handleRuntimeRequest(request));
  }
});

// Check if request is for a model file
function isModelRequest(request) {
  return request.url.includes('/models/') && request.url.endsWith('.onnx');
}

// Check if request is for static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Check exact matches first
  if (STATIC_ASSETS.some(asset => pathname === asset) ||
      WASM_FILES.some(file => pathname === file)) {
    return true;
  }
  
  // Check for static file types
  const staticExtensions = ['.css', '.js', '.html', '.json', '.wasm'];
  const hasStaticExtension = staticExtensions.some(ext => pathname.endsWith(ext));
  
  // Check if it's in a static directory
  const staticPaths = ['/styles/', '/js/', '/data/', '/lib/', '/icons/'];
  const isInStaticPath = staticPaths.some(path => pathname.startsWith(path));
  
  // Return true if it's a static file type in a static directory, or root files
  if (hasStaticExtension && (isInStaticPath || pathname === '/' || pathname === '/index.html' || pathname === '/manifest.json')) {
    return true;
  }
  
  return false;
}

// Handle model requests - cache first, network fallback
async function handleModelRequest(request) {
  console.log('🎯 Model request:', request.url);
  
  try {
    const cache = await caches.open(MODELS_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('⚡ Serving model from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('📥 Downloading model:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone response before caching
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
      console.log('💾 Model cached:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Model request failed:', error);
    throw error;
  }
}

// Handle static asset requests - cache first
async function handleStaticRequest(request) {
  const url = request.url;
  
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('⚡ Serving from cache:', url);
      return cachedResponse;
    }
    
    // Fallback to network
    console.log('📥 Fetching from network:', url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Only cache successful responses
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      console.log('💾 Cached static asset:', url);
    } else {
      console.warn('⚠️ Network response not OK:', url, networkResponse.status);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Static request failed for:', url, error);
    
    // Try to return from cache even if network fails
    const cache = await caches.open(STATIC_CACHE);
    const cachedFallback = await cache.match(request);
    if (cachedFallback) {
      console.log('🔄 Fallback to cached version:', url);
      return cachedFallback;
    }
    
    throw error;
  }
}

// Handle runtime requests - network first, cache fallback
async function handleRuntimeRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cache = await caches.open(RUNTIME_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Background model caching
async function cacheModelsInBackground() {
  console.log('🔄 Starting background model caching...');
  
  try {
    const cache = await caches.open(MODELS_CACHE);
    
    for (const modelUrl of MODEL_FILES) {
      try {
        const cachedResponse = await cache.match(modelUrl);
        if (!cachedResponse) {
          console.log('📥 Background caching model:', modelUrl);
          const response = await fetch(modelUrl);
          if (response.ok) {
            await cache.put(modelUrl, response);
            console.log('✅ Model cached in background:', modelUrl);
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to cache model in background:', modelUrl, error);
      }
      
      // Add delay between downloads to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ Background model caching completed');
  } catch (error) {
    console.error('❌ Background caching failed:', error);
  }
}

// Message handling for cache management
self.addEventListener('message', event => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'CACHE_MODEL':
      cacheSpecificModel(payload.modelUrl).then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message });
      });
      break;
      
    case 'CLEAR_MODEL_CACHE':
      clearModelCache().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
});

// Cache specific model
async function cacheSpecificModel(modelUrl) {
  console.log('🎯 Caching specific model:', modelUrl);
  const cache = await caches.open(MODELS_CACHE);
  const response = await fetch(modelUrl);
  if (response.ok) {
    await cache.put(modelUrl, response);
    console.log('✅ Specific model cached:', modelUrl);
  }
}

// Clear model cache
async function clearModelCache() {
  console.log('🗑️ Clearing model cache...');
  await caches.delete(MODELS_CACHE);
  console.log('✅ Model cache cleared');
}

// Get cache status
async function getCacheStatus() {
  const staticCache = await caches.open(STATIC_CACHE);
  const modelsCache = await caches.open(MODELS_CACHE);
  
  const staticKeys = await staticCache.keys();
  const modelKeys = await modelsCache.keys();
  
  return {
    staticAssets: staticKeys.length,
    modelsCount: modelKeys.length,
    modelsCached: modelKeys.map(req => req.url),
    cacheVersion: CACHE_VERSION
  };
}