/**
 * Kitten-TTS 2 Studio — Audio Recorder
 * Browser microphone capture with live VU-meter dynamics
 */
class StudioRecorder {
  constructor(options = {}) {
    this.onStateChange = options.onStateChange || (() => {});
    this.onRecorded = options.onRecorded || (() => {});
    this.onTimeUpdate = options.onTimeUpdate || (() => {});
    this.onLevelUpdate = options.onLevelUpdate || (() => {});

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.meterAnim = null;
    this.startTime = 0;
    this.timerInterval = null;
    this.isRecording = false;
  }

  async start() {
    // 1. Insecure HTTP Context check (Browsers disable getUserMedia on insecure origins except localhost)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      this.onStateChange('error', 'Microphone recording requires a secure (HTTPS) context.');
      return;
    }

    // 2. MediaDevices API availability check
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onStateChange('error', 'Audio input API is not supported in this browser environment.');
      return;
    }

    // 3. MediaRecorder API support check
    if (typeof MediaRecorder === 'undefined') {
      this.onStateChange('error', 'MediaRecorder API is not available in your browser.');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      // Guard against microphone unplugged / stream track termination mid-recording
      const tracks = this.stream.getAudioTracks();
      if (tracks.length > 0) {
        tracks[0].onended = () => {
          if (this.isRecording) {
            this.stop();
            this.onStateChange('error', 'Microphone was unplugged or disconnected.');
          }
        };
      }

      // Audio Context for VU level meter
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onerror = (e) => {
        this.cleanup();
        this.onStateChange('error', 'Recording error: ' + (e.error ? e.error.message : 'MediaRecorder failed'));
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const finalDuration = (Date.now() - this.startTime) / 1000;
        this.onRecorded(audioBlob, finalDuration);
        this.cleanup();
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.startTime = Date.now();
      this.onStateChange('recording');

      // Timer
      this.timerInterval = setInterval(() => {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toFixed(1).padStart(4, '0');
        this.onTimeUpdate(`${mins}:${secs}`);
      }, 100);

      // Meter loop
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!this.isRecording) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const levelPercent = Math.min(100, Math.round((avg / 128) * 100));
        this.onLevelUpdate(levelPercent);
        this.meterAnim = requestAnimationFrame(updateMeter);
      };
      updateMeter();

    } catch (err) {
      console.error("Microphone access error:", err);
      let errorMsg = err.message || 'Microphone access failed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Microphone permission was denied by user or system policy.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No audio input microphone device found on your system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Microphone hardware is busy or was disconnected.';
      } else if (err.name === 'OverconstrainedError') {
        errorMsg = 'Microphone audio constraints could not be satisfied.';
      }
      this.cleanup();
      this.onStateChange('error', errorMsg);
    }
  }

  stop() {
    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false;
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (e) {}
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      if (this.meterAnim) {
        cancelAnimationFrame(this.meterAnim);
        this.meterAnim = null;
      }
      this.onLevelUpdate(0);
      this.onStateChange('idle');
    }
  }

  cleanup() {
    this.isRecording = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.meterAnim) {
      cancelAnimationFrame(this.meterAnim);
      this.meterAnim = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      this.stream = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
  }
}

window.StudioRecorder = StudioRecorder;
