/**
 * Main Application Module
 * Coordinates all frontend components and manages application state
 * @module App
 */

import { FileManager } from './fileManager.js';
import { ParameterPanel } from './parameterPanel.js';
import { ProgressTracker } from './progressTracker.js';
import { ModelViewer } from './modelViewer.js';
import { LogPanel } from './logPanel.js';
import { ApiClient } from './apiClient.js';
import { Modal } from './modal.js';

/**
 * Main Application Class
 * Orchestrates all frontend components and manages global state
 */
export class App {
  constructor() {
    this.state = {
      currentFile: null,
      isProcessing: false,
      currentJobId: null,
      parameters: {},
      results: null
    };

    this.components = {};
    this.apiClient = new ApiClient();
    
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    try {
      this.initializeComponents();
      this.setupEventListeners();
      this.loadSavedState();
      this.log('info', 'Application initialized successfully');
    } catch (error) {
      this.log('error', `Failed to initialize application: ${error.message}`);
      this.showError('Initialization Error', 'Failed to start the application. Please refresh the page.');
    }
  }

  /**
   * Initialize all components
   */
  initializeComponents() {
    // Initialize FileManager
    this.components.fileManager = new FileManager({
      onFileSelected: (file) => this.handleFileSelected(file),
      onFileRemoved: () => this.handleFileRemoved()
    });

    // Initialize ParameterPanel
    this.components.parameterPanel = new ParameterPanel({
      onParametersChanged: (params) => this.handleParametersChanged(params),
      onProcessStart: () => this.handleProcessStart()
    });

    // Initialize ProgressTracker
    this.components.progressTracker = new ProgressTracker({
      onProgressUpdate: (progress) => this.handleProgressUpdate(progress),
      onProcessComplete: (results) => this.handleProcessComplete(results),
      onProcessError: (error) => this.handleProcessError(error)
    });

    // Initialize ModelViewer
    this.components.modelViewer = new ModelViewer({
      onViewerReady: () => this.handleViewerReady(),
      onModelLoaded: () => this.handleModelLoaded()
    });

    // Initialize LogPanel
    this.components.logPanel = new LogPanel({
      maxEntries: 1000,
      enableExport: true
    });

    // Initialize Modal
    this.components.modal = new Modal();
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            this.components.fileManager.openFileDialog();
            break;
          case 's':
            e.preventDefault();
            this.saveState();
            break;
          case 'enter':
            if (this.canStartProcessing()) {
              e.preventDefault();
              this.handleProcessStart();
            }
            break;
        }
      }

      // ESC to close modals
      if (e.key === 'Escape') {
        this.components.modal.closeModal();
      }
    });

    // Handle window visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.state.isProcessing) {
        this.components.progressTracker.refreshProgress();
      }
    });

    // Handle window beforeunload
    window.addEventListener('beforeunload', (e) => {
      if (this.state.isProcessing) {
        e.preventDefault();
        e.returnValue = 'Processing is still in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
      this.log('info', 'Connection restored');
      if (this.state.isProcessing) {
        this.components.progressTracker.refreshProgress();
      }
    });

    window.addEventListener('offline', () => {
      this.log('warning', 'Connection lost - processing may be affected');
    });
  }

  /**
   * Handle file selection
   * @param {File} file - Selected file
   */
  async handleFileSelected(file) {
    try {
      this.log('info', `File selected: ${file.name} (${this.formatFileSize(file.size)})`);
      
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      this.state.currentFile = file;
      
      // Show file preview
      await this.components.fileManager.showPreview(file);
      
      // Reset previous state
      this.resetProcessingState();
      
      // Enable parameter panel
      this.components.parameterPanel.setEnabled(true);
      
      // Load default parameters based on file type
      const defaultParams = this.getDefaultParameters(file);
      this.components.parameterPanel.setParameters(defaultParams);
      
      this.saveState();
    } catch (error) {
      this.log('error', `File selection failed: ${error.message}`);
      this.showError('File Selection Error', error.message);
    }
  }

  /**
   * Handle file removal
   */
  handleFileRemoved() {
    this.log('info', 'File removed');
    this.state.currentFile = null;
    this.resetProcessingState();
    this.components.parameterPanel.setEnabled(false);
    this.components.modelViewer.clear();
    this.saveState();
  }

  /**
   * Handle parameter changes
   * @param {Object} params - Updated parameters
   */
  handleParametersChanged(params) {
    this.state.parameters = { ...params };
    this.log('debug', 'Parameters updated', params);
    this.saveState();
  }

  /**
   * Handle process start
   */
  async handleProcessStart() {
    if (!this.canStartProcessing()) {
      this.log('warning', 'Cannot start processing - missing file or already processing');
      return;
    }

    try {
      this.log('info', 'Starting processing...');
      this.state.isProcessing = true;
      
      // Upload file and start processing
      const jobId = await this.apiClient.startProcessing(
        this.state.currentFile,
        this.state.parameters
      );
      
      this.state.currentJobId = jobId;
      this.log('info', `Processing started with job ID: ${jobId}`);
      
      // Start progress tracking
      this.components.progressTracker.startTracking(jobId);
      
      this.saveState();
    } catch (error) {
      this.log('error', `Failed to start processing: ${error.message}`);
      this.showError('Processing Error', `Failed to start processing: ${error.message}`);
      this.state.isProcessing = false;
    }
  }

  /**
   * Handle progress updates
   * @param {Object} progress - Progress information
   */
  handleProgressUpdate(progress) {
    this.log('debug', `Progress: ${progress.stage} - ${progress.percentage}%`);
  }

  /**
   * Handle process completion
   * @param {Object} results - Processing results
   */
  async handleProcessComplete(results) {
    try {
      this.log('info', 'Processing completed successfully');
      this.state.isProcessing = false;
      this.state.results = results;
      
      // Load model in viewer
      if (results.modelUrl) {
        await this.components.modelViewer.loadModel(results.modelUrl);
        this.log('info', 'Model loaded in 3D viewer');
      }
      
      this.saveState();
      this.showSuccess('Processing Complete', 'Your 3D model has been generated successfully!');
    } catch (error) {
      this.log('error', `Failed to load results: ${error.message}`);
      this.showError('Results Error', `Processing completed but failed to load results: ${error.message}`);
    }
  }

  /**
   * Handle process error
   * @param {Object} error - Error information
   */
  handleProcessError(error) {
    this.log('error', `Processing failed: ${error.message}`);
    this.state.isProcessing = false;
    this.state.currentJobId = null;
    this.showError('Processing Failed', error.message);
    this.saveState();
  }

  /**
   * Handle viewer ready
   */
  handleViewerReady() {
    this.log('debug', '3D viewer initialized');
  }

  /**
   * Handle model loaded
   */
  handleModelLoaded() {
    this.log('info', 'Model loaded successfully in 3D viewer');
  }

  /**
   * Validate uploaded file
   * @param {File} file - File to validate
   * @returns {Object} Validation result
   */
  validateFile(file) {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported file type: ${file.type}. Supported types: JPEG, PNG, TIFF, WebP`
      };
    }
    
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large: ${this.formatFileSize(file.size)}. Maximum size: ${this.formatFileSize(maxSize)}`
      };
    }
    
    return { valid: true };
  }

  /**
   * Get default parameters based on file type
   * @param {File} file - Input file
   * @returns {Object} Default parameters
   */
  getDefaultParameters(file) {
    return {
      quality: 'medium',
      meshResolution: 1024,
      textureSize: 2048,
      smoothing: true,
      removeBackground: false,
      optimizeForWeb: true
    };
  }

  /**
   * Check if processing can start
   * @returns {boolean} Whether processing can start
   */
  canStartProcessing() {
    return this.state.currentFile && !this.state.isProcessing;
  }

  /**
   * Reset processing state
   */
  resetProcessingState() {
    this.state.isProcessing = false;
    this.state.currentJobId = null;
    this.state.results = null;
    this.components.progressTracker.reset();
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Show success modal
   * @param {string} title - Modal title
   * @param {string} message - Success message
   */
  showSuccess(title, message) {
    this.components.modal.showModal({
      title,
      content: `<p class="text-success-600">${message}</p>`,
      actions: [
        {
          text: 'OK',
          variant: 'primary',
          action: () => this.components.modal.closeModal()
        }
      ]
    });
  }

  /**
   * Show error modal
   * @param {string} title - Modal title
   * @param {string} message - Error message
   */
  showError(title, message) {
    this.components.modal.showModal({
      title,
      content: `<p class="text-danger-600">${message}</p>`,
      actions: [
        {
          text: 'OK',
          variant: 'secondary',
          action: () => this.components.modal.closeModal()
        }
      ]
    });
  }

  /**
   * Log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = null) {
    this.components.logPanel?.addEntry(level, message, data);
    
    // Also log to console in development
    if (process?.env?.NODE_ENV === 'development') {
      console[level](message, data);
    }
  }

  /**
   * Save current state to localStorage
   */
  saveState() {
    try {
      const stateToSave = {
        parameters: this.state.parameters,
        timestamp: Date.now()
      };
      
      localStorage.setItem('meshroom_webapp_state', JSON.stringify(stateToSave));
    } catch (error) {
      this.log('warning', 'Failed to save state to localStorage');
    }
  }

  /**
   * Load saved state from localStorage
   */
  loadSavedState() {
    try {
      const savedState = localStorage.getItem('meshroom_webapp_state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Only restore recent state (within 24 hours)
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          this.state.parameters = parsed.parameters || {};
          this.log('info', 'Previous session state restored');
        }
      }
    } catch (error) {
      this.log('warning', 'Failed to load saved state from localStorage');
    }
  }

  /**
   * Get current application state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }
}

// Auto-initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.meshroomApp = new App();
});
