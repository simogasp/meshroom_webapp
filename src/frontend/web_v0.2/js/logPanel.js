/**
 * Log Panel Module
 * Simple logging functionality for debugging purposes
 * @module LogPanel
 */

/**
 * Log Panel Class
 * Manages log entries display and basic functionality
 */
export class LogPanel {
  constructor(options = {}) {
    this.options = {
      containerId: 'logContainer',
      maxEntries: 1000,
      autoScroll: true,
      timestampFormat: 'HH:mm:ss.SSS',
      ...options
    };

    this.logs = [];
    this.autoScroll = this.options.autoScroll;

    this.init();
  }

  /**
   * Initialize log panel
   */
  init() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      throw new Error(`Log container ${this.options.containerId} not found`);
    }

    this.setupEventListeners();
    this.renderLogs();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Clear logs button
    const clearBtn = document.getElementById('clearLogsBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearLogs());
    }
  }

  /**
   * Add a log entry
   */
  addEntry(level, message, details = null) {
    const timestamp = new Date();
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      level,
      message,
      details
    };

    this.logs.unshift(logEntry);

    // Limit log entries
    if (this.logs.length > this.options.maxEntries) {
      this.logs = this.logs.slice(0, this.options.maxEntries);
    }

    this.renderLogs();
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.renderLogs();
  }

  /**
   * Render logs to container
   */
  renderLogs() {
    if (!this.container) return;

    if (this.logs.length === 0) {
      this.container.innerHTML = '<div class="log-placeholder">Processing logs will appear here...</div>';
      return;
    }

    const logsHtml = this.logs.map(log => this.createLogEntryHTML(log)).join('');
    this.container.innerHTML = logsHtml;

    // Auto-scroll to bottom if enabled
    if (this.autoScroll) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  /**
   * Create HTML for a log entry
   */
  createLogEntryHTML(log) {
    const timeStr = this.formatTimestamp(log.timestamp);
    const levelClass = `log-${log.level}`;
    
    return `
      <div class="log-entry ${levelClass}" data-level="${log.level}">
        <div class="log-time">${timeStr}</div>
        <div class="log-level">${log.level.toUpperCase()}</div>
        <div class="log-message">${this.escapeHtml(log.message)}</div>
        ${log.details ? `<div class="log-details">${this.escapeHtml(JSON.stringify(log.details, null, 2))}</div>` : ''}
      </div>
    `;
  }

  /**
   * Format timestamp
   */
  formatTimestamp(date) {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Convenience methods for different log levels
  error(message, details) { this.addEntry('error', message, details); }
  warning(message, details) { this.addEntry('warning', message, details); }
  info(message, details) { this.addEntry('info', message, details); }
  debug(message, details) { this.addEntry('debug', message, details); }
}
