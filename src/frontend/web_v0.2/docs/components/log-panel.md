# LogPanel Component

The `LogPanel` class provides simple logging capabilities for debugging and monitoring application behavior.

## Overview

The LogPanel displays application logs in a clean, straightforward interface. It focuses on core functionality without complex features, making it reliable and easy to use for debugging purposes.

## Basic Usage

```javascript
import { LogPanel } from './js/logPanel.js';

const logPanel = new LogPanel({
  containerId: 'logContainer',
  maxEntries: 1000,
  autoScroll: true
});

// Add log entries
logPanel.addEntry('info', 'Processing started');
logPanel.addEntry('warning', 'File size is large');
logPanel.addEntry('error', 'Processing failed', { errorCode: 500 });
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `containerId` | `string` | `'logContainer'` | ID of the log content container |
| `maxEntries` | `number` | `1000` | Maximum number of log entries to keep |
| `autoScroll` | `boolean` | `true` | Auto-scroll to newest entries |
| `timestampFormat` | `string` | `'HH:mm:ss.SSS'` | Timestamp display format |

## API Methods

### Core Methods

#### `addEntry(level, message, details?)`

Add a new log entry.

```javascript
logPanel.addEntry('info', 'File uploaded successfully');
logPanel.addEntry('error', 'Upload failed', { 
  error: 'Network timeout',
  filename: 'document.pdf'
});
```

**Parameters:**

- `level` (string): Log level - 'error', 'warning', 'info', or 'debug'
- `message` (string): Main log message  
- `details` (any, optional): Additional data to include with the entry

#### `clearLogs()`

Clear all log entries.

```javascript
logPanel.clearLogs();
```

#### `renderLogs()`

Refresh the log display. Called automatically when entries are added or cleared.

```javascript
logPanel.renderLogs();
```

### Convenience Methods

#### `error(message, details?)`

Add an error log entry.

```javascript
logPanel.error('Database connection failed', { host: 'localhost', port: 5432 });
```

#### `warning(message, details?)`

Add a warning log entry.

```javascript
logPanel.warning('Disk space running low');
```

#### `info(message, details?)`

Add an info log entry.

```javascript
logPanel.info('User logged in', { userId: 12345 });
```

#### `debug(message, details?)`

Add a debug log entry.

```javascript
logPanel.debug('Variable state', { variable: 'value' });
```

## Log Entry Structure

Each log entry contains:

```javascript
{
  id: 1692178123456.789,        // Unique identifier (timestamp + random)
  timestamp: Date,              // When the entry was created
  level: 'info',               // Log level (error/warning/info/debug)  
  message: 'Processing started', // Main log message
  details: { ... }             // Optional additional data
}
```

## HTML Output Structure

Each log entry is rendered as:

```html
<div class="log-entry log-error" data-level="error">
  <div class="log-time">14:30:25.123</div>
  <div class="log-level">ERROR</div>
  <div class="log-message">Processing failed</div>
  <div class="log-details">{"errorCode": 500}</div> <!-- Only if details provided -->
</div>
```

## CSS Classes

### Log Entry Classes

- `.log-entry` - Individual log entry container
- `.log-error` - Error level styling (typically red)
- `.log-warning` - Warning level styling (typically orange/yellow)
- `.log-info` - Info level styling (typically blue)
- `.log-debug` - Debug level styling (typically gray)

### Component Classes

- `.log-time` - Timestamp styling
- `.log-level` - Log level badge styling  
- `.log-message` - Main message content
- `.log-details` - Additional details (JSON formatted)
- `.log-placeholder` - Empty state message

## Expected HTML Structure

The LogPanel expects this HTML structure to exist:

```html
<aside id="logPanel" class="log-panel">
  <div class="log-header">
    <h3>Activity Log</h3>
    <button id="clearLogsBtn" class="btn btn-small">Clear</button>
  </div>
  <div id="logContainer" class="log-container">
    <div class="log-placeholder">Processing logs will appear here...</div>
  </div>
</aside>
```

## Features

### ✅ Core Features

- **Multiple log levels**: error, warning, info, debug
- **Precise timestamps**: Includes milliseconds
- **Auto-scroll**: Shows latest entries automatically
- **Entry limit**: Prevents memory issues with too many logs
- **HTML escaping**: Safe rendering prevents XSS attacks
- **Clear functionality**: One-click to clear all logs
- **JSON details**: Pretty-printed additional data

### ❌ Not Included

- ~~Filtering by log level~~
- ~~Search functionality~~
- ~~Export capabilities~~
- ~~Mobile responsiveness~~  
- ~~Collapsible interface~~
- ~~Keyboard shortcuts~~

## Integration with App

The LogPanel integrates with the main application through the `App.log()` method:

```javascript
// In app.js
log(level, message, data = null) {
  this.components.logPanel?.addEntry(level, message, data);
  console[level](message, data); // Also log to browser console
}

// Usage throughout the app
this.log('info', 'File processing started');
this.log('error', 'Network request failed', { url: '/api/process', status: 500 });
```

## Error Handling

The LogPanel includes basic error handling:

- Graceful degradation if container element is missing
- HTML escaping prevents code injection
- Entry limit prevents memory overflow
- Safe JSON serialization for details objects

## Performance

- **Lightweight**: Minimal code and memory footprint
- **Fast rendering**: Simple DOM manipulation
- **Efficient**: Entry limit prevents unbounded growth
- **No dependencies**: Uses only standard JavaScript APIs

## Browser Compatibility

- All modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with ES6 transpilation)
- No polyfills required
- Uses standard DOM APIs only

## Example Usage Patterns

### Basic Debugging

```javascript
// Simple status messages
logPanel.info('Application started');
logPanel.info('Loading configuration');
logPanel.info('Ready for user input');
```

### Error Tracking

```javascript
try {
  await processFiles();
} catch (error) {
  logPanel.error('File processing failed', {
    error: error.message,
    stack: error.stack,
    files: selectedFiles.map(f => f.name)
  });
}
```

### Progress Monitoring

```javascript
function updateProgress(step, total, currentFile) {
  logPanel.info(`Processing ${step}/${total}: ${currentFile}`);
}
```

### Development Debugging

```javascript
logPanel.debug('User interaction', {
  event: 'click',
  target: event.target.id,
  coordinates: { x: event.clientX, y: event.clientY }
});
```

This simple implementation provides reliable logging functionality without the complexity of advanced features that can introduce bugs or maintenance overhead.
