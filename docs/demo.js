/**
 * Kitten-TTS 2 Studio — GitHub Pages Showcase Interactive Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('demoCanvas');
  const ctx = canvas.getContext('2d');
  const playBtn = document.getElementById('demoPlayBtn');
  const trackTitle = document.getElementById('demoTrackTitle');

  let isPlaying = false;
  let animId = null;
  let phase = 0;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    width = rect.width;
    height = rect.height;
    draw();
  }

  let width = 600;
  let height = 100;
  window.addEventListener('resize', resize);
  resize();

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#181B22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();

    if (!isPlaying) {
      ctx.strokeStyle = '#2D3342';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.stroke();
      return;
    }

    // Oscilloscope wave animation in Studio Green
    ctx.strokeStyle = '#00E599';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const points = 120;
    const slice = width / points;

    for (let i = 0; i <= points; i++) {
      const x = i * slice;
      const angle = (i * 0.15) + phase;
      const amp = Math.sin(angle * 0.5) * 25 + Math.cos(angle * 1.8) * 12;
      const y = (height * 0.5) + amp;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    phase += 0.08;
    animId = requestAnimationFrame(draw);
  }

  // Interactive Audition Switcher
  const tracks = [
    { title: "Demo 1: Cloned Voice — Natural Speech (24kHz Mono)", duration: "00:06.4" },
    { title: "Demo 2: Cloned Voice — [whisper] Intimate Delivery", duration: "00:04.8" },
    { title: "Demo 3: Cloned Voice — <laugh> Event Syntax", duration: "00:05.2" }
  ];
  let currentTrackIdx = 0;

  playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      playBtn.textContent = '⏸ PAUSE';
      draw();
    } else {
      playBtn.textContent = '▶ AUDITION SYNTHESIS';
      if (animId) cancelAnimationFrame(animId);
      draw();
    }
  });

  document.querySelectorAll('.track-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      currentTrackIdx = idx;
      trackTitle.textContent = tracks[idx].title;
      document.getElementById('demoDuration').textContent = tracks[idx].duration;
      isPlaying = true;
      playBtn.textContent = '⏸ PAUSE';
      draw();
    });
  });
});
