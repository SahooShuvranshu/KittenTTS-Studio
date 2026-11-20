/**
 * Kitten-TTS 2 Studio — Core Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Versioned Storage Manager (Schema v1 with quota guard & migration)
  const StorageManager = {
    SCHEMA_VERSION: 1,
    PREFIX: 'kitten_tts_v1_',
    get(key, defaultValue = null) {
      try {
        const raw = localStorage.getItem(this.PREFIX + key);
        if (!raw) {
          const legacy = localStorage.getItem('kitten_tts_' + key);
          return legacy !== null ? legacy : defaultValue;
        }
        const envelope = JSON.parse(raw);
        if (envelope && typeof envelope === 'object' && envelope.v === this.SCHEMA_VERSION) {
          return envelope.data;
        }
        return envelope !== null && envelope.data !== undefined ? envelope.data : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    },
    set(key, value) {
      try {
        const envelope = {
          v: this.SCHEMA_VERSION,
          data: value,
          updated_at: Date.now()
        };
        localStorage.setItem(this.PREFIX + key, JSON.stringify(envelope));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(this.PREFIX + key);
        localStorage.removeItem('kitten_tts_' + key);
      } catch (e) {}
    }
  };

  // Consistent Error Response Formatter
  function formatErrorMessage(data, fallback = 'Unknown error') {
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (Array.isArray(data.detail)) {
      return data.detail.map(d => d.msg || (typeof d === 'string' ? d : JSON.stringify(d))).join(' • ');
    }
    if (typeof data.detail === 'string') return data.detail;
    if (data.message) return data.message;
    return fallback;
  }

  // Offline status banner management
  function setOfflineState(isOffline) {
    const offlineNotice = document.getElementById('offlineNotice');
    const hudModel = document.getElementById('hudModel');
    if (isOffline) {
      if (offlineNotice) offlineNotice.style.display = 'block';
      if (hudModel) {
        hudModel.textContent = 'OFFLINE';
        hudModel.className = 'hud-val';
        hudModel.style.color = 'var(--signal-amber)';
      }
    } else {
      if (offlineNotice) offlineNotice.style.display = 'none';
      if (hudModel) {
        hudModel.style.color = '';
      }
    }
  }

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
      if (isSynthesizing) {
        showToast('Generation in progress. Please wait before changing voice.');
        return;
      }
      selectedProfileId = null;
      StorageManager.remove('selected_profile');
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
  let currentRecordedUrl = null; // Track object URL to prevent memory leaks
  let isSynthesizing = false;

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
      vuMeterBar.parentElement.setAttribute('aria-valuenow', level);
    },
    onRecorded: async (blob, duration = 0) => {
      currentRecordedBlob = blob;
      recPreview.style.display = 'flex';
      // Revoke previous object URL to avoid memory leak
      if (currentRecordedUrl) {
        URL.revokeObjectURL(currentRecordedUrl);
      }
      currentRecordedUrl = URL.createObjectURL(blob);
      document.getElementById('recAudioPreview').src = currentRecordedUrl;
      const durSec = typeof duration === 'number' ? duration.toFixed(1) : '0.0';
      if (duration < 5.0) {
        showToast(`Recorded ${durSec}s. Short sample: 5-30s recommended for best fidelity.`);
      } else if (duration > 30.0) {
        showToast(`Recorded ${durSec}s. Long sample: 5-30s optimal for voice prompt.`);
      } else {
        showToast(`Recorded ${durSec}s clean sample. Ready to save voice profile.`);
      }
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
        if (currentRecordedUrl) {
          URL.revokeObjectURL(currentRecordedUrl);
          currentRecordedUrl = null;
        }
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
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
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
    if (!file || file.size === 0) {
      showToast('Uploaded audio file is empty (0 bytes).');
      return;
    }

    // Client-side file extension and size pre-checks
    const validExts = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExts.some(ext => fileName.endsWith(ext));
    if (!hasValidExt) {
      showToast(`Unsupported audio format. Please choose: ${validExts.join(', ')}`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast('File exceeds 50 MB maximum limit.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      dropzone.classList.add('uploading');
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
        let metaText = `${data.duration}s • 24kHz Mono WAV • ${data.size_kb} KB`;
        if (data.validation && data.validation.status === 'warning') {
          metaText += ` (${data.validation.message})`;
          showToast(`Sample note: ${data.validation.message}`);
        } else {
          showToast('Sample processed and ready for cloning.');
        }
        document.getElementById('uploadFileMeta').textContent = metaText;
        document.getElementById('uploadAudioPreview').src = `/api/audio/${data.filename}?temp=1`;
        profileNameInput.value = file.name.replace(/\.[^/.]+$/, "");
      } else {
        showToast('Upload failed: ' + formatErrorMessage(data, 'Upload error'));
      }
    } catch (e) {
      showToast('Error uploading: ' + e.message);
    } finally {
      dropzone.classList.remove('uploading');
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
        showToast('Failed to save profile: ' + formatErrorMessage(data, 'Save error'));
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const profiles = await res.json();
      setOfflineState(false);
      profileList.innerHTML = '';

      if (profiles.length === 0) {
        profileList.innerHTML = '<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;padding:8px;">No voice profiles saved yet. Upload or record a 5-30s sample above.</div>';
        selectedProfileId = null;
        if (activeVoiceName) activeVoiceName.textContent = 'None (Default / Uploaded)';
        StorageManager.remove('selected_profile');
        return;
      }

      // Check localStorage for remembered profile
      const rememberedId = StorageManager.get('selected_profile');
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
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Select voice profile: ${p.name}`);
        card.innerHTML = `
          <div class="profile-info">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="profile-name">${p.name}</span>
              ${isSelected ? '<span class="tabular" style="font-size:9px;background:var(--accent-meter-bg);color:var(--accent-meter);padding:1px 4px;border-radius:2px;font-weight:600;">ACTIVE</span>' : ''}
            </div>
            <span class="profile-meta">${p.description ? p.description + ' • ' : ''}${p.duration}s • 24kHz</span>
          </div>
          <div class="profile-actions" style="display:flex;gap:4px;">
            <button class="btn btn-tag" aria-label="Preview audio for ${p.name}" style="padding:4px 8px; min-width:28px; min-height:28px;" title="Preview Audio" onclick="event.stopPropagation(); window.playProfileAudio('${p.filename}')">▶</button>
            <button class="btn btn-tag" aria-label="Rename profile ${p.name}" style="padding:4px 8px; min-width:28px; min-height:28px;" title="Rename Profile" onclick="event.stopPropagation(); window.renameProfile('${p.id}', '${p.name.replace(/'/g, "\\'")}')">✏</button>
            <button class="btn btn-tag btn-danger" aria-label="Delete profile ${p.name}" style="padding:4px 8px; min-width:28px; min-height:28px;" title="Delete" onclick="event.stopPropagation(); window.deleteProfile('${p.id}')">✕</button>
          </div>
        `;
        card.addEventListener('click', () => selectProfile(p.id, p.name));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectProfile(p.id, p.name);
          }
        });
        profileList.appendChild(card);
      });

      if (!foundRemembered && selectedProfileId === null && profiles.length > 0) {
        // Automatically select first profile if none remembered
        selectProfile(profiles[0].id, profiles[0].name, false);
      } else if (!foundRemembered && rememberedId) {
        // Stale profile ID no longer on backend
        StorageManager.remove('selected_profile');
      }
    } catch (e) {
      console.warn('Failed to load profiles:', e);
      setOfflineState(true);
      profileList.innerHTML = '<div style="color:var(--signal-amber);font-family:var(--font-mono);font-size:11px;padding:8px;">Disconnected from local studio backend. Run <code>./run_studio.sh</code> to enable speech generation.</div>';
    }
  }

  function selectProfile(id, name, notify = true) {
    if (isSynthesizing) {
      showToast('Speech generation in progress. Cannot change profile right now.');
      return;
    }
    selectedProfileId = id;
    StorageManager.set('selected_profile', id);
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
        const b = el.querySelector('.tabular');
        if (b && b.textContent === 'ACTIVE') b.remove();
      }
    });
    if (notify) {
      showToast(`Selected voice profile: ${name || id}`);
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

  function safePlay(audioEl) {
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Autoplay prevented by browser policy:', err);
        if (playBtn) playBtn.textContent = '▶ PLAY';
        visualizer.stop();
        showToast('Audio ready. Click ▶ PLAY to start playback.');
      });
    }
  }

  window.playProfileAudio = (filename) => {
    audioPlayer.src = `/api/audio/${filename}?profile=1`;
    safePlay(audioPlayer);
    visualizer.start();
  };

  window.deleteProfile = async (id) => {
    if (isSynthesizing && selectedProfileId === id) {
      showToast('Generation in progress. Cannot delete armed voice profile.');
      return;
    }
    if (!confirm('Delete this voice profile?')) return;
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedProfileId === id) {
          selectedProfileId = null;
          StorageManager.remove('selected_profile');
          if (activeVoiceName) activeVoiceName.textContent = 'None (Default / Uploaded)';
        }
        await loadProfiles();
        showToast('Profile deleted.');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast('Delete failed: ' + formatErrorMessage(errData, 'Could not delete profile'));
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
    const val = textInput.value;
    const len = val.length;
    let warning = '';

    // Check unclosed brackets [xxx or <xxx or (((xxx
    const openSquare = (val.match(/\[/g) || []).length;
    const closeSquare = (val.match(/\]/g) || []).length;
    const openAngle = (val.match(/</g) || []).length;
    const closeAngle = (val.match(/>/g) || []).length;
    const openParen = (val.match(/\(\(\(/g) || []).length;
    const closeParen = (val.match(/\)\)\)/g) || []).length;

    // Check for malformed emphasis like ((text)) instead of (((text)))
    const malformedEmphasis = /(^|[^(])\(\([^(][^)]*?\)\)(?:[^)]|$)/.test(val);

    // Check for unknown emotion tags
    const knownBracketTags = new Set(['happy', 'whisper', 'serious', 'excited']);
    const knownAngleTags = new Set(['laugh', 'sigh']);
    const bracketMatches = [...val.matchAll(/\[([a-zA-Z0-9_\-]+)\]/g)];
    const angleMatches = [...val.matchAll(/<([a-zA-Z0-9_\-]+)>/g)];

    let unknownTag = null;
    for (const m of bracketMatches) {
      if (!knownBracketTags.has(m[1].toLowerCase())) {
        unknownTag = `[${m[1]}]`;
        break;
      }
    }
    if (!unknownTag) {
      for (const m of angleMatches) {
        if (!knownAngleTags.has(m[1].toLowerCase())) {
          unknownTag = `<${m[1]}>`;
          break;
        }
      }
    }

    if (openSquare !== closeSquare) {
      warning = ' • [unclosed tag]';
    } else if (openAngle !== closeAngle) {
      warning = ' • <unclosed tag>';
    } else if (openParen !== closeParen) {
      warning = ' • (((unclosed emphasis)))';
    } else if (malformedEmphasis) {
      warning = ' • (((use 3 parentheses for emphasis)))';
    } else if (unknownTag) {
      warning = ` • ${unknownTag} (unrecognized tag)`;
    }

    if (warning) {
      charCounter.innerHTML = `<span style="color:var(--signal-amber);">${len} chars${warning}</span>`;
    } else {
      charCounter.textContent = `${len} chars`;
    }
  }

  let currentDeviceName = 'CPU';
  let synthStopwatchTimer = null;
  let synthTimeoutTimer = null;
  let activeSynthController = null;

  // ==================== SYNTHESIZE AUDIO ====================
  synthesizeBtn.addEventListener('click', async () => {
    // If generation is already active, clicking cancels the in-flight synthesis
    if (isSynthesizing) {
      if (activeSynthController) {
        activeSynthController.abort();
        synthesizeBtn.textContent = '⏹ ABORTING...';
        showToast('Aborting speech synthesis request...');
      }
      return;
    }

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
      synthesizeBtn.textContent = `⏹ CANCEL (${elapsedSec}s)...`;
      latencyBadge.textContent = `Crunching audio on ${currentDeviceName} (${elapsedSec}s)...`;
    };

    try {
      isSynthesizing = true;
      synthesizeBtn.classList.add('btn-danger');
      updateStopwatch();
      synthStopwatchTimer = setInterval(updateStopwatch, 1000);
      activeSynthController = new AbortController();

      // Client-side 60s timeout guard
      synthTimeoutTimer = setTimeout(() => {
        if (activeSynthController) {
          activeSynthController.abort();
          showToast('Synthesis timed out after 60s. Server may be heavily loaded.');
        }
      }, 60000);

      const t0 = performance.now();
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: activeSynthController.signal
      });

      if (synthStopwatchTimer) {
        clearInterval(synthStopwatchTimer);
        synthStopwatchTimer = null;
      }
      if (synthTimeoutTimer) {
        clearTimeout(synthTimeoutTimer);
        synthTimeoutTimer = null;
      }

      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      const data = await res.json();

      if (res.ok) {
        setOfflineState(false);
        const devTag = data.device ? data.device.toUpperCase() : currentDeviceName;
        latencyBadge.textContent = `Latency: ${elapsed}s [${devTag}] (Gen: ${data.duration}s @ 24kHz)`;
        activeAudioUrl = data.audio_url;
        audioPlayer.src = activeAudioUrl;
        downloadLink.href = activeAudioUrl;
        downloadLink.download = data.filename;
        downloadLink.style.display = 'inline-flex';

        safePlay(audioPlayer);
        visualizer.start();
        showToast(`Speech synthesized in ${elapsed}s on ${devTag}!`);
        await loadHistory();
      } else {
        if (res.status === 404 && payload.profile_id) {
          // Stale profile ID no longer on backend
          StorageManager.remove('selected_profile');
          selectedProfileId = null;
          if (activeVoiceName) activeVoiceName.textContent = 'None (Default / Uploaded)';
          await loadProfiles();
        }
        showToast('Synthesis failed: ' + formatErrorMessage(data, 'Unknown error'));
        latencyBadge.textContent = `Failed (${elapsed}s)`;
      }
    } catch (e) {
      if (synthStopwatchTimer) {
        clearInterval(synthStopwatchTimer);
        synthStopwatchTimer = null;
      }
      if (synthTimeoutTimer) {
        clearTimeout(synthTimeoutTimer);
        synthTimeoutTimer = null;
      }
      if (e.name === 'AbortError') {
        showToast('Synthesis canceled by user.');
        latencyBadge.textContent = 'Canceled';
      } else {
        setOfflineState(true);
        showToast('Synthesis failed: Local server is unreachable. Check ./run_studio.sh');
        latencyBadge.textContent = 'Disconnected';
      }
    } finally {
      if (synthStopwatchTimer) {
        clearInterval(synthStopwatchTimer);
        synthStopwatchTimer = null;
      }
      if (synthTimeoutTimer) {
        clearTimeout(synthTimeoutTimer);
        synthTimeoutTimer = null;
      }
      isSynthesizing = false;
      activeSynthController = null;
      synthesizeBtn.classList.remove('btn-danger');
      synthesizeBtn.textContent = '⚡ SYNTHESIZE SPEECH';
    }
  });

  // ==================== AUDIO CONTROLS ====================
  playBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
      safePlay(audioPlayer);
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
      scrubber.setAttribute('aria-valuenow', pct.toFixed(1));
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
              <button class="btn btn-tag" aria-label="Play clip" onclick="window.playHistoryItem('${item.audio_url}', '${encodeURIComponent(item.text)}')">▶ Play</button>
              <a href="${item.audio_url}" download="${item.filename}" class="btn btn-tag" aria-label="Download ${item.filename}">⬇</a>
            </div>
          </div>
        `;
        list.appendChild(card);
      });
    } catch (e) {
      // History error non-fatal in disconnected mode
    }
  }

  window.playHistoryItem = (url, textEncoded) => {
    audioPlayer.src = url;
    safePlay(audioPlayer);
    visualizer.start();
    textInput.value = decodeURIComponent(textEncoded);
    updateCharCount();
  };

  // ==================== TELEMETRY HUD ====================
  async function updateTelemetry() {
    try {
      const res = await fetch('/api/telemetry');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOfflineState(false);
      
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
          hudDevice.textContent = 'GPU (CUDA)';
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
      setOfflineState(true);
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

  // Telemetry Polling with Tab Backgrounding Guard
  let telemetryTimer = null;
  function startPolling() {
    if (!telemetryTimer) {
      updateTelemetry();
      telemetryTimer = setInterval(updateTelemetry, 5000);
    }
  }
  function stopPolling() {
    if (telemetryTimer) {
      clearInterval(telemetryTimer);
      telemetryTimer = null;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  });

  // ==================== MOBILE RACK NAVIGATION JUMPER ====================
  const rackNavBtns = document.querySelectorAll('.rack-nav-btn');
  rackNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        rackNavBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  if ('IntersectionObserver' in window) {
    const rackObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          const id = entry.target.id;
          rackNavBtns.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-target') === id);
          });
        }
      });
    }, { threshold: 0.25 });

    ['panelVoice', 'panelSynth', 'panelVault'].forEach(id => {
      const el = document.getElementById(id);
      if (el) rackObserver.observe(el);
    });
  }

  // Initial Boot
  loadProfiles();
  loadHistory();
  startPolling();
});
