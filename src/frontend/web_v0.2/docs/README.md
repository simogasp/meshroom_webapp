# Frontend Documentation - Web v0.2

This directory contains comprehensive documentation for the Meshroom WebApp frontend v0.2.

## 📁 Documentation Structure

### [`/components`](./components/)

Component-specific documentation for individual UI components:

- API documentation
- Configuration options  
- Usage examples
- Styling guidelines

### [`/features`](./features/)

Feature documentation for major application features:

- [Simple Log Panel](./features/simple-log-panel.md) - Basic debugging and monitoring functionality
- Processing Pipeline - Image upload and 3D model generation workflow
- Real-time Progress Tracking - WebSocket-based progress monitoring

### [`/guides`](./guides/)

Step-by-step guides for developers:

- Getting started with development
- Adding new components
- Styling conventions
- Testing procedures

## 🗂️ Quick Reference

### Core Components

| Component | File | Documentation |
|-----------|------|---------------|
| LogPanel | `js/logPanel.js` | [docs/components/log-panel.md](./components/log-panel.md) |
| FileManager | `js/fileManager.js` | [docs/components/file-manager.md](./components/file-manager.md) |
| ModelViewer | `js/modelViewer.js` | [docs/components/model-viewer.md](./components/model-viewer.md) |
| ProgressTracker | `js/progressTracker.js` | [docs/components/progress-tracker.md](./components/progress-tracker.md) |
| ParameterPanel | `js/parameterPanel.js` | [docs/components/parameter-panel.md](./components/parameter-panel.md) |

### Styling

| File | Purpose | Documentation |
|------|---------|---------------|
| `styles/main.css` | Core styles, layout, variables | [docs/guides/styling.md](./guides/styling.md) |
| `styles/components.css` | Reusable UI components | [docs/guides/components.md](./guides/components.md) |
| `styles/responsive.css` | Mobile & responsive styles | [docs/guides/responsive.md](./guides/responsive.md) |

## 🔧 Development

### Prerequisites

- Modern web browser with ES6+ support
- Local web server (Python, Node.js, or similar)
- Backend server running on port 8000

### Quick Start

```bash
# Navigate to frontend directory
cd src/frontend/web_v0.2

# Start local web server (Python)
python -m http.server 8080

# Or start with the included script
./start_webserver-v0.2.sh
```

### Architecture Overview

```none
web_v0.2/
├── index.html          # Main HTML entry point
├── js/                 # JavaScript modules
│   ├── app.js          # Main application coordinator
│   ├── apiClient.js    # Backend API communication
│   └── [components]    # Individual UI components
├── styles/             # CSS styling
│   ├── main.css        # Core styles & layout
│   ├── components.css  # Component styles
│   └── responsive.css  # Mobile responsive styles
├── assets/             # Static assets
└── docs/               # Documentation (this folder)
```

## 📋 Contributing

When adding new features or components:

1. **Code** - Follow existing patterns and conventions
2. **Document** - Add appropriate documentation in this folder
3. **Test** - Ensure functionality works across devices
4. **Review** - Update this index file with new documentation links

## 📱 Browser Support

### Minimum Requirements

- Chrome 70+ / Firefox 65+ / Safari 12+ / Edge 79+
- CSS Grid and Flexbox support
- ES6 modules support
- WebSocket support for real-time features

### Mobile Support  

- iOS Safari 12+
- Chrome Mobile 70+
- Progressive Web App features
- Touch/gesture support
- Responsive breakpoints: 320px, 480px, 768px, 1024px, 1200px

## 🔗 Related Documentation

- [Backend API Documentation](../../../backend/README.md)
- [Project Overview](../../../README.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
