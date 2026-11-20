/**
 * Kitten-TTS 2 Studio — Oscilloscope Visualizer
 * Real-time Minimal Retro-Futurist Waveform Rendering with Phosphor CRT Green Trace
 * Inspired by Dieter Rams / Teenage Engineering / Tektronix Laboratory Oscilloscopes
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
    
    // Tab backgrounding guard to prevent memory/CPU leaks when hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.animId) {
          cancelAnimationFrame(this.animId);
          this.animId = null;
        }
      } else if (this.isPlaying) {
        this.render();
      }
    });

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

    // Dark phosphor CRT screen tint
    ctx.fillStyle = '#060a08';
    ctx.fillRect(0, 0, w, h);

    // Subtle phosphor graticule grid
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
    ctx.lineWidth = 1;

    // Horizontal division lines
    ctx.beginPath();
    ctx.moveTo(0, h * 0.25);
    ctx.lineTo(w, h * 0.25);
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.75);
    ctx.stroke();

    // Primary center axes with slightly higher contrast
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.moveTo(w * 0.5, 0);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();

    // Precision graticule ticks along center horizontal axis
    const step = 20;
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.25)';
    ctx.beginPath();
    for (let x = step; x < w; x += step) {
      const isMajor = (x % (step * 2) === 0);
      const tickH = isMajor ? 4 : 2;
      ctx.moveTo(x, h * 0.5 - tickH);
      ctx.lineTo(x, h * 0.5 + tickH);
    }
    // Vertical ticks along center vertical axis
    for (let y = step; y < h; y += step) {
      const isMajor = (y % (step * 2) === 0);
      const tickW = isMajor ? 4 : 2;
      ctx.moveTo(w * 0.5 - tickW, y);
      ctx.lineTo(w * 0.5 + tickW, y);
    }
    ctx.stroke();
  }

  drawIdle() {
    const w = this.width;
    const h = this.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);
    this.drawGrid();

    // CRT standby phosphor beam trace
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();
    ctx.shadowBlur = 0;
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

    // Respect prefers-reduced-motion
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Oscilloscope trace in crisp Retro Phosphor CRT Green
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = '#00ff88';
    ctx.shadowColor = reducedMotion ? 'transparent' : '#00ff88';
    ctx.shadowBlur = reducedMotion ? 0 : 6;
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
    ctx.shadowBlur = 0; // reset blur
  }
}

window.OscilloscopeVisualizer = OscilloscopeVisualizer;
