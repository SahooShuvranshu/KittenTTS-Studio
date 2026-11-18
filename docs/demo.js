/**
 * Kitten-TTS 2 Studio — GitHub Pages Showcase Interactive Controller
 * Brutalist Retro-Futurist CRT Phosphor Oscilloscope & Real Audio Player
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('demoCanvas');
  const ctx = canvas.getContext('2d');
  const playBtn = document.getElementById('demoPlayBtn');
  const trackTitle = document.getElementById('demoTrackTitle');
  const trackDuration = document.getElementById('demoDuration');
  const trackMeta = document.querySelector('.track-meta-text');
  const trackBtns = document.querySelectorAll('.track-select-btn');

  let isPlaying = false;
  let animId = null;
  let phase = 0;
  let scanX = 0;
  let width = 600;
  let height = 130;

  // Real Audio Controller & Web Audio Analyser
  let audio = new Audio();
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let audioDataArray = null;

  const tracks = [
    { 
      title: "SAMPLE_01: REFERENCE_TIMBRE // NATURAL VOCAL DELIVERY (24kHz PCM)", 
      meta: "ACOUSTIC_SYNTHESIS // ZERO-SHOT CLONED FORMANT PROFILE",
      duration: "00:05.2",
      src: "assets/audio/sample_01.mp3"
    },
    { 
      title: "SAMPLE_02: EXPRESSION_MOD // [whisper] INTIMATE CLOSE-MIC PROXIMITY", 
      meta: "ACOUSTIC_SYNTHESIS // ATTENUATED VOCAL TRACT GLOTTAL CLOSURE",
      duration: "00:05.4",
      src: "assets/audio/sample_02.mp3"
    },
    { 
      title: "SAMPLE_03: VOCAL_BURST // <laugh> PARALINGUISTIC EVENT SYNTAX", 
      meta: "ACOUSTIC_SYNTHESIS // RHYTHMIC ASPIRATION AND PITCH PEAKS",
      duration: "00:08.9",
      src: "assets/audio/sample_03.mp3"
    }
  ];

  let currentTrackIdx = 0;
  audio.src = tracks[0].src;
  audio.preload = "auto";

  function initAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        sourceNode = audioCtx.createMediaElementSource(audio);
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
        audioDataArray = new Uint8Array(analyser.frequencyBinCount);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function resize() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    width = rect.width;
    height = rect.height;
    draw();
  }

  window.addEventListener('resize', resize);
  resize();

  function drawGraticule() {
    // Oscilloscope CRT Graticule Grid
    ctx.strokeStyle = '#0d2216';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const hDiv = 4;
    for (let i = 1; i < hDiv; i++) {
      const y = (height / hDiv) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical grid lines
    const vDiv = 10;
    for (let i = 1; i < vDiv; i++) {
      const x = (width / vDiv) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Center Crosshair
    ctx.strokeStyle = '#143823';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();

    // Center Tick Marks
    const tickStep = width / 20;
    for (let i = 0; i <= 20; i++) {
      const x = i * tickStep;
      ctx.beginPath();
      ctx.moveTo(x, (height * 0.5) - 3);
      ctx.lineTo(x, (height * 0.5) + 3);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawGraticule();

    if (!isPlaying) {
      // Idle CRT Sweep Line
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Moving CRT Phosphor Sweep Dot
      scanX = (scanX + 3) % width;
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(scanX, height * 0.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
      return;
    }

    // Active Synthesis Waveform
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    if (analyser && audioDataArray) {
      analyser.getByteTimeDomainData(audioDataArray);
      const sliceWidth = width / audioDataArray.length;
      let x = 0;

      for (let i = 0; i < audioDataArray.length; i++) {
        const v = audioDataArray[i] / 128.0; // 0.0 to 2.0
        const y = v * (height * 0.5);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
    } else {
      // Harmonic Formant Waveform fallback if Web Audio is restricted
      const points = 160;
      const slice = width / points;

      for (let i = 0; i <= points; i++) {
        const x = i * slice;
        const angle = (i * 0.12) + phase;
        
        const harmonic1 = Math.sin(angle * 0.6) * 24;
        const harmonic2 = Math.sin(angle * 1.7 + phase * 0.8) * 11;
        const formant3  = Math.cos(angle * 3.4 - phase * 0.4) * 6;
        const microJitter = Math.sin(angle * 7.2) * 2;

        const y = (height * 0.5) + harmonic1 + harmonic2 + formant3 + microJitter;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      phase += 0.08;
    }

    ctx.stroke();
    ctx.restore();

    animId = requestAnimationFrame(draw);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds <= 0) return "00:00.0";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
  }

  audio.addEventListener('timeupdate', () => {
    if (isPlaying && !isNaN(audio.currentTime) && audio.currentTime > 0) {
      trackDuration.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('ended', () => {
    isPlaying = false;
    playBtn.textContent = '▶ AUDITION SYNTHESIS';
    playBtn.classList.remove('btn-amber');
    playBtn.classList.add('btn-green');
    trackDuration.textContent = tracks[currentTrackIdx].duration;
    if (animId) cancelAnimationFrame(animId);
    draw();
  });

  audio.addEventListener('error', (e) => {
    console.warn("Audio playback error, falling back to simulated synth trace:", e);
  });

  playBtn.addEventListener('click', () => {
    try {
      initAudioContext();
    } catch (e) {
      console.warn("Web Audio initialization:", e);
    }

    isPlaying = !isPlaying;
    if (isPlaying) {
      playBtn.textContent = '⏸ PAUSE SYNTHESIS';
      playBtn.classList.remove('btn-green');
      playBtn.classList.add('btn-amber');
      audio.play().catch(err => {
        console.warn("Autoplay restriction or missing codec, simulating oscilloscope trace:", err);
      });
      if (animId) cancelAnimationFrame(animId);
      draw();
    } else {
      playBtn.textContent = '▶ AUDITION SYNTHESIS';
      playBtn.classList.remove('btn-amber');
      playBtn.classList.add('btn-green');
      audio.pause();
      trackDuration.textContent = tracks[currentTrackIdx].duration;
      if (animId) cancelAnimationFrame(animId);
      draw();
    }
  });

  trackBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      if (tracks[idx]) {
        currentTrackIdx = idx;
        trackTitle.textContent = tracks[idx].title;
        if (trackMeta) trackMeta.textContent = tracks[idx].meta;
        trackDuration.textContent = tracks[idx].duration;
        audio.src = tracks[idx].src;

        if (isPlaying) {
          audio.currentTime = 0;
          audio.play().catch(err => console.warn(err));
        }
      }
      trackBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
