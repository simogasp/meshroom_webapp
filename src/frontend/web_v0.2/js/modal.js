/**
 * Modal Module
 * Handles modal dialogs and overlays
 * @module Modal
 */

/**
 * Modal Class
 * Manages modal dialog creation, display, and interaction
 */
export class Modal {
  constructor(options = {}) {
    this.options = {
      closeOnBackdrop: true,
      closeOnEscape: true,
      showCloseButton: true,
      className: '',
      zIndex: 1000,
      ...options
    };

    this.activeModals = [];
    this.modalCounter = 0;

    this.init();
  }

  /**
   * Initialize modal system
   */
  init() {
    this.setupEventListeners();
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Global escape key handler
    if (this.options.closeOnEscape) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.activeModals.length > 0) {
          this.closeModal();
        }
      });
    }
  }

  /**
   * Show modal dialog
   * @param {Object} config - Modal configuration
   * @returns {Promise} Modal promise that resolves when modal is closed
   */
  showModal(config = {}) {
    return new Promise((resolve, reject) => {
      const modalConfig = {
        title: '',
        content: '',
        actions: [],
        className: '',
        size: 'medium',
        showCloseButton: this.options.showCloseButton,
        closeOnBackdrop: this.options.closeOnBackdrop,
        onOpen: () => {},
        onClose: () => {},
        ...config
      };

      const modalId = `modal_${++this.modalCounter}`;
      const modal = this.createModalElement(modalId, modalConfig);
      
      // Add to DOM
      document.body.appendChild(modal);
      
      // Add to active modals
      this.activeModals.push({
        id: modalId,
        element: modal,
        config: modalConfig,
        resolve,
        reject
      });

      // Setup modal-specific event listeners
      this.setupModalEventListeners(modal, modalConfig, resolve, reject);

      // Show modal with animation
      requestAnimationFrame(() => {
        modal.classList.add('show');
        modalConfig.onOpen();
      });

      // Focus management
      this.trapFocus(modal);
    });
  }

  /**
   * Create modal DOM element
   * @param {string} modalId - Modal ID
   * @param {Object} config - Modal configuration
   * @returns {HTMLElement} Modal element
   */
  createModalElement(modalId, config) {
    const modal = document.createElement('div');
    modal.className = `modal ${config.className}`;
    modal.id = modalId;
    modal.style.zIndex = this.options.zIndex + this.activeModals.length;
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('role', 'dialog');
    
    if (config.title) {
      modal.setAttribute('aria-labelledby', `${modalId}_title`);
    }

    const sizeClass = `modal-${config.size}`;
    
    modal.innerHTML = `
      <div class="modal-content ${sizeClass}">
        ${config.title || config.showCloseButton ? `
          <div class="modal-header">
            ${config.title ? `<h3 id="${modalId}_title" class="modal-title">${config.title}</h3>` : ''}
            ${config.showCloseButton ? `
              <button type="button" class="close-btn" aria-label="Close modal">
                <span aria-hidden="true">&times;</span>
              </button>
            ` : ''}
          </div>
        ` : ''}
        <div class="modal-body">
          ${config.content}
        </div>
        ${config.actions && config.actions.length > 0 ? `
          <div class="modal-actions">
            ${this.createModalActions(config.actions)}
          </div>
        ` : ''}
      </div>
    `;

    return modal;
  }

  /**
   * Create modal action buttons
   * @param {Array} actions - Action configurations
   * @returns {string} Actions HTML
   */
  createModalActions(actions) {
    return actions.map((action, index) => {
      const variant = action.variant || 'secondary';
      const disabled = action.disabled ? 'disabled' : '';
      
      return `
        <button type="button" 
                class="btn btn-${variant}" 
                data-action-index="${index}"
                ${disabled}
                ${action.autoFocus ? 'autofocus' : ''}>
          ${action.text || 'OK'}
        </button>
      `;
    }).join('');
  }

  /**
   * Setup modal-specific event listeners
   * @param {HTMLElement} modal - Modal element
   * @param {Object} config - Modal configuration
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   */
  setupModalEventListeners(modal, config, resolve, reject) {
    const modalContent = modal.querySelector('.modal-content');

    // Backdrop click handler
    if (config.closeOnBackdrop) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(null, 'backdrop');
        }
      });
    }

    // Prevent modal content clicks from closing modal
    if (modalContent) {
      modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Close button handler
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.closeModal(null, 'close');
      });
    }

    // Action button handlers
    const actionBtns = modal.querySelectorAll('[data-action-index]');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const actionIndex = parseInt(e.target.dataset.actionIndex);
        const action = config.actions[actionIndex];
        
        if (action) {
          // Call action callback if provided
          if (action.action) {
            const result = action.action();
            
            // If action returns false, don't close modal
            if (result === false) {
              return;
            }
          }

          // Close modal with action result
          this.closeModal({
            action: action,
            actionIndex: actionIndex
          });
        }
      });
    });
  }

  /**
   * Close modal
   * @param {*} result - Modal result
   * @param {string} reason - Close reason
   */
  closeModal(result = null, reason = 'action') {
    if (this.activeModals.length === 0) {
      return;
    }

    const modalData = this.activeModals[this.activeModals.length - 1];
    const modal = modalData.element;

    // Call onClose callback
    modalData.config.onClose(result, reason);

    // Hide with animation
    modal.classList.remove('show');
    modal.classList.add('hiding');

    // Remove from DOM after animation
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }

      // Remove from active modals
      this.activeModals = this.activeModals.filter(m => m.id !== modalData.id);

      // Resolve promise
      modalData.resolve(result);

      // Restore focus to previous modal or document
      this.restoreFocus();

    }, 150); // Match CSS transition duration
  }

  /**
   * Close all modals
   */
  closeAllModals() {
    while (this.activeModals.length > 0) {
      this.closeModal(null, 'closeAll');
    }
  }

  /**
   * Show confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} User confirmation
   */
  showConfirmation(message, options = {}) {
    return this.showModal({
      title: options.title || 'Confirmation',
      content: `<p>${message}</p>`,
      actions: [
        {
          text: options.cancelText || 'Cancel',
          variant: 'secondary',
          action: () => false
        },
        {
          text: options.confirmText || 'OK',
          variant: options.dangerous ? 'danger' : 'primary',
          action: () => true,
          autoFocus: true
        }
      ],
      ...options
    });
  }

  /**
   * Show alert dialog
   * @param {string} message - Alert message
   * @param {Object} options - Additional options
   * @returns {Promise} Alert promise
   */
  showAlert(message, options = {}) {
    return this.showModal({
      title: options.title || 'Alert',
      content: `<p>${message}</p>`,
      actions: [
        {
          text: options.buttonText || 'OK',
          variant: 'primary',
          action: () => true,
          autoFocus: true
        }
      ],
      ...options
    });
  }

  /**
   * Show input dialog
   * @param {string} message - Input prompt message
   * @param {Object} options - Additional options
   * @returns {Promise<string|null>} User input or null if cancelled
   */
  showInput(message, options = {}) {
    const inputId = `input_${Date.now()}`;
    const inputType = options.type || 'text';
    const placeholder = options.placeholder || '';
    const defaultValue = options.defaultValue || '';

    return this.showModal({
      title: options.title || 'Input',
      content: `
        <p>${message}</p>
        <input type="${inputType}" 
               id="${inputId}" 
               class="input-field" 
               placeholder="${placeholder}" 
               value="${defaultValue}"
               style="width: 100%; margin-top: 1rem;">
      `,
      actions: [
        {
          text: options.cancelText || 'Cancel',
          variant: 'secondary',
          action: () => null
        },
        {
          text: options.confirmText || 'OK',
          variant: 'primary',
          action: () => {
            const input = document.getElementById(inputId);
            return input ? input.value : '';
          },
          autoFocus: false
        }
      ],
      onOpen: () => {
        // Focus the input after modal is shown
        setTimeout(() => {
          const input = document.getElementById(inputId);
          if (input) {
            input.focus();
            input.select();
          }
        }, 100);
      },
      ...options
    });
  }

  /**
   * Show loading modal
   * @param {string} message - Loading message
   * @param {Object} options - Additional options
   * @returns {Object} Loading modal controller
   */
  showLoading(message = 'Loading...', options = {}) {
    const modalPromise = this.showModal({
      content: `
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p class="loading-text">${message}</p>
        </div>
      `,
      showCloseButton: false,
      closeOnBackdrop: false,
      closeOnEscape: false,
      className: 'modal-loading',
      ...options
    });

    return {
      close: (result) => this.closeModal(result),
      updateMessage: (newMessage) => {
        const activeModal = this.activeModals[this.activeModals.length - 1];
        if (activeModal) {
          const textElement = activeModal.element.querySelector('.loading-text');
          if (textElement) {
            textElement.textContent = newMessage;
          }
        }
      }
    };
  }

  /**
   * Trap focus within modal
   * @param {HTMLElement} modal - Modal element
   */
  trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    if (firstElement && !modal.querySelector('[autofocus]')) {
      setTimeout(() => firstElement.focus(), 100);
    }

    // Handle tab navigation
    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
  }

  /**
   * Restore focus to previous element
   */
  restoreFocus() {
    // If there are still active modals, focus the top one
    if (this.activeModals.length > 0) {
      const topModal = this.activeModals[this.activeModals.length - 1];
      this.trapFocus(topModal.element);
    } else {
      // Focus the previously focused element (this would need to be tracked)
      document.body.focus();
    }
  }

  /**
   * Get active modal count
   * @returns {number} Number of active modals
   */
  getActiveModalCount() {
    return this.activeModals.length;
  }

  /**
   * Check if any modal is open
   * @returns {boolean} Whether any modal is open
   */
  hasActiveModal() {
    return this.activeModals.length > 0;
  }

  /**
   * Get top modal
   * @returns {Object|null} Top modal data
   */
  getTopModal() {
    return this.activeModals.length > 0 
      ? this.activeModals[this.activeModals.length - 1] 
      : null;
  }

  /**
   * Dispose of modal system
   */
  dispose() {
    this.closeAllModals();
    this.activeModals = [];
  }
}
