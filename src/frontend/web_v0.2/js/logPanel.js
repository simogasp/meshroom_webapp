/**
 * Log Panel Module
 * Handles application logging and log display
 * @module LogPanel
 */

/**
 * Log Panel Class
 * Manages log entries, filtering, and export functionality
 */
export class LogPanel {
  constructor(options = {}) {
    this.options = {
      containerId: 'logContainer',
      maxEntries: 1000,
      enableExport: true,
      enableFiltering: true,
      enableSearch: true,
      autoScroll: true,
      timestampFormat: 'HH:mm:ss.SSS',
      ...options
    };

    this.logs = [];
    this.filteredLogs = [];
    this.filters = {
      levels: ['error', 'warning', 'info', 'debug'],
      search: ''
    };

    this.isVisible = false;
    this.autoScroll = this.options.autoScroll;

    this.init();
  }

  /**
   * Initialize log panel
   */
  init() {
    this.setupElements();
    this.setupEventListeners();
    this.renderLogs();
  }

  /**
   * Setup DOM elements
   */
  setupElements() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      throw new Error(`Log container ${this.options.containerId} not found`);
    }

    // Create log panel structure
    this.container.innerHTML = `
      <div class="log-header">
        <div class="log-title">
          <h3>Activity Log</h3>
          <div class="log-stats">
            <span id="logCount">0</span> entries
          </div>
        </div>
        <div class="log-controls">
          ${this.options.enableSearch ? `
            <input type="text" 
                   id="logSearch" 
                   class="log-search" 
                   placeholder="Search logs..."
                   autocomplete="off">
          ` : ''}
          <div class="log-filters">
            <button class="filter-btn active" data-level="error" title="Show Errors">
              <span class="filter-icon">❌</span>
              <span class="filter-count" id="errorCount">0</span>
            </button>
            <button class="filter-btn active" data-level="warning" title="Show Warnings">
              <span class="filter-icon">⚠️</span>
              <span class="filter-count" id="warningCount">0</span>
            </button>
            <button class="filter-btn active" data-level="info" title="Show Info">
              <span class="filter-icon">ℹ️</span>
              <span class="filter-count" id="infoCount">0</span>
            </button>
            <button class="filter-btn active" data-level="debug" title="Show Debug">
              <span class="filter-icon">🐛</span>
              <span class="filter-count" id="debugCount">0</span>
            </button>
          </div>
          <div class="log-actions">
            <button id="toggleAutoScroll" class="log-action-btn ${this.autoScroll ? 'active' : ''}" title="Auto Scroll">
              📜
            </button>
            <button id="clearLogs" class="log-action-btn" title="Clear Logs">
              🗑️
            </button>
            ${this.options.enableExport ? `
              <button id="exportLogs" class="log-action-btn" title="Export Logs">
                💾
              </button>
            ` : ''}
          </div>
        </div>
      </div>
      <div class="log-content" id="logContent">
        <div class="log-entries" id="logEntries"></div>
        <div class="log-empty" id="logEmpty">
          <div class="empty-icon">📋</div>
          <p>No log entries yet</p>
        </div>
      </div>
    `;

    // Get references to elements
    this.logEntries = document.getElementById('logEntries');
    this.logEmpty = document.getElementById('logEmpty');
    this.logContent = document.getElementById('logContent');
    this.logCount = document.getElementById('logCount');
    this.searchInput = document.getElementById('logSearch');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search functionality
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value.toLowerCase();
        this.applyFilters();
      });
    }

    // Filter buttons
    const filterButtons = this.container.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const level = e.currentTarget.dataset.level;
        this.toggleFilter(level);
        e.currentTarget.classList.toggle('active');
      });
    });

    // Action buttons
    const clearBtn = document.getElementById('clearLogs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearLogs());
    }

    const autoScrollBtn = document.getElementById('toggleAutoScroll');
    if (autoScrollBtn) {
      autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
    }

    const exportBtn = document.getElementById('exportLogs');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportLogs());
    }

    // Auto-scroll detection
    this.logContent.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.logContent;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 3;
      
      if (this.autoScroll && !isAtBottom) {
        // User scrolled away from bottom, disable auto-scroll temporarily
        this.setAutoScroll(false, false);
      }
    });
  }

  /**
   * Add log entry
   * @param {string} level - Log level (error, warning, info, debug)
   * @param {string} message - Log message
   * @param {*} data - Additional data
   */
  addEntry(level, message, data = null) {
    const entry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      level: level.toLowerCase(),
      message,
      data,
      formatted: null
    };

    // Add to logs array
    this.logs.push(entry);

    // Limit log entries
    if (this.logs.length > this.options.maxEntries) {
      this.logs.shift();
    }

    // Update counters
    this.updateCounts();

    // Apply filters and render
    this.applyFilters();

    // Auto-scroll if enabled
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * Generate unique entry ID
   * @returns {string} Entry ID
   */
  generateEntryId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Toggle filter for log level
   * @param {string} level - Log level to toggle
   */
  toggleFilter(level) {
    const index = this.filters.levels.indexOf(level);
    if (index > -1) {
      this.filters.levels.splice(index, 1);
    } else {
      this.filters.levels.push(level);
    }
    
    this.applyFilters();
  }

  /**
   * Apply current filters
   */
  applyFilters() {
    this.filteredLogs = this.logs.filter(entry => {
      // Level filter
      if (!this.filters.levels.includes(entry.level)) {
        return false;
      }

      // Search filter
      if (this.filters.search) {
        const searchTerm = this.filters.search;
        return entry.message.toLowerCase().includes(searchTerm) ||
               entry.level.toLowerCase().includes(searchTerm) ||
               (entry.data && JSON.stringify(entry.data).toLowerCase().includes(searchTerm));
      }

      return true;
    });

    this.renderLogs();
  }

  /**
   * Render log entries
   */
  renderLogs() {
    if (this.filteredLogs.length === 0) {
      this.logEntries.innerHTML = '';
      this.logEmpty.style.display = 'flex';
      return;
    }

    this.logEmpty.style.display = 'none';

    // Render entries
    const entriesHTML = this.filteredLogs.map(entry => this.renderLogEntry(entry)).join('');
    this.logEntries.innerHTML = entriesHTML;

    // Update count
    this.logCount.textContent = this.filteredLogs.length;
  }

  /**
   * Render individual log entry
   * @param {Object} entry - Log entry
   * @returns {string} HTML string
   */
  renderLogEntry(entry) {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const levelIcon = this.getLevelIcon(entry.level);
    const levelClass = `log-level-${entry.level}`;
    
    let dataHTML = '';
    if (entry.data) {
      const dataStr = typeof entry.data === 'string' 
        ? entry.data 
        : JSON.stringify(entry.data, null, 2);
      
      dataHTML = `
        <div class="log-data">
          <details>
            <summary>Additional Data</summary>
            <pre class="log-data-content">${this.escapeHtml(dataStr)}</pre>
          </details>
        </div>
      `;
    }

    return `
      <div class="log-entry ${levelClass}" data-id="${entry.id}">
        <div class="log-entry-header">
          <span class="log-timestamp">${timestamp}</span>
          <span class="log-level">
            <span class="log-level-icon">${levelIcon}</span>
            <span class="log-level-text">${entry.level.toUpperCase()}</span>
          </span>
        </div>
        <div class="log-message">${this.escapeHtml(entry.message)}</div>
        ${dataHTML}
      </div>
    `;
  }

  /**
   * Format timestamp
   * @param {Date} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(timestamp) {
    const hours = timestamp.getHours().toString().padStart(2, '0');
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    const seconds = timestamp.getSeconds().toString().padStart(2, '0');
    const milliseconds = timestamp.getMilliseconds().toString().padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * Get icon for log level
   * @param {string} level - Log level
   * @returns {string} Icon
   */
  getLevelIcon(level) {
    const icons = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      debug: '🐛'
    };
    
    return icons[level] || '📝';
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update log level counters
   */
  updateCounts() {
    const counts = {
      error: 0,
      warning: 0,
      info: 0,
      debug: 0
    };

    this.logs.forEach(entry => {
      if (counts.hasOwnProperty(entry.level)) {
        counts[entry.level]++;
      }
    });

    // Update UI
    Object.keys(counts).forEach(level => {
      const countElement = document.getElementById(`${level}Count`);
      if (countElement) {
        countElement.textContent = counts[level];
      }
    });

    // Update total count
    if (this.logCount) {
      this.logCount.textContent = this.logs.length;
    }
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    if (this.logs.length === 0) return;

    if (confirm('Are you sure you want to clear all log entries?')) {
      this.logs = [];
      this.filteredLogs = [];
      this.renderLogs();
      this.updateCounts();
    }
  }

  /**
   * Toggle auto-scroll
   * @param {boolean} updateUI - Whether to update UI
   */
  toggleAutoScroll(updateUI = true) {
    this.setAutoScroll(!this.autoScroll, updateUI);
  }

  /**
   * Set auto-scroll state
   * @param {boolean} enabled - Whether to enable auto-scroll
   * @param {boolean} updateUI - Whether to update UI
   */
  setAutoScroll(enabled, updateUI = true) {
    this.autoScroll = enabled;
    
    if (updateUI) {
      const autoScrollBtn = document.getElementById('toggleAutoScroll');
      if (autoScrollBtn) {
        autoScrollBtn.classList.toggle('active', enabled);
      }
    }

    if (enabled) {
      this.scrollToBottom();
    }
  }

  /**
   * Scroll to bottom of log panel
   */
  scrollToBottom() {
    if (this.logContent) {
      this.logContent.scrollTop = this.logContent.scrollHeight;
    }
  }

  /**
   * Export logs to file
   */
  exportLogs() {
    if (this.logs.length === 0) {
      alert('No logs to export');
      return;
    }

    const exportData = this.logs.map(entry => ({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      data: entry.data
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meshroom-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import logs from file
   * @param {File} file - Log file to import
   * @returns {Promise} Import promise
   */
  async importLogs(file) {
    try {
      const text = await file.text();
      const importedLogs = JSON.parse(text);
      
      if (!Array.isArray(importedLogs)) {
        throw new Error('Invalid log file format');
      }

      // Validate and convert imported logs
      const validLogs = importedLogs
        .filter(entry => entry.timestamp && entry.level && entry.message)
        .map(entry => ({
          id: this.generateEntryId(),
          timestamp: new Date(entry.timestamp),
          level: entry.level,
          message: entry.message,
          data: entry.data || null
        }));

      // Merge with existing logs
      this.logs = [...this.logs, ...validLogs];

      // Sort by timestamp
      this.logs.sort((a, b) => a.timestamp - b.timestamp);

      // Apply size limit
      if (this.logs.length > this.options.maxEntries) {
        this.logs = this.logs.slice(-this.options.maxEntries);
      }

      this.updateCounts();
      this.applyFilters();

      alert(`Imported ${validLogs.length} log entries`);

    } catch (error) {
      alert(`Failed to import logs: ${error.message}`);
    }
  }

  /**
   * Filter logs by time range
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   */
  filterByTimeRange(startTime, endTime) {
    this.filteredLogs = this.logs.filter(entry => {
      return entry.timestamp >= startTime && entry.timestamp <= endTime;
    });
    
    this.renderLogs();
  }

  /**
   * Get logs by level
   * @param {string} level - Log level
   * @returns {Array} Filtered logs
   */
  getLogsByLevel(level) {
    return this.logs.filter(entry => entry.level === level);
  }

  /**
   * Get recent logs
   * @param {number} minutes - Minutes to look back
   * @returns {Array} Recent logs
   */
  getRecentLogs(minutes = 5) {
    const cutoff = new Date(Date.now() - (minutes * 60 * 1000));
    return this.logs.filter(entry => entry.timestamp >= cutoff);
  }

  /**
   * Get log statistics
   * @returns {Object} Log statistics
   */
  getStats() {
    const counts = {
      error: 0,
      warning: 0,
      info: 0,
      debug: 0,
      total: this.logs.length
    };

    this.logs.forEach(entry => {
      if (counts.hasOwnProperty(entry.level)) {
        counts[entry.level]++;
      }
    });

    return {
      ...counts,
      oldestEntry: this.logs.length > 0 ? this.logs[0].timestamp : null,
      newestEntry: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
      filteredCount: this.filteredLogs.length
    };
  }

  /**
   * Set visibility of log panel
   * @param {boolean} visible - Whether panel should be visible
   */
  setVisible(visible) {
    this.isVisible = visible;
    this.container.style.display = visible ? 'flex' : 'none';
  }

  /**
   * Check if panel is visible
   * @returns {boolean} Whether panel is visible
   */
  getVisible() {
    return this.isVisible;
  }

  /**
   * Dispose of log panel resources
   */
  dispose() {
    this.logs = [];
    this.filteredLogs = [];
  }
}
