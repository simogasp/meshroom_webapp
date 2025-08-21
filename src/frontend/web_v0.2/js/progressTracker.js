/**
 * Progress Tracker Module
 * Handles real-time progress tracking via WebSocket and periodic polling
 * @module ProgressTracker
 */

// Default configuration constants
// Default estimated processing time per job in minutes.
// The value of 3 minutes is based on observed average processing times for typical photogrammetry jobs in our environment.
// This value can be configured via the ProgressTracker options to better match different workloads or processing scenarios.
const DEFAULT_ESTIMATED_MINUTES_PER_JOB = 3;
const DEFAULT_MIN_ESTIMATED_MINUTES = 1; // Minimum wait time to show meaningful estimate
const POLLING_INTERVAL_MS = 2000; // Poll for progress updates every 2 seconds
const COMPLETION_DISPLAY_DURATION_MS = 3000; // Show completion message for 3 seconds

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
      estimatedMinutesPerJob: DEFAULT_ESTIMATED_MINUTES_PER_JOB, // Estimated processing time per job in queue
      minEstimatedMinutes: DEFAULT_MIN_ESTIMATED_MINUTES, // Minimum estimated wait time to display
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
    
    // DOM element references
    this.progressMessage = document.getElementById('progressMessage');
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

    // Note: Queue tracker is used for queued jobs, stage progress for processing jobs
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
    
    // Show the queue tracker and cancel button
    this.showQueueTracker();
    this.showCancelButton();
    
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
    this.updateStatusText();
  }

  /**
   * Update queue status or hide queue tracker when processing starts
   */
  updateQueueStatus() {
    // If job is queued, show queue tracker
    if (this.progressData.status === 'queued') {
      this.showQueueTracker();
      
      if (this.queuePosition) {
        const queuePos = this.progressData.queue_position;
        if (typeof queuePos === 'number' && !isNaN(queuePos) && queuePos > 0) {
          this.queuePosition.textContent = `Position #${queuePos}`;
        } else {
          this.queuePosition.textContent = `Position: calculating...`;
        }
      }
      
      if (this.queueStatus) {
        const position = this.progressData.queue_position;
        if (typeof position === 'number' && !isNaN(position) && position > 0) {
          if (position === 1) {
            this.queueStatus.textContent = "Next in queue - processing will start soon...";
          } else {
            this.queueStatus.textContent = `Waiting in queue... ${position - 1} jobs ahead`;
          }
        } else {
          this.queueStatus.textContent = "Waiting in queue... position calculating...";
        }
      }
      
      if (this.estimatedWait) {
        // Validate queue_position is a valid number before calculation
        const queuePosition = this.progressData.queue_position;
        if (typeof queuePosition === 'number' && !isNaN(queuePosition) && queuePosition > 0) {
          // Configurable estimate based on jobs ahead in queue
          const estimatedMinutes = Math.max(
            this.options.minEstimatedMinutes, 
            (queuePosition - 1) * this.options.estimatedMinutesPerJob
          );
          this.estimatedWait.textContent = `Estimated wait: ~${this._formatWaitTime(estimatedMinutes)}`;
        } else {
          // Fallback when queue position is invalid
          this.estimatedWait.textContent = `Estimated wait: calculating...`;
        }
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
   * Show the cancel button
   */
  showCancelButton() {
    if (this.cancelButton) {
      this.cancelButton.classList.remove('hidden');
      this.cancelButton.style.display = '';
    }
  }

  /**
   * Hide the cancel button
   */
  hideCancelButton() {
    if (this.cancelButton) {
      this.cancelButton.classList.add('hidden');
      this.cancelButton.style.display = 'none';
    }
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
   * Format wait time in minutes to a readable string
   * @param {number} minutes - Time in minutes
   * @returns {string} Formatted time string
   */
  _formatWaitTime(minutes) {
    if (minutes < 1) {
      return "< 1 min";
    } else if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      if (remainingMinutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
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
    // Prevent multiple completion calls
    if (this.completed) {
      return;
    }
    
    this.log('info', 'Processing completed successfully');
    this.completed = true;
    this.stopTracking();
    
    // Hide cancel button when processing is complete
    this.hideCancelButton();
    
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
    
    // Hide cancel button when processing fails
    this.hideCancelButton();
    
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
      
      // Hide cancel button since processing is cancelled
      this.hideCancelButton();
      
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
