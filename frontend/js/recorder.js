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
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

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

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.onRecorded(audioBlob);
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
      this.onStateChange('error', err.message);
    }
  }

  stop() {
    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false;
      this.mediaRecorder.stop();
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
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

window.StudioRecorder = StudioRecorder;
