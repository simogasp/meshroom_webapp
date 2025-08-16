# Simple Log Panel

## Overview

The log panel provides basic debugging functionality for the Meshroom WebApp. It displays log entries with timestamps and different severity levels in a simple, straightforward interface.

## Features

### 🔸 **Basic Logging**

- **Multiple log levels**: Error, Warning, Info, Debug
- **Timestamped entries**: Precise timestamps with milliseconds
- **Auto-scroll**: Automatically scrolls to show the latest entries
- **Entry limit**: Maintains only the most recent 1000 entries (configurable)
- **HTML safety**: All log messages are properly escaped to prevent XSS

### 🔸 **Simple Interface**

- **Clear button**: One-click to clear all log entries
- **Clean layout**: Minimal design focused on readability
- **Color coding**: Different styling for each log level
- **Detailed view**: Optional details object for complex log data

## Technical Implementation

### Configuration Options

```javascript
new LogPanel({
  containerId: 'logContainer',  // DOM container ID
  maxEntries: 1000,            // Maximum number of entries to keep
  autoScroll: true,            // Auto-scroll to latest entries
  timestampFormat: 'HH:mm:ss.SSS'  // Timestamp format
});
```

### CSS Classes

- `.log-entry` - Individual log entry container
- `.log-error` - Error level styling (red)
- `.log-warning` - Warning level styling (orange)
- `.log-info` - Info level styling (blue)
- `.log-debug` - Debug level styling (gray)
- `.log-time` - Timestamp styling
- `.log-level` - Log level badge styling
- `.log-message` - Main message content
- `.log-details` - Additional details (if provided)

## API Methods

### Core Methods

- `addEntry(level, message, details)` - Add a new log entry
- `clearLogs()` - Remove all log entries
- `renderLogs()` - Refresh the display (called automatically)

### Convenience Methods

- `error(message, details)` - Add error log entry
- `warning(message, details)` - Add warning log entry
- `info(message, details)` - Add info log entry
- `debug(message, details)` - Add debug log entry

## Usage Examples

### Basic Logging

```javascript
// Initialize (done automatically by app.js)
const logPanel = new LogPanel();

// Add different types of log entries
logPanel.error('Processing failed', { errorCode: 500 });
logPanel.warning('File size is large');
logPanel.info('Processing started');
logPanel.debug('Variable value', { variable: 'value' });
```

### Through App Interface

```javascript
// The app provides a unified logging interface
app.log('info', 'User uploaded files');
app.log('error', 'Network connection failed', { url: '/api/process' });
```

### Manual Control

```javascript
// Clear all logs
logPanel.clearLogs();

// Check current log count
console.log(logPanel.logs.length);
```

## Log Entry Format

Each log entry contains:

```javascript
{
  id: 1692178123456.789,        // Unique identifier
  timestamp: Date object,        // When the entry was created
  level: 'info',                // Log level (error/warning/info/debug)
  message: 'Processing started', // Main log message
  details: { ... }              // Optional additional data
}
```

## HTML Structure

The log panel expects this HTML structure:

```html
<aside id="logPanel" class="log-panel">
  <div class="log-header">
    <h3>Activity Log</h3>
    <button id="clearLogsBtn" class="btn btn-small">Clear</button>
  </div>
  <div id="logContainer" class="log-container">
    <!-- Log entries appear here -->
  </div>
</aside>
```

## Styling

The panel uses semantic CSS classes for styling:

- Error entries have red coloring
- Warning entries have orange/yellow coloring  
- Info entries have blue coloring
- Debug entries have gray coloring
- Timestamps are displayed in a monospace font
- Messages are word-wrapped for readability

## Benefits

### For Developers

- ✅ **Simple API**: Easy to use logging methods
- ✅ **Lightweight**: Minimal overhead and complexity
- ✅ **Reliable**: No complex features that can break
- ✅ **Safe**: HTML escaping prevents injection attacks
- ✅ **Fast**: Optimized for performance with entry limits

### For Debugging

- ✅ **Real-time**: Log entries appear immediately
- ✅ **Persistent**: Logs remain until manually cleared
- ✅ **Detailed**: Support for additional data objects
- ✅ **Searchable**: Easy to scan through recent entries
- ✅ **Timestamped**: Precise timing information

## Browser Compatibility

- All modern browsers (Chrome, Firefox, Safari, Edge)
- No special dependencies or polyfills required
- Uses standard JavaScript APIs only
- Graceful degradation if container element is missing

## Integration

The log panel integrates seamlessly with the Meshroom WebApp:

1. **Automatic initialization** by app.js
2. **Global logging** through `app.log()` method
3. **Error handling** displays errors in the log panel
4. **Processing updates** show progress and status
5. **File operations** log success/failure states

This simple implementation focuses on core functionality without unnecessary complexity, making it perfect for debugging and monitoring application behavior.
