/**
 * Parameter Panel Module
 * Handles processing parameters UI and validation
 * @module ParameterPanel
 */

/**
 * Parameter Panel Class
 * Manages parameter inputs and validation
 */
export class ParameterPanel {
  constructor(options = {}) {
    this.options = {
      onParametersChanged: () => {},
      onProcessStart: () => {},
      onParameterError: () => {},
      ...options
    };

    this.parameters = {};
    this.isEnabled = false;
    
    // Parameter definitions with validation rules
    this.parameterDefinitions = {
      quality: {
        type: 'select',
        label: 'Quality',
        description: 'Processing quality level affects speed and output detail',
        options: [
          { value: 'draft', label: 'Draft (Fast)', description: 'Quick processing, lower quality' },
          { value: 'medium', label: 'Medium (Balanced)', description: 'Good balance of speed and quality' },
          { value: 'high', label: 'High (Detailed)', description: 'Slower processing, higher quality' },
          { value: 'ultra', label: 'Ultra (Maximum)', description: 'Longest processing, maximum quality' }
        ],
        default: 'medium',
        required: true
      },
      meshResolution: {
        type: 'slider',
        label: 'Mesh Resolution',
        description: 'Higher resolution creates more detailed geometry',
        min: 512,
        max: 4096,
        step: 256,
        default: 1024,
        unit: 'vertices',
        required: true
      },
      textureSize: {
        type: 'select',
        label: 'Texture Size',
        description: 'Texture resolution affects visual quality',
        options: [
          { value: 512, label: '512×512' },
          { value: 1024, label: '1024×1024' },
          { value: 2048, label: '2048×2048' },
          { value: 4096, label: '4096×4096' }
        ],
        default: 2048,
        required: true
      },
      smoothing: {
        type: 'checkbox',
        label: 'Surface Smoothing',
        description: 'Apply smoothing to reduce noise in the mesh',
        default: true
      },
      removeBackground: {
        type: 'checkbox',
        label: 'Remove Background',
        description: 'Automatically remove background from the input image',
        default: false
      },
      optimizeForWeb: {
        type: 'checkbox',
        label: 'Optimize for Web',
        description: 'Optimize model for web display (smaller file size)',
        default: true
      },
      advanced: {
        type: 'group',
        label: 'Advanced Settings',
        collapsed: true,
        parameters: {
          depthEstimation: {
            type: 'select',
            label: 'Depth Estimation',
            description: 'Algorithm for estimating depth information',
            options: [
              { value: 'auto', label: 'Automatic' },
              { value: 'midas', label: 'MiDaS' },
              { value: 'dpt', label: 'DPT' },
              { value: 'zoe', label: 'ZoeDepth' }
            ],
            default: 'auto'
          },
          meshAlgorithm: {
            type: 'select',
            label: 'Mesh Algorithm',
            description: 'Algorithm for generating 3D mesh',
            options: [
              { value: 'marching_cubes', label: 'Marching Cubes' },
              { value: 'poisson', label: 'Poisson Reconstruction' },
              { value: 'alpha_shape', label: 'Alpha Shape' }
            ],
            default: 'marching_cubes'
          },
          simplification: {
            type: 'slider',
            label: 'Simplification',
            description: 'Reduce mesh complexity (0 = no simplification)',
            min: 0,
            max: 90,
            step: 5,
            default: 0,
            unit: '%'
          }
        }
      }
    };

    this.init();
  }

  /**
   * Initialize parameter panel
   */
  init() {
    this.setupElements();
    this.renderParameters();
    this.setupEventListeners();
    this.setDefaultValues();
  }

  /**
   * Setup DOM elements
   */
  setupElements() {
    this.container = document.getElementById('parametersContainer');
    this.startButton = document.getElementById('startProcessing');
    this.resetButton = document.getElementById('resetParameters');

    if (!this.container) {
      throw new Error('Parameters container element not found');
    }
  }

  /**
   * Render parameter controls
   */
  renderParameters() {
    this.container.innerHTML = '';
    this.renderParameterGroup(this.parameterDefinitions, this.container);
  }

  /**
   * Render parameter group
   * @param {Object} definitions - Parameter definitions
   * @param {HTMLElement} container - Container element
   * @param {string} prefix - Parameter key prefix
   */
  renderParameterGroup(definitions, container, prefix = '') {
    for (const [key, def] of Object.entries(definitions)) {
      const paramKey = prefix ? `${prefix}.${key}` : key;
      
      if (def.type === 'group') {
        const groupElement = this.createParameterGroup(def, paramKey);
        container.appendChild(groupElement);
        
        // Render nested parameters
        const groupContent = groupElement.querySelector('.parameter-group-content');
        if (groupContent && def.parameters) {
          this.renderParameterGroup(def.parameters, groupContent, paramKey);
        }
      } else {
        const paramElement = this.createParameterControl(def, paramKey);
        container.appendChild(paramElement);
      }
    }
  }

  /**
   * Create parameter group
   * @param {Object} definition - Parameter definition
   * @param {string} key - Parameter key
   * @returns {HTMLElement} Group element
   */
  createParameterGroup(definition, key) {
    const group = document.createElement('div');
    group.className = 'parameter-group';
    group.dataset.paramKey = key;

    const isCollapsed = definition.collapsed || false;
    
    group.innerHTML = `
      <div class="parameter-group-header" role="button" tabindex="0">
        <h4 class="parameter-group-title">${definition.label}</h4>
        <span class="parameter-group-toggle ${isCollapsed ? 'collapsed' : 'expanded'}">
          ${isCollapsed ? '▶' : '▼'}
        </span>
      </div>
      <div class="parameter-group-content ${isCollapsed ? 'hidden' : ''}"></div>
    `;

    // Setup collapse/expand functionality
    const header = group.querySelector('.parameter-group-header');
    const content = group.querySelector('.parameter-group-content');
    const toggle = group.querySelector('.parameter-group-toggle');

    const toggleGroup = () => {
      const isCurrentlyCollapsed = content.classList.contains('hidden');
      
      if (isCurrentlyCollapsed) {
        content.classList.remove('hidden');
        toggle.classList.remove('collapsed');
        toggle.classList.add('expanded');
        toggle.textContent = '▼';
      } else {
        content.classList.add('hidden');
        toggle.classList.remove('expanded');
        toggle.classList.add('collapsed');
        toggle.textContent = '▶';
      }
    };

    header.addEventListener('click', toggleGroup);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleGroup();
      }
    });

    return group;
  }

  /**
   * Create parameter control
   * @param {Object} definition - Parameter definition
   * @param {string} key - Parameter key
   * @returns {HTMLElement} Control element
   */
  createParameterControl(definition, key) {
    const wrapper = document.createElement('div');
    wrapper.className = 'parameter-control';
    wrapper.dataset.paramKey = key;

    const label = document.createElement('label');
    label.className = 'parameter-label';
    label.setAttribute('for', `param-${key}`);

    let controlHTML = '';
    let labelHTML = `
      <span class="label-text">${definition.label}</span>
      ${definition.required ? '<span class="required-indicator">*</span>' : ''}
    `;

    switch (definition.type) {
      case 'select':
        controlHTML = this.createSelectControl(definition, key);
        break;
      case 'slider':
        controlHTML = this.createSliderControl(definition, key);
        break;
      case 'checkbox':
        controlHTML = this.createCheckboxControl(definition, key);
        labelHTML = `
          <input type="checkbox" 
                 id="param-${key}" 
                 class="checkbox" 
                 ${definition.default ? 'checked' : ''}>
          <span class="checkmark"></span>
          <span class="label-text">${definition.label}</span>
        `;
        break;
      case 'number':
        controlHTML = this.createNumberControl(definition, key);
        break;
      case 'text':
        controlHTML = this.createTextControl(definition, key);
        break;
      default:
        controlHTML = '<div>Unsupported parameter type</div>';
    }

    label.innerHTML = labelHTML;
    
    if (definition.type !== 'checkbox') {
      wrapper.appendChild(label);
      wrapper.innerHTML += controlHTML;
    } else {
      wrapper.appendChild(label);
    }

    if (definition.description) {
      const description = document.createElement('div');
      description.className = 'parameter-description';
      description.textContent = definition.description;
      wrapper.appendChild(description);
    }

    return wrapper;
  }

  /**
   * Create select control
   * @param {Object} definition - Parameter definition
   * @param {string} key - Parameter key
   * @returns {string} Control HTML
   */
  createSelectControl(definition, key) {
    const options = definition.options.map(opt => 
      `<option value="${opt.value}" ${opt.value === definition.default ? 'selected' : ''}>
        ${opt.label}
      </option>`
    ).join('');

    return `
      <select id="param-${key}" class="dropdown" data-param="${key}">
        ${options}
      </select>
    `;
  }

  /**
   * Create slider control
   * @param {Object} definition - Parameter definition
   * @param {string} key - Parameter key
   * @returns {string} Control HTML
   */
  createSliderControl(definition, key) {
    return `
      <div class="slider-container">
        <input type="range" 
               id="param-${key}" 
               class="slider" 
               data-param="${key}"
               min="${definition.min}" 
               max="${definition.max}" 
               step="${definition.step || 1}" 
               value="${definition.default}">
        <div class="slider-labels">
          <span>${definition.min}${definition.unit ? ` ${definition.unit}` : ''}</span>
          <span id="param-${key}-value" class="slider-value">
            ${definition.default}${definition.unit ? ` ${definition.unit}` : ''}
          </span>
          <span>${definition.max}${definition.unit ? ` ${definition.unit}` : ''}</span>
        </div>
      </div>
    `;
  }

  /**
   * Create checkbox control (handled in main function)
   * @param {Object} definition - Parameter definition
   * @param {string} key - Parameter key
   * @returns {string} Empty (handled by main function)
   */
  createCheckboxControl(definition, key) {
    return '';
  }

  /**
   * Create number control
   * @param {Object} definition - Parameter definition
   * @param {string} key - Parameter key
   * @returns {string} Control HTML
   */
  createNumberControl(definition, key) {
    return `
      <input type="number" 
             id="param-${key}" 
             class="input-field" 
             data-param="${key}"
             min="${definition.min || ''}" 
             max="${definition.max || ''}" 
             step="${definition.step || 1}" 
             value="${definition.default || ''}">
    `;
  }

  /**
   * Create text control
   * @param {Object} definition - Parameter definition
   * @param {string} key - Parameter key
   * @returns {string} Control HTML
   */
  createTextControl(definition, key) {
    return `
      <input type="text" 
             id="param-${key}" 
             class="input-field" 
             data-param="${key}"
             value="${definition.default || ''}" 
             placeholder="${definition.placeholder || ''}">
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Parameter change listeners
    this.container.addEventListener('change', (e) => {
      if (e.target.dataset.param) {
        this.handleParameterChange(e.target);
      }
    });

    this.container.addEventListener('input', (e) => {
      if (e.target.dataset.param && e.target.type === 'range') {
        this.handleSliderInput(e.target);
      }
    });

    // Start processing button
    if (this.startButton) {
      this.startButton.addEventListener('click', () => {
        if (this.validateParameters()) {
          this.options.onProcessStart();
        }
      });
    }

    // Reset parameters button
    if (this.resetButton) {
      this.resetButton.addEventListener('click', () => {
        this.resetToDefaults();
      });
    }
  }

  /**
   * Handle parameter change
   * @param {HTMLElement} element - Changed element
   */
  handleParameterChange(element) {
    const key = element.dataset.param;
    let value;

    switch (element.type) {
      case 'checkbox':
        value = element.checked;
        break;
      case 'range':
      case 'number':
        value = parseFloat(element.value);
        break;
      default:
        value = element.value;
    }

    this.setParameterValue(key, value);
    this.options.onParametersChanged(this.parameters);
  }

  /**
   * Handle slider input
   * @param {HTMLElement} slider - Slider element
   */
  handleSliderInput(slider) {
    const key = slider.dataset.param;
    const value = parseFloat(slider.value);
    const valueDisplay = document.getElementById(`param-${key}-value`);
    
    if (valueDisplay) {
      const definition = this.getParameterDefinition(key);
      const unit = definition?.unit ? ` ${definition.unit}` : '';
      valueDisplay.textContent = `${value}${unit}`;
    }

    this.setParameterValue(key, value);
  }

  /**
   * Set parameter value
   * @param {string} key - Parameter key
   * @param {*} value - Parameter value
   */
  setParameterValue(key, value) {
    // Handle nested keys (e.g., "advanced.depthEstimation")
    const keys = key.split('.');
    let target = this.parameters;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in target)) {
        target[keys[i]] = {};
      }
      target = target[keys[i]];
    }

    target[keys[keys.length - 1]] = value;
  }

  /**
   * Get parameter definition
   * @param {string} key - Parameter key
   * @returns {Object|null} Parameter definition
   */
  getParameterDefinition(key) {
    const keys = key.split('.');
    let definition = this.parameterDefinitions;

    for (const k of keys) {
      if (definition[k]) {
        definition = definition[k];
        if (definition.parameters && keys.indexOf(k) < keys.length - 1) {
          definition = definition.parameters;
        }
      } else {
        return null;
      }
    }

    return definition;
  }

  /**
   * Set default values
   */
  setDefaultValues() {
    this.parameters = {};
    this.setDefaultsFromDefinitions(this.parameterDefinitions);
    this.options.onParametersChanged(this.parameters);
  }

  /**
   * Set defaults from parameter definitions
   * @param {Object} definitions - Parameter definitions
   * @param {string} prefix - Key prefix
   */
  setDefaultsFromDefinitions(definitions, prefix = '') {
    for (const [key, def] of Object.entries(definitions)) {
      const paramKey = prefix ? `${prefix}.${key}` : key;
      
      if (def.type === 'group' && def.parameters) {
        this.setDefaultsFromDefinitions(def.parameters, paramKey);
      } else if (def.default !== undefined) {
        this.setParameterValue(paramKey, def.default);
      }
    }
  }

  /**
   * Validate all parameters
   * @returns {boolean} Whether parameters are valid
   */
  validateParameters() {
    const errors = [];
    this.validateParametersRecursive(this.parameterDefinitions, errors);

    if (errors.length > 0) {
      this.options.onParameterError(errors);
      return false;
    }

    return true;
  }

  /**
   * Recursive parameter validation
   * @param {Object} definitions - Parameter definitions
   * @param {Array} errors - Error collection
   * @param {string} prefix - Key prefix
   */
  validateParametersRecursive(definitions, errors, prefix = '') {
    for (const [key, def] of Object.entries(definitions)) {
      const paramKey = prefix ? `${prefix}.${key}` : key;
      
      if (def.type === 'group' && def.parameters) {
        this.validateParametersRecursive(def.parameters, errors, paramKey);
      } else if (def.required) {
        const value = this.getParameterValue(paramKey);
        if (value === undefined || value === null || value === '') {
          errors.push(`${def.label} is required`);
        }
      }
    }
  }

  /**
   * Get parameter value
   * @param {string} key - Parameter key
   * @returns {*} Parameter value
   */
  getParameterValue(key) {
    const keys = key.split('.');
    let value = this.parameters;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Reset to default values
   */
  resetToDefaults() {
    this.setDefaultValues();
    this.updateUI();
  }

  /**
   * Update UI with current parameter values
   */
  updateUI() {
    this.updateUIRecursive(this.parameterDefinitions);
  }

  /**
   * Recursive UI update
   * @param {Object} definitions - Parameter definitions
   * @param {string} prefix - Key prefix
   */
  updateUIRecursive(definitions, prefix = '') {
    for (const [key, def] of Object.entries(definitions)) {
      const paramKey = prefix ? `${prefix}.${key}` : key;
      
      if (def.type === 'group' && def.parameters) {
        this.updateUIRecursive(def.parameters, paramKey);
      } else {
        const element = document.getElementById(`param-${paramKey}`);
        if (element) {
          const value = this.getParameterValue(paramKey);
          
          switch (def.type) {
            case 'checkbox':
              element.checked = !!value;
              break;
            case 'range':
              element.value = value;
              this.handleSliderInput(element);
              break;
            default:
              element.value = value;
          }
        }
      }
    }
  }

  /**
   * Set parameters from external source
   * @param {Object} params - Parameters to set
   */
  setParameters(params) {
    this.parameters = { ...params };
    this.updateUI();
    this.options.onParametersChanged(this.parameters);
  }

  /**
   * Get current parameters
   * @returns {Object} Current parameters
   */
  getParameters() {
    return { ...this.parameters };
  }

  /**
   * Enable/disable parameter panel
   * @param {boolean} enabled - Whether to enable
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    
    // Enable/disable all inputs
    const inputs = this.container.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.disabled = !enabled;
    });

    // Enable/disable start button
    if (this.startButton) {
      this.startButton.disabled = !enabled;
    }

    // Update visual state
    this.container.classList.toggle('disabled', !enabled);
  }

  /**
   * Check if panel is enabled
   * @returns {boolean} Whether panel is enabled
   */
  isEnabled() {
    return this.isEnabled;
  }

  /**
   * Load parameter definitions from server configuration
   * @param {Object} config - Server parameters config {version, parameters: []}
   */
  loadFromServer(config) {
    if (!config || !Array.isArray(config.parameters)) {
      return;
    }

    const toTitle = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    const newDefs = {};
    const advancedGroup = {
      type: 'group',
      label: 'Advanced Settings',
      collapsed: true,
      parameters: {}
    };

    config.parameters.forEach((p) => {
      const uiDef = this._mapSchemaParamToUi(p);
      if (p.advanced) {
        advancedGroup.parameters[p.name] = uiDef;
      } else {
        newDefs[p.name] = uiDef;
      }
    });

    // Only include advanced group if it has params
    if (Object.keys(advancedGroup.parameters).length > 0) {
      newDefs.advanced = advancedGroup;
    }

    this.parameterDefinitions = newDefs;

    // Re-render with new definitions and set defaults
    this.renderParameters();
    this.setDefaultValues();
  }

  /**
   * Map schema parameter to UI control definition
   * @param {Object} p - Schema parameter
   * @returns {Object} UI parameter definition
   * @private
   */
  _mapSchemaParamToUi(p) {
    const base = {
      label: p.label || toStringSafe(p.name),
      description: p.description || '',
      required: !!p.required,
      default: p.default
    };

    switch (p.type) {
      case 'boolean':
        return { ...base, type: 'checkbox' };
      case 'integer':
      case 'float': {
        // Use slider if min/max are provided, else numeric input
        if (typeof p.min !== 'undefined' && typeof p.max !== 'undefined') {
          return {
            ...base,
            type: 'slider',
            min: p.min,
            max: p.max,
            step: typeof p.step !== 'undefined' ? p.step : (p.type === 'integer' ? 1 : 0.1)
          };
        }
        return {
          ...base,
          type: 'number',
          step: typeof p.step !== 'undefined' ? p.step : (p.type === 'integer' ? 1 : 0.1)
        };
      }
      case 'string':
        return { ...base, type: 'text', placeholder: p.placeholder || '' };
      case 'enum': {
        const options = (p.values || []).map((v) => ({ value: v, label: String(v) }));
        return { ...base, type: 'select', options };
      }
      default:
        return { ...base, type: 'text' };
    }

    function toStringSafe(v) {
      try { return String(v); } catch { return ''; }
    }
  }
}
