/**
 * Sticky Call Button Component
 * A reusable component for showing a floating call button
 */
class StickyCallButton {
    constructor(options = {}) {
        this.options = {
            text: options.text || 'Helista',
            position: options.position || { right: '24px', bottom: '24px' },
            onClick: options.onClick || this.defaultOnClick,
            container: options.container || document.body,
            id: options.id || 'stickyCallBtn',
            ...options
        };
        
        this.element = null;
        this.isHidden = false;
        
        this.init();
    }
    
    init() {
        this.createElement();
        this.attachEventListeners();
        this.render();
    }
    
    createElement() {
        this.element = document.createElement('button');
        this.element.className = 'sticky-call-button';
        this.element.id = this.options.id;
        this.element.title = this.options.text;
        
        // Set custom position if provided
        if (this.options.position.right) {
            this.element.style.right = this.options.position.right;
        }
        if (this.options.position.bottom) {
            this.element.style.bottom = this.options.position.bottom;
        }
        
        this.element.innerHTML = `
            <svg class="call-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            ${this.options.text}
        `;
    }
    
    attachEventListeners() {
        if (this.element) {
            this.element.addEventListener('click', (e) => {
                e.preventDefault();
                this.options.onClick(e, this);
            });
            
            // Add keyboard support
            this.element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.options.onClick(e, this);
                }
            });
        }
    }
    
    render() {
        if (this.element && this.options.container) {
            this.options.container.appendChild(this.element);
        }
    }
    
    show() {
        if (this.element) {
            this.element.classList.remove('hidden');
            this.isHidden = false;
        }
    }
    
    hide() {
        if (this.element) {
            this.element.classList.add('hidden');
            this.isHidden = true;
        }
    }
    
    toggle() {
        if (this.isHidden) {
            this.show();
        } else {
            this.hide();
        }
    }
    
    setText(newText) {
        if (this.element) {
            this.options.text = newText;
            this.element.title = newText;
            // Update only the text, keep the SVG
            const textNode = this.element.childNodes[1];
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                textNode.textContent = newText;
            } else {
                // Fallback: rebuild innerHTML
                this.element.innerHTML = `
                    <svg class="call-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    ${newText}
                `;
            }
        }
    }
    
    setIcon(svgContent) {
        if (this.element) {
            const iconElement = this.element.querySelector('.call-icon');
            if (iconElement) {
                iconElement.innerHTML = svgContent;
            }
        }
    }
    
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        if (newOptions.onClick) {
            // Re-attach event listeners with new onClick
            this.element.removeEventListener('click', this.clickHandler);
            this.attachEventListeners();
        }
        
        if (newOptions.text) {
            this.setText(newOptions.text);
        }
        
        if (newOptions.position) {
            if (newOptions.position.right) {
                this.element.style.right = newOptions.position.right;
            }
            if (newOptions.position.bottom) {
                this.element.style.bottom = newOptions.position.bottom;
            }
        }
    }
    
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
    
    // Default click handler
    defaultOnClick(event, instance) {
        console.log('Sticky call button clicked!');
        // Default behavior - can be overridden by passing onClick option
    }
    
    // Static method to create and return instance
    static create(options) {
        return new StickyCallButton(options);
    }
}

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StickyCallButton;
} else {
    window.StickyCallButton = StickyCallButton;
} 