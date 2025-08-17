/**
 * Main Application Module
 * Coordinates all frontend components and manages global state
 * @module App
 */

import FileManager from './fileManager.js';
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
      selectedFiles: [],
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
      
      // Load dynamic parameters from backend if available
      this.loadDynamicParameters();

      // Set initial processing button state
      this.updateProcessingButtonState();
      
      // Ensure key sections are always accessible
      this.ensureSectionsEnabled();
      
      this.log('info', 'Application initialized successfully');
    } catch (error) {
      this.log('error', `Failed to initialize application: ${error.message}`);
      // Check if modal is available before using it
      if (this.components && this.components.modal) {
        this.showError('Initialization Error', 'Failed to start the application. Please refresh the page.');
      } else {
        // Fallback to alert if modal is not available
        alert('Initialization Error: Failed to start the application. Please refresh the page.');
      }
    }
  }

  /**
   * Initialize all components
   */
  initializeComponents() {
    console.log('Initializing components...');
    
    // Initialize FileManager
    console.log('Creating FileManager...');
    this.components.fileManager = new FileManager({
      onFilesSelected: (files) => this.handleFilesSelected(files),
      onFileRemoved: (fileData) => this.handleFileRemoved(fileData),
      onFilesCleared: () => this.handleFilesCleared(),
      onError: (error) => this.handleFileError(error)
    });
    console.log('FileManager created successfully');

    // Initialize ParameterPanel
    this.components.parameterPanel = new ParameterPanel({
      onParametersChanged: (params) => this.handleParametersChanged(params),
      onProcessStart: () => this.handleProcessStart()
    });

    // Always enable parameter panel - it should be accessible
    this.components.parameterPanel?.setEnabled(true);

    // Initialize ProgressTracker
    this.components.progressTracker = new ProgressTracker({
      apiClient: this.apiClient,
      onProgressUpdate: (progress) => this.handleProgressUpdate(progress),
      onProcessComplete: (results) => this.handleProcessComplete(results),
      onProcessError: (error) => this.handleProcessError(error)
    });

    // Initialize progress tracker DOM elements
    this.components.progressTracker.init();

    // Initialize ModelViewer
    this.components.modelViewer = new ModelViewer({
      onViewerReady: () => this.handleViewerReady(),
      onModelLoaded: () => this.handleModelLoaded()
    });

    // Initialize LogPanel (simple version)
    this.components.logPanel = new LogPanel({
      containerId: 'logContainer',
      maxEntries: 1000,
      autoScroll: true
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
            // Trigger file input click
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.click();
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
        this.components.modal?.closeModal();
      }
    });

    // Handle window visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.state.isProcessing) {
        this.components.progressTracker?.refreshProgress();
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
        this.components.progressTracker?.refreshProgress();
      }
    });

    window.addEventListener('offline', () => {
      this.log('warning', 'Connection lost - processing may be affected');
    });
  }

  /**
   * Handle files selection (multiple files)
   * @param {Array} files - Array of selected file data objects
   */
  async handleFilesSelected(files) {
    try {
      this.log('info', `${files.length} file${files.length !== 1 ? 's' : ''} selected`);
      
      // For now, we'll work with the first file for processing
      // Future versions can support multi-file processing
      if (files.length > 0) {
        const firstFile = files[0].file; // Get the File object from fileData
        this.log('info', `Primary file: ${firstFile.name} (${this.formatFileSize(firstFile.size)})`);
        
        // Validate file
        const validation = this.validateFile(firstFile);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        this.state.currentFile = firstFile;
        this.state.selectedFiles = files; // Store all selected files
        
        // Reset previous state
        this.resetProcessingState();
        
        // Enable parameter panel (always accessible)
        this.components.parameterPanel?.setEnabled(true);
        
        // Update processing button state
        this.updateProcessingButtonState();
        
        // Load default parameters based on file type
        const defaultParams = this.getDefaultParameters(firstFile);
        this.components.parameterPanel?.setParameters(defaultParams);
        
        // Ensure sections remain enabled
        this.ensureSectionsEnabled();
        
        this.saveState();
      }
    } catch (error) {
      this.log('error', `File selection failed: ${error.message}`);
      this.showError('File Selection Error', error.message);
    }
  }

  /**
   * Handle single file removal
   * @param {Object} fileData - Removed file data
   */
  handleFileRemoved(fileData) {
    this.log('info', `File removed: ${fileData.name}`);
    
    // If the removed file was the current processing file, update state
    if (this.state.currentFile && this.state.currentFile.name === fileData.name) {
      const remainingFiles = this.components.fileManager.getSelectedFiles();
      if (remainingFiles.length > 0) {
        // Set new primary file
        this.state.currentFile = remainingFiles[0].file;
        this.log('info', `New primary file: ${this.state.currentFile.name}`);
      } else {
        // No files left
        this.handleFilesCleared();
        return;
      }
    }
    
    this.state.selectedFiles = this.components.fileManager.getSelectedFiles();
    
    // Update processing button state
    this.updateProcessingButtonState();
    
    // Ensure sections remain enabled
    this.ensureSectionsEnabled();
    
    this.saveState();
  }

  /**
   * Handle all files cleared
   */
  handleFilesCleared() {
    this.log('info', 'All files removed');
    this.state.currentFile = null;
    this.state.selectedFiles = [];
    this.resetProcessingState();
    // Keep parameter panel enabled - don't disable it
    
    // Safely clear model viewer if available
    if (this.components.modelViewer && typeof this.components.modelViewer.clear === 'function') {
      this.components.modelViewer.clear();
    }
    
    // Disable model action buttons
    this.disableModelActionButtons();
    
    // Update processing button state
    this.updateProcessingButtonState();
    
    // Ensure sections remain enabled
    this.ensureSectionsEnabled();
    
    this.saveState();
  }

  /**
   * Handle file-related errors
   * @param {Object} error - Error information
   */
  handleFileError(error) {
    this.log('error', `File error: ${error.message}`);
    
    let errorMessage = error.message;
    if (error.details && error.details.length > 0) {
      errorMessage += '\n\nDetails:\n' + error.details.join('\n');
    }
    
    this.showError('File Error', errorMessage);
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
      const fileCount = this.state.selectedFiles.length;
      if (this.state.isProcessing) {
        this.log('warning', 'Cannot start processing - already processing');
        this.showError('Already Processing', 'A processing job is already running. Please wait for it to complete.');
      } else if (fileCount < 2) {
        this.log('warning', `Cannot start processing - only ${fileCount} image${fileCount !== 1 ? 's' : ''} selected`);
        this.showError('Insufficient Images', `You need at least 2 images to start processing. Currently ${fileCount} image${fileCount !== 1 ? 's are' : ' is'} selected.`);
      }
      return;
    }

    try {
      this.log('info', 'Starting processing...');
      this.state.isProcessing = true;
      
      // Get all selected file objects
      const fileObjects = this.state.selectedFiles.map(fileData => fileData.file);
      
      // Upload files and start processing
      const jobId = await this.apiClient.startProcessing(
        fileObjects,
        this.state.parameters
      );
      
      this.state.currentJobId = jobId;
      this.log('info', `Processing started with job ID: ${jobId}`);
      
      // Show processing section
      this.showProcessingSection();
      
      // Start progress tracking
      this.components.progressTracker?.startTracking(jobId);
      
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
      console.log('Process completion results:', results);
      this.state.isProcessing = false;
      this.state.results = results;
      
      // Show results section
      this.showResultsSection();
      
      // Load model in viewer
      // Backend serves models via /jobs/{job_id}/download endpoint
      let modelUrl = results.modelUrl; // Check if already provided
      if (!modelUrl && (results.job_id || this.state.currentJobId)) {
        const jobId = results.job_id || this.state.currentJobId;
        modelUrl = `${this.apiClient.options.baseUrl}/jobs/${encodeURIComponent(jobId)}/download`;
        console.log('Constructed model URL:', modelUrl);
      }
      
      console.log('ModelViewer component:', this.components.modelViewer);
      console.log('ModelViewer loadModel method:', typeof this.components.modelViewer?.loadModel);
      
      if (modelUrl) {
        this.log('info', `Loading 3D model from: ${modelUrl}`);
        if (this.components.modelViewer && typeof this.components.modelViewer.loadModel === 'function') {
          try {
            console.log('Attempting to load model...');
            await this.components.modelViewer.loadModel(modelUrl);
            this.log('info', 'Model loaded in 3D viewer');
            console.log('Model loading completed successfully');
          } catch (modelError) {
            console.error('Model loading error:', modelError);
            this.log('error', `Failed to load 3D model: ${modelError.message}`);
            this.showError('Model Loading Error', `Failed to load 3D model: ${modelError.message}`);
          }
        } else {
          console.warn('3D model viewer not available or loadModel method missing');
          this.log('warning', '3D model viewer not available');
        }
      } else {
        console.warn('No model URL could be constructed', results);
        this.log('warning', 'No model URL could be constructed', results);
      }
      
      this.saveState();
      this.showSuccess('Processing Complete', 'Your 3D model has been generated successfully!');
    } catch (error) {
      console.error('Process completion error:', error);
      this.log('error', `Failed to load results: ${error.message}`);
      this.showError('Results Error', `Processing completed but failed to load results: ${error.message}`);
    }
  }

  /**
   * Handle process error
   * @param {Object} error - Error information
   */
  handleProcessError(error) {
    // Check if this is a cancellation rather than an error
    const isCancellation = error.stage === 'cancelled' || 
                          error.message.toLowerCase().includes('cancelled') ||
                          error.message.toLowerCase().includes('cancel');
    
    if (isCancellation) {
      this.log('info', `Processing cancelled: ${error.message}`);
      this.state.isProcessing = false;
      this.state.currentJobId = null;
      this.showSuccess('Processing Cancelled', 'The processing was successfully cancelled by the user.');
      this.saveState();
    } else {
      this.log('error', `Processing failed: ${error.message}`);
      this.state.isProcessing = false;
      this.state.currentJobId = null;
      this.showError('Processing Failed', error.message);
      this.saveState();
    }
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
    
    // Enable the model action buttons
    const downloadModelBtn = document.getElementById('downloadModelBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
    
    if (downloadModelBtn) {
      downloadModelBtn.disabled = false;
      this.log('debug', 'Download Model button enabled');
    }
    
    if (resetViewBtn) {
      resetViewBtn.disabled = false;
      this.log('debug', 'Reset View button enabled');
    }

    // Setup button event listeners if not already done
    this.setupModelActionButtons();
  }

  /**
   * Setup event listeners for model action buttons
   */
  setupModelActionButtons() {
    const downloadModelBtn = document.getElementById('downloadModelBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');

    // Setup download button
    if (downloadModelBtn && !downloadModelBtn.hasAttribute('data-listener-added')) {
      downloadModelBtn.addEventListener('click', () => {
        this.downloadModel();
      });
      downloadModelBtn.setAttribute('data-listener-added', 'true');
      this.log('debug', 'Download Model button event listener added');
    }

    // Setup reset view button  
    if (resetViewBtn && !resetViewBtn.hasAttribute('data-listener-added')) {
      resetViewBtn.addEventListener('click', () => {
        this.resetModelView();
      });
      resetViewBtn.setAttribute('data-listener-added', 'true');
      this.log('debug', 'Reset View button event listener added');
    }
  }

  /**
   * Download the current model
   */
  downloadModel() {
    if (!this.state.currentJobId) {
      this.log('warning', 'No model available for download');
      return;
    }

    try {
      const downloadUrl = `${this.apiClient.options.baseUrl}/jobs/${encodeURIComponent(this.state.currentJobId)}/download`;
      this.log('info', `Downloading model from: ${downloadUrl}`);
      
      // Create a temporary download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `model_${this.state.currentJobId}.glb`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.log('info', 'Model download initiated');
    } catch (error) {
      this.log('error', `Failed to download model: ${error.message}`);
      this.showError('Download Error', `Failed to download model: ${error.message}`);
    }
  }

  /**
   * Reset the 3D model view
   */
  resetModelView() {
    if (this.components.modelViewer && typeof this.components.modelViewer.resetView === 'function') {
      this.components.modelViewer.resetView();
      this.log('info', '3D model view reset');
    } else {
      this.log('warning', '3D model viewer not available or resetView method missing');
    }
  }

  /**
   * Disable model action buttons
   */
  disableModelActionButtons() {
    const downloadModelBtn = document.getElementById('downloadModelBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
    
    if (downloadModelBtn) {
      downloadModelBtn.disabled = true;
      this.log('debug', 'Download Model button disabled');
    }
    
    if (resetViewBtn) {
      resetViewBtn.disabled = true;
      this.log('debug', 'Reset View button disabled');
    }
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
    return this.state.selectedFiles.length >= 2 && !this.state.isProcessing;
  }

  /**
   * Reset processing state
   */
  resetProcessingState() {
    this.state.isProcessing = false;
    this.state.currentJobId = null;
    this.state.results = null;
    this.components.progressTracker?.reset();
    
    // Disable model action buttons when resetting processing
    this.disableModelActionButtons();
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
    if (this.components && this.components.modal) {
      this.components.modal.showModal({
        type: 'error',
        title: title,
        content: `<div class="error-message">${this.escapeHtml(message)}</div>`,
        actions: [
          {
            text: 'OK',
            variant: 'primary',
            action: () => true,
            autoFocus: true
          }
        ]
      });
    } else {
      // Fallback to alert if modal is not available
      alert(`${title}: ${message}`);
    }
  }

  /**
   * Escape HTML characters to prevent XSS attacks
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = null) {
    this.components.logPanel?.addEntry(level, message, data);
    
    // Log to console in the meantime
    console[level](message, data);
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
   * Ensure key sections remain accessible
   */
  ensureSectionsEnabled() {
    // Always keep upload and parameters sections accessible
    const uploadSection = document.getElementById('uploadSection');
    const parametersSection = document.getElementById('parametersSection');
    
    if (uploadSection && !uploadSection.classList.contains('active')) {
      uploadSection.classList.add('active');
    }
    
    if (parametersSection && !parametersSection.classList.contains('active')) {
      parametersSection.classList.add('active');
    }
  }

  /**
   * Show processing section when processing starts
   */
  showProcessingSection() {
    const processingSection = document.getElementById('processingSection');
    if (processingSection && !processingSection.classList.contains('active')) {
      processingSection.classList.add('active');
      this.log('debug', 'Processing section activated');
    }
  }

  /**
   * Show results section when processing completes
   */
  showResultsSection() {
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection && !resultsSection.classList.contains('active')) {
      resultsSection.classList.add('active');
      this.log('debug', 'Results section activated');
    }
  }

  /**
   * Update the processing button state based on file count
   */
  updateProcessingButtonState() {
    const startProcessingBtn = document.getElementById('startProcessing');
    const imageRequirement = document.getElementById('imageRequirement');
    const fileCount = this.state.selectedFiles.length;

    if (startProcessingBtn) {
      if (fileCount >= 2) {
        startProcessingBtn.disabled = false;
        startProcessingBtn.textContent = 'Start Processing';
      } else {
        startProcessingBtn.disabled = true;
        startProcessingBtn.textContent = fileCount === 0 
          ? 'Start Processing (no images selected)' 
          : 'Start Processing (need at least 2 images)';
      }
    }

    // Update requirement notice
    if (imageRequirement) {
      imageRequirement.className = 'requirement-notice';
      if (fileCount === 0) {
        imageRequirement.innerHTML = '<strong>Note:</strong> At least 2 images are required to start processing.';
      } else if (fileCount === 1) {
        imageRequirement.className += ' error';
        imageRequirement.innerHTML = '<strong>Missing:</strong> You need at least 1 more image to start processing.';
      } else {
        imageRequirement.className += ' success';
        imageRequirement.innerHTML = `<strong>Ready:</strong> ${fileCount} images selected. You can now start processing.`;
      }
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
   * Fetch parameter definitions from backend and update panel
   */
  async loadDynamicParameters() {
    try {
      const config = await this.apiClient.getParameters();
      if (config && config.parameters) {
        this.components.parameterPanel?.loadFromServer(config);
        this.log('info', 'Loaded dynamic parameters from server');
      }
    } catch (error) {
      // Fallback to built-in defaults
      this.log('warning', `Dynamic parameters not available, using defaults: ${error.message}`);
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
  console.log('DOM content loaded - initializing app...');
  window.meshroomApp = new App();
  console.log('App initialization complete');
});
