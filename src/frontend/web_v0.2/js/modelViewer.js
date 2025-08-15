/**
 * Model Viewer Module
 * Handles 3D model display using Three.js
 * @module ModelViewer
 */

/**
 * Model Viewer Class  
 * Manages 3D model loading, display, and interaction
 */
export class ModelViewer {
  constructor(options = {}) {
    this.options = {
      containerId: 'modelViewer',
      canvasId: 'threeCanvas',
      backgroundColor: 0xf5f5f5,
      cameraFov: 75,
      enableControls: true,
      autoRotate: false,
      onViewerReady: () => {},
      onModelLoaded: () => {},
      onError: () => {},
      ...options
    };

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.lights = [];
    this.isReady = false;
    this.isLoading = false;
    
    this.animationId = null;
    this.loadedModelUrl = null;

    this.init();
  }

  /**
   * Initialize the model viewer
   */
  async init() {
    try {
      console.log('ModelViewer: Initializing...');
      
      // Check if Three.js is already loaded
      if (window.THREE) {
        console.log('Three.js already loaded via script tag');
        this.THREE = window.THREE;
      } else {
        console.log('Loading Three.js dynamically...');
        await this.loadThreeJS();
      }
      
      // Check if additional modules are needed
      const needsModuleLoading = !window.THREE?.GLTFLoader && !window.GLTFLoader;
      if (needsModuleLoading) {
        console.log('Loading additional Three.js modules...');
        await this.loadThreeJSModules();
      } else {
        console.log('Three.js modules already loaded via script tags');
      }

      console.log('Setting up DOM elements...');
      this.setupElements();
      
      console.log('Setting up WebGL...');
      this.setupWebGL();
      
      console.log('Setting up controls...');
      this.setupControls();
      
      console.log('Starting render loop...');
      this.startRenderLoop();
      
      this.isReady = true;
      console.log('ModelViewer: Initialization complete');
      
      // Check what's available after initialization
      console.log('Available loaders:', {
        GLTFLoader: !!(window.THREE?.GLTFLoader || window.GLTFLoader),
        OrbitControls: !!window.THREE?.OrbitControls
      });
      
    } catch (error) {
      console.error('ModelViewer: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load Three.js library dynamically
   */
  async loadThreeJS() {
    if (window.THREE) {
      return; // Already loaded
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r144/three.min.js';
      script.onload = () => {
        console.log('Three.js core loaded successfully');
        // Load additional modules
        this.loadThreeJSModules().then(resolve).catch(reject);
      };
      script.onerror = (error) => {
        console.error('Failed to load Three.js core:', error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load additional Three.js modules
   */
  async loadThreeJSModules() {
    const modules = [
      {
        url: 'https://unpkg.com/three@0.144.0/examples/js/controls/OrbitControls.js',
        name: 'OrbitControls'
      },
      {
        url: 'https://unpkg.com/three@0.144.0/examples/js/loaders/GLTFLoader.js', 
        name: 'GLTFLoader'
      }
    ];

    for (const module of modules) {
      try {
        await this.loadModule(module);
        console.log(`Three.js ${module.name} loaded successfully`);
      } catch (error) {
        console.error(`Failed to load Three.js ${module.name}:`, error);
        // For GLTFLoader, try alternative sources
        if (module.name === 'GLTFLoader') {
          console.log('Trying alternative GLTFLoader sources...');
          const alternatives = [
            'https://unpkg.com/three@0.144.0/examples/js/loaders/GLTFLoader.js',
            'https://threejs.org/examples/js/loaders/GLTFLoader.js'
          ];
          
          let loaded = false;
          for (const altUrl of alternatives) {
            try {
              await this.loadModule({ url: altUrl, name: module.name });
              console.log(`GLTFLoader loaded from alternative source: ${altUrl}`);
              loaded = true;
              break;
            } catch (altError) {
              console.warn(`Alternative GLTFLoader source failed: ${altUrl}`, altError);
            }
          }
          
          if (!loaded) {
            console.warn('GLTFLoader not available, some features may not work');
          }
        } else {
          console.warn(`${module.name} not available, some features may not work`);
        }
      }
    }
    
    // Check what's available after loading
    console.log('Three.js modules loaded. Available:', {
      THREE: !!window.THREE,
      OrbitControls: !!window.THREE?.OrbitControls,
      GLTFLoader: !!window.THREE?.GLTFLoader,
      windowGLTFLoader: !!window.GLTFLoader
    });
  }

  /**
   * Load a single module
   */
  async loadModule(module) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = module.url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Setup DOM elements
   */
  setupElements() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      throw new Error(`Container element ${this.options.containerId} not found`);
    }

    this.canvas = document.getElementById(this.options.canvasId);
    if (!this.canvas) {
      // Create canvas if it doesn't exist
      this.canvas = document.createElement('canvas');
      this.canvas.id = this.options.canvasId;
      this.container.appendChild(this.canvas);
    }

    // Setup viewer controls
    this.setupViewerControls();
  }

  /**
   * Setup WebGL components (scene, camera, renderer, lights)
   */
  setupWebGL() {
    if (!window.THREE) {
      throw new Error('Three.js is not loaded');
    }

    this.THREE = window.THREE;
    
    // Initialize WebGL components
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupLights();
  }

  /**
   * Setup viewer control buttons
   */
  setupViewerControls() {
    const controlsContainer = this.container.querySelector('.viewer-controls');
    if (controlsContainer) {
      controlsContainer.innerHTML = `
        <button class="viewer-btn" id="resetView" title="Reset View">🏠</button>
        <button class="viewer-btn" id="toggleWireframe" title="Toggle Wireframe">📐</button>
        <button class="viewer-btn" id="toggleAutoRotate" title="Auto Rotate">🔄</button>
        <button class="viewer-btn" id="fullscreen" title="Fullscreen">⛶</button>
      `;

      // Add event listeners
      const resetBtn = controlsContainer.querySelector('#resetView');
      const wireframeBtn = controlsContainer.querySelector('#toggleWireframe');
      const rotateBtn = controlsContainer.querySelector('#toggleAutoRotate');
      const fullscreenBtn = controlsContainer.querySelector('#fullscreen');

      if (resetBtn) {
        resetBtn.addEventListener('click', () => this.resetView());
      }

      if (wireframeBtn) {
        wireframeBtn.addEventListener('click', () => this.toggleWireframe());
      }

      if (rotateBtn) {
        rotateBtn.addEventListener('click', () => this.toggleAutoRotate());
      }

      if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
      }
    }
  }

  /**
   * Setup Three.js scene
   */
  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.options.backgroundColor);
  }

  /**
   * Setup camera
   */
  setupCamera() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(this.options.cameraFov, aspect, 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Setup renderer
   */
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  /**
   * Setup lighting
   */
  setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);
    this.lights.push(ambientLight);

    // Main directional light
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 5, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 500;
    this.scene.add(mainLight);
    this.lights.push(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 2, -5);
    this.scene.add(fillLight);
    this.lights.push(fillLight);

    // Key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
    keyLight.position.set(0, 10, 0);
    this.scene.add(keyLight);
    this.lights.push(keyLight);
  }

  /**
   * Setup camera controls
   */
  setupControls() {
    if (this.options.enableControls && window.THREE && THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enableZoom = true;
      this.controls.enableRotate = true;
      this.controls.enablePan = true;
      this.controls.autoRotate = this.options.autoRotate;
      this.controls.autoRotateSpeed = 2.0;
      this.controls.maxPolarAngle = Math.PI;
      this.controls.minDistance = 1;
      this.controls.maxDistance = 100;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this.handleResize());

    // Container resize observer
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Handle container/window resize
   */
  handleResize() {
    if (!this.camera || !this.renderer) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Start render loop
   */
  startRenderLoop() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      if (this.controls) {
        this.controls.update();
      }
      
      this.renderer.render(this.scene, this.camera);
    };
    
    animate();
  }

  /**
   * Stop render loop
   */
  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Load 3D model
   * @param {string} url - Model URL
   * @param {Object} options - Loading options
   * @returns {Promise} Loading promise
   */
  async loadModel(url, options = {}) {
    console.log('ModelViewer: loadModel called with URL:', url);
    
    if (this.isLoading) {
      throw new Error('Another model is currently loading');
    }

    if (!this.isReady) {
      throw new Error('Model viewer is not ready yet');
    }

    this.isLoading = true;
    this.showLoading(true);

    try {
      console.log('ModelViewer: Starting model load process...');
      
      // Clear previous model
      if (this.model) {
        console.log('ModelViewer: Clearing previous model');
        this.clearModel();
      }

      // Determine loader based on file extension
      console.log('ModelViewer: Getting loader for URL');
      const loader = this.getLoaderForUrl(url);
      console.log('ModelViewer: Loader obtained:', loader.constructor.name);
      
      // Load model
      console.log('ModelViewer: Loading model with loader...');
      const modelData = await this.loadModelWithLoader(loader, url, options);
      console.log('ModelViewer: Model data loaded:', modelData);
      
      // Process loaded model
      this.model = modelData;
      this.processLoadedModel(this.model);
      console.log('ModelViewer: Model processed');
      
      // Add to scene
      this.scene.add(this.model);
      console.log('ModelViewer: Model added to scene');
      
      // Fit model to view
      this.fitModelToView();
      console.log('ModelViewer: Model fitted to view');
      
      this.loadedModelUrl = url;
      this.isLoading = false;
      this.showLoading(false);
      
      console.log('ModelViewer: Model loading completed successfully');
      this.options.onModelLoaded();
      
    } catch (error) {
      this.isLoading = false;
      this.showLoading(false);
      console.error('Failed to load model:', error);
      this.options.onError(error);
      throw error;
    }
  }

  /**
   * Get appropriate loader for URL
   * @param {string} url - Model URL
   * @returns {Object} Three.js loader instance
   */
  getLoaderForUrl(url) {
    // Helper function to get GLTFLoader from various possible locations
    const getGLTFLoader = () => {
      // Try different ways the GLTFLoader might be available
      if (window.THREE && window.THREE.GLTFLoader) {
        console.log('Found GLTFLoader at THREE.GLTFLoader');
        return new window.THREE.GLTFLoader();
      }
      // Sometimes modules are available globally (from static script tags)
      if (window.GLTFLoader) {
        console.log('Found GLTFLoader at window.GLTFLoader');
        return new window.GLTFLoader();
      }
      // Check if it's in the examples namespace
      if (window.THREE && window.THREE.examples && window.THREE.examples.loaders && window.THREE.examples.loaders.GLTFLoader) {
        console.log('Found GLTFLoader at THREE.examples.loaders.GLTFLoader');
        return new window.THREE.examples.loaders.GLTFLoader();
      }
      return null;
    };

    // Handle download endpoints without file extensions
    if (url.includes('/download')) {
      // Default to GLTF loader for download endpoints (backend serves GLB files)
      const loader = getGLTFLoader();
      if (loader) {
        console.log('ModelViewer: Using GLTFLoader for download endpoint');
        return loader;
      } else {
        console.error('Available in window:', Object.keys(window).filter(k => k.includes('THREE') || k.includes('GLTF')));
        console.error('THREE object:', window.THREE);
        if (window.THREE) {
          console.error('THREE object keys:', Object.keys(window.THREE));
        }
        throw new Error('GLTFLoader not available - failed to load Three.js modules');
      }
    }
    
    const extension = url.split('.').pop().toLowerCase();
    
    switch (extension) {
      case 'gltf':
      case 'glb':
        const loader = getGLTFLoader();
        if (loader) {
          return loader;
        } else {
          throw new Error('GLTFLoader not available - failed to load Three.js modules');
        }
      case 'obj':
        if (window.THREE && window.THREE.OBJLoader) {
          return new window.THREE.OBJLoader();
        } else {
          throw new Error('OBJLoader not available');
        }
      case 'ply':
        if (window.THREE && window.THREE.PLYLoader) {
          return new window.THREE.PLYLoader();
        } else {
          throw new Error('PLYLoader not available');
        }
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  /**
   * Load model with specific loader
   * @param {Object} loader - Three.js loader
   * @param {string} url - Model URL
   * @param {Object} options - Loading options
   * @returns {Promise} Loading promise
   */
  loadModelWithLoader(loader, url, options) {
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (result) => {
          // Handle different loader result formats
          if (result.scene) {
            resolve(result.scene); // GLTF
          } else if (result.children) {
            resolve(result); // OBJ
          } else {
            resolve(result); // PLY
          }
        },
        (progress) => {
          if (options.onProgress) {
            options.onProgress(progress);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Process loaded model (materials, animations, etc.)
   * @param {Object} model - Loaded model
   */
  processLoadedModel(model) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Ensure proper material setup
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => this.processMaterial(material));
          } else {
            this.processMaterial(child.material);
          }
        }
      }
    });
  }

  /**
   * Process material properties
   * @param {Object} material - Three.js material
   */
  processMaterial(material) {
    if (material.map) {
      material.map.encoding = THREE.sRGBEncoding;
    }
    
    material.side = THREE.FrontSide;
    
    // Enable wireframe toggle capability
    material.userData.originalWireframe = material.wireframe;
  }

  /**
   * Fit model to camera view
   */
  fitModelToView() {
    if (!this.model || !this.camera) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Calculate optimal camera position
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    cameraZ *= 2.5; // Add some padding
    
    this.camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
    this.camera.lookAt(center);
    
    if (this.controls) {
      this.controls.target.copy(center);
      this.controls.update();
    }
  }

  /**
   * Clear current model
   */
  clearModel() {
    if (this.model) {
      this.scene.remove(this.model);
      
      // Dispose of geometries and materials
      this.model.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      
      this.model = null;
      this.loadedModelUrl = null;
    }
  }

  /**
   * Reset camera view
   */
  resetView() {
    if (this.model) {
      this.fitModelToView();
    } else {
      this.camera.position.set(5, 5, 5);
      this.camera.lookAt(0, 0, 0);
      
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
        this.controls.update();
      }
    }
  }

  /**
   * Toggle wireframe mode
   */
  toggleWireframe() {
    if (!this.model) return;

    this.model.traverse((child) => {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            material.wireframe = !material.wireframe;
          });
        } else {
          child.material.wireframe = !child.material.wireframe;
        }
      }
    });
  }

  /**
   * Toggle auto rotation
   */
  toggleAutoRotate() {
    if (this.controls) {
      this.controls.autoRotate = !this.controls.autoRotate;
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      this.container.requestFullscreen();
    }
  }

  /**
   * Show/hide loading indicator
   * @param {boolean} show - Whether to show loading
   */
  showLoading(show) {
    const placeholder = this.container.querySelector('.viewer-placeholder');
    if (placeholder) {
      placeholder.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Take screenshot of current view
   * @param {Object} options - Screenshot options
   * @returns {string} Data URL of screenshot
   */
  takeScreenshot(options = {}) {
    const {
      width = this.renderer.domElement.width,
      height = this.renderer.domElement.height,
      format = 'image/png'
    } = options;

    // Render current frame
    this.renderer.render(this.scene, this.camera);
    
    // Get image data
    return this.renderer.domElement.toDataURL(format);
  }

  /**
   * Export model (if supported)
   * @param {string} format - Export format
   * @returns {Promise<Blob>} Exported model data
   */
  async exportModel(format = 'gltf') {
    if (!this.model) {
      throw new Error('No model loaded to export');
    }

    // This would require additional Three.js exporters
    throw new Error('Model export not yet implemented');
  }

  /**
   * Get viewer statistics
   * @returns {Object} Viewer stats
   */
  getStats() {
    const info = this.renderer.info;
    
    return {
      isReady: this.isReady,
      isLoading: this.isLoading,
      hasModel: !!this.model,
      modelUrl: this.loadedModelUrl,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      triangles: info.render.triangles,
      fps: this.getFPS()
    };
  }

  /**
   * Get approximate FPS
   * @returns {number} FPS estimate
   */
  getFPS() {
    // Simple FPS estimation - would need more sophisticated tracking for accuracy
    return Math.round(1000 / 16.67); // Rough estimate assuming 60fps target
  }

  /**
   * Dispose of viewer resources
   */
  dispose() {
    this.stopRenderLoop();
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.model) {
      this.clearModel();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.controls) {
      this.controls.dispose();
    }

    this.isReady = false;
  }
}
