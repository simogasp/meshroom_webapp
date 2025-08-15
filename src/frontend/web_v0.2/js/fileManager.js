/**
 * File Manager Module
 * Handles file upload, drag-and-drop, preview, and validation
 * @module FileManager
 */

/**
 * File Manager Class
 * Manages file upload interface and file operations
 */
export class FileManager {
  constructor(options = {}) {
    this.options = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/webp'],
      onFileSelected: () => {},
      onFileRemoved: () => {},
      onError: () => {},
      ...options
    };

    this.currentFile = null;
    this.previewUrl = null;
    
    this.init();
  }

  /**
   * Initialize file manager
   */
  init() {
    this.setupElements();
    this.setupEventListeners();
  }

  /**
   * Setup DOM elements
   */
  setupElements() {
    this.uploadArea = document.getElementById('uploadArea');
    this.fileInput = document.getElementById('fileInput');
    this.uploadText = document.getElementById('uploadText');
    this.uploadSubtext = document.getElementById('uploadSubtext');
    this.filePreview = document.getElementById('filePreview');
    this.previewImage = document.getElementById('previewImage');
    this.fileName = document.getElementById('fileName');
    this.fileSize = document.getElementById('fileSize');
    this.removeFileBtn = document.getElementById('removeFile');

    if (!this.uploadArea) {
      throw new Error('Upload area element not found');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Click to upload
    this.uploadArea.addEventListener('click', () => {
      if (!this.currentFile) {
        this.openFileDialog();
      }
    });

    // File input change
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.handleFileSelection(file);
        }
      });
    }

    // Drag and drop
    this.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadArea.classList.add('dragover');
    });

    this.uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!this.uploadArea.contains(e.relatedTarget)) {
        this.uploadArea.classList.remove('dragover');
      }
    });

    this.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadArea.classList.remove('dragover');
      
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.handleFileSelection(files[0]);
      }
    });

    // Remove file button
    if (this.removeFileBtn) {
      this.removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFile();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.openFileDialog();
      }
    });
  }

  /**
   * Open file dialog
   */
  openFileDialog() {
    if (this.fileInput) {
      this.fileInput.click();
    }
  }

  /**
   * Handle file selection
   * @param {File} file - Selected file
   */
  async handleFileSelection(file) {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Remove previous file
      if (this.currentFile) {
        this.removeFile();
      }

      this.currentFile = file;

      // Show preview
      await this.showPreview(file);

      // Update UI
      this.updateUploadAreaState();

      // Notify parent
      this.options.onFileSelected(file);

    } catch (error) {
      this.options.onError(error);
      this.showError(error.message);
    }
  }

  /**
   * Validate file
   * @param {File} file - File to validate
   * @returns {Object} Validation result
   */
  validateFile(file) {
    // Check file type
    if (!this.options.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported file type: ${file.type}. Supported types: ${this.options.allowedTypes.join(', ')}`
      };
    }

    // Check file size
    if (file.size > this.options.maxFileSize) {
      return {
        valid: false,
        error: `File too large: ${this.formatFileSize(file.size)}. Maximum size: ${this.formatFileSize(this.options.maxFileSize)}`
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
   * Show file preview
   * @param {File} file - File to preview
   */
  async showPreview(file) {
    return new Promise((resolve, reject) => {
      // Clean up previous preview
      if (this.previewUrl) {
        URL.revokeObjectURL(this.previewUrl);
      }

      // Create new preview URL
      this.previewUrl = URL.createObjectURL(file);

      // Load image
      const img = new Image();
      img.onload = () => {
        // Update preview elements
        if (this.previewImage) {
          this.previewImage.src = this.previewUrl;
          this.previewImage.alt = file.name;
        }

        if (this.fileName) {
          this.fileName.textContent = file.name;
        }

        if (this.fileSize) {
          this.fileSize.textContent = this.formatFileSize(file.size);
        }

        // Show preview container
        if (this.filePreview) {
          this.filePreview.classList.remove('hidden');
        }

        // Update image dimensions info
        this.updateImageInfo(img.naturalWidth, img.naturalHeight);

        resolve();
      };

      img.onerror = () => {
        reject(new Error('Failed to load image preview'));
      };

      img.src = this.previewUrl;
    });
  }

  /**
   * Update image information display
   * @param {number} width - Image width
   * @param {number} height - Image height
   */
  updateImageInfo(width, height) {
    const imageInfo = document.getElementById('imageInfo');
    if (imageInfo) {
      imageInfo.innerHTML = `
        <div class="image-dimensions">
          <span class="dimension-label">Dimensions:</span>
          <span class="dimension-value">${width} × ${height} pixels</span>
        </div>
        <div class="image-aspect">
          <span class="aspect-label">Aspect Ratio:</span>
          <span class="aspect-value">${this.calculateAspectRatio(width, height)}</span>
        </div>
      `;
      imageInfo.classList.remove('hidden');
    }
  }

  /**
   * Calculate aspect ratio
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @returns {string} Aspect ratio string
   */
  calculateAspectRatio(width, height) {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    const ratioW = width / divisor;
    const ratioH = height / divisor;
    
    // Common ratios
    const commonRatios = {
      '16:9': 16/9,
      '4:3': 4/3,
      '3:2': 3/2,
      '1:1': 1/1,
      '2:3': 2/3,
      '3:4': 3/4,
      '9:16': 9/16
    };
    
    const actualRatio = width / height;
    
    for (const [name, ratio] of Object.entries(commonRatios)) {
      if (Math.abs(actualRatio - ratio) < 0.01) {
        return name;
      }
    }
    
    return `${ratioW}:${ratioH}`;
  }

  /**
   * Remove current file
   */
  removeFile() {
    if (this.currentFile) {
      // Clean up preview URL
      if (this.previewUrl) {
        URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
      }

      // Reset file input
      if (this.fileInput) {
        this.fileInput.value = '';
      }

      // Hide preview
      if (this.filePreview) {
        this.filePreview.classList.add('hidden');
      }

      // Hide image info
      const imageInfo = document.getElementById('imageInfo');
      if (imageInfo) {
        imageInfo.classList.add('hidden');
      }

      // Reset state
      this.currentFile = null;
      this.updateUploadAreaState();

      // Notify parent
      this.options.onFileRemoved();
    }
  }

  /**
   * Update upload area visual state
   */
  updateUploadAreaState() {
    if (!this.uploadArea) return;

    if (this.currentFile) {
      this.uploadArea.classList.add('has-file');
      
      if (this.uploadText) {
        this.uploadText.textContent = 'File uploaded successfully';
      }
      
      if (this.uploadSubtext) {
        this.uploadSubtext.textContent = 'Click or drag another file to replace';
      }
    } else {
      this.uploadArea.classList.remove('has-file');
      
      if (this.uploadText) {
        this.uploadText.textContent = 'Drop your image here or click to browse';
      }
      
      if (this.uploadSubtext) {
        this.uploadSubtext.textContent = 'Supports JPEG, PNG, TIFF, WebP (max 100MB)';
      }
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    // Create temporary error display
    const errorDiv = document.createElement('div');
    errorDiv.className = 'upload-error';
    errorDiv.textContent = message;
    
    // Insert into upload area
    if (this.uploadArea) {
      this.uploadArea.appendChild(errorDiv);
      
      // Remove after 5 seconds
      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.parentNode.removeChild(errorDiv);
        }
      }, 5000);
    }
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
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
   * Get current file
   * @returns {File|null} Current file
   */
  getCurrentFile() {
    return this.currentFile;
  }

  /**
   * Check if file is selected
   * @returns {boolean} Whether file is selected
   */
  hasFile() {
    return !!this.currentFile;
  }

  /**
   * Get file preview URL
   * @returns {string|null} Preview URL
   */
  getPreviewUrl() {
    return this.previewUrl;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.currentFile = null;
    this.previewUrl = null;
  }
}
