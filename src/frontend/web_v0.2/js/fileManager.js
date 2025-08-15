/**
 * File Manager Module
 * Handles multiple file upload, drag-and-drop, preview, and validation
 * @module FileManager
 */

/**
 * File Manager Class
 * Manages multiple file upload interface and file operations
 */
class FileManager {
  constructor(options = {}) {
    this.options = {
      maxFileSize: 100 * 1024 * 1024, // 100MB per file
      maxFiles: 50, // Maximum number of files
      allowedTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/webp'],
      onFilesSelected: () => {},
      onFileRemoved: () => {},
      onFilesCleared: () => {},
      onError: () => {},
      ...options
    };

    this.selectedFiles = [];
    this.fileMap = new Map(); // Map to track files by unique ID
    this.fileCounter = 0;
    
    this.init();
  }

  /**
   * Initialize file manager
   */
  init() {
    this.setupElements();
    this.setupEventListeners();
    
    // Make fileManager globally accessible for onclick handlers
    window.fileManager = this;
  }

  /**
   * Setup DOM elements
   */
  setupElements() {
    this.uploadArea = document.getElementById('uploadArea');
    this.fileInput = document.getElementById('fileInput');
    this.selectFilesBtn = document.getElementById('selectFilesBtn');
    this.uploadText = document.getElementById('uploadText');
    this.uploadSubtext = document.getElementById('uploadSubtext');
    this.imagePreview = document.getElementById('imagePreview');
    this.previewGrid = document.getElementById('previewGrid');
    this.imageCount = document.getElementById('imageCount');
    this.clearAllBtn = document.getElementById('clearAllBtn');

    if (!this.uploadArea) {
      throw new Error('Upload area element not found');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // File input change
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        this.handleFileSelect(e.target.files);
      });
    }

    // Select files button
    if (this.selectFilesBtn) {
      this.selectFilesBtn.addEventListener('click', () => {
        this.fileInput?.click();
      });
    }

    // Drag and drop events
    if (this.uploadArea) {
      this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
      this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
    }

    // Clear all button
    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', () => this.clearAllFiles());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.fileInput?.click();
      }
    });
  }

  /**
   * Handle drag over event
   * @param {DragEvent} e - Drag event
   */
  handleDragOver(e) {
    e.preventDefault();
    this.uploadArea.classList.add('dragover');
  }

  /**
   * Handle drag leave event
   * @param {DragEvent} e - Drag event
   */
  handleDragLeave(e) {
    e.preventDefault();
    if (!this.uploadArea.contains(e.relatedTarget)) {
      this.uploadArea.classList.remove('dragover');
    }
  }

  /**
   * Handle drop event
   * @param {DragEvent} e - Drop event
   */
  handleDrop(e) {
    e.preventDefault();
    this.uploadArea.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    this.handleFileSelect(files);
  }

  /**
   * Handle file selection (from input or drop)
   * @param {FileList|Array} files - Selected files
   */
  handleFileSelect(files) {
    const fileArray = Array.from(files);
    
    if (fileArray.length === 0) {
      return;
    }

    // Check total file limit
    if (this.selectedFiles.length + fileArray.length > this.options.maxFiles) {
      this.options.onError({
        type: 'file_limit',
        message: `Maximum ${this.options.maxFiles} files allowed. Currently have ${this.selectedFiles.length} files.`
      });
      return;
    }

    const validFiles = [];
    const errors = [];

    // Validate each file
    fileArray.forEach(file => {
      const validation = this.validateFile(file);
      if (validation.valid) {
        // Check for duplicates by name and size
        const isDuplicate = this.selectedFiles.some(existingFile => 
          existingFile.name === file.name && existingFile.size === file.size
        );
        
        if (!isDuplicate) {
          validFiles.push(file);
        } else {
          errors.push(`File "${file.name}" is already selected`);
        }
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    // Show errors if any
    if (errors.length > 0) {
      this.options.onError({
        type: 'validation_errors',
        message: `Some files were rejected:`,
        details: errors
      });
    }

    // Add valid files
    if (validFiles.length > 0) {
      validFiles.forEach(file => this.addFile(file));
      this.updateUI();
      this.options.onFilesSelected(this.selectedFiles);
    }

    // Reset file input
    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }

  /**
   * Validate a single file
   * @param {File} file - File to validate
   * @returns {Object} Validation result
   */
  validateFile(file) {
    // Check file type
    if (!this.options.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed: ${this.options.allowedTypes.join(', ')}`
      };
    }

    // Check file size
    if (file.size > this.options.maxFileSize) {
      return {
        valid: false,
        error: `File too large. Max size: ${this.formatFileSize(this.options.maxFileSize)}`
      };
    }

    // Check if file is actually an image
    if (!file.type.startsWith('image/')) {
      return {
        valid: false,
        error: 'Please select a valid image file'
      };
    }

    return { valid: true };
  }

  /**
   * Add a file to the selection
   * @param {File} file - File to add
   */
  addFile(file) {
    const fileId = `file_${++this.fileCounter}_${Date.now()}`;
    
    const fileData = {
      id: fileId,
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      previewUrl: null,
      metadata: null
    };

    this.selectedFiles.push(fileData);
    this.fileMap.set(fileId, fileData);

    // Create preview for image files
    this.createPreview(fileData);
  }

  /**
   * Remove a file from selection
   * @param {string} fileId - File ID to remove
   */
  removeFile(fileId) {
    const fileData = this.fileMap.get(fileId);
    if (!fileData) return;

    // Remove from arrays and map
    this.selectedFiles = this.selectedFiles.filter(f => f.id !== fileId);
    this.fileMap.delete(fileId);

    // Clean up preview URL
    if (fileData.previewUrl) {
      URL.revokeObjectURL(fileData.previewUrl);
    }

    // Remove from DOM
    const previewElement = document.getElementById(`preview-${fileId}`);
    if (previewElement) {
      previewElement.remove();
    }

    this.updateUI();
    this.options.onFileRemoved(fileData);
    this.options.onFilesSelected(this.selectedFiles);
  }

  /**
   * Clear all files
   */
  clearAllFiles() {
    // Clean up preview URLs
    this.selectedFiles.forEach(fileData => {
      if (fileData.previewUrl) {
        URL.revokeObjectURL(fileData.previewUrl);
      }
    });

    // Clear data structures
    this.selectedFiles = [];
    this.fileMap.clear();

    // Clear DOM
    if (this.previewGrid) {
      this.previewGrid.innerHTML = '';
    }

    this.updateUI();
    this.options.onFilesCleared();
    this.options.onFilesSelected(this.selectedFiles);
  }

  /**
   * Create preview for a file
   * @param {Object} fileData - File data object
   */
  createPreview(fileData) {
    if (!fileData.file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      fileData.previewUrl = e.target.result;
      this.extractImageMetadata(fileData).then(() => {
        this.renderPreview(fileData);
      });
    };
    reader.readAsDataURL(fileData.file);
  }

  /**
   * Extract image metadata
   * @param {Object} fileData - File data object
   * @returns {Promise} Promise that resolves when metadata is extracted
   */
  extractImageMetadata(fileData) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        fileData.metadata = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2),
          megapixels: ((img.naturalWidth * img.naturalHeight) / 1000000).toFixed(1)
        };
        resolve();
      };
      img.onerror = () => {
        fileData.metadata = { error: 'Failed to load image' };
        resolve();
      };
      img.src = fileData.previewUrl;
    });
  }

  /**
   * Render preview in the grid
   * @param {Object} fileData - File data object
   */
  renderPreview(fileData) {
    if (!this.previewGrid) return;

    const previewElement = document.createElement('div');
    previewElement.className = 'preview-item';
    previewElement.id = `preview-${fileData.id}`;
    
    const metadataHtml = fileData.metadata && !fileData.metadata.error 
      ? `<div class="file-meta">${fileData.metadata.width}×${fileData.metadata.height}</div>`
      : '';

    previewElement.innerHTML = `
      <img src="${fileData.previewUrl}" alt="${fileData.name}" class="preview-image">
      <div class="preview-overlay">
        <div class="preview-info">
          <div class="file-name" title="${fileData.name}">${this.truncateFileName(fileData.name)}</div>
          <div class="file-size">${this.formatFileSize(fileData.size)}</div>
          ${metadataHtml}
        </div>
        <button class="preview-remove" onclick="window.fileManager?.removeFile('${fileData.id}')" title="Remove file">
          ×
        </button>
      </div>
    `;

    this.previewGrid.appendChild(previewElement);
  }

  /**
   * Update UI state
   */
  updateUI() {
    const fileCount = this.selectedFiles.length;
    
    // Update file count
    if (this.imageCount) {
      this.imageCount.textContent = fileCount;
    }

    // Show/hide preview container
    if (this.imagePreview) {
      this.imagePreview.classList.toggle('hidden', fileCount === 0);
    }

    // Update upload area text
    if (fileCount === 0) {
      if (this.uploadText) {
        this.uploadText.innerHTML = `
          <strong>Drag and drop your images here</strong>
          <br>or
        `;
      }
    } else {
      if (this.uploadText) {
        this.uploadText.innerHTML = `
          <strong>${fileCount} image${fileCount !== 1 ? 's' : ''} selected</strong>
          <br>Add more files or
        `;
      }
    }

    // Update button text
    if (this.selectFilesBtn) {
      this.selectFilesBtn.textContent = fileCount === 0 ? 'Select Files' : 'Add More Files';
    }

    // Update subtext
    if (this.uploadSubtext) {
      this.uploadSubtext.textContent = fileCount === 0 
        ? 'Supports JPEG, PNG, TIFF, WebP formats. Max 100MB per file.'
        : `Total: ${this.formatFileSize(this.getTotalSize())} • ${this.options.maxFiles - fileCount} more allowed`;
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Truncate long file names
   * @param {string} fileName - Original file name
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated file name
   */
  truncateFileName(fileName, maxLength = 20) {
    if (fileName.length <= maxLength) return fileName;
    
    const extension = fileName.split('.').pop();
    const nameWithoutExt = fileName.substring(0, fileName.length - extension.length - 1);
    const truncated = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';
    
    return `${truncated}.${extension}`;
  }

  /**
   * Get selected files
   * @returns {Array} Array of file data objects
   */
  getSelectedFiles() {
    return [...this.selectedFiles];
  }

  /**
   * Get selected files as File objects
   * @returns {Array} Array of File objects
   */
  getSelectedFileObjects() {
    return this.selectedFiles.map(fileData => fileData.file);
  }

  /**
   * Check if files are selected
   * @returns {boolean} True if files are selected
   */
  hasFiles() {
    return this.selectedFiles.length > 0;
  }

  /**
   * Get file count
   * @returns {number} Number of selected files
   */
  getFileCount() {
    return this.selectedFiles.length;
  }

  /**
   * Get total file size
   * @returns {number} Total size in bytes
   */
  getTotalSize() {
    return this.selectedFiles.reduce((total, fileData) => total + fileData.size, 0);
  }

  /**
   * Get file by ID
   * @param {string} fileId - File ID
   * @returns {Object|null} File data or null
   */
  getFileById(fileId) {
    return this.fileMap.get(fileId) || null;
  }

  /**
   * Get summary statistics
   * @returns {Object} File statistics
   */
  getStatistics() {
    return {
      count: this.selectedFiles.length,
      totalSize: this.getTotalSize(),
      averageSize: this.selectedFiles.length > 0 ? this.getTotalSize() / this.selectedFiles.length : 0,
      types: [...new Set(this.selectedFiles.map(f => f.type))],
      maxFiles: this.options.maxFiles,
      remainingSlots: this.options.maxFiles - this.selectedFiles.length
    };
  }

  /**
   * Dispose of file manager resources
   */
  dispose() {
    // Clean up preview URLs
    this.selectedFiles.forEach(fileData => {
      if (fileData.previewUrl) {
        URL.revokeObjectURL(fileData.previewUrl);
      }
    });

    // Clear data
    this.selectedFiles = [];
    this.fileMap.clear();

    // Remove global reference
    if (window.fileManager === this) {
      delete window.fileManager;
    }
  }
}

export default FileManager;
