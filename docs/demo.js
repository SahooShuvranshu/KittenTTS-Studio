/**
 * Kitten-TTS 2 Studio — Acoustic Neural Speech Synthesizer Showcase
 * Interactive Audio Workstation Controller & CRT Visualizer (docs/demo.js)
 *
 * Implements:
 * 1. Web Audio API AudioContext & AnalyserNode pipeline (fftSize: 512).
 * 2. Dual Visualizer Modes:
 *    - Mode A (Default): CRT Phosphor Oscilloscope (time-domain waveform trace).
 *    - Mode B: Real-Time Frequency Spectrum (animated FFT frequency bars with peak hold decay).
 * 3. Smooth CRT idle sweep line and moving phosphor dot when paused.
 * 4. Seamless auditioning across the 3 audio tracks (Natural, Whisper, Laugh) with automatic WAV fallback.
 * 5. Dynamic timecode tracking (MM:SS.s / duration), play/pause toggling, and auto-reset on completion.
 * 6. Graceful fallback: simulated acoustic formant synthesis if Web Audio or Autoplay is restricted.
 * 7. Interactive mode toggling via mode badge, canvas click, or keyboard shortcut ('v' / 'm').
 * 8. Interactive clipboard copy for terminal and curl snippets.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const canvas = document.getElementById('demoCanvas');
  if (!canvas) {
    console.warn('[demo.js] Canvas element #demoCanvas not found.');
    return;
  }

  const ctx = canvas.getContext('2d');
  const playBtn = document.getElementById('demoPlayBtn');
  const trackTitle = document.getElementById('demoTrackTitle');
  const trackDuration = document.getElementById('demoDuration');
  const trackMeta = document.querySelector('.track-meta-text');
  const trackBtns = document.querySelectorAll('.track-select-btn');
  const modeBadge = document.getElementById('demoModeBadge') || document.querySelector('.demo-mode-badge');
  const scopeScale = document.querySelector('.scope-scale');
  const scopeFreq = document.querySelector('.scope-freq');
  const canvasBox = canvas.closest('.demo-canvas-box') || canvas.parentElement;

  // Visualizer Dimensions & Animation State
  let width = 600;
  let height = 130;
  let animId = null;
  let isPlaying = false;
  let currentMode = 'oscilloscope'; // 'oscilloscope' (Mode A) | 'spectrum' (Mode B)
  let scanX = 0;
  let phase = 0;
  let simulatedTime = 0;

  // Spectrum peak-hold indicators
  const NUM_SPECTRUM_BARS = 56;
  const peakBars = new Float32Array(NUM_SPECTRUM_BARS);
  const PEAK_DECAY = 0.94;

  // Web Audio Context & Node References
  let audio = new Audio();
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let isSourceConnected = false;
  let timeDomainData = null; // Uint8Array(512)
  let freqData = null;       // Uint8Array(256)
  let usingFallbackSrc = false;

  // Audio Tracks Configuration
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

  // Initialize initial audio source
  audio.preload = "auto";
  audio.crossOrigin = "anonymous";
  audio.src = tracks[0].src;

  // Initialize Web Audio API pipeline
  function initAudioContext() {
    if (!audioCtx) {
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512; // 256 frequency bins, 512 time-domain samples
          analyser.smoothingTimeConstant = 0.78;

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
        console.warn("[demo.js] Web Audio initialization note:", err);
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  // Responsive High-DPI Canvas Resizing
  function resize() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height || 130;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    if (ctx.setTransform) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      ctx.scale(dpr, dpr);
    }
  }

  window.addEventListener('resize', resize);
  resize();

  // Mode Toggling & UI Label Synchronization
  function setVisualizerMode(newMode) {
    currentMode = newMode;

    if (modeBadge) {
      if (currentMode === 'oscilloscope') {
        modeBadge.textContent = 'CRT PHOSPHOR 50Hz';
        modeBadge.style.color = 'var(--signal-amber, #ff8800)';
        modeBadge.title = 'Click to switch to Real-Time FFT Spectrum Mode';
      } else {
        modeBadge.textContent = 'FFT SPECTRUM 512-BIN';
        modeBadge.style.color = 'var(--phosphor-green, #00ff88)';
        modeBadge.title = 'Click to switch to CRT Oscilloscope Waveform Mode';
      }
    }

    if (scopeScale) {
      if (currentMode === 'oscilloscope') {
        scopeScale.innerHTML = '<span>+1.0V</span><span>0.0V</span><span>-1.0V</span>';
      } else {
        scopeScale.innerHTML = '<span>0 dB</span><span>-18 dB</span><span>-36 dB</span>';
      }
    }

    if (scopeFreq) {
      if (currentMode === 'oscilloscope') {
        scopeFreq.textContent = 'TRACE // CH-A 24.0 kHz';
      } else {
        scopeFreq.textContent = 'SPECTRUM // FFT 0-12.0 kHz';
      }
    }
  }

  function toggleVisualizerMode() {
    const nextMode = (currentMode === 'oscilloscope') ? 'spectrum' : 'oscilloscope';
    setVisualizerMode(nextMode);
  }

  // Interactive toggle listeners
  if (modeBadge) {
    modeBadge.style.cursor = 'pointer';
    modeBadge.title = 'Click to switch visualizer mode (Oscilloscope / Spectrum)';
    modeBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleVisualizerMode();
    });
  }

  if (canvasBox) {
    canvasBox.style.cursor = 'crosshair';
    canvasBox.addEventListener('click', () => {
      toggleVisualizerMode();
    });
  }

  // Keyboard shortcut listener ('v' or 'm' toggles mode, space toggles playback)
  window.addEventListener('keydown', (e) => {
    // Avoid capturing inputs inside text inputs or textareas
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.key === 'v' || e.key === 'V' || e.key === 'm' || e.key === 'M') {
      toggleVisualizerMode();
    }
  });

  // Oscilloscope & Spectrum Graticule Grid
  function drawGraticule() {
    // Dark CRT interior background
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 1;

    if (currentMode === 'oscilloscope') {
      // Oscilloscope horizontal division lines
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
      const hDiv = 4;
      for (let i = 1; i < hDiv; i++) {
        const y = (height / hDiv) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical graticule divisions
      const vDiv = 10;
      for (let i = 1; i < vDiv; i++) {
        const x = (width / vDiv) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Center calibration crosshair
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.stroke();

      // Precision calibration tick marks
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
    } else {
      // Spectrum Analyzer dB Grid Lines
      ctx.strokeStyle = 'rgba(255, 136, 0, 0.08)';
      const dbSteps = [0.25, 0.5, 0.75];
      for (const ratio of dbSteps) {
        const y = height * ratio;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Frequency Band Division Lines (1 kHz, 3 kHz, 6 kHz, 9 kHz)
      const freqSteps = [0.125, 0.25, 0.5, 0.75];
      for (const ratio of freqSteps) {
        const x = width * ratio;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Baseline floor axis
      ctx.strokeStyle = 'rgba(255, 136, 0, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height - 1);
      ctx.lineTo(width, height - 1);
      ctx.stroke();
    }
  }

  // Check if Web Audio Analyser is returning live audio data
  function hasLiveAudioData(array) {
    if (!array || array.length === 0) return false;
    // For time domain, 128 is silence. For frequency, 0 is silence.
    if (currentMode === 'oscilloscope') {
      let variance = 0;
      for (let i = 0; i < array.length; i += 8) {
        variance += Math.abs(array[i] - 128);
        if (variance > 10) return true;
      }
      return false;
    } else {
      let energy = 0;
      for (let i = 0; i < array.length; i += 4) {
        energy += array[i];
        if (energy > 20) return true;
      }
      return false;
    }
  }

  // Primary Animation Render Loop
  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawGraticule();

    // ==========================================
    // IDLE STATE (PAUSED / STOPPED)
    // ==========================================
    if (!isPlaying) {
      if (currentMode === 'oscilloscope') {
        // Idle CRT Reference Sweep Line
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.40)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, height * 0.5);
        ctx.lineTo(width, height * 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        // Moving CRT Phosphor Sweep Dot
        scanX = (scanX + 3.2) % width;
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(scanX, height * 0.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Idle Spectrum Mode: Baseline Floor Noise & RF Idling
        const barWidth = (width / NUM_SPECTRUM_BARS) - 1.5;
        ctx.fillStyle = 'rgba(0, 255, 136, 0.28)';

        for (let i = 0; i < NUM_SPECTRUM_BARS; i++) {
          const x = i * (barWidth + 1.5) + 1;
          const noise = Math.sin((i * 0.35) + phase) * 1.5 + 2.5;
          ctx.fillRect(x, height - noise, barWidth, noise);

          // Decay any residual peaks
          peakBars[i] = Math.max(0, peakBars[i] * PEAK_DECAY);
        }
        phase += 0.05;
      }

      animId = requestAnimationFrame(draw);
      return;
    }

    // ==========================================
    // ACTIVE PLAYBACK STATE
    // ==========================================
    if (currentMode === 'oscilloscope') {
      // ----------------------------------------
      // MODE A: CRT PHOSPHOR OSCILLOSCOPE
      // ----------------------------------------
      ctx.save();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 8;
      ctx.beginPath();

      let liveDataAvailable = false;
      if (analyser && timeDomainData) {
        analyser.getByteTimeDomainData(timeDomainData);
        liveDataAvailable = hasLiveAudioData(timeDomainData);
      }

      if (liveDataAvailable) {
        // Real-Time Web Audio Time-Domain Waveform Trace
        const sliceWidth = width / timeDomainData.length;
        let x = 0;

        for (let i = 0; i < timeDomainData.length; i++) {
          const v = timeDomainData[i] / 128.0; // 0.0 to 2.0 (1.0 = center)
          const y = v * (height * 0.5);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
      } else {
        // Graceful Fallback: Simulated Harmonic Speech Formant Waves
        const points = 160;
        const slice = width / points;
        const syllabicEnvelope = 0.6 + 0.4 * Math.sin(simulatedTime * 4.2);

        for (let i = 0; i <= points; i++) {
          const x = i * slice;
          const angle = (i * 0.13) + phase;

          // Fundamental pitch + Formant 1 + Formant 2 + micro-jitter
          const h1 = Math.sin(angle * 0.65) * 25 * syllabicEnvelope;
          const h2 = Math.sin(angle * 1.75 + phase * 0.8) * 12 * syllabicEnvelope;
          const f3 = Math.cos(angle * 3.5 - phase * 0.4) * 6;
          const microJitter = (Math.random() - 0.5) * 2.2;

          const y = (height * 0.5) + h1 + h2 + f3 + microJitter;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        phase += 0.085;
        simulatedTime += 0.016;
      }

      ctx.stroke();
      ctx.restore();

    } else {
      // ----------------------------------------
      // MODE B: REAL-TIME FREQUENCY SPECTRUM
      // ----------------------------------------
      ctx.save();
      const barWidth = Math.max(2, (width / NUM_SPECTRUM_BARS) - 1.5);
      const binStep = analyser ? Math.floor(analyser.frequencyBinCount / NUM_SPECTRUM_BARS) : 4;

      let liveDataAvailable = false;
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        liveDataAvailable = hasLiveAudioData(freqData);
      }

      for (let i = 0; i < NUM_SPECTRUM_BARS; i++) {
        const x = i * (barWidth + 1.5) + 1;
        let barHeight = 0;

        if (liveDataAvailable) {
          // Average energy across binStep frequency bins
          let sum = 0;
          for (let j = 0; j < binStep; j++) {
            const idx = (i * binStep) + j;
            if (idx < freqData.length) sum += freqData[idx];
          }
          const avg = sum / binStep;
          barHeight = (avg / 255.0) * (height - 8);
        } else {
          // Simulated vocal formant spectral distribution
          const formant1 = Math.exp(-Math.pow(i - 8, 2) / 18) * 0.9;
          const formant2 = Math.exp(-Math.pow(i - 22, 2) / 32) * 0.75;
          const formant3 = Math.exp(-Math.pow(i - 36, 2) / 40) * 0.5;
          const rolloff = Math.max(0.08, 1.0 - (i / NUM_SPECTRUM_BARS));
          const syllabicMod = 0.55 + 0.45 * Math.sin(simulatedTime * 4.2);
          const jitter = (Math.random() * 0.12);

          const composite = (formant1 + formant2 + formant3 + jitter) * rolloff * syllabicMod;
          barHeight = Math.min(height - 8, composite * (height - 8));
        }

        barHeight = Math.max(2, barHeight);

        // Peak Hold Calculation with Gravity Decay
        if (barHeight > peakBars[i]) {
          peakBars[i] = barHeight;
        } else {
          peakBars[i] = Math.max(barHeight, peakBars[i] * PEAK_DECAY);
        }

        // Tactical Multi-Zone Color Styling
        const amplitudeRatio = barHeight / (height - 8);
        if (amplitudeRatio > 0.82) {
          ctx.fillStyle = '#ff5722'; // Peak Alert Orange
          ctx.shadowColor = '#ff5722';
          ctx.shadowBlur = 6;
        } else if (amplitudeRatio > 0.55) {
          ctx.fillStyle = '#ff8800'; // Mid Signal Amber
          ctx.shadowColor = '#ff8800';
          ctx.shadowBlur = 4;
        } else {
          ctx.fillStyle = '#00ff88'; // Phosphor Green
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 2;
        }

        // Draw frequency spectrum bar
        const y = height - barHeight;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Draw floating peak indicator tick
        const peakY = height - peakBars[i];
        ctx.fillStyle = '#ff8800';
        ctx.shadowBlur = 0;
        ctx.fillRect(x, peakY - 1.5, barWidth, 1.5);
      }

      if (!liveDataAvailable) {
        simulatedTime += 0.016;
      }

      ctx.restore();
    }

    animId = requestAnimationFrame(draw);
  }

  // Format seconds into digital laboratory timecode MM:SS.s
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds <= 0) return "00:00.0";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
  }

  // Audio Event Listeners for Dynamic Timecode Tracking
  audio.addEventListener('timeupdate', () => {
    if (isPlaying && !isNaN(audio.currentTime) && audio.currentTime > 0) {
      if (trackDuration) {
        trackDuration.textContent = formatTime(audio.currentTime);
      }
    }
  });

  // Auto-Reset when audio ends
  audio.addEventListener('ended', () => {
    isPlaying = false;
    if (playBtn) {
      playBtn.textContent = '▶ AUDITION SYNTHESIS';
      playBtn.classList.remove('btn-amber');
      playBtn.classList.add('btn-green');
    }
    if (trackDuration) {
      trackDuration.textContent = tracks[currentTrackIdx].duration;
    }
    audio.currentTime = 0;
  });

  // Resilient Audio Error Handling & WAV Fallback
  audio.addEventListener('error', (e) => {
    console.warn(`[demo.js] Audio load error on ${audio.src}:`, e);
    if (!usingFallbackSrc && tracks[currentTrackIdx].fallbackSrc) {
      console.info(`[demo.js] Attempting fallback to ${tracks[currentTrackIdx].fallbackSrc}`);
      usingFallbackSrc = true;
      audio.src = tracks[currentTrackIdx].fallbackSrc;
      if (isPlaying) {
        audio.play().catch(err => console.warn('[demo.js] Fallback play notice:', err));
      }
    }
  });

  // Play / Pause Toggle Controller
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      initAudioContext();

      isPlaying = !isPlaying;

      if (isPlaying) {
        playBtn.textContent = '⏸ PAUSE SYNTHESIS';
        playBtn.classList.remove('btn-green');
        playBtn.classList.add('btn-amber');

        audio.play().catch(err => {
          console.warn("[demo.js] Autoplay restriction or audio playback notice:", err);
          // Visualizer will continue in simulated formant mode smoothly
        });
      } else {
        playBtn.textContent = '▶ AUDITION SYNTHESIS';
        playBtn.classList.remove('btn-amber');
        playBtn.classList.add('btn-green');
        audio.pause();
        if (trackDuration) {
          trackDuration.textContent = tracks[currentTrackIdx].duration;
        }
      }
    });
  }

  // Seamless Track Auditioning
  function selectTrack(idx) {
    if (!tracks[idx]) return;

    currentTrackIdx = idx;
    usingFallbackSrc = false;

    if (trackTitle) trackTitle.textContent = tracks[idx].title;
    if (trackMeta) trackMeta.textContent = tracks[idx].meta;
    if (trackDuration) trackDuration.textContent = tracks[idx].duration;

    audio.src = tracks[idx].src;
    audio.load();

    if (isPlaying) {
      audio.currentTime = 0;
      audio.play().catch(err => console.warn('[demo.js] Track switch play notice:', err));
    }

    // Synchronize UI active button states
    trackBtns.forEach(btn => {
      const btnIdx = parseInt(btn.getAttribute('data-idx'), 10);
      if (btnIdx === idx) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Track Selector Button Clicks
  trackBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (!isNaN(idx)) {
        selectTrack(idx);
      }
    });
  });

  // Start continuous CRT animation loop
  draw();

  // Initialize visualizer mode labels
  setVisualizerMode('oscilloscope');

  // ==========================================
  // CLIPBOARD COPY UTILITIES FOR CODE BLOCKS
  // ==========================================
  const copyButtons = document.querySelectorAll('.copy-btn, [data-copy]');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSelector = btn.getAttribute('data-copy-target') || btn.getAttribute('data-copy');
      let textToCopy = '';

      if (targetSelector) {
        const targetEl = document.querySelector(targetSelector);
        textToCopy = targetEl ? targetEl.innerText.trim() : '';
      } else {
        const parentBlock = btn.closest('.terminal-block, .curl-box, pre');
        if (parentBlock) {
          const codeEl = parentBlock.querySelector('code, .terminal-body, pre');
          textToCopy = codeEl ? codeEl.innerText.trim() : parentBlock.innerText.trim();
        }
      }

      if (textToCopy && navigator.clipboard) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalText = btn.textContent;
          btn.textContent = 'COPIED!';
          btn.classList.add('btn-green');
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('btn-green');
          }, 2000);
        }).catch(err => {
          console.warn('[demo.js] Clipboard copy failed:', err);
        });
      }
    });
  });
});
