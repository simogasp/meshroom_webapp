/**
 * Progress Tracker Module
 * Handles real-time progress tracking via WebSocket and periodic polling
 * @module ProgressTracker
 */

/**
 * Progress Tracker Class
 * Manages real-time progress updates and stage tracking
 */
export class ProgressTracker {
  constructor(options = {}) {
    this.options = {
      wsUrl: 'ws://localhost:8000/ws/progress',
      pollInterval: 5000, // 5 seconds fallback polling
      onProgressUpdate: () => {},
      onProcessComplete: () => {},
      onProcessError: () => {},
      onConnectionStatusChange: () => {},
      ...options
    };

    this.jobId = null;
    this.isTracking = false;
    this.websocket = null;
    this.pollTimer = null;
    this.connectionStatus = 'disconnected';
    
    this.progressData = {
      overall: 0,
      stage: 'idle',
      stageProgress: 0,
      message: '',
      stages: [],
      estimatedTimeRemaining: null,
      startTime: null,
      lastUpdate: null
    };

    this.stages = [
      {
        id: 'upload',
        name: 'File Upload',
        description: 'Uploading and validating input file',
        weight: 5
      },
      {
        id: 'preprocessing',
        name: 'Preprocessing',
        description: 'Analyzing and preparing image data',
        weight: 15
      },
      {
        id: 'depth_estimation',
        name: 'Depth Estimation',
        description: 'Calculating depth information from image',
        weight: 30
      },
      {
        id: 'mesh_generation',
        name: 'Mesh Generation',
        description: 'Creating 3D geometry from depth data',
        weight: 25
      },
      {
        id: 'texture_mapping',
        name: 'Texture Mapping',
        description: 'Applying textures to 3D model',
        weight: 15
      },
      {
        id: 'optimization',
        name: 'Optimization',
        description: 'Optimizing model for output format',
        weight: 10
      }
    ];

    this.init();
  }

  /**
   * Initialize progress tracker
   */
  init() {
    this.setupElements();
    this.renderStages();
  }

  /**
   * Setup DOM elements
   */
  setupElements() {
    this.overallProgressBar = document.getElementById('overallProgress');
    this.overallPercentage = document.getElementById('overallPercentage');
    this.processingStatus = document.getElementById('processingStatus');
    this.timeRemaining = document.getElementById('timeRemaining');
    this.stageContainer = document.getElementById('stageProgressContainer');
    this.cancelButton = document.getElementById('cancelProcessing');

    if (!this.overallProgressBar) {
      throw new Error('Progress bar elements not found');
    }

    // Cancel button handler
    if (this.cancelButton) {
      this.cancelButton.addEventListener('click', () => {
        this.cancelProcessing();
      });
    }
  }

  /**
   * Render stage progress indicators
   */
  renderStages() {
    if (!this.stageContainer) return;

    this.stageContainer.innerHTML = this.stages.map(stage => `
      <div class="stage-progress" data-stage="${stage.id}">
        <div class="stage-header">
          <div class="stage-info">
            <h4 class="stage-name">${stage.name}</h4>
            <p class="stage-description">${stage.description}</p>
          </div>
          <div class="stage-status">
            <span class="stage-icon">⏳</span>
            <span class="stage-percentage">0%</span>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Start tracking progress for a job
   * @param {string} jobId - Job ID to track
   */
  startTracking(jobId) {
    this.jobId = jobId;
    this.isTracking = true;
    this.progressData.startTime = Date.now();
    this.progressData.lastUpdate = Date.now();

    this.log('info', `Starting progress tracking for job ${jobId}`);
    
    // Try WebSocket connection first
    this.connectWebSocket();
    
    // Start fallback polling
    this.startPolling();
    
    // Update UI
    this.updateUI();
  }

  /**
   * Stop tracking progress
   */
  stopTracking() {
    this.isTracking = false;
    this.jobId = null;
    
    // Close WebSocket connection
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    // Stop polling
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    
    this.setConnectionStatus('disconnected');
    this.log('info', 'Progress tracking stopped');
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket() {
    try {
      const wsUrl = `${this.options.wsUrl}/${this.jobId}`;
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.setConnectionStatus('connected');
        this.log('info', 'WebSocket connected for real-time progress updates');
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleProgressUpdate(data);
        } catch (error) {
          this.log('error', 'Failed to parse WebSocket message', error);
        }
      };

      this.websocket.onclose = () => {
        this.setConnectionStatus('disconnected');
        this.log('warning', 'WebSocket connection closed');
        
        // Attempt to reconnect after 5 seconds if still tracking
        if (this.isTracking) {
          setTimeout(() => {
            if (this.isTracking) {
              this.connectWebSocket();
            }
          }, 5000);
        }
      };

      this.websocket.onerror = (error) => {
        this.log('error', 'WebSocket error', error);
        this.setConnectionStatus('error');
      };

    } catch (error) {
      this.log('error', 'Failed to establish WebSocket connection', error);
      this.setConnectionStatus('error');
    }
  }

  /**
   * Start fallback polling
   */
  startPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(() => {
      if (this.isTracking && this.jobId) {
        this.pollProgress();
      }
    }, this.options.pollInterval);
  }

  /**
   * Poll progress via HTTP
   */
  async pollProgress() {
    try {
      const response = await fetch(`/api/jobs/${this.jobId}/progress`);
      if (response.ok) {
        const data = await response.json();
        this.handleProgressUpdate(data);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.log('error', 'Failed to poll progress', error);
    }
  }

  /**
   * Handle progress update from any source
   * @param {Object} data - Progress data
   */
  handleProgressUpdate(data) {
    this.progressData = {
      ...this.progressData,
      ...data,
      lastUpdate: Date.now()
    };

    // Calculate time estimates
    this.calculateTimeEstimates();

    // Update UI
    this.updateUI();

    // Handle completion or error
    if (data.status === 'completed') {
      this.handleCompletion(data);
    } else if (data.status === 'failed' || data.status === 'error') {
      this.handleError(data);
    } else {
      // Notify of progress update
      this.options.onProgressUpdate(this.progressData);
    }
  }

  /**
   * Calculate time estimates
   */
  calculateTimeEstimates() {
    if (!this.progressData.startTime || this.progressData.overall <= 0) {
      this.progressData.estimatedTimeRemaining = null;
      return;
    }

    const elapsed = Date.now() - this.progressData.startTime;
    const progress = this.progressData.overall / 100;
    const totalEstimated = elapsed / progress;
    const remaining = totalEstimated - elapsed;

    this.progressData.estimatedTimeRemaining = Math.max(0, remaining);
  }

  /**
   * Update UI elements
   */
  updateUI() {
    this.updateOverallProgress();
    this.updateStageProgress();
    this.updateStatusText();
    this.updateTimeEstimate();
  }

  /**
   * Update overall progress bar
   */
  updateOverallProgress() {
    if (this.overallProgressBar) {
      this.overallProgressBar.style.width = `${this.progressData.overall}%`;
    }

    if (this.overallPercentage) {
      this.overallPercentage.textContent = `${Math.round(this.progressData.overall)}%`;
    }
  }

  /**
   * Update stage progress indicators
   */
  updateStageProgress() {
    if (!this.stageContainer) return;

    const currentStage = this.progressData.stage;
    const currentStageProgress = this.progressData.stageProgress || 0;

    this.stages.forEach((stage, index) => {
      const stageElement = this.stageContainer.querySelector(`[data-stage="${stage.id}"]`);
      if (!stageElement) return;

      const progressBar = stageElement.querySelector('.progress-fill');
      const percentage = stageElement.querySelector('.stage-percentage');
      const icon = stageElement.querySelector('.stage-icon');

      // Determine stage state
      let stageState, stageProgress;
      
      if (stage.id === currentStage) {
        stageState = 'active';
        stageProgress = currentStageProgress;
      } else if (this.stages.findIndex(s => s.id === currentStage) > index) {
        stageState = 'completed';
        stageProgress = 100;
      } else {
        stageState = 'pending';
        stageProgress = 0;
      }

      // Update visual state
      stageElement.className = `stage-progress ${stageState}`;
      
      if (progressBar) {
        progressBar.style.width = `${stageProgress}%`;
      }

      if (percentage) {
        percentage.textContent = `${Math.round(stageProgress)}%`;
      }

      if (icon) {
        switch (stageState) {
          case 'completed':
            icon.textContent = '✅';
            break;
          case 'active':
            icon.textContent = '⚡';
            break;
          default:
            icon.textContent = '⏳';
        }
      }
    });
  }

  /**
   * Update status text
   */
  updateStatusText() {
    if (this.processingStatus) {
      const currentStage = this.stages.find(s => s.id === this.progressData.stage);
      const statusText = this.progressData.message || 
                        (currentStage ? currentStage.description : 'Processing...');
      
      this.processingStatus.textContent = statusText;
    }
  }

  /**
   * Update time estimate
   */
  updateTimeEstimate() {
    if (this.timeRemaining) {
      if (this.progressData.estimatedTimeRemaining) {
        const remaining = this.progressData.estimatedTimeRemaining;
        this.timeRemaining.textContent = `Estimated time remaining: ${this.formatTime(remaining)}`;
      } else {
        this.timeRemaining.textContent = 'Calculating time estimate...';
      }
    }
  }

  /**
   * Format time duration
   * @param {number} milliseconds - Time in milliseconds
   * @returns {string} Formatted time string
   */
  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Handle processing completion
   * @param {Object} data - Completion data
   */
  handleCompletion(data) {
    this.log('info', 'Processing completed successfully');
    this.stopTracking();
    
    // Update to 100% completion
    this.progressData.overall = 100;
    this.progressData.stage = 'completed';
    this.progressData.stageProgress = 100;
    this.updateUI();

    // Notify completion
    this.options.onProcessComplete(data.results || data);
  }

  /**
   * Handle processing error
   * @param {Object} data - Error data
   */
  handleError(data) {
    this.log('error', `Processing failed: ${data.error || 'Unknown error'}`);
    this.stopTracking();
    
    // Update UI to show error state
    this.progressData.stage = 'error';
    this.progressData.message = data.error || 'Processing failed';
    this.updateUI();

    // Notify error
    this.options.onProcessError({
      message: data.error || 'Processing failed',
      details: data.details,
      stage: data.stage
    });
  }

  /**
   * Cancel processing
   */
  async cancelProcessing() {
    if (!this.jobId) return;

    try {
      const response = await fetch(`/api/jobs/${this.jobId}/cancel`, {
        method: 'POST'
      });

      if (response.ok) {
        this.log('info', 'Processing cancelled successfully');
        this.stopTracking();
        this.reset();
      } else {
        throw new Error(`Failed to cancel: ${response.statusText}`);
      }
    } catch (error) {
      this.log('error', 'Failed to cancel processing', error);
    }
  }

  /**
   * Reset progress tracker
   */
  reset() {
    this.stopTracking();
    
    this.progressData = {
      overall: 0,
      stage: 'idle',
      stageProgress: 0,
      message: '',
      stages: [],
      estimatedTimeRemaining: null,
      startTime: null,
      lastUpdate: null
    };

    this.updateUI();
  }

  /**
   * Refresh progress (manual refresh)
   */
  async refreshProgress() {
    if (this.jobId && this.isTracking) {
      await this.pollProgress();
    }
  }

  /**
   * Set connection status
   * @param {string} status - Connection status
   */
  setConnectionStatus(status) {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.options.onConnectionStatusChange(status);
      
      // Update UI indicator if exists
      const indicator = document.getElementById('connectionStatus');
      if (indicator) {
        indicator.className = `connection-status ${status}`;
        indicator.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      }
    }
  }

  /**
   * Get current progress data
   * @returns {Object} Current progress data
   */
  getProgressData() {
    return { ...this.progressData };
  }

  /**
   * Check if currently tracking
   * @returns {boolean} Whether currently tracking
   */
  isCurrentlyTracking() {
    return this.isTracking;
  }

  /**
   * Get connection status
   * @returns {string} Connection status
   */
  getConnectionStatus() {
    return this.connectionStatus;
  }

  /**
   * Log message (would integrate with main app logger)
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {*} data - Additional data
   */
  log(level, message, data = null) {
    // This would integrate with the main app's logging system
    console[level](`[ProgressTracker] ${message}`, data);
  }
}
