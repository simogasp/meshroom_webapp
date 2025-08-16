# Development Guide

This guide covers the development workflow, coding standards, and best practices for the Meshroom WebApp frontend v0.2.

## Getting Started

### Prerequisites

- Modern web browser (Chrome 70+, Firefox 65+, Safari 12+, Edge 79+)
- Python 3.x or Node.js for local web server
- Text editor with JavaScript/CSS support
- Backend server running on port 8000

### Local Development Setup

1. **Clone and navigate to the project:**

   ```bash
   git clone https://github.com/yourusername/meshroom_webapp.git
   cd meshroom_webapp/src/frontend/web_v0.2
   ```

2. **Start a local web server:**

   ```bash
   # Using Python
   python -m http.server 8080
   
   # Using Node.js
   npx http-server -p 8080
   
   # Using the included script
   ./start_webserver-v0.2.sh
   ```

3. **Access the application:**
   Open `http://localhost:8080` in your browser

### Project Structure

```none
web_v0.2/
├── index.html              # Entry point
├── js/                     # JavaScript modules
│   ├── app.js              # Main application coordinator
│   ├── apiClient.js        # API communication
│   ├── fileManager.js      # File handling
│   ├── logPanel.js         # Logging system
│   ├── modal.js            # Modal dialogs
│   ├── modelViewer.js      # 3D model display
│   ├── parameterPanel.js   # Parameter configuration
│   └── progressTracker.js  # Progress monitoring
├── styles/                 # CSS stylesheets
│   ├── main.css            # Core styles and layout
│   ├── components.css      # UI component styles
│   └── responsive.css      # Mobile/responsive styles
├── assets/                 # Static assets
│   ├── icons/              # App icons and favicons
│   └── logos/              # Brand assets
└── docs/                   # Documentation
```

## Architecture Overview

### Module System

The application uses ES6 modules with a component-based architecture:

```javascript
// Main app coordinates all components
import { FileManager } from './fileManager.js';
import { LogPanel } from './logPanel.js';
import { ProgressTracker } from './progressTracker.js';

class App {
  constructor() {
    this.components = {
      fileManager: new FileManager(),
      logPanel: new LogPanel(),
      progressTracker: new ProgressTracker()
    };
  }
}
```

### Component Pattern

Each component follows a consistent pattern:

```javascript
export class ComponentName {
  constructor(options = {}) {
    this.options = {
      // Default options
      defaultOption: 'value',
      ...options
    };
    
    this.state = {
      // Component state
    };
    
    this.init();
  }
  
  init() {
    this.setupElements();
    this.setupEventListeners();
  }
  
  setupElements() {
    // DOM element setup
  }
  
  setupEventListeners() {
    // Event handlers
  }
  
  // Public API methods
  
  dispose() {
    // Cleanup
  }
}
```

## Coding Standards

### JavaScript

**ES6+ Features:**

- Use `const` and `let` instead of `var`
- Arrow functions for short callbacks
- Template literals for string interpolation
- Destructuring assignment where appropriate

- Async/await for promises

**Example:**

```javascript
// Good
const getData = async (url) => {
  try {
    const response = await fetch(url);
    const { data, error } = await response.json();
    return error ? null : data;
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err);
    return null;
  }
};

// Avoid
function getData(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.onload = function() {
    if (xhr.status === 200) {
      callback(null, JSON.parse(xhr.responseText));
    } else {
      callback(new Error('Request failed'));
    }
  };
  xhr.send();

}
```

**Naming Conventions:**

- camelCase for variables and functions
- PascalCase for classes and constructors
- UPPER_SNAKE_CASE for constants

- Descriptive names over short names

### CSS

**Organization:**

- Use CSS custom properties (variables) for consistency
- BEM methodology for class naming
- Mobile-first responsive design
- Logical property grouping in declarations

**Example:**

```css
/* CSS Custom Properties */
:root {
  --primary-color: #2563eb;
  --spacing-md: 1rem;
  --radius-md: 0.5rem;
}

/* BEM Class Structure */
.component-name {
  /* Layout properties */
  display: flex;
  flex-direction: column;
  
  /* Spacing */
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  
  /* Visual properties */
  background: var(--primary-color);
  border-radius: var(--radius-md);
  
  /* Typography */
  font-size: 0.875rem;
  line-height: 1.5;
}

.component-name__element {
  /* Element-specific styles */
}


.component-name--modifier {
  /* Modifier styles */
}
```

**Responsive Design:**

```css
/* Mobile first */
.component {
  width: 100%;
  padding: 1rem;
}

/* Desktop enhancement */
@media (min-width: 768px) {
  .component {
    width: 50%;
    padding: 2rem;
  }
}
```

## Adding New Components

### 1. Create Component File

Create a new file in the `js/` directory:

```javascript
// js/myNewComponent.js
export class MyNewComponent {
  constructor(options = {}) {
    this.options = {
      containerId: 'myComponentContainer',
      enabled: true,
      ...options
    };
    
    this.state = {
      isVisible: false,
      data: null
    };
    
    this.init();
  }
  
  init() {
    this.setupElements();
    this.setupEventListeners();
  }
  
  setupElements() {
    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      throw new Error(`Container ${this.options.containerId} not found`);
    }
    
    this.render();
  }
  
  setupEventListeners() {
    // Add event listeners
  }
  
  render() {
    this.container.innerHTML = `
      <div class="my-new-component">
        <!-- Component HTML -->
      </div>
    `;
  }
  
  // Public API methods
  setVisible(visible) {
    this.state.isVisible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }
  
  dispose() {
    // Cleanup event listeners and resources
  }
}
```

### 2. Add Styles

Add component styles to `styles/components.css`:

```css
/* My New Component */
.my-new-component {
  /* Component styles */
  display: flex;
  flex-direction: column;
  background: var(--white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.my-new-component__header {
  /* Header styles */
}

.my-new-component__content {
  /* Content styles */
}
```

### 3. Integrate with App

Update `app.js` to include the new component:

```javascript
import { MyNewComponent } from './myNewComponent.js';

// In the App class constructor
this.components.myNewComponent = new MyNewComponent({
  containerId: 'myComponentContainer',
  onDataChanged: (data) => this.handleDataChanged(data)
});
```

### 4. Update HTML

Add the container to `index.html`:

```html
<div id="myComponentContainer" class="component-container">
  <!-- Component will be rendered here -->
</div>
```

### 5. Add Documentation

Create documentation in `docs/components/my-new-component.md` following the established pattern.

## Testing

### Manual Testing

1. **Cross-browser testing:**
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest)
   - Edge (latest)

2. **Device testing:**
   - Desktop (1920x1080, 1366x768)
   - Tablet (768x1024, 1024x768)
   - Mobile (375x667, 414x896)

3. **Feature testing:**
   - File upload/drag-and-drop
   - Progress tracking
   - 3D model loading
   - Mobile responsive behavior

### Automated Testing

For future implementation:

```javascript
// Example test structure
describe('MyNewComponent', () => {
  let component;
  
  beforeEach(() => {
    document.body.innerHTML = '<div id="testContainer"></div>';
    component = new MyNewComponent({
      containerId: 'testContainer'
    });
  });
  
  afterEach(() => {
    component.dispose();
    document.body.innerHTML = '';
  });
  
  test('should initialize correctly', () => {
    expect(component.state.isVisible).toBe(false);
  });
  
  test('should show/hide on setVisible', () => {
    component.setVisible(true);
    expect(component.state.isVisible).toBe(true);
  });

});
```

## Debugging

### Browser DevTools

**Console Debugging:**

```javascript
// Add debug logging
console.group('Component Debug');
console.log('State:', this.state);
console.log('Options:', this.options);

console.groupEnd();

// Performance timing
console.time('Component Init');
this.init();

console.timeEnd('Component Init');
```

**Network Debugging:**

- Monitor API calls in Network tab
- Check WebSocket connection status

- Verify file uploads are working

**Mobile Debugging:**

- Use Chrome DevTools Device Mode

- Enable touch simulation
- Test with various screen sizes

### Common Issues

**Component not initializing:**

- Check container element exists
- Verify script import order
- Check browser console for errors

**Styles not applying:**

- Verify CSS file is loaded

- Check CSS selector specificity
- Inspect element styles in DevTools

**Mobile layout issues:**

- Test responsive breakpoints

- Verify touch targets are adequate (44px minimum)
- Check viewport meta tag

## Performance

### Best Practices

**JavaScript:**

- Minimize DOM queries (cache references)
- Use event delegation for dynamic content
- Debounce/throttle frequent events
- Lazy load heavy components

**CSS:**

- Minimize reflows/repaints
- Use `transform` and `opacity` for animations
- Avoid inline styles

- Optimize font loading

**Assets:**

- Compress images
- Use appropriate image formats
- Implement lazy loading for images
- Minimize and combine CSS/JS files (for production)

## Deployment

### Development

- Use local web server
- Enable browser caching disabled for development
- Use unminified files for debugging

### Production

- Minify CSS and JavaScript
- Optimize images
- Enable gzip compression
- Set appropriate cache headers
- Test on actual devices

## Contributing

1. **Follow the coding standards**
2. **Add appropriate documentation**
3. **Test across browsers and devices**
4. **Update this guide if adding new patterns**
5. **Consider backward compatibility**

## Resources

- [MDN Web Docs](https://developer.mozilla.org/)
- [CSS-Tricks](https://css-tricks.com/)
- [Can I Use](https://caniuse.com/) - Browser support tables
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
