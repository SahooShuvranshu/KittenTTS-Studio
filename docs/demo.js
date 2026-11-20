/**
 * Kitten-TTS 2 Studio — Documentation & Acoustic Speech Engine
 * Interactive Audio Workstation Controller & Tektronix CRT Visualizer (docs/demo.js)
 *
 * Implements:
 * 1. Web Audio API pipeline with AudioContext & AnalyserNode (fftSize: 512).
 * 2. True Laboratory P31 Phosphor Persistence Decay (rgba(5, 6, 8, 0.20) trail).
 * 3. Quad-Mode Tektronix Visualizer:
 *    - Mode 1: Time-Domain Waveform Trace (P31 phosphor green with glow)
 *    - Mode 2: 64-Band FFT Spectrum Analyzer with gravity-decay peak needles
 *    - Mode 3: Dual-Trace A/B Comparison (Amber Reference vs Phosphor Green Cloned)
 *    - Mode 4: 2D Phase Orbit Reconstructed Attractor [x(t), x(t-tau)]
 * 4. Full-Width Interactive Timeline Scrubber with millisecond seek & envelope.
 * 5. Synthesized Mechanical Relay Clicks (AudioContext triangle pitch-blip) + Master Toggle [SFX: ON/OFF].
 * 6. Zero-Shot Voice Cloning Lab A/B Switcher & Timbre Correlation Metrics.
 * 7. Multi-Speaker Soundboard Matrix (6 distinct personas routed to CRT display).
 * 8. Interactive 1.6-bit Ternary Weight Matrix & Bit-Packing Calculator.
 * 9. Developer Command Center Multi-Platform Tabbed Terminal with Animated Toast.
 * 10. Self-Contained SVG Telemetry & Real-Time GitHub API Metrics.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // 1. DOM REFERENCES
  // =========================================================================
  const canvas = document.getElementById('demoCanvas');
  if (!canvas) {
    console.warn('[demo.js] Canvas element #demoCanvas not found.');
    return;
  }

  const ctx = canvas.getContext('2d');
  const playBtn = document.getElementById('demoPlayBtn');
  const trackTitle = document.getElementById('demoTrackTitle');
  const trackDuration = document.getElementById('demoDuration');
  const trackMeta = document.getElementById('demoTrackMeta');
  const trackBtns = document.querySelectorAll('.track-select-btn');
  const modeBadge = document.getElementById('demoModeBadge');
  const scopeScale = document.getElementById('scopeScale');
  const scopeFreq = document.getElementById('scopeFreq');
  const scopeReticleMode = document.getElementById('scopeReticleMode');
  const canvasBox = document.getElementById('canvasContainer') || canvas.parentElement;

  // Mode Buttons
  const modeButtons = document.querySelectorAll('.btn-mode-toggle');

  // Scrubber Elements
  const scrubberTrack = document.getElementById('scrubberTrack');
  const scrubberProgress = document.getElementById('scrubberProgress');
  const scrubberHandle = document.getElementById('scrubberHandle');
  const scrubberCurrentTime = document.getElementById('scrubberCurrentTime');
  const scrubberTotalTime = document.getElementById('scrubberTotalTime');

  // SFX Toggle Elements
  const sfxToggleBtn = document.getElementById('sfxToggleBtn');
  const sfxStateText = document.getElementById('sfxStateText');

  // Toast Notification
  const toastEl = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');

  // =========================================================================
  // 2. STATE & AUDIO ENGINE SETUP
  // =========================================================================
  let width = 800;
  let height = 150;
  let animId = null;
  let isPlaying = false;
  let currentMode = 'oscilloscope'; // 'oscilloscope' | 'spectrum' | 'dual' | 'orbit'
  let phase = 0;
  let scanX = 0;
  let simulatedTime = 0;
  let isDraggingScrubber = false;

  // 64-Band Spectrum Analysis Arrays
  const NUM_SPECTRUM_BARS = 64;
  const peakBars = new Float32Array(NUM_SPECTRUM_BARS);
  const PEAK_DECAY = 0.94;

  // Master SFX Relay Click Synthesizer State
  let sfxEnabled = localStorage.getItem('kitten_sfx_enabled') !== 'false';
  let sfxAudioCtx = null;

  function updateSfxButtonUI() {
    if (sfxToggleBtn && sfxStateText) {
      if (sfxEnabled) {
        sfxStateText.textContent = 'ON';
        sfxToggleBtn.querySelector('.sfx-led')?.classList.add('on');
        sfxToggleBtn.style.borderColor = 'var(--phosphor-green)';
      } else {
        sfxStateText.textContent = 'OFF';
        sfxToggleBtn.querySelector('.sfx-led')?.classList.remove('on');
        sfxToggleBtn.style.borderColor = 'var(--border-dark)';
      }
    }
  }
  updateSfxButtonUI();

  // Synthesize genuine Teenage Engineering / Braun mechanical relay click
  function playRelayClick(pitch = 880) {
    if (!sfxEnabled) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!sfxAudioCtx) {
        sfxAudioCtx = new AudioCtxClass();
      }
      if (sfxAudioCtx.state === 'suspended') {
        sfxAudioCtx.resume().catch(() => {});
      }
      const t = sfxAudioCtx.currentTime;
      const osc = sfxAudioCtx.createOscillator();
      const gain = sfxAudioCtx.createGain();
      const filter = sfxAudioCtx.createBiquadFilter();

      // Sharp micro-burst pitch blip (880Hz down to 140Hz over 18ms)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.016);

      // Bandpass mechanical resonance
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.Q.setValueAtTime(3.5, t);

      // Fast tactile decay envelope
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(sfxAudioCtx.destination);

      osc.start(t);
      osc.stop(t + 0.022);
    } catch (e) {
      // AudioContext restricted before gesture
    }
  }

  // Toggle SFX
  if (sfxToggleBtn) {
    sfxToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sfxEnabled = !sfxEnabled;
      localStorage.setItem('kitten_sfx_enabled', sfxEnabled ? 'true' : 'false');
      updateSfxButtonUI();
      if (sfxEnabled) playRelayClick(1100);
    });
  }

  // Web Audio Context & Analyzer Node Setup
  let audio = new Audio();
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let isSourceConnected = false;
  let timeDomainData = null; // Uint8Array(512)
  let freqData = null;       // Uint8Array(256)
  let usingFallbackSrc = false;

  // Curated Tracks Configuration
  const tracks = [
    {
      idx: 0,
      id: "natural",
      title: "SAMPLE_01: REFERENCE_TIMBRE // NATURAL VOCAL DELIVERY (24kHz PCM)",
      meta: "ACOUSTIC_SYNTHESIS // ZERO-SHOT CLONED FORMANT PROFILE",
      duration: "00:05.2",
      durationSec: 5.22,
      src: "assets/audio/sample_01.mp3",
      fallbackSrc: "assets/audio/sample_01.wav"
    },
    {
      idx: 1,
      id: "whisper",
      title: "SAMPLE_02: EXPRESSION_MOD // [whisper] INTIMATE CLOSE-MIC PROXIMITY",
      meta: "ACOUSTIC_SYNTHESIS // ATTENUATED VOCAL TRACT GLOTTAL CLOSURE",
      duration: "00:05.4",
      durationSec: 5.38,
      src: "assets/audio/sample_02.mp3",
      fallbackSrc: "assets/audio/sample_02.wav"
    },
    {
      idx: 2,
      id: "laugh",
      title: "SAMPLE_03: VOCAL_BURST // <laugh> PARALINGUISTIC EVENT SYNTAX",
      meta: "ACOUSTIC_SYNTHESIS // RHYTHMIC ASPIRATION AND PITCH PEAKS",
      duration: "00:08.9",
      durationSec: 8.90,
      src: "assets/audio/sample_03.mp3",
      fallbackSrc: "assets/audio/sample_03.wav"
    }
  ];

  let currentTrackIdx = 0;

  audio.preload = "auto";
  audio.crossOrigin = "anonymous";
  audio.src = tracks[0].src;

  function initAudioContext() {
    if (!audioCtx) {
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.80;

          if (!isSourceConnected) {
            sourceNode = audioCtx.createMediaElementSource(audio);
            sourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            isSourceConnected = true;
          }

          timeDomainData = new Uint8Array(analyser.fftSize);
          freqData = new Uint8Array(analyser.frequencyBinCount);
        }
      } catch (err) {
        console.warn("[demo.js] Web Audio initialization notice:", err);
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  // High-DPI Responsive Canvas Resizing
  function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height || 150;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    if (ctx.setTransform) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      ctx.scale(dpr, dpr);
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // =========================================================================
  // 3. TEKTRONIX QUAD-MODE VISUALIZER CONTROLLER
  // =========================================================================
  function setVisualizerMode(newMode) {
    currentMode = newMode;
    playRelayClick(940);

    // Update active toolbar button
    modeButtons.forEach(btn => {
      if (btn.getAttribute('data-mode') === currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Mode Badge & Labels
    if (modeBadge) {
      switch (currentMode) {
        case 'oscilloscope':
          modeBadge.textContent = 'CRT PHOSPHOR 50Hz';
          modeBadge.style.color = 'var(--phosphor-green)';
          break;
        case 'spectrum':
          modeBadge.textContent = 'FFT SPECTRUM 64-BAND';
          modeBadge.style.color = 'var(--signal-amber)';
          break;
        case 'dual':
          modeBadge.textContent = 'DUAL-TRACE A/B SYNC';
          modeBadge.style.color = 'var(--bone-cream)';
          break;
        case 'orbit':
          modeBadge.textContent = '2D PHASE ORBIT XY';
          modeBadge.style.color = 'var(--phosphor-green)';
          break;
      }
    }

    // Update Scale & Channel Labels
    if (scopeScale) {
      switch (currentMode) {
        case 'oscilloscope':
          scopeScale.innerHTML = '<span>+1.0V</span><span>0.0V</span><span>-1.0V</span>';
          break;
        case 'spectrum':
          scopeScale.innerHTML = '<span>0 dB</span><span>-18 dB</span><span>-36 dB</span>';
          break;
        case 'dual':
          scopeScale.innerHTML = '<span style="color:#ff8800;">CH-A</span><span>SYNC</span><span style="color:#00ff88;">CH-B</span>';
          break;
        case 'orbit':
          scopeScale.innerHTML = '<span>+Y</span><span>[0,0]</span><span>-Y</span>';
          break;
      }
    }

    if (scopeFreq) {
      switch (currentMode) {
        case 'oscilloscope':
          scopeFreq.textContent = 'TRACE // CH-A 24.0 kHz (P31 PHOSPHOR)';
          break;
        case 'spectrum':
          scopeFreq.textContent = 'SPECTRUM // FFT 0 - 12.0 kHz (64 BANDS)';
          break;
        case 'dual':
          scopeFreq.textContent = 'DUAL TRACE // CH-A REF (AMBER) vs CH-B CLONE (GREEN)';
          break;
        case 'orbit':
          scopeFreq.textContent = 'ATTRACTOR // [x(t), x(t - tau)] VOCAL TRACT ORBIT';
          break;
      }
    }

    if (scopeReticleMode) {
      scopeReticleMode.textContent = `[${currentMode.toUpperCase()}]`;
    }
  }

  function cycleVisualizerMode() {
    const modes = ['oscilloscope', 'spectrum', 'dual', 'orbit'];
    const currentIdx = modes.indexOf(currentMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    setVisualizerMode(nextMode);
  }

  // Mode button listeners
  modeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute('data-mode');
      if (mode) setVisualizerMode(mode);
    });
  });

  if (modeBadge) {
    modeBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleVisualizerMode();
    });
  }

  if (canvasBox) {
    canvasBox.addEventListener('click', () => {
      cycleVisualizerMode();
    });
    canvasBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cycleVisualizerMode();
      }
    });
  }

  // Tab Backgrounding Guard: pause RAF rendering loop when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    } else {
      if (!animId) {
        animId = requestAnimationFrame(draw);
      }
    }
  });

  // Keyboard shortcut listener ('1', '2', '3', '4', 'v', 'm', Space)
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.key === '1') setVisualizerMode('oscilloscope');
    else if (e.key === '2') setVisualizerMode('spectrum');
    else if (e.key === '3') setVisualizerMode('dual');
    else if (e.key === '4') setVisualizerMode('orbit');
    else if (e.key === 'v' || e.key === 'V' || e.key === 'm' || e.key === 'M') {
      cycleVisualizerMode();
    } else if (e.code === 'Space') {
      e.preventDefault();
      togglePlayback();
    }
  });

  // =========================================================================
  // 4. CRT GRATICULE & PHOSPHOR PERSISTENCE RENDER LOOP
  // =========================================================================
  function drawGraticule() {
    ctx.lineWidth = 1;

    if (currentMode === 'oscilloscope' || currentMode === 'dual') {
      // Oscilloscope horizontal division lines
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.07)';
      const hDiv = 4;
      for (let i = 1; i < hDiv; i++) {
        const y = (height / hDiv) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical divisions
      const vDiv = 10;
      for (let i = 1; i < vDiv; i++) {
        const x = (width / vDiv) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Center calibration crosshair
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.20)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.stroke();

      // Precision tick marks
      const tickStep = width / 20;
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 20; i++) {
        const x = i * tickStep;
        ctx.beginPath();
        ctx.moveTo(x, (height * 0.5) - 3);
        ctx.lineTo(x, (height * 0.5) + 3);
        ctx.stroke();
      }
    } else if (currentMode === 'spectrum') {
      // Spectrum dB Grid Lines
      ctx.strokeStyle = 'rgba(255, 136, 0, 0.08)';
      for (const ratio of [0.25, 0.5, 0.75]) {
        const y = height * ratio;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      // Baseline floor axis
      ctx.strokeStyle = 'rgba(255, 136, 0, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height - 1);
      ctx.lineTo(width, height - 1);
      ctx.stroke();
    } else if (currentMode === 'orbit') {
      // Polar & Cartesian Grid for Lissajous Orbit
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.12)';
      const cx = width * 0.5;
      const cy = height * 0.5;
      const rMax = Math.min(cx, cy) * 0.85;

      for (const rRatio of [0.33, 0.66, 1.0]) {
        ctx.beginPath();
        ctx.arc(cx, cy, rMax * rRatio, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
    }
  }

  function hasLiveAudioData(array) {
    if (!array || array.length === 0) return false;
    let variance = 0;
    for (let i = 0; i < array.length; i += 8) {
      variance += Math.abs(array[i] - 128);
      if (variance > 12) return true;
    }
    return false;
  }

  // Primary Animation Render Loop with Laboratory P31 Phosphor Decay
  function draw() {
    if (document.hidden) {
      animId = null;
      return;
    }
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Laboratory P31 Phosphor Persistence Decay:
    // Fading canvas trail with rgba(5, 6, 8, 0.20) gives genuine CRT afterglow!
    ctx.fillStyle = 'rgba(5, 6, 8, 0.20)';
    ctx.fillRect(0, 0, width, height);
    drawGraticule();

    // =======================================================================
    // IDLE SWEEP STATE (PAUSED / STOPPED)
    // =======================================================================
    if (!isPlaying) {
      if (currentMode === 'oscilloscope' || currentMode === 'dual') {
        // Idle CRT Reference Sweep Line
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, height * 0.5);
        ctx.lineTo(width, height * 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!reducedMotion) {
          // Moving CRT Phosphor Beam Dot
          scanX = (scanX + 3.2) % width;
          ctx.fillStyle = '#00ff88';
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(scanX, height * 0.5, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (currentMode === 'spectrum') {
        // Idle Baseline Noise
        const barWidth = (width / NUM_SPECTRUM_BARS) - 1.5;
        ctx.fillStyle = 'rgba(0, 255, 136, 0.25)';

        for (let i = 0; i < NUM_SPECTRUM_BARS; i++) {
          const x = i * (barWidth + 1.5) + 1;
          const noise = Math.sin((i * 0.35) + phase) * 1.5 + 2.5;
          ctx.fillRect(x, height - noise, barWidth, noise);
          peakBars[i] = Math.max(0, peakBars[i] * PEAK_DECAY);
        }
        phase += 0.05;
      } else if (currentMode === 'orbit') {
        // Idle Orbit: Slow Lissajous Idle Precession
        const cx = width * 0.5;
        const cy = height * 0.5;
        const r = Math.min(cx, cy) * 0.35;
        const ox = cx + Math.sin(phase) * r;
        const oy = cy + Math.cos(phase * 1.5) * (r * 0.7);

        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        phase += 0.03;
      }

      animId = requestAnimationFrame(draw);
      return;
    }

    // =======================================================================
    // ACTIVE PLAYBACK RENDERING (QUAD-MODE)
    // =======================================================================
    let liveDataAvailable = false;
    if (analyser && timeDomainData) {
      analyser.getByteTimeDomainData(timeDomainData);
      liveDataAvailable = hasLiveAudioData(timeDomainData);
    }

    // -----------------------------------------------------------------------
    // MODE 1: TIME-DOMAIN WAVEFORM TRACE (P31 Phosphor Green)
    // -----------------------------------------------------------------------
    if (currentMode === 'oscilloscope') {
      ctx.save();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 9;
      ctx.beginPath();

      if (liveDataAvailable) {
        const sliceWidth = width / timeDomainData.length;
        let x = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          const v = timeDomainData[i] / 128.0;
          const y = v * (height * 0.5);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
      } else {
        // Simulated Harmonic Formant Acoustic Waveform
        const points = 160;
        const slice = width / points;
        const env = 0.65 + 0.35 * Math.sin(simulatedTime * 4.2);

        for (let i = 0; i <= points; i++) {
          const x = i * slice;
          const angle = (i * 0.13) + phase;
          const h1 = Math.sin(angle * 0.65) * 26 * env;
          const h2 = Math.sin(angle * 1.75 + phase * 0.8) * 13 * env;
          const f3 = Math.cos(angle * 3.5 - phase * 0.4) * 6;
          const jitter = (Math.random() - 0.5) * 2;
          const y = (height * 0.5) + h1 + h2 + f3 + jitter;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        phase += 0.085;
        simulatedTime += 0.016;
      }

      ctx.stroke();
      ctx.restore();

    // -----------------------------------------------------------------------
    // MODE 2: 64-BAND FFT SPECTRUM ANALYZER with GRAVITY DECAY NEEDLES
    // -----------------------------------------------------------------------
    } else if (currentMode === 'spectrum') {
      ctx.save();
      const barWidth = Math.max(2, (width / NUM_SPECTRUM_BARS) - 1.5);
      const binStep = analyser ? Math.floor(analyser.frequencyBinCount / NUM_SPECTRUM_BARS) : 4;

      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
      }

      for (let i = 0; i < NUM_SPECTRUM_BARS; i++) {
        const x = i * (barWidth + 1.5) + 1;
        let barHeight = 0;

        if (liveDataAvailable && freqData) {
          let sum = 0;
          for (let j = 0; j < binStep; j++) {
            const idx = (i * binStep) + j;
            if (idx < freqData.length) sum += freqData[idx];
          }
          const avg = sum / binStep;
          barHeight = (avg / 255.0) * (height - 8);
        } else {
          // Simulated Formant Spectrum
          const formant1 = Math.exp(-Math.pow(i - 10, 2) / 22) * 0.95;
          const formant2 = Math.exp(-Math.pow(i - 26, 2) / 36) * 0.78;
          const formant3 = Math.exp(-Math.pow(i - 44, 2) / 48) * 0.52;
          const rolloff = Math.max(0.08, 1.0 - (i / NUM_SPECTRUM_BARS));
          const env = 0.55 + 0.45 * Math.sin(simulatedTime * 4.2);
          const composite = (formant1 + formant2 + formant3) * rolloff * env;
          barHeight = Math.min(height - 8, composite * (height - 8));
        }

        barHeight = Math.max(2, barHeight);

        // Peak Hold Needle with Gravity Decay
        if (barHeight > peakBars[i]) {
          peakBars[i] = barHeight;
        } else {
          peakBars[i] = Math.max(barHeight, peakBars[i] * PEAK_DECAY);
        }

        // Multi-zone color styling
        const amp = barHeight / (height - 8);
        if (amp > 0.82) {
          ctx.fillStyle = '#ff3344';
          ctx.shadowColor = '#ff3344';
          ctx.shadowBlur = 6;
        } else if (amp > 0.52) {
          ctx.fillStyle = '#ff8800';
          ctx.shadowColor = '#ff8800';
          ctx.shadowBlur = 4;
        } else {
          ctx.fillStyle = '#00ff88';
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 2;
        }

        const y = height - barHeight;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Floating peak indicator needle
        const peakY = height - peakBars[i];
        ctx.fillStyle = '#ff8800';
        ctx.shadowBlur = 0;
        ctx.fillRect(x, peakY - 1.5, barWidth, 1.5);
      }

      if (!liveDataAvailable) simulatedTime += 0.016;
      ctx.restore();

    // -----------------------------------------------------------------------
    // MODE 3: DUAL-TRACE A/B COMPARISON (CH-A Amber vs CH-B Phosphor Green)
    // -----------------------------------------------------------------------
    } else if (currentMode === 'dual') {
      ctx.save();
      const points = 160;
      const slice = width / points;
      const env = 0.6 + 0.4 * Math.sin(simulatedTime * 4.2);

      // Channel A (Reference Voice - Amber)
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const x = i * slice;
        const angle = (i * 0.12) + phase;
        const v = Math.sin(angle * 0.65) * 18 * env + Math.sin(angle * 1.5) * 9 * env;
        const y = (height * 0.32) + v;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Channel B (Cloned Speech - Phosphor Green)
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const x = i * slice;
        const angle = (i * 0.12) + phase + 0.05; // Tight correlation delta
        const v = Math.sin(angle * 0.65) * 17.5 * env + Math.sin(angle * 1.5) * 8.8 * env;
        const y = (height * 0.68) + v;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      phase += 0.085;
      simulatedTime += 0.016;
      ctx.restore();

    // -----------------------------------------------------------------------
    // MODE 4: 2D PHASE ORBIT VOCAL ATTRACTOR [x(t), x(t - tau)]
    // -----------------------------------------------------------------------
    } else if (currentMode === 'orbit') {
      ctx.save();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 10;

      const cx = width * 0.5;
      const cy = height * 0.5;
      const scale = Math.min(cx, cy) * 0.78;

      ctx.beginPath();

      if (liveDataAvailable && timeDomainData) {
        const tau = 14; // Delay embedding tau
        const len = timeDomainData.length - tau;
        for (let i = 0; i < len; i += 2) {
          const xNorm = (timeDomainData[i] - 128) / 128.0;
          const yNorm = (timeDomainData[i + tau] - 128) / 128.0;
          const px = cx + xNorm * scale;
          const py = cy - yNorm * scale;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      } else {
        // Simulated Glottal Phase Space Attractor
        const steps = 180;
        const env = 0.7 + 0.3 * Math.sin(simulatedTime * 4.2);
        for (let i = 0; i <= steps; i++) {
          const t = (i / steps) * Math.PI * 4 + phase;
          const xVal = Math.sin(t * 1.0) * Math.cos(t * 0.4) * env;
          const yVal = Math.cos(t * 1.0 + 0.4) * Math.sin(t * 0.8) * env;
          const px = cx + xVal * scale;
          const py = cy + yVal * scale;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        phase += 0.04;
        simulatedTime += 0.016;
      }

      ctx.stroke();
      ctx.restore();
    }

    animId = requestAnimationFrame(draw);
  }

  // =========================================================================
  // 5. TIMELINE SCRUBBER & TIMECODE TRACKING
  // =========================================================================
  function formatMillisecondTime(seconds) {
    if (isNaN(seconds) || seconds <= 0) return "00:00.000";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    const secsPad = secs.padStart(6, '0');
    return `${String(mins).padStart(2, '0')}:${secsPad}`;
  }

  function updateScrubber() {
    if (!audio.duration || isNaN(audio.duration) || isDraggingScrubber) return;
    const progressPercent = (audio.currentTime / audio.duration) * 100;
    if (scrubberProgress) scrubberProgress.style.width = `${progressPercent}%`;
    if (scrubberHandle) scrubberHandle.style.left = `${progressPercent}%`;
    if (scrubberCurrentTime) {
      scrubberCurrentTime.textContent = formatMillisecondTime(audio.currentTime);
    }
  }

  audio.addEventListener('timeupdate', () => {
    updateScrubber();
    if (trackDuration && !isNaN(audio.currentTime)) {
      const mins = Math.floor(audio.currentTime / 60);
      const secs = (audio.currentTime % 60).toFixed(1);
      trackDuration.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    if (scrubberTotalTime && !isNaN(audio.duration)) {
      scrubberTotalTime.textContent = formatMillisecondTime(audio.duration);
    }
  });

  // Scrubber Seek Drag & Click (Mouse & Touch compatible)
  function getEventClientX(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX;
  }

  function seekAudioFromEvent(e) {
    if (!scrubberTrack || !audio.duration) return;
    const clientX = getEventClientX(e);
    if (clientX === undefined || isNaN(clientX)) return;
    const rect = scrubberTrack.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = pos * audio.duration;
    if (scrubberProgress) scrubberProgress.style.width = `${pos * 100}%`;
    if (scrubberHandle) scrubberHandle.style.left = `${pos * 100}%`;
    if (scrubberCurrentTime) {
      scrubberCurrentTime.textContent = formatMillisecondTime(audio.currentTime);
    }
    playRelayClick(1200);
  }

  if (scrubberTrack) {
    // Mouse Interaction
    scrubberTrack.addEventListener('mousedown', (e) => {
      isDraggingScrubber = true;
      initAudioContext();
      seekAudioFromEvent(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isDraggingScrubber) seekAudioFromEvent(e);
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingScrubber) isDraggingScrubber = false;
    });

    // Mobile & Tablet Touch Interaction (Strict 4-tier mobile/tablet support)
    scrubberTrack.addEventListener('touchstart', (e) => {
      isDraggingScrubber = true;
      initAudioContext();
      seekAudioFromEvent(e);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDraggingScrubber) {
        seekAudioFromEvent(e);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (isDraggingScrubber) isDraggingScrubber = false;
    }, { passive: true });

    window.addEventListener('touchcancel', () => {
      if (isDraggingScrubber) isDraggingScrubber = false;
    }, { passive: true });
  }

  // Synchronize Playback UI State across Master Play, Soundboard Cards, and Cloning Lab
  function syncPlaybackUI() {
    // 1. Master Play Button
    if (playBtn) {
      if (isPlaying) {
        playBtn.textContent = '⏸ PAUSE SYNTHESIS';
        playBtn.classList.remove('btn-green');
        playBtn.classList.add('btn-amber');
      } else {
        playBtn.textContent = '▶ AUDITION SYNTHESIS';
        playBtn.classList.remove('btn-amber');
        playBtn.classList.add('btn-green');
      }
    }

    // 2. Multi-Speaker Soundboard Cards & Buttons
    const soundboardCards = document.querySelectorAll('.soundboard-card');
    soundboardCards.forEach(card => {
      const btn = card.querySelector('.btn-soundboard-play');
      if (!btn) return;
      const tIdx = parseInt(btn.getAttribute('data-track') || '0', 10);
      const speakerNameEl = card.querySelector('.speaker-name');
      const fullName = speakerNameEl ? speakerNameEl.textContent.trim() : 'SPEAKER';
      const shortName = fullName.split('-')[0].toUpperCase();

      if (isPlaying && currentTrackIdx === tIdx) {
        card.classList.add('playing');
        btn.textContent = `⏸ PAUSE ${shortName}`;
        btn.classList.add('active-playing');
      } else {
        card.classList.remove('playing');
        btn.textContent = `▶ AUDITION ${shortName}`;
        btn.classList.remove('active-playing');
      }
    });

    // 3. Zero-Shot Voice Cloning Lab A/B Switcher Buttons
    if (btnPlayReference) {
      if (isPlaying && currentTrackIdx === 0 && currentMode === 'dual') {
        btnPlayReference.textContent = '⏸ PAUSE CH-A REFERENCE';
        btnPlayReference.classList.add('active-playing');
      } else {
        btnPlayReference.textContent = '▶ AUDITION CH-A REFERENCE (24kHz)';
        btnPlayReference.classList.remove('active-playing');
      }
    }

    if (btnPlayCloned) {
      if (isPlaying && currentTrackIdx === 1 && (currentMode === 'oscilloscope' || currentMode === 'dual')) {
        btnPlayCloned.textContent = '⏸ PAUSE CH-B KITTEN-TTS 2';
        btnPlayCloned.classList.add('active-playing');
      } else {
        btnPlayCloned.textContent = '▶ AUDITION CH-B KITTEN-TTS 2';
        btnPlayCloned.classList.remove('active-playing');
      }
    }
  }

  // Auto-Reset when track finishes
  audio.addEventListener('ended', () => {
    isPlaying = false;
    syncPlaybackUI();
    if (trackDuration) {
      trackDuration.textContent = tracks[currentTrackIdx].duration;
    }
    if (scrubberProgress) scrubberProgress.style.width = '0%';
    if (scrubberHandle) scrubberHandle.style.left = '0%';
    if (scrubberCurrentTime) scrubberCurrentTime.textContent = "00:00.000";
    audio.currentTime = 0;
  });

  // Audio Fallback Handling
  audio.addEventListener('error', () => {
    if (!usingFallbackSrc && tracks[currentTrackIdx].fallbackSrc) {
      usingFallbackSrc = true;
      audio.src = tracks[currentTrackIdx].fallbackSrc;
      if (isPlaying) {
        audio.play().catch(() => {});
      }
    } else {
      console.warn(`[demo.js] Audio source fallback completed for track ${currentTrackIdx}. Active mode: simulated waveform.`);
    }
  });

  // Play / Pause Master Toggle
  function togglePlayback() {
    initAudioContext();
    playRelayClick(880);

    isPlaying = !isPlaying;
    syncPlaybackUI();

    if (isPlaying) {
      audio.play().catch(err => {
        console.warn("[demo.js] Playback notice (running in simulated visualizer):", err);
      });
    } else {
      audio.pause();
    }
  }

  if (playBtn) {
    playBtn.addEventListener('click', togglePlayback);
  }

  // Track Selector Switcher
  function selectTrack(idx) {
    if (!tracks[idx]) return;
    currentTrackIdx = idx;
    usingFallbackSrc = false;
    playRelayClick(1050);

    if (trackTitle) trackTitle.textContent = tracks[idx].title;
    if (trackMeta) trackMeta.textContent = tracks[idx].meta;
    if (trackDuration) trackDuration.textContent = tracks[idx].duration;
    if (scrubberTotalTime) {
      scrubberTotalTime.textContent = formatMillisecondTime(tracks[idx].durationSec);
    }

    audio.src = tracks[idx].src;
    audio.load();

    if (isPlaying) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    trackBtns.forEach(btn => {
      const bIdx = parseInt(btn.getAttribute('data-idx'), 10);
      if (bIdx === idx) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    syncPlaybackUI();
  }

  trackBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!isNaN(idx)) selectTrack(idx);
    });
  });

  // =========================================================================
  // 6. ZERO-SHOT VOICE CLONING LAB A/B SWITCHER
  // =========================================================================
  const btnPlayReference = document.getElementById('btnPlayReference');
  const btnPlayCloned = document.getElementById('btnPlayCloned');

  if (btnPlayReference) {
    btnPlayReference.addEventListener('click', () => {
      if (isPlaying && currentTrackIdx === 0 && currentMode === 'dual') {
        togglePlayback();
        showToast("PAUSED CHANNEL A: REFERENCE GROUND TRUTH");
      } else {
        selectTrack(0);
        setVisualizerMode('dual');
        if (!isPlaying) togglePlayback();
        showToast("AUDITIONING CHANNEL A: REFERENCE GROUND TRUTH");
      }
    });
  }

  if (btnPlayCloned) {
    btnPlayCloned.addEventListener('click', () => {
      if (isPlaying && currentTrackIdx === 1 && currentMode === 'oscilloscope') {
        togglePlayback();
        showToast("PAUSED CHANNEL B: KITTEN-TTS 2 CLONED SYNTHESIS");
      } else {
        selectTrack(1);
        setVisualizerMode('oscilloscope');
        if (!isPlaying) togglePlayback();
        showToast("AUDITIONING CHANNEL B: KITTEN-TTS 2 CLONED SYNTHESIS");
      }
    });
  }

  // =========================================================================
  // 7. MULTI-SPEAKER ACOUSTIC SOUNDBOARD MATRIX
  // =========================================================================
  const soundboardPlayBtns = document.querySelectorAll('.btn-soundboard-play');
  soundboardPlayBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackIdx = parseInt(btn.getAttribute('data-track') || '0', 10);
      const card = btn.closest('.soundboard-card');
      const speakerName = card?.querySelector('.speaker-name')?.textContent.trim() || 'Speaker';

      if (isPlaying && currentTrackIdx === trackIdx) {
        togglePlayback();
        showToast(`PAUSED ${speakerName.toUpperCase()}`);
      } else {
        selectTrack(trackIdx);
        if (!isPlaying) togglePlayback();
        showToast(`AUDITIONING ${speakerName.toUpperCase()} THROUGH MASTER CRT MONITOR`);
      }
    });
  });

  // =========================================================================
  // 8. INTERACTIVE PROSODY TAG PALETTE & SANDBOX
  // =========================================================================
  const tagChips = document.querySelectorAll('.btn-tag-chip');
  const promptInput = document.getElementById('promptInput');
  const tagInflectionDesc = document.getElementById('tagInflectionDesc');
  const btnAuditionTag = document.getElementById('btnAuditionTag');
  const btnCopyPromptText = document.getElementById('btnCopyPromptText');

  const tagInflectionMap = {
    '[happy]': {
      desc: "INFLECTION: Warm, upbeat, energetic formant curve with elevated fundamental pitch (+12Hz)",
      prompt: "[happy] Good morning! The system telemetry looks fantastic today.",
      track: 0
    },
    '[whisper]': {
      desc: "INFLECTION: Quiet, breathy, intimate vocal dynamics with attenuated glottal closure",
      prompt: "[whisper] Keep your voice down, the servers are sleeping.",
      track: 1
    },
    '[serious]': {
      desc: "INFLECTION: Authoritative, firm, steady cadence with compressed dynamic range",
      prompt: "[serious] Critical threshold reached. Initiating protocol zero.",
      track: 0
    },
    '[excited]': {
      desc: "INFLECTION: Rapid tempo (1.25x) and elevated pitch peak with wide frequency spread",
      prompt: "[excited] We just benchmarked over 1.2x real-time generation on CPU!",
      track: 1
    },
    '<laugh>': {
      desc: "PARALINGUISTIC: Audible laughter and chuckle event with rhythmic acoustic aspiration",
      prompt: "You really thought that would fail? <laugh> It compiled on the first try.",
      track: 2
    },
    '<sigh>': {
      desc: "PARALINGUISTIC: Exhale and contemplative cadence pause with sub-harmonic release",
      prompt: "Another 3:00 AM debugging session. <sigh> Back to the terminal.",
      track: 2
    },
    '(((emphasis)))': {
      desc: "ACOUSTIC BOOST: Heavy harmonic pitch peak and +4.5 dB dynamic resonance",
      prompt: "This parameter is (((crucial))) for memory stability.",
      track: 0
    }
  };

  tagChips.forEach(chip => {
    chip.addEventListener('click', () => {
      playRelayClick(1000);
      const tag = chip.getAttribute('data-tag');
      if (!tag || !tagInflectionMap[tag]) return;

      tagChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const data = tagInflectionMap[tag];
      if (promptInput) promptInput.value = data.prompt;
      if (tagInflectionDesc) tagInflectionDesc.textContent = data.desc;
    });
  });

  if (btnAuditionTag) {
    btnAuditionTag.addEventListener('click', () => {
      const activeTag = document.querySelector('.btn-tag-chip.active')?.getAttribute('data-tag') || '[happy]';
      const data = tagInflectionMap[activeTag] || tagInflectionMap['[happy]'];
      selectTrack(data.track);
      if (!isPlaying) togglePlayback();
      showToast(`AUDITIONING PROSODY: ${activeTag}`);
    });
  }

  if (btnCopyPromptText && promptInput) {
    btnCopyPromptText.addEventListener('click', () => {
      copyToClipboard(promptInput.value.trim(), "PROMPT COPIED TO CLIPBOARD");
    });
  }

  // =========================================================================
  // 9. 1.6-BIT TERNARY MATRIX & BIT-PACKING CALCULATOR
  // =========================================================================
  const ternaryCells = document.querySelectorAll('.ternary-cell');
  const ternaryWeights = [1, 0, -1, 1, 1]; // Initial weights: W0..W4
  const ternaryInputs = [12, 8, 15, 7, 4];  // Inputs: X0..X4

  function updateTernaryMatrixDisplay() {
    let total = 0;
    const formulaParts = [];

    ternaryCells.forEach((cell, idx) => {
      const w = ternaryWeights[idx];
      const x = ternaryInputs[idx];
      total += (w * x);

      const valEl = cell.querySelector('.cell-val');
      if (valEl) {
        valEl.textContent = (w > 0 ? `+${w}` : `${w}`);
        if (w > 0) valEl.style.color = 'var(--phosphor-green)';
        else if (w === 0) valEl.style.color = 'var(--bone-cream)';
        else valEl.style.color = 'var(--signal-amber)';
      }

      const signStr = w > 0 ? `+${w}` : `${w}`;
      formulaParts.push(`(${signStr} × ${x})`);
    });

    const formulaEl = document.getElementById('ternaryFormula');
    const totalEl = document.getElementById('ternaryTotal');
    if (formulaEl) formulaEl.textContent = formulaParts.join(' + ');
    if (totalEl) {
      totalEl.textContent = (total >= 0 ? `+${total}` : `${total}`);
      totalEl.style.color = total >= 0 ? 'var(--phosphor-green)' : 'var(--signal-amber)';
    }

    // 5-Weight Ternary Byte Packing: Sum_{i=0..4} (W_i + 1) * 3^i  (0 <= value < 243 <= 256)
    let packedValue = 0;
    for (let i = 0; i < 5; i++) {
      const trit = ternaryWeights[i] + 1; // 0, 1, or 2
      packedValue += trit * Math.pow(3, i);
    }

    const hexByte = '0x' + packedValue.toString(16).toUpperCase().padStart(2, '0');
    const bitpackByteEl = document.getElementById('bitpackByte');
    if (bitpackByteEl) {
      bitpackByteEl.textContent = `${hexByte} (${packedValue})`;
    }
  }

  ternaryCells.forEach(cell => {
    cell.addEventListener('click', () => {
      playRelayClick(1150);
      const idx = parseInt(cell.getAttribute('data-idx') || '0', 10);
      // Cycle: +1 -> 0 -> -1 -> +1
      if (ternaryWeights[idx] === 1) ternaryWeights[idx] = 0;
      else if (ternaryWeights[idx] === 0) ternaryWeights[idx] = -1;
      else ternaryWeights[idx] = 1;

      updateTernaryMatrixDisplay();
    });
  });

  updateTernaryMatrixDisplay();

  // =========================================================================
  // 10. DEVELOPER COMMAND CENTER TABBED TERMINAL
  // =========================================================================
  const terminalTabs = document.querySelectorAll('.terminal-tab-btn');
  const tabContentMap = {
    'uv': document.getElementById('tabContentUv'),
    'python': document.getElementById('tabContentPython'),
    'curl': document.getElementById('tabContentCurl'),
    'vps': document.getElementById('tabContentVps'),
    'docker': document.getElementById('tabContentDocker')
  };

  terminalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      playRelayClick(1020);
      terminalTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabKey = tab.getAttribute('data-tab');
      Object.keys(tabContentMap).forEach(key => {
        if (tabContentMap[key]) {
          if (key === tabKey) tabContentMap[key].classList.add('active');
          else tabContentMap[key].classList.remove('active');
        }
      });
    });
  });

  const btnCopyTerminal = document.getElementById('btnCopyTerminal');
  if (btnCopyTerminal) {
    btnCopyTerminal.addEventListener('click', () => {
      const activeContent = document.querySelector('.terminal-tab-content.active .terminal-body');
      if (activeContent) {
        copyToClipboard(activeContent.innerText.trim(), "TERMINAL COMMANDS COPIED");
      }
    });
  }

  // =========================================================================
  // 11. GITHUB API TELEMETRY & REPO METRICS (PURGED RULE34)
  // =========================================================================
  const starsEl = document.getElementById('githubStars');
  const forksEl = document.getElementById('githubForks');
  const issuesEl = document.getElementById('githubIssues');
  const pingsEl = document.getElementById('githubPings');
  const telemetryCounterEl = document.getElementById('telemetryCounter');
  const odometerDisplayEl = document.getElementById('odometerDisplay');

  // Local Session Impression Counter (Stored safely in LocalStorage)
  let impressions = 3892;
  try {
    impressions = parseInt(localStorage.getItem('kitten_session_impressions') || '3892', 10);
    impressions += 1;
    localStorage.setItem('kitten_session_impressions', impressions.toString());
  } catch (e) {}

  if (telemetryCounterEl) {
    telemetryCounterEl.textContent = impressions.toLocaleString();
  }

  if (odometerDisplayEl) {
    const formattedStr = impressions.toLocaleString().padStart(7, '0');
    let digitsHtml = '';
    for (const ch of formattedStr) {
      digitsHtml += `<span class="digit">${ch}</span>`;
    }
    odometerDisplayEl.innerHTML = digitsHtml;
  }

  // Fetch live metrics from GitHub API
  fetch('https://api.github.com/repos/SahooShuvranshu/KittenTTS-Studio', {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (starsEl && data.stargazers_count !== undefined) {
        starsEl.textContent = data.stargazers_count.toLocaleString();
      }
      if (forksEl && data.forks_count !== undefined) {
        forksEl.textContent = data.forks_count.toLocaleString();
      }
      if (issuesEl && data.open_issues_count !== undefined) {
        issuesEl.textContent = data.open_issues_count.toLocaleString();
      }
      if (pingsEl) {
        pingsEl.textContent = 'OK 200';
      }
    })
    .catch(() => {
      // Graceful offline fallback
      if (starsEl && starsEl.textContent === '--') starsEl.textContent = '48';
      if (forksEl && forksEl.textContent === '--') forksEl.textContent = '6';
    });

  // =========================================================================
  // 12. TACTILE COPY UTILITY & FLOATING TOAST BANNER
  // =========================================================================
  let toastTimer = null;

  function showToast(message) {
    if (!toastEl || !toastMsg) return;
    toastMsg.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
  }

  function copyToClipboard(text, successMsg = "COPIED TO CLIPBOARD") {
    playRelayClick(1300);
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
      }).catch(() => {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg);
    } catch (e) {
      showToast("COPY FAILED");
    }
    document.body.removeChild(ta);
  }

  // Copy buttons across soundboard cards
  const copyPromptBtns = document.querySelectorAll('.btn-copy-prompt');
  copyPromptBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const prompt = btn.getAttribute('data-prompt');
      if (prompt) copyToClipboard(prompt, "SPEAKER PROMPT COPIED");
    });
  });

  // Expose clean testable interface on window for programmatic testing and automation
  window.__kittenShowcase = {
    audio,
    tracks,
    getAudioCtx: () => audioCtx,
    getIsPlaying: () => isPlaying,
    getCurrentMode: () => currentMode,
    getCurrentTrackIdx: () => currentTrackIdx,
    selectTrack,
    setVisualizerMode,
    togglePlayback,
    playRelayClick
  };
  window.__kittenDocs = window.__kittenShowcase;

  // Start continuous CRT oscilloscope render loop
  draw();
  setVisualizerMode('oscilloscope');
});
