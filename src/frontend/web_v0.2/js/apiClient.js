/**
 * API Client Module  
 * Handles all communication with the backend API
 * @module ApiClient
 */

/**
 * API Client Class
 * Manages HTTP requests and WebSocket connections to the backend
 */
export class ApiClient {
  constructor(options = {}) {
    this.options = {
      baseUrl: 'http://localhost:8000',
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      ...options
    };

    this.activeUploads = new Map();
    this.requestQueue = [];
    this.isOnline = navigator.onLine;
    
    this.setupNetworkHandlers();
  }

  /**
   * Setup network status handlers
   */
  setupNetworkHandlers() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueuedRequests();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Make HTTP request with retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise} Request promise
   */
  async request(endpoint, options = {}) {
    const url = `${this.options.baseUrl}${endpoint}`;
    const requestOptions = {
      ...options
    };

    // Don't set Content-Type for FormData, let the browser handle it
    if (!(options.body instanceof FormData)) {
      requestOptions.headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
    } else {
      // For FormData, only include custom headers, not Content-Type
      requestOptions.headers = {
        ...options.headers
      };
    }

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
    requestOptions.signal = controller.signal;

    let lastError;
    
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Handle different response types
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else if (contentType && contentType.startsWith('text/')) {
          return await response.text();
        } else {
          return await response.blob();
        }
        
      } catch (error) {
        lastError = error;
        clearTimeout(timeoutId);
        
        // Don't retry for certain errors
        if (error.name === 'AbortError' || 
            (error.message && error.message.includes('401')) ||
            (error.message && error.message.includes('403'))) {
          throw error;
        }

        // Wait before retry
        if (attempt < this.options.retryAttempts) {
          await this.delay(this.options.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Upload file to server
   * @param {File} file - File to upload  
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(file, options = {}) {
    const {
      onProgress,
      onUploadId,
      endpoint = '/upload',
      ...otherOptions
    } = options;

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add additional form fields
      if (otherOptions.metadata) {
        Object.entries(otherOptions.metadata).forEach(([key, value]) => {
          formData.append(key, JSON.stringify(value));
        });
      }

      const xhr = new XMLHttpRequest();
      const uploadId = this.generateUploadId();
      
      // Store active upload
      this.activeUploads.set(uploadId, xhr);
      
      if (onUploadId) {
        onUploadId(uploadId);
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = {
            loaded: e.loaded,
            total: e.total,
            percentage: (e.loaded / e.total) * 100
          };
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        this.activeUploads.delete(uploadId);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            resolve({ success: true, data: xhr.responseText });
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        this.activeUploads.delete(uploadId);
        reject(new Error('Upload failed due to network error'));
      });

      xhr.addEventListener('abort', () => {
        this.activeUploads.delete(uploadId);
        reject(new Error('Upload was cancelled'));
      });

      xhr.open('POST', `${this.options.baseUrl}${endpoint}`);
      xhr.send(formData);
    });
  }

  /**
   * Cancel file upload
   * @param {string} uploadId - Upload ID to cancel
   */
  cancelUpload(uploadId) {
    const xhr = this.activeUploads.get(uploadId);
    if (xhr) {
      xhr.abort();
      this.activeUploads.delete(uploadId);
    }
  }

  /**
   * Start processing job
   * @param {File[]} files - Input files
   * @param {Object} parameters - Processing parameters
   * @returns {Promise<string>} Job ID
   */
  async startProcessing(files, parameters = {}) {
    try {
      const formData = new FormData();
      
      // Add files to FormData
      files.forEach((file) => {
        formData.append('files', file);
      });
      
      // Add parameters to FormData
      if (parameters.quality) {
        formData.append('quality', parameters.quality);
      }
      if (parameters.max_features) {
        formData.append('max_features', parameters.max_features.toString());
      }
      if (parameters.enable_gpu !== undefined) {
        formData.append('enable_gpu', parameters.enable_gpu.toString());
      }

      const result = await this.request('/upload', {
        method: 'POST',
        body: formData
      });

      if (!result.job_id) {
        throw new Error('Upload did not return job ID');
      }

      return result.job_id;
    } catch (error) {
      throw new Error(`Failed to start processing: ${error.message}`);
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    return await this.request(`/jobs/${jobId}`);
  }

  /**
   * Get job progress
   * @param {string} jobId - Job ID  
   * @returns {Promise<Object>} Job progress
   */
  async getJobProgress(jobId) {
    return await this.request(`/jobs/${jobId}/progress`);
  }

  /**
   * Get job results
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job results
   */
  async getJobResults(jobId) {
    return await this.request(`/jobs/${jobId}/results`);
  }

  /**
   * Cancel job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelJob(jobId) {
    return await this.request(`/jobs/${jobId}/cancel`, {
      method: 'POST'
    });
  }

  /**
   * Delete job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteJob(jobId) {
    return await this.request(`/jobs/${jobId}`, {
      method: 'DELETE'
    });
  }

  /**
   * List all jobs
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Jobs list
   */
  async listJobs(filters = {}) {
    const params = new URLSearchParams(filters);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.request(`/jobs${query}`);
  }

  /**
   * Download file
   * @param {string} url - Download URL
   * @param {Object} options - Download options
   * @returns {Promise<Blob>} Downloaded file
   */
  async downloadFile(url, options = {}) {
    const { onProgress } = options;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    if (!onProgress) {
      return await response.blob();
    }

    // Handle progress tracking for downloads
    const reader = response.body.getReader();
    const contentLength = +response.headers.get('Content-Length');
    
    let receivedLength = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      if (contentLength) {
        onProgress({
          loaded: receivedLength,
          total: contentLength,
          percentage: (receivedLength / contentLength) * 100
        });
      }
    }

    return new Blob(chunks);
  }

  /**
   * Get server health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    return await this.request('/health');
  }

  /**
   * Get server info
   * @returns {Promise<Object>} Server information
   */
  async getServerInfo() {
    return await this.request('/info');
  }

  /**
   * Test WebSocket connection
   * @param {string} endpoint - WebSocket endpoint
   * @returns {Promise<WebSocket>} WebSocket connection
   */
  testWebSocketConnection(endpoint = '/ws/test') {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.options.baseUrl.replace('http', 'ws')}${endpoint}`;
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  /**
   * Create WebSocket connection for real-time updates
   * @param {string} endpoint - WebSocket endpoint
   * @param {Object} options - WebSocket options
   * @returns {WebSocket} WebSocket connection
   */
  createWebSocket(endpoint, options = {}) {
    const wsUrl = `${this.options.baseUrl.replace('http', 'ws')}${endpoint}`;
    const ws = new WebSocket(wsUrl);
    
    // Add automatic reconnection logic
    if (options.autoReconnect) {
      ws._shouldReconnect = true;
      
      const reconnect = () => {
        if (ws._shouldReconnect) {
          setTimeout(() => {
            if (ws._shouldReconnect) {
              const newWs = this.createWebSocket(endpoint, options);
              // Copy event handlers
              if (options.onOpen) newWs.onopen = options.onOpen;
              if (options.onMessage) newWs.onmessage = options.onMessage;
              if (options.onClose) newWs.onclose = options.onClose;
              if (options.onError) newWs.onError = options.onError;
            }
          }, options.reconnectDelay || 5000);
        }
      };

      ws.onclose = (event) => {
        if (options.onClose) {
          options.onClose(event);
        }
        if (!event.wasClean) {
          reconnect();
        }
      };

      ws.onerror = (error) => {
        if (options.onError) {
          options.onError(error);
        }
        reconnect();
      };
    }

    return ws;
  }

  /**
   * Generate unique upload ID
   * @returns {string} Upload ID
   */
  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Delay promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process queued requests (when connection is restored)
   */
  async processQueuedRequests() {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    for (const { resolve, reject, endpoint, options } of queue) {
      try {
        const result = await this.request(endpoint, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
  }

  /**
   * Queue request for when connection is restored
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise} Queued request promise
   */
  queueRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, endpoint, options });
    });
  }

  /**
   * Get network status
   * @returns {boolean} Whether online
   */
  isNetworkOnline() {
    return this.isOnline;
  }

  /**
   * Get active uploads count
   * @returns {number} Number of active uploads
   */
  getActiveUploadsCount() {
    return this.activeUploads.size;
  }

  /**
   * Get queued requests count
   * @returns {number} Number of queued requests
   */
  getQueuedRequestsCount() {
    return this.requestQueue.length;
  }
}
