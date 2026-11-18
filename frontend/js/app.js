/**
 * Kitten-TTS 2 Studio — Core Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const audioPlayer = document.getElementById('audioPlayer');
  const playBtn = document.getElementById('playBtn');
  const scrubber = document.getElementById('scrubber');
  const currentTimeLabel = document.getElementById('currentTime');
  const totalTimeLabel = document.getElementById('totalTime');
  const downloadLink = document.getElementById('downloadLink');

  const textInput = document.getElementById('textPrompt');
  const charCounter = document.getElementById('charCount');
  const synthesizeBtn = document.getElementById('synthesizeBtn');
  const speedSelect = document.getElementById('speedSelect');
  const latencyBadge = document.getElementById('latencyBadge');

  const profileList = document.getElementById('profileList');
  const activeVoiceName = document.getElementById('activeVoiceName');
  const resetVoiceBtn = document.getElementById('resetVoiceBtn');

  if (resetVoiceBtn) {
    resetVoiceBtn.addEventListener('click', () => {
      selectedProfileId = null;
      localStorage.removeItem('kitten_tts_selected_profile');
      if (activeVoiceName) activeVoiceName.textContent = 'None (Default / Uploaded)';
      document.querySelectorAll('.profile-card').forEach(el => {
        el.classList.remove('selected');
        const b = el.querySelector('.tabular');
        if (b && b.textContent === 'ACTIVE') b.remove();
      });
      showToast('Cleared voice selection. Using default or uploaded audio.');
    });
  }

  // File Upload Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('audioFileInput');
  const uploadPreview = document.getElementById('uploadPreview');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const profileNameInput = document.getElementById('profileNameInput');

  // Recording Elements
  const recBtn = document.getElementById('recBtn');
  const recTime = document.getElementById('recTime');
  const recIndicator = document.getElementById('recIndicator');
  const vuMeterBar = document.getElementById('vuMeterBar');
  const recPreview = document.getElementById('recPreview');
  const saveRecProfileBtn = document.getElementById('saveRecProfileBtn');
  const recProfileNameInput = document.getElementById('recProfileNameInput');

  // State
  let selectedProfileId = null;
  let activeAudioUrl = null;
  let currentUploadedSample = null; // { filename, metadata }
  let currentRecordedBlob = null;

  // Initialize Oscilloscope Visualizer
  const visualizer = new OscilloscopeVisualizer('oscilloscopeCanvas', audioPlayer);

  // Initialize Recorder
  const recorder = new StudioRecorder({
    onStateChange: (state, err) => {
      if (state === 'recording') {
        recBtn.textContent = '⏹ STOP RECORDING';
        recBtn.classList.add('btn-danger');
        recIndicator.classList.add('active');
        recPreview.style.display = 'none';
      } else if (state === 'idle') {
        recBtn.textContent = '🎙 START RECORDING';
        recBtn.classList.remove('btn-danger');
        recIndicator.classList.remove('active');
      } else if (state === 'error') {
        showToast('Microphone error: ' + err);
      }
    },
    onTimeUpdate: (timeStr) => {
      recTime.textContent = timeStr;
    },
    onLevelUpdate: (level) => {
      vuMeterBar.style.width = level + '%';
    },
    onRecorded: async (blob) => {
      currentRecordedBlob = blob;
      recPreview.style.display = 'flex';
      const tempAudioUrl = URL.createObjectURL(blob);
      document.getElementById('recAudioPreview').src = tempAudioUrl;
    }
  });

  recBtn.addEventListener('click', () => {
    if (recorder.isRecording) {
      recorder.stop();
    } else {
      recorder.start();
    }
  });

  // Save Recorded Voice Profile
  saveRecProfileBtn.addEventListener('click', async () => {
    if (!currentRecordedBlob) return;
    const name = recProfileNameInput.value.trim() || 'My Voice Recording';
    const formData = new FormData();
    formData.append('file', currentRecordedBlob, 'recorded_voice.webm');
    formData.append('name', name);
    formData.append('description', 'Live browser recording');

    try {
      saveRecProfileBtn.textContent = 'SAVING...';
      const res = await fetch('/api/profiles/record', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Profile "${name}" created.`);
        recPreview.style.display = 'none';
        currentRecordedBlob = null;
        recProfileNameInput.value = '';
        await loadProfiles();
        selectProfile(data.id);
      } else {
        showToast('Failed to save profile: ' + (data.detail || 'Error'));
      }
    } catch (e) {
      showToast('Error uploading recording: ' + e.message);
    } finally {
      saveRecProfileBtn.textContent = 'SAVE AS VOICE PROFILE';
    }
  });

  // ==================== TABS ====================
  const tabUpload = document.getElementById('tabUpload');
  const tabRecord = document.getElementById('tabRecord');
  const viewUpload = document.getElementById('viewUpload');
  const viewRecord = document.getElementById('viewRecord');

  tabUpload.addEventListener('click', () => {
    tabUpload.classList.add('active');
    tabRecord.classList.remove('active');
    viewUpload.style.display = 'flex';
    viewRecord.style.display = 'none';
  });

  tabRecord.addEventListener('click', () => {
    tabRecord.classList.add('active');
    tabUpload.classList.remove('active');
    viewRecord.style.display = 'flex';
    viewUpload.style.display = 'none';
  });

  // ==================== DRAG & DROP UPLOAD ====================
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast('Processing audio sample...');
      const res = await fetch('/api/upload-sample', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        currentUploadedSample = data;
        uploadPreview.style.display = 'flex';
        document.getElementById('uploadFileName').textContent = data.original_filename;
        document.getElementById('uploadFileMeta').textContent = `${data.duration}s • 24kHz Mono WAV • ${data.size_kb} KB`;
        document.getElementById('uploadAudioPreview').src = `/api/audio/${data.filename}?temp=1`;
        profileNameInput.value = file.name.replace(/\.[^/.]+$/, "");
        showToast('Sample processed and ready.');
      } else {
        showToast('Upload failed: ' + (data.detail || 'Unknown error'));
      }
    } catch (e) {
      showToast('Error uploading: ' + e.message);
    }
  }

  saveProfileBtn.addEventListener('click', async () => {
    if (!currentUploadedSample) return;
    const name = profileNameInput.value.trim() || 'Uploaded Voice';
    try {
      saveProfileBtn.textContent = 'SAVING...';
      const res = await fetch('/api/profiles/save-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currentUploadedSample.filename,
          name: name,
          description: `Uploaded from ${currentUploadedSample.original_filename}`
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Profile "${name}" saved.`);
        uploadPreview.style.display = 'none';
        currentUploadedSample = null;
        await loadProfiles();
        selectProfile(data.id);
      } else {
        showToast('Failed to save profile: ' + (data.detail || 'Error'));
      }
    } catch (e) {
      showToast('Error: ' + e.message);
    } finally {
      saveProfileBtn.textContent = 'SAVE AS VOICE PROFILE';
    }
  });

  // ==================== PROFILES ====================
  async function loadProfiles() {
    try {
      const res = await fetch('/api/profiles');
      const profiles = await res.json();
      profileList.innerHTML = '';

      if (profiles.length === 0) {
        profileList.innerHTML = '<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;padding:8px;">No voice profiles saved yet. Upload or record a 5-30s sample above.</div>';
        selectedProfileId = null;
        if (activeVoiceName) activeVoiceName.textContent = 'None (Default / Uploaded)';
        return;
      }

      // Check localStorage for remembered profile
      const rememberedId = localStorage.getItem('kitten_tts_selected_profile');
      let foundRemembered = false;

      profiles.forEach(p => {
        const isSelected = p.id === selectedProfileId || (selectedProfileId === null && p.id === rememberedId);
        if (isSelected) {
          selectedProfileId = p.id;
          foundRemembered = true;
          if (activeVoiceName) activeVoiceName.textContent = p.name;
        }

        const card = document.createElement('div');
        card.className = 'profile-card' + (isSelected ? ' selected' : '');
        card.setAttribute('data-id', p.id);
        card.innerHTML = `
          <div class="profile-info">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="profile-name">${p.name}</span>
              ${isSelected ? '<span class="tabular" style="font-size:9px;background:var(--accent-meter-bg);color:var(--accent-meter);padding:1px 4px;border-radius:2px;font-weight:600;">ACTIVE</span>' : ''}
            </div>
            <span class="profile-meta">${p.description ? p.description + ' • ' : ''}${p.duration}s • 24kHz</span>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-tag" style="padding:2px 6px;" title="Preview Audio" onclick="event.stopPropagation(); window.playProfileAudio('${p.filename}')">▶</button>
            <button class="btn btn-tag" style="padding:2px 6px;" title="Rename Profile" onclick="event.stopPropagation(); window.renameProfile('${p.id}', '${p.name.replace(/'/g, "\\'")}')">✏</button>
            <button class="btn btn-tag btn-danger" style="padding:2px 6px;" title="Delete" onclick="event.stopPropagation(); window.deleteProfile('${p.id}')">✕</button>
          </div>
        `;
        card.addEventListener('click', () => selectProfile(p.id, p.name));
        profileList.appendChild(card);
      });

      if (!foundRemembered && selectedProfileId === null && profiles.length > 0) {
        // Automatically select first profile if none remembered
        selectProfile(profiles[0].id, profiles[0].name, false);
      }
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
  }

  function selectProfile(id, name, notify = true) {
    selectedProfileId = id;
    localStorage.setItem('kitten_tts_selected_profile', id);
    if (activeVoiceName) {
      activeVoiceName.textContent = name || id;
    }
    document.querySelectorAll('.profile-card').forEach(el => {
      if (el.getAttribute('data-id') === id) {
        el.classList.add('selected');
        // add active badge if not present
        if (!el.innerHTML.includes('ACTIVE')) {
          const nameSpan = el.querySelector('.profile-name');
          if (nameSpan && nameSpan.parentElement) {
            const badge = document.createElement('span');
            badge.className = 'tabular';
            badge.style.cssText = 'font-size:9px;background:var(--accent-meter-bg);color:var(--accent-meter);padding:1px 4px;border-radius:2px;font-weight:600;';
            badge.textContent = 'ACTIVE';
            nameSpan.parentElement.appendChild(badge);
          }
        }
      } else {
        el.classList.remove('selected');
        const activeBadge = el.querySelector('span[style*="ACTIVE"], .tabular');
        if (activeBadge && activeBadge.textContent === 'ACTIVE') {
          activeBadge.remove();
        }
      }
    });
    if (notify) {
      showToast(`Armed profile: ${name || id}`);
    }
  }

  window.renameProfile = async (id, currentName) => {
    const newName = prompt('Enter new name for this voice profile:', currentName);
    if (!newName || newName.trim() === '' || newName.trim() === currentName) return;
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (res.ok) {
        showToast('Profile renamed.');
        await loadProfiles();
      } else {
        showToast('Rename failed.');
      }
    } catch (e) {
      showToast('Error: ' + e.message);
    }
  };

  window.playProfileAudio = (filename) => {
    audioPlayer.src = `/api/audio/${filename}?profile=1`;
    audioPlayer.play();
    visualizer.start();
  };

  window.deleteProfile = async (id) => {
    if (!confirm('Delete this voice profile?')) return;
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedProfileId === id) {
          selectedProfileId = null;
          localStorage.removeItem('kitten_tts_selected_profile');
          activeVoiceName.textContent = 'None (Default / Uploaded)';
        }
        await loadProfiles();
        showToast('Profile deleted.');
      }
    } catch (e) {
      showToast('Error deleting profile: ' + e.message);
    }
  };

  // ==================== EXPRESSION TAG BUTTONS ====================
  document.querySelectorAll('.btn-tag[data-tag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      const start = textInput.selectionStart;
      const end = textInput.selectionEnd;
      const val = textInput.value;
      textInput.value = val.substring(0, start) + ' ' + tag + ' ' + val.substring(end);
      textInput.focus();
      textInput.selectionStart = textInput.selectionEnd = start + tag.length + 2;
      updateCharCount();
    });
  });

  textInput.addEventListener('input', updateCharCount);
  function updateCharCount() {
    charCounter.textContent = `${textInput.value.length} chars`;
  }

  let currentDeviceName = 'CPU';
  let synthStopwatchTimer = null;

  // ==================== SYNTHESIZE AUDIO ====================
  synthesizeBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    if (!text) {
      showToast('Please enter text to synthesize.');
      return;
    }

    const payload = {
      text: text,
      speed: parseFloat(speedSelect.value) || 1.0,
      profile_id: selectedProfileId,
      temp_sample: currentUploadedSample ? currentUploadedSample.filename : null
    };

    const startTimeMs = Date.now();
    const updateStopwatch = () => {
      const elapsedSec = Math.floor((Date.now() - startTimeMs) / 1000);
      synthesizeBtn.textContent = `⚡ SYNTHESIZING ON ${currentDeviceName} (${elapsedSec}s)...`;
      latencyBadge.textContent = `Crunching audio on ${currentDeviceName} (${elapsedSec}s)...`;
    };

    try {
      synthesizeBtn.disabled = true;
      updateStopwatch();
      synthStopwatchTimer = setInterval(updateStopwatch, 1000);

      const t0 = performance.now();
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (synthStopwatchTimer) {
        clearInterval(synthStopwatchTimer);
        synthStopwatchTimer = null;
      }

      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      const data = await res.json();

      if (res.ok) {
        const devTag = data.device ? data.device.toUpperCase() : currentDeviceName;
        latencyBadge.textContent = `Latency: ${elapsed}s [${devTag}] (Gen: ${data.duration}s @ 24kHz)`;
        activeAudioUrl = data.audio_url;
        audioPlayer.src = activeAudioUrl;
        downloadLink.href = activeAudioUrl;
        downloadLink.download = data.filename;
        downloadLink.style.display = 'inline-flex';

        audioPlayer.play();
        visualizer.start();
        showToast(`Speech synthesized in ${elapsed}s on ${devTag}!`);
        await loadHistory();
      } else {
        showToast('Synthesis failed: ' + (data.detail || 'Unknown error'));
        latencyBadge.textContent = `Failed (${elapsed}s)`;
      }
    } catch (e) {
      if (synthStopwatchTimer) {
        clearInterval(synthStopwatchTimer);
        synthStopwatchTimer = null;
      }
      showToast('Error: ' + e.message);
      latencyBadge.textContent = 'Error';
    } finally {
      if (synthStopwatchTimer) {
        clearInterval(synthStopwatchTimer);
        synthStopwatchTimer = null;
      }
      synthesizeBtn.disabled = false;
      synthesizeBtn.textContent = '⚡ SYNTHESIZE SPEECH';
    }
  });

  // ==================== AUDIO CONTROLS ====================
  playBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
      audioPlayer.play();
      playBtn.textContent = '⏸ PAUSE';
      visualizer.start();
    } else {
      audioPlayer.pause();
      playBtn.textContent = '▶ PLAY';
      visualizer.stop();
    }
  });

  audioPlayer.addEventListener('play', () => {
    playBtn.textContent = '⏸ PAUSE';
    visualizer.start();
  });

  audioPlayer.addEventListener('pause', () => {
    playBtn.textContent = '▶ PLAY';
    visualizer.stop();
  });

  audioPlayer.addEventListener('ended', () => {
    playBtn.textContent = '▶ PLAY';
    visualizer.stop();
  });

  audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
      const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
      scrubber.value = pct;
      currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
      totalTimeLabel.textContent = formatTime(audioPlayer.duration);
    }
  });

  scrubber.addEventListener('input', () => {
    if (audioPlayer.duration) {
      audioPlayer.currentTime = (scrubber.value / 100) * audioPlayer.duration;
    }
  });

  function formatTime(secs) {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    const ms = Math.floor((secs % 1) * 10).toString();
    return `${m}:${s}.${ms}`;
  }

  // ==================== HISTORY ====================
  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      const items = await res.json();
      const list = document.getElementById('historyList');
      list.innerHTML = '';

      if (items.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;padding:8px;">No generated clips yet.</div>';
        return;
      }

      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
          <div class="history-text">${item.text}</div>
          <div class="history-bottom">
            <span>${item.duration}s • ${item.created_at}</span>
            <div class="history-actions">
              <button class="btn btn-tag" onclick="window.playHistoryItem('${item.audio_url}', '${encodeURIComponent(item.text)}')">▶ Play</button>
              <a href="${item.audio_url}" download="${item.filename}" class="btn btn-tag">⬇</a>
            </div>
          </div>
        `;
        list.appendChild(card);
      });
    } catch (e) {
      console.error('History load error:', e);
    }
  }

  window.playHistoryItem = (url, textEncoded) => {
    audioPlayer.src = url;
    audioPlayer.play();
    visualizer.start();
    textInput.value = decodeURIComponent(textEncoded);
    updateCharCount();
  };

  // ==================== TELEMETRY HUD ====================
  async function updateTelemetry() {
    try {
      const res = await fetch('/api/telemetry');
      if (!res.ok) return;
      const data = await res.json();
      
      const hudRam = document.getElementById('hudRam');
      if (hudRam) hudRam.textContent = `${data.ram_used_gb}G / ${data.ram_total_gb}G`;
      
      const hudCpu = document.getElementById('hudCpu');
      if (hudCpu) hudCpu.textContent = `${data.cpu_percent}%`;
      
      const hudModel = document.getElementById('hudModel');
      if (hudModel) {
        hudModel.textContent = data.model_loaded ? 'LOADED' : 'STANDBY';
        hudModel.className = 'hud-val' + (data.model_loaded ? ' active' : '');
      }

      const hudDevice = document.getElementById('hudDevice');
      if (data.device && (data.device.toLowerCase().includes('cuda') || data.device.toLowerCase().includes('gpu'))) {
        currentDeviceName = 'GPU';
        if (hudDevice) {
          hudDevice.textContent = 'GPU (NVIDIA MX250)';
          hudDevice.className = 'hud-val active';
        }
      } else {
        currentDeviceName = 'CPU';
        if (hudDevice) {
          hudDevice.textContent = 'CPU (AVX2)';
          hudDevice.className = 'hud-val';
        }
      }
    } catch (e) {
      // Telemetry poll error is non-fatal
    }
  }

  // Toast Helper
  function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 300ms ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Initial Boot
  loadProfiles();
  loadHistory();
  updateTelemetry();
  setInterval(updateTelemetry, 5000);
});
