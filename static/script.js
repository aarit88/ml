// Driver Drowsiness Detection System - Frontend
class DrowsinessDetector {
    constructor() {
        this.isDetecting = false;
        this.pollInterval = null;
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.alertSoundEnabled = true;

        this.statistics = {
            drowsyEvents: 0,
            yawnEvents: 0,
            totalAlerts: 0
        };

        // Track previous status to detect transitions
        this.previousAlarmState = false;
        this.previousStatus = '';
        this.alerts = [];

        this.initElements();
        this.setupEvents();
    }

    initElements() {
        this.el = {
            detectionToggle: document.getElementById('detection-toggle'),
            webcamVideo: document.getElementById('webcam-video'),
            captureCanvas: document.getElementById('capture-canvas'),
            videoFeed: document.getElementById('video-feed'),
            cameraOverlay: document.getElementById('camera-overlay'),
            connectionStatus: document.getElementById('connection-status'),
            statusText: document.getElementById('status-text'),
            statusDescription: document.getElementById('status-description'),
            statusDisplay: document.getElementById('status-display'),
            earValue: document.getElementById('ear-value'),
            marValue: document.getElementById('mar-value'),
            earBar: document.getElementById('ear-bar'),
            marBar: document.getElementById('mar-bar'),
            eyeStatusBadge: document.getElementById('eye-status-badge'),
            eyeStatusText: document.getElementById('eye-status-text'),
            mouthStatusBadge: document.getElementById('mouth-status-badge'),
            mouthStatusText: document.getElementById('mouth-status-text'),
            alertsContainer: document.getElementById('alerts-container'),
            sessionDuration: document.getElementById('session-duration'),
            drowsyCount: document.getElementById('drowsy-count'),
            yawnCount: document.getElementById('yawn-count'),
            alertCount: document.getElementById('alert-count'),
            alertModal: document.getElementById('alert-modal'),
            alertMessage: document.getElementById('alert-message'),
            dismissAlert: document.getElementById('dismiss-alert'),
            settingsModal: document.getElementById('settings-modal'),
            settingsBtn: document.getElementById('settings-btn'),
            saveSettings: document.getElementById('save-settings'),
            cancelSettings: document.getElementById('cancel-settings'),
            earThresholdSlider: document.getElementById('ear-threshold'),
            marThresholdSlider: document.getElementById('mar-threshold'),
            earThresholdValue: document.getElementById('ear-threshold-value'),
            marThresholdValue: document.getElementById('mar-threshold-value'),
            alertSoundCheckbox: document.getElementById('alert-sound'),
            screenshotBtn: document.getElementById('screenshot-btn')
        };
    }

    setupEvents() {
        this.el.detectionToggle.addEventListener('click', () => this.toggleDetection());
        this.el.dismissAlert.addEventListener('click', () => this.dismissAlertModal());
        this.el.settingsBtn.addEventListener('click', () => this.openSettings());
        this.el.saveSettings.addEventListener('click', () => this.saveSettings());
        this.el.cancelSettings.addEventListener('click', () => this.closeSettings());
        this.el.screenshotBtn.addEventListener('click', () => this.takeScreenshot());

        this.el.earThresholdSlider.addEventListener('input', (e) => {
            this.el.earThresholdValue.textContent = e.target.value;
        });
        this.el.marThresholdSlider.addEventListener('input', (e) => {
            this.el.marThresholdValue.textContent = e.target.value;
        });

        // Close modals on background click
        this.el.alertModal.addEventListener('click', (e) => {
            if (e.target === this.el.alertModal) this.dismissAlertModal();
        });
        this.el.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.el.settingsModal) this.closeSettings();
        });
    }

    // ============ Detection Start/Stop ============

    async toggleDetection() {
        if (this.isDetecting) {
            await this.stopDetection();
        } else {
            await this.startDetection();
        }
    }

    async startDetection() {
        try {
            // Request camera access first
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            this.el.webcamVideo.srcObject = stream;
            
            const res = await fetch('/start_detection');
            const data = await res.json();

            if (data.status === 'started') {
                this.isDetecting = true;
                this.el.cameraOverlay.style.display = 'none';

                // Update button immediately
                this.el.detectionToggle.innerHTML = '<i class="fas fa-stop mr-2"></i>Stop Detection';
                this.el.detectionToggle.classList.remove('bg-green-600', 'hover:bg-green-700');
                this.el.detectionToggle.classList.add('bg-red-600', 'hover:bg-red-700');

                // Enable controls
                this.el.screenshotBtn.disabled = false;

                // Update connection status
                this.setConnectionStatus(true);

                // Start processing loop
                this.startProcessingLoop();

                // Start session timer
                this.sessionStartTime = Date.now();
                this.startSessionTimer();

                this.showNotification('Detection started', 'success');
            } else {
                this.showNotification(data.message || 'Failed to start', 'error');
            }
        } catch (err) {
            console.error('Start detection error:', err);
            this.showNotification('Camera access denied or server error', 'error');
        }
    }

    startProcessingLoop() {
        this.stopProcessingLoop();
        this.processingInterval = setInterval(() => this.captureAndProcessFrame(), 200);
    }

    stopProcessingLoop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    async captureAndProcessFrame() {
        if (!this.isDetecting) return;

        const video = this.el.webcamVideo;
        const canvas = this.el.captureCanvas;
        const context = canvas.getContext('2d');

        // Draw the current video frame to the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas image to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.7);

        try {
            const res = await fetch('/process_frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData })
            });
            const data = await res.json();
            this.updateUI(data);
        } catch (err) {
            console.error('Frame processing error:', err);
        }
    }

    loadVideoFeed() {
        if (!this.isDetecting) return;

        console.log('Loading video feed...');
        const feedUrl = '/video_feed?t=' + Date.now();

        // Remove any previous error handler
        this.el.videoFeed.onerror = null;
        this.el.videoFeed.onload = null;

        // Set up error handler to retry
        this.el.videoFeed.onerror = () => {
            console.warn('Video feed failed to load, retrying in 2s...');
            if (this.isDetecting) {
                setTimeout(() => this.loadVideoFeed(), 2000);
            }
        };

        this.el.videoFeed.onload = () => {
            console.log('Video feed loaded successfully');
        };

        // Hide overlay and set the MJPEG source
        this.el.cameraOverlay.style.display = 'none';
        this.el.videoFeed.src = feedUrl;
        console.log('Video feed src set to:', feedUrl);
    }

    async stopDetection() {
        try {
            await fetch('/stop_detection');
        } catch (err) {
            console.error('Stop detection error:', err);
        }

        this.isDetecting = false;

        // Stop camera stream
        if (this.el.webcamVideo.srcObject) {
            this.el.webcamVideo.srcObject.getTracks().forEach(track => track.stop());
            this.el.webcamVideo.srcObject = null;
        }

        // Show overlay
        this.el.cameraOverlay.style.display = 'flex';

        // Update button
        this.el.detectionToggle.innerHTML = '<i class="fas fa-play mr-2"></i>Start Detection';
        this.el.detectionToggle.classList.remove('bg-red-600', 'hover:bg-red-700');
        this.el.detectionToggle.classList.add('bg-green-600', 'hover:bg-green-700');

        // Disable controls
        this.el.screenshotBtn.disabled = true;

        // Update connection status
        this.setConnectionStatus(false);

        // Stop processing
        this.stopProcessingLoop();

        // Stop session timer
        this.stopSessionTimer();

        // Reset display
        this.resetDisplay();

        this.showNotification('Detection stopped', 'success');
    }

    // ============ Polling Real Detection Data ============

    startPolling() {
        this.stopPolling();
        this.pollInterval = setInterval(() => this.fetchDetectionData(), 200);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async fetchDetectionData() {
        if (!this.isDetecting) return;

        try {
            const res = await fetch('/get_detection_data');
            const data = await res.json();
            this.updateUI(data);
        } catch (err) {
            // Silently ignore fetch errors during polling
        }
    }

    // ============ UI Updates ============

    updateUI(data) {
        const { ear, mar, eye_status, mouth_status, status, alarm_on, face_detected } = data;

        // Update EAR/MAR values
        this.el.earValue.textContent = ear.toFixed(2);
        this.el.marValue.textContent = mar.toFixed(2);

        // Update progress bars (EAR: 0.15-0.4, MAR: 0.2-0.9)
        const earPct = Math.min(((ear - 0.1) / 0.3) * 100, 100);
        const marPct = Math.min(((mar - 0.2) / 0.7) * 100, 100);
        this.el.earBar.style.width = Math.max(0, earPct) + '%';
        this.el.marBar.style.width = Math.max(0, marPct) + '%';

        // Color bars based on status
        this.el.earBar.className = 'h-2 rounded-full transition-all duration-300 ' +
            (eye_status === 'Closed' ? 'bg-red-500' : 'bg-green-500');
        this.el.marBar.className = 'h-2 rounded-full transition-all duration-300 ' +
            (mouth_status === 'Yawning' ? 'bg-orange-500' : 'bg-green-500');

        // Update eye status badge
        this.el.eyeStatusText.textContent = eye_status;
        if (eye_status === 'Closed') {
            this.el.eyeStatusBadge.className = 'status-badge status-badge-danger rounded-xl p-4 text-center transition-all duration-300';
        } else if (eye_status === 'Open') {
            this.el.eyeStatusBadge.className = 'status-badge status-badge-ok rounded-xl p-4 text-center transition-all duration-300';
        } else {
            this.el.eyeStatusBadge.className = 'status-badge status-badge-neutral rounded-xl p-4 text-center transition-all duration-300';
        }

        // Update mouth status badge
        this.el.mouthStatusText.textContent = mouth_status;
        if (mouth_status === 'Yawning') {
            this.el.mouthStatusBadge.className = 'status-badge status-badge-warning rounded-xl p-4 text-center transition-all duration-300';
        } else if (mouth_status === 'Normal') {
            this.el.mouthStatusBadge.className = 'status-badge status-badge-ok rounded-xl p-4 text-center transition-all duration-300';
        } else {
            this.el.mouthStatusBadge.className = 'status-badge status-badge-neutral rounded-xl p-4 text-center transition-all duration-300';
        }

        // Update main status display
        this.updateMainStatus(status, alarm_on, face_detected);

        // Detect new alert transitions
        if (alarm_on && !this.previousAlarmState) {
            // New alarm just triggered
            if (status.includes('Eyes Closed')) {
                this.triggerAlert('Drowsiness detected! Eyes closed for too long.', 'danger');
                this.statistics.drowsyEvents++;
            }
            if (status.includes('Yawning')) {
                this.triggerAlert('Yawning detected! Driver may be tired.', 'warning');
                this.statistics.yawnEvents++;
            }
            this.updateStatistics();
        }

        // Track if status changed during alarm
        if (alarm_on && this.previousAlarmState && status !== this.previousStatus) {
            if (status.includes('Eyes Closed') && !this.previousStatus.includes('Eyes Closed')) {
                this.triggerAlert('Drowsiness detected! Eyes closed for too long.', 'danger');
                this.statistics.drowsyEvents++;
                this.updateStatistics();
            }
            if (status.includes('Yawning') && !this.previousStatus.includes('Yawning')) {
                this.triggerAlert('Yawning detected! Driver may be tired.', 'warning');
                this.statistics.yawnEvents++;
                this.updateStatistics();
            }
        }

        this.previousAlarmState = alarm_on;
        this.previousStatus = status;
    }

    updateMainStatus(status, alarmOn, faceDetected) {
        const circle = this.el.statusDisplay.querySelector('.inline-flex');
        const icon = circle.querySelector('i');

        // Reset classes
        circle.className = 'inline-flex items-center justify-center w-28 h-28 rounded-full animate-pulse-slow';
        icon.className = 'text-5xl';

        if (!faceDetected) {
            circle.classList.add('bg-gray-100');
            icon.classList.add('fas', 'fa-user-slash', 'text-gray-500');
            this.el.statusText.textContent = 'No Face Detected';
            this.el.statusText.className = 'text-2xl font-bold text-gray-500 mt-4';
            this.el.statusDescription.textContent = 'Please position your face in front of the camera';
        } else if (alarmOn) {
            if (status.includes('Eyes Closed') && status.includes('Yawning')) {
                circle.classList.add('bg-red-100');
                icon.classList.add('fas', 'fa-exclamation-triangle', 'text-red-600');
                this.el.statusText.textContent = 'DROWSY + YAWNING!';
                this.el.statusText.className = 'text-2xl font-bold text-red-600 mt-4';
                this.el.statusDescription.textContent = 'Immediate attention required!';
            } else if (status.includes('Eyes Closed')) {
                circle.classList.add('bg-red-100');
                icon.classList.add('fas', 'fa-eye-slash', 'text-red-600');
                this.el.statusText.textContent = 'Eyes Closed!';
                this.el.statusText.className = 'text-2xl font-bold text-red-600 mt-4';
                this.el.statusDescription.textContent = 'Warning: Driver eyes are closed';
            } else if (status.includes('Yawning')) {
                circle.classList.add('bg-orange-100');
                icon.classList.add('fas', 'fa-tired', 'text-orange-600');
                this.el.statusText.textContent = 'Driver Yawning';
                this.el.statusText.className = 'text-2xl font-bold text-orange-600 mt-4';
                this.el.statusDescription.textContent = 'Driver is yawning — may be tired';
            }
        } else {
            circle.classList.add('bg-green-100');
            icon.classList.add('fas', 'fa-user-check', 'text-green-600');
            this.el.statusText.textContent = 'Driver Attentive';
            this.el.statusText.className = 'text-2xl font-bold text-green-600 mt-4';
            this.el.statusDescription.textContent = 'System is monitoring driver behavior';
        }
    }

    resetDisplay() {
        this.el.earValue.textContent = '0.00';
        this.el.marValue.textContent = '0.00';
        this.el.earBar.style.width = '0%';
        this.el.marBar.style.width = '0%';
        this.el.eyeStatusText.textContent = '--';
        this.el.mouthStatusText.textContent = '--';
        this.el.eyeStatusBadge.className = 'status-badge status-badge-neutral rounded-xl p-4 text-center transition-all duration-300';
        this.el.mouthStatusBadge.className = 'status-badge status-badge-neutral rounded-xl p-4 text-center transition-all duration-300';

        const circle = this.el.statusDisplay.querySelector('.inline-flex');
        const icon = circle.querySelector('i');
        circle.className = 'inline-flex items-center justify-center w-28 h-28 rounded-full bg-green-100 animate-pulse-slow';
        icon.className = 'fas fa-user-check text-5xl text-green-600';
        this.el.statusText.textContent = 'Driver Attentive';
        this.el.statusText.className = 'text-2xl font-bold text-green-600 mt-4';
        this.el.statusDescription.textContent = 'System is monitoring driver behavior';

        this.previousAlarmState = false;
        this.previousStatus = '';
    }

    // ============ Alerts ============

    triggerAlert(message, type) {
        const alert = { message, type, timestamp: new Date() };
        this.alerts.unshift(alert);
        if (this.alerts.length > 20) this.alerts.pop();

        this.statistics.totalAlerts++;
        this.updateStatistics();
        this.updateAlertsDisplay();

        // Show modal
        this.el.alertMessage.textContent = message;
        this.el.alertModal.style.display = 'flex';

        // Play sound
        if (this.alertSoundEnabled) this.playAlertSound();

        // Auto-dismiss after 3 seconds
        setTimeout(() => this.dismissAlertModal(), 3000);
    }

    updateAlertsDisplay() {
        if (this.alerts.length === 0) {
            this.el.alertsContainer.innerHTML = `
                <div class="text-center text-gray-500 py-6">
                    <i class="fas fa-check-circle text-4xl text-green-500 mb-2"></i>
                    <p>No alerts yet</p>
                    <p class="text-sm">System is running normally</p>
                </div>`;
            return;
        }

        this.el.alertsContainer.innerHTML = this.alerts.map(a => {
            const cls = a.type === 'danger' ? 'alert-danger' : 'alert-warning';
            const ico = a.type === 'danger' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle';
            return `
                <div class="alert-item ${cls}">
                    <div class="flex items-start">
                        <i class="fas ${ico} mt-1 mr-3"></i>
                        <div class="flex-1">
                            <p class="text-sm font-medium text-gray-800">${a.message}</p>
                            <p class="text-xs text-gray-500 mt-1">${a.timestamp.toLocaleTimeString()}</p>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    dismissAlertModal() {
        this.el.alertModal.style.display = 'none';
    }

    playAlertSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) { /* ignore audio errors */ }
    }

    // ============ Connection Status ============

    setConnectionStatus(online) {
        const dot = this.el.connectionStatus.querySelector('span:first-child');
        const txt = this.el.connectionStatus.querySelector('span:last-child');
        dot.className = 'w-3 h-3 rounded-full mr-2 ' + (online ? 'bg-green-500' : 'bg-gray-400');
        txt.textContent = online ? 'Online' : 'Offline';
    }

    // ============ Session Timer ============

    startSessionTimer() {
        this.stopSessionTimer();
        this.sessionTimer = setInterval(() => {
            if (this.sessionStartTime) {
                const elapsed = Date.now() - this.sessionStartTime;
                this.el.sessionDuration.textContent = this.formatDuration(elapsed);
            }
        }, 1000);
    }

    stopSessionTimer() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
    }

    updateStatistics() {
        this.el.drowsyCount.textContent = this.statistics.drowsyEvents;
        this.el.yawnCount.textContent = this.statistics.yawnEvents;
        this.el.alertCount.textContent = this.statistics.totalAlerts;
    }

    formatDuration(ms) {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    // ============ Settings ============

    openSettings() {
        this.el.settingsModal.style.display = 'flex';
    }

    closeSettings() {
        this.el.settingsModal.style.display = 'none';
    }

    async saveSettings() {
        const earThreshold = parseFloat(this.el.earThresholdSlider.value);
        const marThreshold = parseFloat(this.el.marThresholdSlider.value);
        this.alertSoundEnabled = this.el.alertSoundCheckbox.checked;

        try {
            await fetch('/update_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ear_threshold: earThreshold,
                    mar_threshold: marThreshold
                })
            });
            this.showNotification('Settings saved', 'success');
        } catch (e) {
            this.showNotification('Failed to save settings', 'error');
        }

        this.closeSettings();
    }

    // ============ Screenshot ============

    takeScreenshot() {
        const img = this.el.videoFeed;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const link = document.createElement('a');
        link.download = `drowsiness-screenshot-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
        this.showNotification('Screenshot saved', 'success');
    }

    // ============ Notification ============

    showNotification(message, type) {
        const n = document.createElement('div');
        const bg = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
        n.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 animate-slide-up ${bg} text-white`;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new DrowsinessDetector();
});
