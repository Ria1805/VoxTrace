/**
 * VoxTrace Web UI — Vanilla JavaScript Client
 * Safe DOM generation (no innerHTML with raw API data)
 */

(function () {
  'use strict';

  // --- State ---
  let selectedAudioFile = null;
  let selectedVideoFile = null;
  let audioObjectUrl = null;
  let videoObjectUrl = null;

  // --- DOM Elements ---
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');

  const verifyLedgerBtn = document.getElementById('verifyLedgerBtn');
  const lastVerifiedTime = document.getElementById('lastVerifiedTime');

  const audioModelChip = document.getElementById('audioModelChip');
  const audioModelDot = document.getElementById('audioModelDot');
  const audioModelVal = document.getElementById('audioModelVal');

  const videoDetectorChip = document.getElementById('videoDetectorChip');
  const videoDetectorDot = document.getElementById('videoDetectorDot');
  const videoDetectorVal = document.getElementById('videoDetectorVal');

  const ledgerStatusChip = document.getElementById('ledgerStatusChip');
  const ledgerDot = document.getElementById('ledgerDot');
  const ledgerStatusVal = document.getElementById('ledgerStatusVal');

  const keyPinningVal = document.getElementById('keyPinningVal');

  const videoPlaceholderWarning = document.getElementById('videoPlaceholderWarning');
  const tamperAlertBox = document.getElementById('tamperAlertBox');
  const tamperProblemsList = document.getElementById('tamperProblemsList');

  const globalErrorBox = document.getElementById('globalErrorBox');
  const globalErrorTitle = document.getElementById('globalErrorTitle');
  const globalErrorMessage = document.getElementById('globalErrorMessage');
  const globalErrorExtra = document.getElementById('globalErrorExtra');

  const audioDropZone = document.getElementById('audioDropZone');
  const audioInput = document.getElementById('audioInput');
  const audioPrompt = document.getElementById('audioPrompt');
  const audioPreviewContainer = document.getElementById('audioPreviewContainer');
  const audioFileName = document.getElementById('audioFileName');
  const audioPreviewPlayer = document.getElementById('audioPreviewPlayer');
  const clearAudioBtn = document.getElementById('clearAudioBtn');

  const videoDropZone = document.getElementById('videoDropZone');
  const videoInput = document.getElementById('videoInput');
  const videoPrompt = document.getElementById('videoPrompt');
  const videoPreviewContainer = document.getElementById('videoPreviewContainer');
  const videoFileName = document.getElementById('videoFileName');
  const videoPreviewPlayer = document.getElementById('videoPreviewPlayer');
  const clearVideoBtn = document.getElementById('clearVideoBtn');

  const analyzeForm = document.getElementById('analyzeForm');
  const analyzeSubmitBtn = document.getElementById('analyzeSubmitBtn');
  const analyzeBtnSpinner = document.getElementById('analyzeBtnSpinner');
  const analyzeBtnText = document.getElementById('analyzeBtnText');

  const resultCard = document.getElementById('resultCard');
  const verdictBanner = document.getElementById('verdictBanner');
  const verdictText = document.getElementById('verdictText');
  const severityChip = document.getElementById('severityChip');

  const audioScoreLabel = document.getElementById('audioScoreLabel');
  const audioMeterFill = document.getElementById('audioMeterFill');
  const videoScoreLabel = document.getElementById('videoScoreLabel');
  const videoMeterFill = document.getElementById('videoMeterFill');
  const fusedScoreLabel = document.getElementById('fusedScoreLabel');
  const fusedMeterFill = document.getElementById('fusedMeterFill');

  const playbookChecklist = document.getElementById('playbookChecklist');
  const iocMatchesContainer = document.getElementById('iocMatchesContainer');
  const noIocMatchesText = document.getElementById('noIocMatchesText');
  const iocTableWrapper = document.getElementById('iocTableWrapper');
  const iocTableBody = document.getElementById('iocTableBody');

  const recordHashVal = document.getElementById('recordHashVal');
  const evidenceShaList = document.getElementById('evidenceShaList');

  const refreshIncidentsBtn = document.getElementById('refreshIncidentsBtn');
  const incidentsCountBadge = document.getElementById('incidentsCountBadge');
  const incidentsTableBody = document.getElementById('incidentsTableBody');

  // --- Helper Functions for Safe DOM Creation ---
  function el(tag, className, textContent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textContent !== undefined && textContent !== null) {
      node.textContent = String(textContent);
    }
    return node;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function copyTextToClipboard(text, btnElement) {
    if (!navigator.clipboard) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopiedFeedback(btnElement);
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      showCopiedFeedback(btnElement);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  function showCopiedFeedback(btn) {
    if (!btn) return;
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 1800);
  }

  // --- Global Error Handling ---
  function showError(title, message, extra) {
    globalErrorBox.classList.remove('hidden');
    globalErrorTitle.textContent = title || 'Error';
    globalErrorMessage.textContent = message || '';
    if (extra) {
      globalErrorExtra.textContent = extra;
      globalErrorExtra.classList.remove('hidden');
    } else {
      globalErrorExtra.classList.add('hidden');
      globalErrorExtra.textContent = '';
    }
    globalErrorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearError() {
    globalErrorBox.classList.add('hidden');
    globalErrorTitle.textContent = '';
    globalErrorMessage.textContent = '';
    globalErrorExtra.textContent = '';
  }

  // --- Theme Management ---
  function initTheme() {
    const savedTheme = localStorage.getItem('voxtrace-theme') || 'dark';
    setTheme(savedTheme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('voxtrace-theme', theme);
    if (theme === 'light') {
      themeIcon.textContent = '☀️';
      themeText.textContent = 'Light';
    } else {
      themeIcon.textContent = '🌙';
      themeText.textContent = 'Dark';
    }
  }

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // --- Status and Verification ---
  async function loadStatus() {
    try {
      const res = await fetch('/status');
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const data = await res.json();

      // Audio model: loaded / NOT loaded
      const audioLoaded = Boolean(data.audio_model_loaded);
      audioModelVal.textContent = audioLoaded ? 'loaded' : 'NOT loaded';
      audioModelDot.className = 'chip-dot ' + (audioLoaded ? 'dot-success' : 'dot-neutral');

      // Video detector version
      const videoVersion = data.video_detector || 'unknown';
      videoDetectorVal.textContent = videoVersion;
      videoDetectorDot.className = 'chip-dot ' + (data.video_is_placeholder ? 'dot-warning' : 'dot-success');

      // Placeholder warning
      if (data.video_is_placeholder) {
        videoPlaceholderWarning.classList.remove('hidden');
      } else {
        videoPlaceholderWarning.classList.add('hidden');
      }

      return data;
    } catch (err) {
      console.warn('Status check failed:', err);
      audioModelVal.textContent = 'offline';
      videoDetectorVal.textContent = 'offline';
    }
  }

  async function loadVerify() {
    verifyLedgerBtn.disabled = true;
    lastVerifiedTime.textContent = 'Verifying ledger...';

    try {
      const res = await fetch('/verify');
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const data = await res.json();

      // Badge: Evidence log intact / TAMPERING DETECTED
      tamperProblemsList.textContent = '';
      if (data.chain_intact) {
        ledgerStatusChip.className = 'status-chip badge-chip intact';
        ledgerDot.className = 'chip-dot dot-success';
        ledgerStatusVal.textContent = 'Evidence log intact';
        tamperAlertBox.classList.add('hidden');
      } else {
        ledgerStatusChip.className = 'status-chip badge-chip tampered';
        ledgerDot.className = 'chip-dot dot-danger';
        ledgerStatusVal.textContent = 'TAMPERING DETECTED';
        tamperAlertBox.classList.remove('hidden');

        const problems = Array.isArray(data.problems) ? data.problems : [];
        if (problems.length > 0) {
          problems.forEach(prob => {
            const li = el('li', '', prob);
            tamperProblemsList.appendChild(li);
          });
        } else {
          const li = el('li', '', 'Ledger validation failed with unspecified errors.');
          tamperProblemsList.appendChild(li);
        }
      }

      // Key pinning status
      if (data.checked_key_fingerprint === false) {
        keyPinningVal.textContent = 'signing key not pinned';
        keyPinningVal.className = 'chip-val text-xs text-muted';
      } else {
        const fp = data.key_fp ? data.key_fp.substring(0, 16) + '...' : 'pinned';
        keyPinningVal.textContent = fp;
        keyPinningVal.className = 'chip-val text-xs text-muted';
      }

      const now = new Date();
      lastVerifiedTime.textContent = 'Last checked: ' + now.toLocaleTimeString();
      return data;
    } catch (err) {
      console.error('Verify failed:', err);
      ledgerStatusChip.className = 'status-chip badge-chip tampered';
      ledgerDot.className = 'chip-dot dot-danger';
      ledgerStatusVal.textContent = 'Verify unreachable';
      lastVerifiedTime.textContent = 'Verify failed';
    } finally {
      verifyLedgerBtn.disabled = false;
    }
  }

  verifyLedgerBtn.addEventListener('click', () => {
    loadVerify();
  });

  // --- File Upload & Preview Handling ---
  function updateAnalyzeButtonState() {
    analyzeSubmitBtn.disabled = !(selectedAudioFile || selectedVideoFile);
  }

  function handleAudioSelection(file) {
    if (!file) return;
    selectedAudioFile = file;
    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
    }
    audioObjectUrl = URL.createObjectURL(file);
    audioFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
    audioPreviewPlayer.src = audioObjectUrl;
    audioPrompt.classList.add('hidden');
    audioPreviewContainer.classList.remove('hidden');
    updateAnalyzeButtonState();
  }

  function clearAudioSelection() {
    selectedAudioFile = null;
    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
      audioObjectUrl = null;
    }
    audioInput.value = '';
    audioPreviewPlayer.pause();
    audioPreviewPlayer.removeAttribute('src');
    audioPreviewPlayer.load();
    audioFileName.textContent = '—';
    audioPreviewContainer.classList.add('hidden');
    audioPrompt.classList.remove('hidden');
    updateAnalyzeButtonState();
  }

  function handleVideoSelection(file) {
    if (!file) return;
    selectedVideoFile = file;
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
    }
    videoObjectUrl = URL.createObjectURL(file);
    videoFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
    videoPreviewPlayer.src = videoObjectUrl;
    videoPrompt.classList.add('hidden');
    videoPreviewContainer.classList.remove('hidden');
    updateAnalyzeButtonState();
  }

  function clearVideoSelection() {
    selectedVideoFile = null;
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      videoObjectUrl = null;
    }
    videoInput.value = '';
    videoPreviewPlayer.pause();
    videoPreviewPlayer.removeAttribute('src');
    videoPreviewPlayer.load();
    videoFileName.textContent = '—';
    videoPreviewContainer.classList.add('hidden');
    videoPrompt.classList.remove('hidden');
    updateAnalyzeButtonState();
  }

  // Audio Dropzone & Input events
  audioInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleAudioSelection(e.target.files[0]);
    }
  });

  clearAudioBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAudioSelection();
  });

  audioDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    audioDropZone.classList.add('dragover');
  });

  audioDropZone.addEventListener('dragleave', () => {
    audioDropZone.classList.remove('dragover');
  });

  audioDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    audioDropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAudioSelection(e.dataTransfer.files[0]);
    }
  });

  // Video Dropzone & Input events
  videoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleVideoSelection(e.target.files[0]);
    }
  });

  clearVideoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearVideoSelection();
  });

  videoDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoDropZone.classList.add('dragover');
  });

  videoDropZone.addEventListener('dragleave', () => {
    videoDropZone.classList.remove('dragover');
  });

  videoDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    videoDropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoSelection(e.dataTransfer.files[0]);
    }
  });

  // --- Analyze Submission & Result Rendering ---
  analyzeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedAudioFile && !selectedVideoFile) {
      showError('Input Required', 'Please select at least one audio or video file to analyze.');
      return;
    }

    clearError();
    analyzeSubmitBtn.disabled = true;
    analyzeBtnSpinner.classList.remove('hidden');
    analyzeBtnText.textContent = 'Analyzing...';

    const formData = new FormData();
    if (selectedAudioFile) {
      formData.append('audio', selectedAudioFile);
    }
    if (selectedVideoFile) {
      formData.append('video', selectedVideoFile);
    }

    try {
      const response = await fetch('/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorJson = await response.json();
          errorDetail = errorJson.detail || '';
          if (typeof errorDetail !== 'string') {
            errorDetail = JSON.stringify(errorDetail);
          }
        } catch (_) {
          errorDetail = response.statusText || 'Request failed';
        }

        // Status code specific handling
        if (response.status === 422) {
          showError(
            `Error 422 (Unusable Media): ${errorDetail}`,
            'No verdict was given and nothing was logged.'
          );
        } else if (response.status === 503) {
          showError(`Error 503 (Service Unavailable)`, errorDetail || 'Audio model not trained');
        } else if (response.status === 409) {
          showError(`Error 409 (Ledger Conflict)`, errorDetail || 'Evidence log refused the write');
        } else if (response.status === 400) {
          showError(`Error 400 (Bad Request)`, errorDetail || 'Upload an audio and/or video file');
        } else {
          showError(`Error ${response.status}`, errorDetail);
        }
        return;
      }

      // Successful 200 Analysis Response
      const result = await response.json();
      renderResultCard(result);

      // Auto-refresh incidents table and status bar
      loadIncidents();
      loadStatus();
      loadVerify();

    } catch (networkErr) {
      console.error('Analysis request network failure:', networkErr);
      showError('Network Failure', 'Cannot reach the VoxTrace server');
    } finally {
      analyzeBtnSpinner.classList.add('hidden');
      analyzeBtnText.textContent = 'Analyze';
      updateAnalyzeButtonState();
    }
  });

  function renderResultCard(data) {
    resultCard.classList.remove('hidden');

    // 1. Verdict Banner
    const verdict = data.verdict || 'UNSCORED';
    verdictText.textContent = verdict;
    verdictBanner.className = 'verdict-banner';
    if (verdict === 'FAKE') {
      verdictBanner.classList.add('verdict-fake');
    } else if (verdict === 'REAL') {
      verdictBanner.classList.add('verdict-real');
    } else {
      verdictBanner.classList.add('verdict-banner-neutral');
    }

    // 2. Severity Chip
    const sev = (data.severity || 'NONE').toUpperCase();
    severityChip.textContent = sev;
    severityChip.className = 'badge';
    const sevClassMap = {
      NONE: 'badge-severity-none',
      LOW: 'badge-severity-low',
      MEDIUM: 'badge-severity-medium',
      HIGH: 'badge-severity-high',
      CRITICAL: 'badge-severity-critical',
    };
    severityChip.classList.add(sevClassMap[sev] || 'badge-severity-none');

    // Warnings Banner
    const warningsList = document.getElementById('analysisWarningsList');
    const warningsBox = document.getElementById('analysisWarningsBox');
    if (warningsList && warningsBox) {
      warningsList.textContent = '';
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        data.warnings.forEach(w => {
          warningsList.appendChild(el('li', '', w));
        });
        warningsBox.classList.remove('hidden');
      } else {
        warningsBox.classList.add('hidden');
      }
    }

    // 3. Score Meters
    // Audio Score
    if (data.audio_score !== null && data.audio_score !== undefined && !isNaN(data.audio_score)) {
      const aPct = Math.min(Math.max(data.audio_score * 100, 0), 100);
      audioScoreLabel.textContent = `${aPct.toFixed(1)}% (${Number(data.audio_score).toFixed(4)})`;
      audioMeterFill.style.width = `${aPct}%`;
    } else {
      audioScoreLabel.textContent = 'not provided';
      audioMeterFill.style.width = '0%';
    }

    // Video Score
    if (data.video_score !== null && data.video_score !== undefined && !isNaN(data.video_score)) {
      const vPct = Math.min(Math.max(data.video_score * 100, 0), 100);
      videoScoreLabel.textContent = `${vPct.toFixed(1)}% (${Number(data.video_score).toFixed(4)})`;
      videoMeterFill.style.width = `${vPct}%`;
    } else {
      videoScoreLabel.textContent = 'not provided';
      videoMeterFill.style.width = '0%';
    }

    // Fused Score
    if (data.fused_score !== null && data.fused_score !== undefined && !isNaN(data.fused_score)) {
      const fPct = Math.min(Math.max(data.fused_score * 100, 0), 100);
      fusedScoreLabel.textContent = `${fPct.toFixed(1)}% (${Number(data.fused_score).toFixed(4)})`;
      fusedMeterFill.style.width = `${fPct}%`;
    } else {
      fusedScoreLabel.textContent = 'not provided';
      fusedMeterFill.style.width = '0%';
    }

    // 4. Playbook Actions Checklist
    playbookChecklist.textContent = '';
    const actions = Array.isArray(data.actions) ? data.actions : [];
    if (actions.length > 0) {
      actions.forEach((act, idx) => {
        const li = el('li', 'playbook-checklist-item');
        const chkId = `act_chk_${idx}`;
        const chk = el('input');
        chk.type = 'checkbox';
        chk.id = chkId;

        const lbl = el('label', '', act);
        lbl.htmlFor = chkId;

        chk.addEventListener('change', () => {
          if (chk.checked) {
            li.classList.add('checked');
          } else {
            li.classList.remove('checked');
          }
        });

        li.appendChild(chk);
        li.appendChild(lbl);
        playbookChecklist.appendChild(li);
      });
    } else {
      const li = el('li', 'text-muted text-sm', 'No playbook actions assigned.');
      playbookChecklist.appendChild(li);
    }

    // 5. Threat Intel & IOC Matches Table
    iocTableBody.textContent = '';
    const matches = Array.isArray(data.ioc_matches) ? data.ioc_matches : [];
    if (matches.length > 0) {
      noIocMatchesText.classList.add('hidden');
      iocTableWrapper.classList.remove('hidden');

      matches.forEach(item => {
        const tr = el('tr');
        tr.appendChild(el('td', 'font-semibold', item.type || '—'));
        tr.appendChild(el('td', '', item.value || '—'));
        tr.appendChild(el('td', 'text-muted', item.source || '—'));
        tr.appendChild(el('td', '', item.tag || '—'));
        iocTableBody.appendChild(tr);
      });
    } else {
      iocTableWrapper.classList.add('hidden');
      noIocMatchesText.classList.remove('hidden');
    }

    // 6. Hashes and Copy buttons
    recordHashVal.textContent = data.record_hash || '—';

    evidenceShaList.textContent = '';
    const hashes = Array.isArray(data.evidence_sha256) ? data.evidence_sha256 : [];
    if (hashes.length > 0) {
      hashes.forEach((h, i) => {
        const itemBox = el('div', 'hash-box');
        const codeEl = el('code', 'hash-code', h);
        const copyBtn = el('button', 'btn btn-outline btn-xs', 'Copy');
        copyBtn.type = 'button';
        copyBtn.addEventListener('click', () => copyTextToClipboard(h, copyBtn));

        itemBox.appendChild(codeEl);
        itemBox.appendChild(copyBtn);
        evidenceShaList.appendChild(itemBox);
      });
    } else {
      evidenceShaList.appendChild(el('span', 'text-muted text-xs', 'None recorded'));
    }

    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // General delegated copy handler for static copy buttons
  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('btn-copy')) {
      const targetId = e.target.getAttribute('data-target');
      if (targetId) {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          copyTextToClipboard(targetEl.textContent, e.target);
        }
      }
    }
  });

  // --- Incident Log Table ---
  async function loadIncidents() {
    refreshIncidentsBtn.disabled = true;

    try {
      const res = await fetch('/incidents?limit=50');
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      const incidents = await res.json();

      incidentsTableBody.textContent = '';
      const list = Array.isArray(incidents) ? incidents : [];
      incidentsCountBadge.textContent = `${list.length} incident${list.length === 1 ? '' : 's'}`;

      if (list.length === 0) {
        const emptyRow = el('tr', 'empty-state-row');
        const emptyTd = el('td', 'text-center text-muted', 'No incidents yet');
        emptyTd.colSpan = 6;
        emptyRow.appendChild(emptyTd);
        incidentsTableBody.appendChild(emptyRow);
        return;
      }

      list.forEach((item) => {
        const tr = el('tr');

        // Column 1: # (seq)
        tr.appendChild(el('td', 'font-semibold', item.seq !== undefined ? item.seq : '—'));

        // Column 2: Time (local format)
        let timeStr = '—';
        if (item.ts) {
          try {
            timeStr = new Date(item.ts * 1000).toLocaleString();
          } catch (_) {
            timeStr = String(item.ts);
          }
        }
        tr.appendChild(el('td', 'text-muted', timeStr));

        // Column 3: Verdict (colored)
        const verdictTd = el('td');
        const vText = item.verdict || 'UNSCORED';
        const vChip = el('span', 'badge', vText);
        if (vText === 'FAKE') {
          vChip.className = 'badge badge-severity-critical';
        } else if (vText === 'REAL') {
          vChip.className = 'badge badge-severity-low';
        } else {
          vChip.className = 'badge badge-neutral';
        }
        verdictTd.appendChild(vChip);
        tr.appendChild(verdictTd);

        // Column 4: Fused score as %
        let fusedText = '—';
        if (item.fused_score !== null && item.fused_score !== undefined && !isNaN(item.fused_score)) {
          fusedText = `${(Number(item.fused_score) * 100).toFixed(1)}%`;
        }
        tr.appendChild(el('td', 'font-semibold', fusedText));

        // Column 5: Severity (from item.severity or first element of playbook_actions)
        let sevVal = 'NONE';
        if (item.severity) {
          sevVal = String(item.severity).toUpperCase();
        } else if (item.playbook_actions) {
          try {
            const parsed = typeof item.playbook_actions === 'string'
              ? JSON.parse(item.playbook_actions)
              : item.playbook_actions;
            if (Array.isArray(parsed) && parsed.length > 0) {
              sevVal = String(parsed[0]).toUpperCase();
            }
          } catch (_) {}
        }
        const sevTd = el('td');
        const sevChip = el('span', 'badge', sevVal);
        const sevMap = {
          NONE: 'badge-severity-none',
          LOW: 'badge-severity-low',
          MEDIUM: 'badge-severity-medium',
          HIGH: 'badge-severity-high',
          CRITICAL: 'badge-severity-critical',
        };
        sevChip.className = 'badge ' + (sevMap[sevVal] || 'badge-severity-none');
        sevTd.appendChild(sevChip);
        tr.appendChild(sevTd);

        // Column 6: Short evidence hash (first 12 chars, full hash on hover/copy)
        let rawHash = '';
        if (typeof item.evidence_sha256 === 'string') {
          try {
            const arr = JSON.parse(item.evidence_sha256);
            if (Array.isArray(arr) && arr.length > 0) {
              rawHash = arr[0];
            } else {
              rawHash = item.evidence_sha256;
            }
          } catch (_) {
            rawHash = item.evidence_sha256;
          }
        } else if (Array.isArray(item.evidence_sha256) && item.evidence_sha256.length > 0) {
          rawHash = item.evidence_sha256[0];
        } else if (item.record_hash) {
          rawHash = item.record_hash;
        }

        const hashTd = el('td');
        if (rawHash) {
          const hashCell = el('div', 'hash-cell');
          const shortHash = rawHash.length > 12 ? rawHash.substring(0, 12) + '…' : rawHash;
          const code = el('code', '', shortHash);
          code.title = rawHash; // Full hash on hover tooltip

          const copyBtn = el('button', 'btn btn-outline btn-xs', 'Copy');
          copyBtn.type = 'button';
          copyBtn.title = 'Copy full hash';
          copyBtn.addEventListener('click', () => copyTextToClipboard(rawHash, copyBtn));

          hashCell.appendChild(code);
          hashCell.appendChild(copyBtn);
          hashTd.appendChild(hashCell);
        } else {
          hashTd.appendChild(el('span', 'text-muted', '—'));
        }
        tr.appendChild(hashTd);

        incidentsTableBody.appendChild(tr);
      });

    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      refreshIncidentsBtn.disabled = false;
    }
  }

  refreshIncidentsBtn.addEventListener('click', () => {
    loadIncidents();
  });

  // --- Initial Boot ---
  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadStatus();
    loadVerify();
    loadIncidents();
  });

})();
