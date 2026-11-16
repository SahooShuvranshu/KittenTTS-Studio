/**
 * Kitten-TTS 2 Studio — Oscilloscope Visualizer
 * Real-time hardware waveform rendering using Web Audio API
 */
class OscilloscopeVisualizer {
  constructor(canvasId, audioElement) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.audio = audioElement;
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.animId = null;
    this.dataArray = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.drawIdle();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.width = rect.width;
    this.height = rect.height;
    if (!this.isPlaying) {
      this.drawIdle();
    }
  }

  initAudio() {
    if (this.audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.source = this.audioCtx.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.warn("AudioContext initialization note:", e);
    }
  }

  start() {
    this.initAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.isPlaying = true;
    this.render();
  }

  stop() {
    this.isPlaying = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.drawIdle();
  }

  drawGrid() {
    const w = this.width;
    const h = this.height;
    const ctx = this.ctx;

    ctx.strokeStyle = '#181B22';
    ctx.lineWidth = 1;

    // Horizontal center and quarter lines
    ctx.beginPath();
    ctx.moveTo(0, h * 0.25);
    ctx.lineTo(w, h * 0.25);
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.75);
    ctx.stroke();

    // Subtle vertical ticks
    const step = 40;
    ctx.beginPath();
    for (let x = step; x < w; x += step) {
      ctx.moveTo(x, h * 0.5 - 4);
      ctx.lineTo(x, h * 0.5 + 4);
    }
    ctx.stroke();
  }

  drawIdle() {
    const w = this.width;
    const h = this.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);
    this.drawGrid();

    // Quiet center line
    ctx.strokeStyle = '#2D3342';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();
  }

  render() {
    if (!this.isPlaying) return;
    this.animId = requestAnimationFrame(() => this.render());

    const w = this.width;
    const h = this.height;
    const ctx = this.ctx;

    this.analyser.getByteTimeDomainData(this.dataArray);

    ctx.clearRect(0, 0, w, h);
    this.drawGrid();

    // Waveform line in Studio Green
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#00E599';
    ctx.beginPath();

    const sliceWidth = w / this.dataArray.length;
    let x = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      const v = this.dataArray[i] / 128.0;
      const y = (v * h) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }
}

window.OscilloscopeVisualizer = OscilloscopeVisualizer;
