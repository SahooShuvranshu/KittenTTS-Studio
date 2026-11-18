/**
 * Kitten-TTS 2 Studio — GitHub Pages Showcase Interactive Controller
 * Brutalist Retro-Futurist CRT Phosphor Oscilloscope Visualizer
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('demoCanvas');
  const ctx = canvas.getContext('2d');
  const playBtn = document.getElementById('demoPlayBtn');
  const trackTitle = document.getElementById('demoTrackTitle');
  const trackDuration = document.getElementById('demoDuration');

  let isPlaying = false;
  let animId = null;
  let phase = 0;
  let scanX = 0;
  let width = 600;
  let height = 130;

  function resize() {
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

    // Active Synthesis: Harmonic Formant Waveform
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const points = 160;
    const slice = width / points;

    for (let i = 0; i <= points; i++) {
      const x = i * slice;
      const angle = (i * 0.12) + phase;
      
      // Superposition of fundamental pitch + formant harmonics + voice jitter
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
    ctx.stroke();
    ctx.restore();

    phase += 0.08;
    animId = requestAnimationFrame(draw);
  }

  // Interactive Audition Switcher
  const tracks = [
    { 
      title: "SAMPLE_01: REFERENCE_TIMBRE // NATURAL VOCAL DELIVERY (24kHz PCM)", 
      meta: "ACOUSTIC_SYNTHESIS // ZERO-SHOT CLONED FORMANT PROFILE",
      duration: "00:06.4" 
    },
    { 
      title: "SAMPLE_02: EXPRESSION_MOD // [whisper] INTIMATE CLOSE-MIC PROXIMITY", 
      meta: "ACOUSTIC_SYNTHESIS // ATTENUATED VOCAL TRACT GLOTTAL CLOSURE",
      duration: "00:04.8" 
    },
    { 
      title: "SAMPLE_03: VOCAL_BURST // <laugh> PARALINGUISTIC EVENT SYNTAX", 
      meta: "ACOUSTIC_SYNTHESIS // RHYTHMIC ASPIRATION AND PITCH PEAKS",
      duration: "00:05.2" 
    }
  ];

  playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      playBtn.textContent = '⏸ PAUSE SYNTHESIS';
      playBtn.classList.remove('btn-green');
      playBtn.classList.add('btn-amber');
      if (animId) cancelAnimationFrame(animId);
      draw();
    } else {
      playBtn.textContent = '▶ AUDITION SYNTHESIS';
      playBtn.classList.remove('btn-amber');
      playBtn.classList.add('btn-green');
      if (animId) cancelAnimationFrame(animId);
      draw();
    }
  });

  const trackBtns = document.querySelectorAll('.track-select-btn');
  const trackMeta = document.querySelector('.track-meta-text');

  trackBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      if (tracks[idx]) {
        trackTitle.textContent = tracks[idx].title;
        if (trackMeta) trackMeta.textContent = tracks[idx].meta;
        trackDuration.textContent = tracks[idx].duration;
      }
      trackBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
