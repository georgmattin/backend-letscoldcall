/**
 * Dialer Panel Component
 * A reusable component for number input and calling
 */
class DialerPanel {
    constructor(options = {}) {
        this.options = {
            container: options.container || document.body,
            id: options.id || 'dialerPanel',
            placeholder: options.placeholder || 'Sisesta number',
            onCall: options.onCall || this.defaultOnCall,
            onNumberChange: options.onNumberChange || null,
            maxLength: options.maxLength || 20,
            allowSpecialKeys: options.allowSpecialKeys !== false, // *, #, +
            showStatusMessage: options.showStatusMessage !== false,
            ...options
        };
        
        this.element = null;
        this.currentNumber = '';
        this.dtmfGenerator = null;
        
        this.init();
    }
    
    init() {
        this.createElement();
        this.attachEventListeners();
        this.render();
        this.initDTMFGenerator();
    }
    
    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'dialer-panel';
        this.element.id = this.options.id;
        
        this.element.innerHTML = `
            <div class="dialer-status-message" id="${this.options.id}_statusMessage"></div>
            
            <!-- Number Display -->
            <div class="dialer-number-display">
                <div class="dialer-number-display-content">
                    <div class="dialer-number-text" id="${this.options.id}_numberText">
                        <span id="${this.options.id}_phoneDisplay" class="placeholder">${this.options.placeholder}</span>
                    </div>
                </div>
                <button class="dialer-clear-number-btn" id="${this.options.id}_clearBtn" title="Kustuta kõik">
                    <svg class="dialer-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <!-- Dialpad -->
            <div class="dialer-dialpad">
                <div class="dialer-dialpad-key" data-digit="1">
                    <span class="dialer-key-number">1</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="2">
                    <span class="dialer-key-number">2</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="3">
                    <span class="dialer-key-number">3</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="4">
                    <span class="dialer-key-number">4</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="5">
                    <span class="dialer-key-number">5</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="6">
                    <span class="dialer-key-number">6</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="7">
                    <span class="dialer-key-number">7</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="8">
                    <span class="dialer-key-number">8</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="9">
                    <span class="dialer-key-number">9</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="*">
                    <span class="dialer-key-number">*</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="0">
                    <span class="dialer-key-number">0</span>
                </div>
                <div class="dialer-dialpad-key" data-digit="#">
                    <span class="dialer-key-number">#</span>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="dialer-action-buttons">
                <button class="dialer-call-btn" id="${this.options.id}_callBtn" disabled title="Helista">
                    <svg class="dialer-icon-lg" viewBox="0 0 24 24">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                </button>
            </div>
        `;
    }
    
    attachEventListeners() {
        if (!this.element) return;
        
        // Dialpad key clicks
        const dialpadKeys = this.element.querySelectorAll('.dialer-dialpad-key');
        dialpadKeys.forEach(key => {
            key.addEventListener('click', (e) => {
                const digit = e.currentTarget.getAttribute('data-digit');
                if (digit) {
                    this.addDigit(digit);
                }
            });
        });
        
        // Clear button
        const clearBtn = this.element.querySelector(`#${this.options.id}_clearBtn`);
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearNumber();
            });
        }
        
        // Call button
        const callBtn = this.element.querySelector(`#${this.options.id}_callBtn`);
        if (callBtn) {
            callBtn.addEventListener('click', () => {
                this.makeCall();
            });
        }
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible()) return;
            
            const key = e.key;
            
            if (key >= '0' && key <= '9') {
                e.preventDefault();
                this.addDigit(key);
            } else if (key === '*' || key === '#') {
                e.preventDefault();
                this.addDigit(key);
            } else if (key === 'Backspace') {
                e.preventDefault();
                this.clearNumber();
            } else if (key === 'Enter') {
                e.preventDefault();
                this.makeCall();
            }
        });
    }
    
    render() {
        if (this.element && this.options.container) {
            this.options.container.appendChild(this.element);
        }
    }
    
    initDTMFGenerator() {
        this.dtmfGenerator = new DTMFToneGenerator();
    }
    
    addDigit(digit) {
        if (this.currentNumber.length >= this.options.maxLength) {
            this.showStatusMessage('Maksimaalne numbri pikkus saavutatud!', 'warning');
            return;
        }
        
        // Play DTMF tone
        if (this.dtmfGenerator) {
            this.dtmfGenerator.playTone(digit);
        }
        
        // Handle special cases
        if (digit === '0' && this.currentNumber === '') {
            this.currentNumber = '+';
        } else if (digit === '*' && this.currentNumber === '') {
            this.currentNumber = '+372';
        } else {
            this.currentNumber += digit;
        }
        
        this.updateDisplay();
        this.updateActionButtons();
        
        // Trigger callback if provided
        if (this.options.onNumberChange) {
            this.options.onNumberChange(this.currentNumber, this);
        }
    }
    
    clearNumber() {
        this.currentNumber = '';
        this.updateDisplay();
        this.updateActionButtons();
        
        // Trigger callback if provided
        if (this.options.onNumberChange) {
            this.options.onNumberChange(this.currentNumber, this);
        }
    }
    
    setNumber(number) {
        this.currentNumber = number || '';
        this.updateDisplay();
        this.updateActionButtons();
        
        // Trigger callback if provided
        if (this.options.onNumberChange) {
            this.options.onNumberChange(this.currentNumber, this);
        }
    }
    
    getNumber() {
        return this.currentNumber;
    }
    
    updateDisplay() {
        const display = this.element.querySelector(`#${this.options.id}_phoneDisplay`);
        const clearBtn = this.element.querySelector(`#${this.options.id}_clearBtn`);
        
        if (!display || !clearBtn) return;
        
        if (this.currentNumber.length === 0) {
            display.textContent = this.options.placeholder;
            display.className = 'placeholder';
            clearBtn.classList.remove('visible');
        } else {
            display.textContent = this.formatPhoneNumber(this.currentNumber);
            display.className = '';
            clearBtn.classList.add('visible');
        }
    }
    
    updateActionButtons() {
        const callBtn = this.element.querySelector(`#${this.options.id}_callBtn`);
        if (!callBtn) return;
        
        const hasNumber = this.currentNumber.trim().length > 0;
        callBtn.disabled = !hasNumber;
    }
    
    formatPhoneNumber(num) {
        // Simple Estonian phone number formatting
        if (num.startsWith('+372')) {
            const cleaned = num.replace(/\D/g, '');
            if (cleaned.length >= 7) {
                return `+372 ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
            }
        }
        return num;
    }
    
    makeCall() {
        if (this.currentNumber.length < 3) {
            this.showStatusMessage('Palun sisesta kehtiv telefoninumber!', 'error');
            return;
        }

        if (!this.currentNumber.startsWith('+')) {
            this.showStatusMessage('⚠️ Number peab algama + märgiga (nt +37256272798)', 'error');
            return;
        }
        
        // Trigger callback
        this.options.onCall(this.currentNumber, this);
    }
    
    showStatusMessage(message, type = 'info') {
        if (!this.options.showStatusMessage) return;
        
        const statusEl = this.element.querySelector(`#${this.options.id}_statusMessage`);
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.className = `dialer-status-message ${type}`;
        statusEl.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
    
    hideStatusMessage() {
        const statusEl = this.element.querySelector(`#${this.options.id}_statusMessage`);
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }
    
    enable() {
        const callBtn = this.element.querySelector(`#${this.options.id}_callBtn`);
        if (callBtn) {
            callBtn.disabled = this.currentNumber.trim().length === 0;
        }
        
        const dialpadKeys = this.element.querySelectorAll('.dialer-dialpad-key');
        dialpadKeys.forEach(key => {
            key.style.pointerEvents = 'auto';
            key.style.opacity = '1';
        });
    }
    
    disable() {
        const callBtn = this.element.querySelector(`#${this.options.id}_callBtn`);
        if (callBtn) {
            callBtn.disabled = true;
        }
        
        const dialpadKeys = this.element.querySelectorAll('.dialer-dialpad-key');
        dialpadKeys.forEach(key => {
            key.style.pointerEvents = 'none';
            key.style.opacity = '0.5';
        });
    }
    
    show() {
        if (this.element) {
            this.element.style.display = 'flex';
        }
    }
    
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
    
    isVisible() {
        if (!this.element) return false;
        return this.element.style.display !== 'none' && 
               this.element.offsetParent !== null;
    }
    
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        if (newOptions.placeholder) {
            this.updateDisplay();
        }
    }
    
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.dtmfGenerator = null;
    }
    
    // Default call handler
    defaultOnCall(phoneNumber, instance) {
        console.log('Dialer panel call initiated:', phoneNumber);
        instance.showStatusMessage('Helistamine funktsioon pole määratud!', 'warning');
    }
    
    // Static method to create and return instance
    static create(options) {
        return new DialerPanel(options);
    }
}

// DTMF Tone Generator (embedded for dialer component)
class DTMFToneGenerator {
    constructor() {
        this.audioContext = null;
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    // DTMF frequency mapping
    getDTMFFrequencies(key) {
        const frequencies = {
            '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
            '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
            '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
            '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
        };
        return frequencies[key] || [400, 400];
    }

    playTone(key, duration = 150) {
        if (!this.audioContext) return;

        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const [freq1, freq2] = this.getDTMFFrequencies(key);
            const currentTime = this.audioContext.currentTime;

            // Create oscillators for both frequencies
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            // Set frequencies
            osc1.frequency.setValueAtTime(freq1, currentTime);
            osc2.frequency.setValueAtTime(freq2, currentTime);

            // Connect oscillators to gain node
            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Set volume (lower for pleasant sound)
            gainNode.gain.setValueAtTime(0.1, currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration / 1000);

            // Start and stop oscillators
            osc1.start(currentTime);
            osc2.start(currentTime);
            osc1.stop(currentTime + duration / 1000);
            osc2.stop(currentTime + duration / 1000);

        } catch (error) {
            console.warn('Failed to play DTMF tone:', error);
        }
    }
}

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DialerPanel;
} else {
    window.DialerPanel = DialerPanel;
} 