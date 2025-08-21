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
      updateInterval: 100,
      pollInterval: 2000, // Poll every 2 seconds
      smoothingFactor: 0.1,
      estimatedMinutesPerJob: 3, // Estimated processing time per job in queue
      onProgressUpdate: () => {},
      onCompletion: () => {},
      onError: () => {},
      onConnectionStatusChange: () => {},
      ...options
    };

    this.apiClient = options.apiClient;
    this.progressData = {};
    this.startTime = null;
    this.lastProgressTime = null;
    this.velocityHistory = [];
    this.stages = []; // Initialize empty stages array
    this.cancelling = false; // Flag to prevent multiple cancellation attempts
    
    // Get DOM elements - simplified since we're using queue tracker instead of overall progress
    this.progressBar = document.getElementById('progressBar');
    this.progressText = document.getElementById('progressText');
    this.progressMessage = document.getElementById('progressMessage');
    this.estimatedCompletion = document.getElementById('estimatedCompletion');
    this.stageContainer = document.getElementById('stageProgressContainer');
    
    // Initialize UI - simplified initialization since DOM elements are already set
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
    // Queue tracking elements (for when job is queued)
    this.queueTracker = document.getElementById('queueTracker');
    this.queuePosition = document.getElementById('queuePosition');
    this.queueStatus = document.getElementById('queueStatus');
    this.estimatedWait = document.getElementById('estimatedWait');
    
    // Stage progress elements (for when job is processing)
    this.stageContainer = document.getElementById('stageProgressContainer');
    this.cancelButton = document.getElementById('cancelProcessing');

    // Note: No longer requiring overall progress elements since they're replaced by queue tracker
    // The queue tracker will be shown when job is queued, hidden when processing starts

    // Cancel button handler (prevent duplicate listeners)
    if (this.cancelButton && !this.cancelButton.hasAttribute('data-progress-tracker-listener')) {
      this.cancelButton.addEventListener('click', () => {
        this.cancelProcessing();
      });
      this.cancelButton.setAttribute('data-progress-tracker-listener', 'true');
    }
  }

  /**
   * Render stage progress indicators
   */
  renderStages() {
    if (!this.stageContainer) return;
    
    // Check if stages is defined and is an array
    if (!this.stages || !Array.isArray(this.stages) || this.stages.length === 0) {
      // Clear any existing content for empty stages
      this.stageContainer.innerHTML = '';
      return;
    }

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
    this.completed = false; // Reset completion flag
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
      // Use API client to get the correct WebSocket URL
      const baseWsUrl = this.apiClient ? 
        this.apiClient.options.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws' :
        'ws://localhost:8000/ws';
      const wsUrl = `${baseWsUrl}/${this.jobId}`;
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
    // Don't poll if tracking has been stopped
    if (!this.isTracking || !this.jobId) {
      return;
    }

    try {
      if (!this.apiClient) {
        throw new Error('API client not available');
      }
      
      const data = await this.apiClient.getJobStatus(this.jobId);
      
      // Double check that we're still tracking before handling the update
      if (this.isTracking) {
        this.handleProgressUpdate(data);
      }
    } catch (error) {
      // Only log errors if we're still tracking
      if (this.isTracking) {
        this.log('error', 'Failed to poll progress', error);
      }
    }
  }

  /**
   * Handle progress update from any source
   * @param {Object} data - Progress data
   */
  handleProgressUpdate(data) {
    // Don't handle updates if tracking has been stopped
    if (!this.isTracking) {
      return;
    }

    this.progressData = {
      ...this.progressData,
      ...data,
      lastUpdate: Date.now()
    };

    // Parse stage information from message if available
    if (data.message) {
      const stageInfo = this.parseStageMessage(data.message);
      if (stageInfo) {
        this.updateDynamicStageProgress(stageInfo);
      }
    }

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
   * Parse stage information from progress message
   * @param {string} message - Progress message in format "1/6 Stage name... 45.0%"
   * @returns {Object|null} Parsed stage info or null if not parseable
   */
  parseStageMessage(message) {
    // Match pattern: "{stage_idx}/{num_stages} {stage_name}... {percentage}%"
    const regex = /^(\d+)\/(\d+)\s+(.+?)\.{3}\s+(\d+(?:\.\d+)?)%$/;
    const match = message.match(regex);
    
    if (match) {
      return {
        stageIdx: parseInt(match[1], 10),
        numStages: parseInt(match[2], 10),
        stageName: match[3],
        stageProgress: parseFloat(match[4])
      };
    }
    
    return null;
  }

  /**
   * Update or create dynamic stage progress bars
   * @param {Object} stageInfo - Parsed stage information
   */
  updateDynamicStageProgress(stageInfo) {
    const { stageIdx, numStages, stageName, stageProgress } = stageInfo;
    const stageId = `stage-${stageIdx}`;
    
    // Check if stage progress bar already exists
    let stageElement = document.getElementById(stageId);
    
    if (!stageElement) {
      // Create new stage progress bar
      stageElement = this.createStageProgressBar(stageId, stageIdx, numStages, stageName);
      if (this.stageContainer) {
        this.stageContainer.appendChild(stageElement);
      }
    }
    
    // Update the progress bar
    const progressBar = stageElement.querySelector('.stage-progress-fill');
    const progressText = stageElement.querySelector('.stage-progress-text');
    
    if (progressBar) {
      progressBar.style.width = `${stageProgress}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${stageProgress.toFixed(1)}%`;
    }
    
    // Update stage status
    const isComplete = stageProgress >= 100;
    const isActive = stageProgress > 0 && stageProgress < 100;
    
    stageElement.classList.toggle('stage-complete', isComplete);
    stageElement.classList.toggle('stage-active', isActive);
    stageElement.classList.toggle('stage-pending', stageProgress === 0);
  }

  /**
   * Create a new stage progress bar element
   * @param {string} stageId - Unique stage ID
   * @param {number} stageIdx - Stage index (1-based)
   * @param {number} numStages - Total number of stages
   * @param {string} stageName - Name of the stage
   * @returns {HTMLElement} Created stage element
   */
  createStageProgressBar(stageId, stageIdx, numStages, stageName) {
    const stageElement = document.createElement('div');
    stageElement.id = stageId;
    stageElement.className = 'dynamic-stage-progress stage-pending';
    
    stageElement.innerHTML = `
      <div class="stage-header">
        <span class="stage-label">${stageIdx}/${numStages} ${stageName}</span>
        <span class="stage-progress-text">0.0%</span>
      </div>
      <div class="stage-progress-bar">
        <div class="stage-progress-fill"></div>
      </div>
    `;
    
    return stageElement;
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
    this.updateQueueStatus();
    this.updateStageProgress();
    this.updateStatusText();
    this.updateTimeEstimate();
  }

  /**
   * Update queue status or hide queue tracker when processing starts
   */
  updateQueueStatus() {
    // If job is queued, show queue tracker
    if (this.progressData.status === 'queued' && this.progressData.queue_position > 0) {
      this.showQueueTracker();
      
      if (this.queuePosition) {
        this.queuePosition.textContent = `Position #${this.progressData.queue_position}`;
      }
      
      if (this.queueStatus) {
        const position = this.progressData.queue_position;
        if (position === 1) {
          this.queueStatus.textContent = "Next in queue - processing will start soon...";
        } else {
          this.queueStatus.textContent = `Waiting in queue... ${position - 1} jobs ahead`;
        }
      }
      
      if (this.estimatedWait) {
        // Configurable estimate based on jobs ahead in queue
        const estimatedMinutes = Math.max(1, (this.progressData.queue_position - 1) * this.options.estimatedMinutesPerJob);
        this.estimatedWait.textContent = `Estimated wait: ~${estimatedMinutes} minutes`;
      }
    } 
    // If job is processing or completed, hide queue tracker
    else if (this.progressData.status === 'processing' || this.progressData.status === 'completed') {
      this.hideQueueTracker();
    }
  }
  
  /**
   * Show the queue tracker widget
   */
  showQueueTracker() {
    if (this.queueTracker) {
      this.queueTracker.classList.remove('hidden');
    }
  }
  
  /**
   * Hide the queue tracker widget
   */
  hideQueueTracker() {
    if (this.queueTracker) {
      this.queueTracker.classList.add('hidden');
    }
  }

  /**
   * Calculate overall progress from stage information (fallback method)
   */
  calculateOverallProgressFromStages() {
    if (!this.progressData.message) return 0;
    
    const stageInfo = this.parseStageMessage(this.progressData.message);
    if (!stageInfo) return 0;
    
    const { stageIdx, numStages, stageProgress } = stageInfo;
    // Calculate overall progress: (completed stages + current stage progress) / total stages
    const completedStages = Math.max(0, stageIdx - 1);
    const overallProgress = (completedStages * 100 + stageProgress) / numStages;
    return Math.min(100, Math.max(0, overallProgress));
  }

  /**
   * Update stage progress indicators (legacy method - now handled by dynamic system)
   */
  updateStageProgress() {
    // This method is now handled by updateDynamicStageProgress
    // Keep for compatibility but no longer needed
    return;
  }

  /**
   * Update status text
   */
  updateStatusText() {
    // Update progress message if we have the DOM element
    if (this.progressMessage) {
      const statusText = this.progressData.message || 'Processing...';
      this.progressMessage.textContent = statusText;
    }
  }

  /**
   * Update time estimate (now handled by queue tracker when queued)
   */
  updateTimeEstimate() {
    // Time estimate is now handled in updateQueueStatus() when job is queued
    // No overall time estimate needed when processing (stage progress shows progress)
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
    // Prevent multiple completion calls
    if (this.completed) {
      return;
    }
    
    this.log('info', 'Processing completed successfully');
    this.completed = true;
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
    // Don't handle errors if tracking has already been stopped (prevents duplicate errors)
    if (!this.isTracking) {
      return;
    }

    this.log('error', `Processing failed: ${data.error || 'Unknown error'}`);
    this.stopTracking();
    
    // Update UI to show error state
    this.progressData.stage = 'error';
    this.progressData.message = data.error || 'Processing failed';
    this.updateUI();

    // Notify error (only once)
    if (this.options.onProcessError) {
      this.options.onProcessError({
        message: data.error || 'Processing failed',
        details: data.details,
        stage: data.stage
      });
    }
  }

  /**
   * Cancel processing
   */
  async cancelProcessing() {
    if (!this.jobId || !this.apiClient) return;
    
    // Prevent multiple cancellation attempts
    if (this.cancelling) return;
    this.cancelling = true;

    // Store jobId before stopping tracking (which sets it to null)
    const jobIdToCancel = this.jobId;

    try {
      this.log('info', 'Cancelling processing...');
      
      // Stop tracking FIRST to prevent polling conflicts
      this.stopTracking();
      
      // Use the stored job ID for the cancel request
      await this.apiClient.cancelJob(jobIdToCancel);
      
      this.log('info', 'Processing cancelled successfully');
      
      // Reset UI state
      this.reset();
      
      // Update progress data to show cancellation
      this.progressData = {
        ...this.progressData,
        status: 'cancelled',
        message: 'Processing cancelled by user'
      };
      this.updateUI();
      
      // Notify the app about the cancellation (only once)
      if (this.options.onProcessError) {
        this.options.onProcessError({
          message: 'Processing cancelled by user',
          details: 'Job was cancelled',
          stage: 'cancelled'
        });
      }
      
    } catch (error) {
      this.log('error', 'Failed to cancel processing', error);
      // Still stop tracking even if cancel request failed
      this.stopTracking();
      this.reset();
    } finally {
      this.cancelling = false;
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

    // Reset cancelling flag
    this.cancelling = false;

    // Clear dynamic stage progress bars
    this.clearDynamicStageProgress();

    this.updateUI();
  }

  /**
   * Clear all dynamic stage progress bars
   */
  clearDynamicStageProgress() {
    if (this.stageContainer) {
      // Remove all dynamically created stage progress bars
      const dynamicStages = this.stageContainer.querySelectorAll('.dynamic-stage-progress');
      dynamicStages.forEach(stageElement => {
        stageElement.remove();
      });
    }
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
    // Ensure valid console method exists, fallback to log
    const validLevels = ['log', 'info', 'warn', 'error', 'debug'];
    const logLevel = validLevels.includes(level) ? level : 'log';
    
    if (data) {
      console[logLevel](`[ProgressTracker] ${message}`, data);
    } else {
      console[logLevel](`[ProgressTracker] ${message}`);
    }
  }
}
