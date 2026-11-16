/**
 * Kitten-TTS 2 Studio — GitHub Pages Showcase Interactive Controller
 * Cute Brutalist Oscilloscope Demo
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
  let width = 600;
  let height = 110;

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

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Grid line
    ctx.strokeStyle = '#181b28';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();

    if (!isPlaying) {
      // Idle dashed center line with cute pink tint
      ctx.strokeStyle = '#ff70a6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    // Oscilloscope wave animation with Cute Brutalist Mint-to-Pink gradient
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#00f59b');
    grad.addColorStop(0.5, '#fff9e6');
    grad.addColorStop(1, '#ff70a6');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff70a6';
    ctx.shadowBlur = 6;
    ctx.beginPath();

    const points = 120;
    const slice = width / points;

    for (let i = 0; i <= points; i++) {
      const x = i * slice;
      const angle = (i * 0.15) + phase;
      const amp = Math.sin(angle * 0.5) * 28 + Math.cos(angle * 1.8) * 14;
      const y = (height * 0.5) + amp;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    phase += 0.08;
    animId = requestAnimationFrame(draw);
  }

  // Interactive Audition Switcher
  const tracks = [
    { title: "Demo 1: Cloned Voice — Natural Speech (24kHz Mono)", duration: "00:06.4" },
    { title: "Demo 2: Cloned Voice — [whisper] Intimate Delivery", duration: "00:04.8" },
    { title: "Demo 3: Cloned Voice — <laugh> Event Syntax", duration: "00:05.2" }
  ];

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
      if (tracks[idx]) {
        trackTitle.textContent = tracks[idx].title;
        trackDuration.textContent = tracks[idx].duration;
      }
      document.querySelectorAll('.track-select-btn').forEach(b => {
        b.style.borderColor = 'var(--border-dark)';
        b.style.backgroundColor = 'var(--bg-surface-raised)';
        b.style.color = 'var(--text-primary)';
      });
      btn.style.borderColor = 'var(--border-dark)';
      btn.style.backgroundColor = 'var(--kitty-pink)';
      btn.style.color = '#000000';
    });
  });
});
