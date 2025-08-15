# Web Frontend v0.2

Modern, modular web-based frontend for the Meshroom Web Application, implementing the Product Requirements Document (PRD) for version 0.2.

## Features

### Core Functionality

- **Single Image Processing**: Upload and process individual images for 3D reconstruction
- **Drag and Drop Interface**: Intuitive file upload with visual feedback
- **Real-time Progress Tracking**: WebSocket-based live progress updates with fallback polling
- **3D Model Viewer**: Interactive Three.js-based 3D model display
- **Parameter Configuration**: Comprehensive parameter panel with validation
- **Activity Logging**: Real-time logging with filtering and export capabilities

### User Experience

- **Responsive Design**: Works across desktop, tablet, and mobile devices
- **Accessibility**: WCAG-compliant design with keyboard navigation and screen reader support
- **Dark Mode Support**: Respects user's system preference for dark/light themes
- **Offline Handling**: Graceful degradation when network connection is lost
- **Error Handling**: User-friendly error messages and recovery options

### Technical Features

- **Modern JavaScript**: ES6+ modules with clean separation of concerns
- **No Build Process**: Runs directly in modern browsers without compilation
- **Progressive Enhancement**: Works with basic functionality even if advanced features fail
- **Performance Optimized**: Lazy loading, efficient rendering, and memory management

## Architecture

### File Structure

```text
src/frontend/web_v0.2/
├── index.html              # Main HTML file
├── styles/
│   ├── main.css           # Core styles and layout
│   ├── components.css     # Reusable UI components
│   └── responsive.css     # Responsive design and media queries
└── js/
    ├── app.js            # Main application orchestrator
    ├── fileManager.js    # File upload and management
    ├── parameterPanel.js # Parameter configuration UI
    ├── progressTracker.js# Real-time progress tracking
    ├── modelViewer.js    # 3D model display using Three.js
    ├── logPanel.js       # Activity logging and display
    ├── apiClient.js      # Backend API communication
    └── modal.js          # Modal dialogs and overlays
```

### Module Overview

#### App.js - Main Application

- Orchestrates all other modules
- Manages global application state
- Handles keyboard shortcuts and window events
- Provides logging and error handling coordination

#### FileManager.js - File Operations

- Drag and drop file upload
- File validation and preview
- Image metadata extraction
- File removal and management

#### ParameterPanel.js - Configuration UI

- Dynamic parameter form generation
- Parameter validation and constraints
- Parameter grouping and collapsible sections
- Default value management

#### ProgressTracker.js - Real-time Updates

- WebSocket connection for live progress
- Fallback HTTP polling
- Stage-based progress visualization
- Time estimation and completion tracking

#### ModelViewer.js - 3D Display

- Three.js integration for 3D rendering
- Model loading (GLB/GLTF, OBJ, PLY formats)
- Interactive camera controls
- Wireframe/solid rendering modes

#### LogPanel.js - Activity Logging

- Real-time log display with filtering
- Log level categorization (error, warning, info, debug)
- Search functionality
- Log export to JSON

#### ApiClient.js - Backend Communication

- RESTful API client with retry logic
- File upload with progress tracking
- WebSocket management
- Network status handling

#### Modal.js - Dialog System

- Reusable modal dialog system
- Confirmation, alert, and input dialogs
- Focus trapping and accessibility
- Keyboard navigation support

## Usage

### Basic Operation

1. Open `index.html` in a modern web browser
2. Drag and drop an image file onto the upload area
3. Configure processing parameters in the parameter panel
4. Click "Start Processing" to begin 3D reconstruction
5. Monitor progress in real-time
6. View and interact with the resulting 3D model

### Advanced Features

#### Keyboard Shortcuts

- `Ctrl/Cmd + O`: Open file dialog
- `Ctrl/Cmd + S`: Save current state
- `Ctrl/Cmd + Enter`: Start processing (when ready)
- `Escape`: Close active modal dialog

#### Parameter Configuration

The parameter panel supports various parameter types:

- **Dropdowns**: Quality levels, algorithms
- **Sliders**: Numeric ranges with live preview
- **Checkboxes**: Boolean options
- **Text inputs**: Custom values
- **Grouped parameters**: Collapsible advanced sections

#### 3D Viewer Controls

- **Mouse/Touch**: Orbit, pan, and zoom
- **Reset View**: Return to default camera position
- **Wireframe Toggle**: Switch between solid and wireframe rendering
- **Auto Rotate**: Automatic model rotation
- **Fullscreen**: Expand viewer to full screen

#### Log Panel Features

- **Real-time Updates**: Live log entries during processing
- **Level Filtering**: Show/hide by log level (error, warning, info, debug)
- **Search**: Find specific log entries
- **Export**: Download logs as JSON file
- **Auto-scroll**: Automatic scrolling to latest entries

## Browser Requirements

### Minimum Requirements

- **Chrome**: Version 80+ (2020)
- **Firefox**: Version 75+ (2020)
- **Safari**: Version 13+ (2019)
- **Edge**: Version 80+ (2020)

### Required Features

- ES6 Modules support
- WebSocket API
- Drag and Drop API
- File API
- Canvas 2D Context
- WebGL (for 3D viewer)
- CSS Grid and Flexbox
- CSS Custom Properties

### Optional Enhancements

- ResizeObserver (progressive enhancement)
- IntersectionObserver (performance optimization)
- Web Workers (future enhancement)
- Service Workers (offline functionality)

## Development

### Code Style

- **JavaScript**: ES6+ with modules, async/await
- **CSS**: Modern CSS with custom properties, Grid, and Flexbox
- **HTML**: Semantic HTML5 with proper accessibility attributes
- **Comments**: JSDoc-style documentation for all modules

### Testing

- Manual testing across supported browsers
- Accessibility testing with screen readers
- Responsive design testing on various screen sizes
- Performance testing with various file sizes

### Performance Considerations

- **Lazy Loading**: Components loaded only when needed
- **Memory Management**: Proper cleanup of resources
- **Debounced Events**: Efficient handling of resize/scroll events
- **Optimized Rendering**: RequestAnimationFrame for smooth animations

## Configuration

### Environment Variables

The application automatically detects the backend URL based on the current page location. For development, ensure the backend is running on `http://localhost:8000`.

### Customization

- **Themes**: Modify CSS custom properties in `main.css`
- **Parameters**: Edit parameter definitions in `parameterPanel.js`
- **Logging**: Adjust log levels and filters in `logPanel.js`
- **3D Viewer**: Configure Three.js settings in `modelViewer.js`

## Troubleshooting

### Common Issues

#### File Upload Fails

- Check file size (max 100MB)
- Verify file format (JPEG, PNG, TIFF, WebP)
- Ensure backend is running and accessible

#### 3D Viewer Not Loading

- Verify WebGL support in browser
- Check Three.js library loading
- Inspect browser console for errors

#### Progress Not Updating

- Check WebSocket connection status
- Verify backend WebSocket endpoint
- Check network connectivity

#### Dark Mode Not Working

- Verify browser supports `prefers-color-scheme`
- Check CSS custom properties support
- Inspect computed styles in developer tools

### Debug Mode

Open browser developer tools and check:

- **Console**: JavaScript errors and debug messages
- **Network**: API requests and WebSocket connections
- **Elements**: HTML structure and CSS styles
- **Application**: Local storage and session data

## Future Enhancements

### Planned Features

- **Multi-image Processing**: Support for multiple input images
- **Advanced Parameters**: More detailed processing options
- **Result Comparison**: Side-by-side model comparison
- **Processing Queue**: Batch processing capabilities
- **User Accounts**: Save preferences and processing history

### Technical Improvements

- **Web Workers**: Background processing for better performance
- **Service Workers**: Offline functionality and caching
- **WebAssembly**: Client-side image processing
- **PWA Features**: Installable web app capabilities

## License

This project is part of the Meshroom Web Application and follows the same licensing terms as the parent project.
