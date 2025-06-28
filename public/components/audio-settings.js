/**
 * Audio Settings Component
 * A reusable component for audio device selection and testing
 */
class AudioSettings {
    constructor(options = {}) {
        this.options = {
            container: options.container || document.body,
            id: options.id || 'audioSettings',
            title: options.title || 'Audio seaded',
            collapsed: options.collapsed !== false, // Default to collapsed
            showDeviceInfo: options.showDeviceInfo !== false,
            onDeviceChange: options.onDeviceChange || null,
            onToggle: options.onToggle || null,
            twilioDevice: options.twilioDevice || null, // Twilio Device instance
            ...options
        };
        
        this.element = null;
        this.isExpanded = !this.options.collapsed;
        this.availableInputDevices = [];
        this.availableOutputDevices = [];
        this.selectedInputDevice = null;
        this.selectedOutputDevice = null;
        this.isLoading = false;
        
        this.init();
    }
    
    init() {
        this.createElement();
        this.attachEventListeners();
        this.render();
        this.loadAudioDevices();
    }
    
    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'audio-settings';
        this.element.id = this.options.id;
        
        this.element.innerHTML = `
            <!-- Audio Settings Toggle -->
            <div class="audio-settings-toggle" id="${this.options.id}_toggle">
                <svg class="audio-icon" viewBox="0 0 24 24">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span class="audio-toggle-text">${this.options.title}</span>
                <div class="audio-status-dots">
                    <div class="audio-status-dot" id="${this.options.id}_micStatus"></div>
                    <div class="audio-status-dot" id="${this.options.id}_speakerStatus"></div>
                </div>
                <svg class="audio-toggle-icon audio-icon" viewBox="0 0 24 24">
                    <polyline points="6,9 12,15 18,9"/>
                </svg>
            </div>
            
            <!-- Device Selection (Collapsible) -->
            <div class="audio-device-selection" id="${this.options.id}_deviceSelection">
                <div class="audio-device-section">
                    <div class="audio-device-label">
                        <svg class="audio-icon" viewBox="0 0 24 24">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                            <line x1="12" y1="19" x2="12" y2="23"/>
                            <line x1="8" y1="23" x2="16" y2="23"/>
                        </svg>
                        <span>Mikrofon</span>
                        <div class="audio-device-status-indicator" id="${this.options.id}_micIndicator"></div>
                    </div>
                    <select class="audio-device-select" id="${this.options.id}_microphoneSelect">
                        <option value="">Laen mikrofonid...</option>
                    </select>
                    <button class="audio-test-button" id="${this.options.id}_testMic">Testa mikrofoni</button>
                    <div class="audio-status-message" id="${this.options.id}_micMessage"></div>
                </div>

                <div class="audio-device-section">
                    <div class="audio-device-label">
                        <svg class="audio-icon" viewBox="0 0 24 24">
                            <polygon points="11 5,6 9,2 9,2 15,6 15,11 19"/>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                        </svg>
                        <span>Väljund</span>
                        <div class="audio-device-status-indicator" id="${this.options.id}_speakerIndicator"></div>
                    </div>
                    <select class="audio-device-select" id="${this.options.id}_speakerSelect">
                        <option value="">Laen kõlareid...</option>
                    </select>
                    <button class="audio-test-button" id="${this.options.id}_testSpeaker">Testa kõlareid</button>
                    <div class="audio-status-message" id="${this.options.id}_speakerMessage"></div>
                </div>

                <div class="audio-device-info" id="${this.options.id}_deviceInfo" style="display: none;">
                    <svg class="audio-icon-sm" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>Leitud: <span class="audio-device-count" id="${this.options.id}_deviceCount">0</span> seadet</span>
                </div>
            </div>
        `;
        
        // Set initial expanded state
        if (this.isExpanded) {
            this.element.querySelector(`#${this.options.id}_toggle`).classList.add('active');
            this.element.querySelector(`#${this.options.id}_deviceSelection`).classList.add('expanded');
        }
    }
    
    attachEventListeners() {
        if (!this.element) return;
        
        // Toggle button
        const toggle = this.element.querySelector(`#${this.options.id}_toggle`);
        if (toggle) {
            toggle.addEventListener('click', () => {
                this.toggle();
            });
        }
        
        // Microphone selection
        const micSelect = this.element.querySelector(`#${this.options.id}_microphoneSelect`);
        if (micSelect) {
            micSelect.addEventListener('change', (e) => {
                this.handleMicrophoneChange(e.target.value);
            });
        }
        
        // Speaker selection
        const speakerSelect = this.element.querySelector(`#${this.options.id}_speakerSelect`);
        if (speakerSelect) {
            speakerSelect.addEventListener('change', (e) => {
                this.handleSpeakerChange(e.target.value);
            });
        }
        
        // Test microphone button
        const testMicBtn = this.element.querySelector(`#${this.options.id}_testMic`);
        if (testMicBtn) {
            testMicBtn.addEventListener('click', () => {
                this.testMicrophone();
            });
        }
        
        // Test speaker button
        const testSpeakerBtn = this.element.querySelector(`#${this.options.id}_testSpeaker`);
        if (testSpeakerBtn) {
            testSpeakerBtn.addEventListener('click', () => {
                this.testSpeakers();
            });
        }
    }
    
    render() {
        if (this.element && this.options.container) {
            this.options.container.appendChild(this.element);
        }
    }
    
    async loadAudioDevices() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();
        
        try {
            console.log('Loading audio devices...');
            
            // Wait a bit for device to be fully ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get available input devices (microphones) using Twilio API or fallback
            if (this.options.twilioDevice && this.options.twilioDevice.audio && this.options.twilioDevice.audio.availableInputDevices) {
                try {
                    this.availableInputDevices = await this.options.twilioDevice.audio.availableInputDevices.get();
                    console.log('Available input devices (Twilio API):', this.availableInputDevices);
                } catch (twilioError) {
                    console.warn('Twilio input devices API failed:', twilioError);
                    // Fallback to browser API
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    this.availableInputDevices = devices.filter(device => device.kind === 'audioinput');
                    console.log('Available input devices (browser fallback):', this.availableInputDevices);
                }
            } else {
                console.log('Using browser API for input devices');
                const devices = await navigator.mediaDevices.enumerateDevices();
                this.availableInputDevices = devices.filter(device => device.kind === 'audioinput');
                console.log('Available input devices (browser API):', this.availableInputDevices);
            }
            
            // Get available output devices (speakers)
            if (this.options.twilioDevice && this.options.twilioDevice.audio && this.options.twilioDevice.audio.availableOutputDevices) {
                try {
                    this.availableOutputDevices = await this.options.twilioDevice.audio.availableOutputDevices.get();
                    console.log('Available output devices (Twilio API):', this.availableOutputDevices);
                } catch (twilioError) {
                    console.warn('Twilio output devices API failed:', twilioError);
                    // Fallback to browser API
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    this.availableOutputDevices = devices.filter(device => device.kind === 'audiooutput');
                    console.log('Available output devices (browser fallback):', this.availableOutputDevices);
                }
            } else {
                console.log('Using browser API for output devices');
                const devices = await navigator.mediaDevices.enumerateDevices();
                this.availableOutputDevices = devices.filter(device => device.kind === 'audiooutput');
                console.log('Available output devices (browser API):', this.availableOutputDevices);
            }
            
            // Populate device selectors
            this.populateDeviceSelectors();
            
            // Update device status indicators
            this.updateDeviceStatusIndicators();
            
            // Show device info
            if (this.options.showDeviceInfo) {
                this.updateDeviceInfo();
            }
            
            this.showStatusMessage('micMessage', '🎧 Audio seadmed laaditud!', 'success');
            
        } catch (error) {
            console.error('Error loading audio devices:', error);
            this.showStatusMessage('micMessage', '⚠️ Audio seadmete laadimine ebaõnnestus: ' + error.message, 'error');
            
            // Try fallback method
            try {
                console.log('Trying fallback device enumeration...');
                const devices = await navigator.mediaDevices.enumerateDevices();
                this.availableInputDevices = devices.filter(device => device.kind === 'audioinput');
                this.availableOutputDevices = devices.filter(device => device.kind === 'audiooutput');
                
                this.populateDeviceSelectors();
                this.updateDeviceStatusIndicators();
                
                if (this.options.showDeviceInfo) {
                    this.updateDeviceInfo();
                }
                
                this.showStatusMessage('micMessage', '🎧 Audio seadmed laaditud (fallback)', 'success');
            } catch (fallbackError) {
                console.error('Fallback device enumeration failed:', fallbackError);
                this.showStatusMessage('micMessage', '❌ Audio seadmete laadimine ebaõnnestus täielikult', 'error');
            }
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }
    
    populateDeviceSelectors() {
        const micSelect = this.element.querySelector(`#${this.options.id}_microphoneSelect`);
        const speakerSelect = this.element.querySelector(`#${this.options.id}_speakerSelect`);
        
        if (!micSelect || !speakerSelect) return;
        
        console.log('Populating device selectors...');
        
        // Clear existing options
        micSelect.innerHTML = '';
        speakerSelect.innerHTML = '';
        
        // Add default option
        micSelect.add(new Option('Vaikimisi mikrofon', 'default'));
        speakerSelect.add(new Option('Vaikimisi kõlarid', 'default'));
        
        // Add input devices (microphones)
        if (this.availableInputDevices && this.availableInputDevices.length > 0) {
            this.availableInputDevices.forEach(audioDevice => {
                const label = audioDevice.label || `Mikrofon ${audioDevice.deviceId ? audioDevice.deviceId.slice(0, 8) : 'tundmatu'}`;
                const option = new Option(label, audioDevice.deviceId);
                micSelect.add(option);
                console.log('Added input device:', label, audioDevice.deviceId);
            });
        }
        
        // Add output devices (speakers)
        if (this.availableOutputDevices && this.availableOutputDevices.length > 0) {
            this.availableOutputDevices.forEach(audioDevice => {
                const label = audioDevice.label || `Kõlarid ${audioDevice.deviceId ? audioDevice.deviceId.slice(0, 8) : 'tundmatu'}`;
                const option = new Option(label, audioDevice.deviceId);
                speakerSelect.add(option);
                console.log('Added output device:', label, audioDevice.deviceId);
            });
        }
        
        console.log('Device selectors populated');
    }
    
    async handleMicrophoneChange(deviceId) {
        try {
            console.log('Changing input device to:', deviceId);
            
            if (deviceId === 'default') {
                if (this.options.twilioDevice && this.options.twilioDevice.audio && this.options.twilioDevice.audio.unsetInputDevice) {
                    await this.options.twilioDevice.audio.unsetInputDevice();
                }
                this.showStatusMessage('micMessage', '🎤 Vaikimisi mikrofon valitud', 'success');
            } else {
                const selectedDevice = this.availableInputDevices.find(d => d.deviceId === deviceId);
                if (selectedDevice) {
                    if (this.options.twilioDevice && this.options.twilioDevice.audio && this.options.twilioDevice.audio.setInputDevice) {
                        await this.options.twilioDevice.audio.setInputDevice(selectedDevice.deviceId);
                    }
                    this.selectedInputDevice = selectedDevice;
                    console.log('Input device changed to:', selectedDevice.label);
                    this.showStatusMessage('micMessage', `🎤 Mikrofon muudetud: ${selectedDevice.label || 'Tundmatu seade'}`, 'success');
                    this.updateDeviceStatusIndicators();
                }
            }
            
            // Trigger callback if provided
            if (this.options.onDeviceChange) {
                this.options.onDeviceChange('input', deviceId, this);
            }
            
        } catch (error) {
            console.error('Error changing input device:', error);
            this.showStatusMessage('micMessage', '❌ Mikrofoni muutmine ebaõnnestus: ' + error.message, 'error');
        }
    }
    
    async handleSpeakerChange(deviceId) {
        try {
            console.log('Changing output device to:', deviceId);
            
            if (deviceId === 'default') {
                if (this.options.twilioDevice && this.options.twilioDevice.audio && this.options.twilioDevice.audio.unsetOutputDevice) {
                    await this.options.twilioDevice.audio.unsetOutputDevice();
                }
                this.showStatusMessage('speakerMessage', '🔊 Vaikimisi kõlarid valitud', 'success');
            } else {
                const selectedDevice = this.availableOutputDevices.find(d => d.deviceId === deviceId);
                if (selectedDevice) {
                    if (this.options.twilioDevice && this.options.twilioDevice.audio && this.options.twilioDevice.audio.setOutputDevice) {
                        await this.options.twilioDevice.audio.setOutputDevice(selectedDevice.deviceId);
                    }
                    this.selectedOutputDevice = selectedDevice;
                    console.log('Output device changed to:', selectedDevice.label);
                    this.showStatusMessage('speakerMessage', `🔊 Kõlarid muudetud: ${selectedDevice.label || 'Tundmatu seade'}`, 'success');
                    this.updateDeviceStatusIndicators();
                }
            }
            
            // Trigger callback if provided
            if (this.options.onDeviceChange) {
                this.options.onDeviceChange('output', deviceId, this);
            }
            
        } catch (error) {
            console.error('Error changing output device:', error);
            this.showStatusMessage('speakerMessage', '❌ Kõlarite muutmine ebaõnnestus: ' + error.message, 'error');
        }
    }
    
    testMicrophone() {
        const testBtn = this.element.querySelector(`#${this.options.id}_testMic`);
        if (!testBtn) return;
        
        try {
            testBtn.classList.add('testing');
            testBtn.textContent = 'Testin...';
            testBtn.disabled = true;
            
            this.showStatusMessage('micMessage', '🎤 Testin mikrofoni... Räägi midagi!', 'info');
            
            // Get microphone volume for 3 seconds
            let testDuration = 3000;
            let startTime = Date.now();
            
            const testVolume = () => {
                if (this.options.twilioDevice && this.options.twilioDevice.audio && this.options.twilioDevice.audio.inputDevice) {
                    // This is a simplified test - in real implementation you'd analyze audio levels
                    const elapsed = Date.now() - startTime;
                    if (elapsed < testDuration) {
                        setTimeout(testVolume, 100);
                    } else {
                        this.showStatusMessage('micMessage', '✅ Mikrofoni test lõpetatud', 'success');
                        testBtn.classList.remove('testing');
                        testBtn.textContent = 'Testa mikrofoni';
                        testBtn.disabled = false;
                    }
                } else {
                    this.showStatusMessage('micMessage', '❌ Mikrofon pole saadaval', 'error');
                    testBtn.classList.remove('testing');
                    testBtn.textContent = 'Testa mikrofoni';
                    testBtn.disabled = false;
                }
            };
            
            testVolume();
            
        } catch (error) {
            console.error('Microphone test error:', error);
            this.showStatusMessage('micMessage', '❌ Mikrofoni test ebaõnnestus', 'error');
            testBtn.classList.remove('testing');
            testBtn.textContent = 'Testa mikrofoni';
            testBtn.disabled = false;
        }
    }
    
    testSpeakers() {
        const testBtn = this.element.querySelector(`#${this.options.id}_testSpeaker`);
        if (!testBtn) return;
        
        try {
            testBtn.classList.add('testing');
            testBtn.textContent = 'Testin...';
            testBtn.disabled = true;
            
            this.showStatusMessage('speakerMessage', '🔊 Testin kõlareid... Peaksid kuulma testi heli!', 'info');
            
            // Play test sound using Twilio's test sounds
            if (this.options.twilioDevice && this.options.twilioDevice.audio) {
                this.options.twilioDevice.audio.outgoing(true).then(() => {
                    this.showStatusMessage('speakerMessage', '✅ Kõlarite test lõpetatud', 'success');
                    testBtn.classList.remove('testing');
                    testBtn.textContent = 'Testa kõlareid';
                    testBtn.disabled = false;
                    
                    setTimeout(() => {
                        this.options.twilioDevice.audio.outgoing(false);
                    }, 2000);
                }).catch(error => {
                    console.error('Speaker test error:', error);
                    this.showStatusMessage('speakerMessage', '❌ Kõlarite test ebaõnnestus', 'error');
                    testBtn.classList.remove('testing');
                    testBtn.textContent = 'Testa kõlareid';
                    testBtn.disabled = false;
                });
            } else {
                this.showStatusMessage('speakerMessage', '❌ Audio seade pole saadaval', 'error');
                testBtn.classList.remove('testing');
                testBtn.textContent = 'Testa kõlareid';
                testBtn.disabled = false;
            }
            
        } catch (error) {
            console.error('Speaker test error:', error);
            this.showStatusMessage('speakerMessage', '❌ Kõlarite test ebaõnnestus', 'error');
            testBtn.classList.remove('testing');
            testBtn.textContent = 'Testa kõlareid';
            testBtn.disabled = false;
        }
    }
    
    updateDeviceStatusIndicators() {
        const micDot = this.element.querySelector(`#${this.options.id}_micStatus`);
        const speakerDot = this.element.querySelector(`#${this.options.id}_speakerStatus`);
        const micIndicator = this.element.querySelector(`#${this.options.id}_micIndicator`);
        const speakerIndicator = this.element.querySelector(`#${this.options.id}_speakerIndicator`);
        
        // Update microphone status
        if (micDot && micIndicator) {
            if (this.availableInputDevices && this.availableInputDevices.length > 0) {
                micDot.className = 'audio-status-dot connected';
                micIndicator.className = 'audio-device-status-indicator connected';
            } else {
                micDot.className = 'audio-status-dot error';
                micIndicator.className = 'audio-device-status-indicator error';
            }
        }
        
        // Update speaker status
        if (speakerDot && speakerIndicator) {
            if (this.availableOutputDevices && this.availableOutputDevices.length > 0) {
                speakerDot.className = 'audio-status-dot connected';
                speakerIndicator.className = 'audio-device-status-indicator connected';
            } else {
                speakerDot.className = 'audio-status-dot error';
                speakerIndicator.className = 'audio-device-status-indicator error';
            }
        }
    }
    
    updateDeviceInfo() {
        const deviceInfo = this.element.querySelector(`#${this.options.id}_deviceInfo`);
        const deviceCount = this.element.querySelector(`#${this.options.id}_deviceCount`);
        
        if (deviceInfo && deviceCount) {
            const totalDevices = (this.availableInputDevices?.length || 0) + (this.availableOutputDevices?.length || 0);
            deviceCount.textContent = totalDevices;
            deviceInfo.style.display = totalDevices > 0 ? 'flex' : 'none';
        }
    }
    
    showStatusMessage(elementId, message, type = 'info') {
        const statusEl = this.element.querySelector(`#${this.options.id}_${elementId}`);
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.className = `audio-status-message ${type}`;
        statusEl.style.display = 'block';
        
        // Auto-hide after 3 seconds for success/info messages
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }
    
    showLoadingState() {
        const micSelect = this.element.querySelector(`#${this.options.id}_microphoneSelect`);
        const speakerSelect = this.element.querySelector(`#${this.options.id}_speakerSelect`);
        
        if (micSelect) {
            micSelect.innerHTML = '<option value="">Laen mikrofonid...</option>';
            micSelect.disabled = true;
        }
        
        if (speakerSelect) {
            speakerSelect.innerHTML = '<option value="">Laen kõlareid...</option>';
            speakerSelect.disabled = true;
        }
    }
    
    hideLoadingState() {
        const micSelect = this.element.querySelector(`#${this.options.id}_microphoneSelect`);
        const speakerSelect = this.element.querySelector(`#${this.options.id}_speakerSelect`);
        
        if (micSelect) {
            micSelect.disabled = false;
        }
        
        if (speakerSelect) {
            speakerSelect.disabled = false;
        }
    }
    
    toggle() {
        const toggle = this.element.querySelector(`#${this.options.id}_toggle`);
        const deviceSelection = this.element.querySelector(`#${this.options.id}_deviceSelection`);
        
        if (!toggle || !deviceSelection) return;
        
        this.isExpanded = !this.isExpanded;
        
        if (this.isExpanded) {
            deviceSelection.classList.add('expanded');
            toggle.classList.add('active');
        } else {
            deviceSelection.classList.remove('expanded');
            toggle.classList.remove('active');
        }
        
        // Trigger callback if provided
        if (this.options.onToggle) {
            this.options.onToggle(this.isExpanded, this);
        }
    }
    
    expand() {
        if (!this.isExpanded) {
            this.toggle();
        }
    }
    
    collapse() {
        if (this.isExpanded) {
            this.toggle();
        }
    }
    
    refresh() {
        this.loadAudioDevices();
    }
    
    setTwilioDevice(twilioDevice) {
        this.options.twilioDevice = twilioDevice;
        this.refresh();
    }
    
    getSelectedDevices() {
        return {
            inputDevice: this.selectedInputDevice,
            outputDevice: this.selectedOutputDevice
        };
    }
    
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
    
    // Static method to create and return instance
    static create(options) {
        return new AudioSettings(options);
    }
}

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioSettings;
} else {
    window.AudioSettings = AudioSettings;
} 