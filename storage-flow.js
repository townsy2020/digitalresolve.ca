/* ==========================================================================
   DigitalResolve - Tiered Storage & Live Data Flow (storage-flow.js)
   Isolated controller for storage.html consuming /api/storage-flow
   ========================================================================== */
(function () {
  'use strict';

  const GATEWAY = 'https://wake.digitalresolve.ca';
  const LAN_BASE = 'http://192.168.2.35:8082';
  const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';

  const state = {
    data: null,
    filter: 'all',
    animPaused: false,
    selectedType: 'pipeline',
    selectedId: 'tier-coldstorage',
    waveformHistory: [],
    maxWaveformPoints: 40,
    pollTimer: null,
    unauthenticated: false
  };

  // Explicit node-to-node routing for each pipeline ID so SVG curves never overlap text
  const PIPE_NODE_MAP = {
    'postprocess-torrent': { from: 'postprocess-7z', to: 'nuc-d', color: '#38bdf8', dy: -8 },
    'tier-coldstorage': { from: 'nuc-d', to: 'qnap-smb', color: '#a855f7', dy: -10 },
    'audible-sync': { from: 'audible-sync', to: 'qnap-smb', color: '#f472b6', dy: 14 },
    'audiobook-ingest': { from: 'qnap-smb', to: 'nuc-c', color: '#fbbf24', dy: 18 },
    'homelab-resilience': { from: 'nuc-c', to: 'qnap-iscsi-nuc', color: '#10b981', dy: -12 },
    'iscsi-watchdog': { from: 'nuc-qbit', to: 'qnap-iscsi-nuc', color: '#f59e0b', dy: 14 },
    'baremetal-nuc': { from: 'nuc-c', to: 'qnap-iscsi-nuc', color: '#34d399', dy: 6 },
    'baremetal-desktop': { from: 'desktop-drives', to: 'qnap-iscsi-desktop', color: '#60a5fa', dy: 16 },
    'sync-qnap-backups': { from: 'qnap-iscsi-nuc', to: 'qnap-iscsi-desktop', color: '#2dd4bf', dy: 0 },
    'cloud-daily': { from: 'nuc-c', to: 'onedrive-vault', color: '#38bdf8', dy: -14 },
    'dr-nightly': { from: 'nuc-c', to: 'onedrive-vault', color: '#818cf8', dy: 14 },
    'ssd-guard': { from: 'nuc-d', to: 'nuc-qbit', color: '#f59e0b', dy: 0 }
  };

  const NODE_DETAILS = {
    'desktop-drives': {
      title: 'Desktop Workstation Storage (C: / D: / F:)',
      scriptName: 'Desktop Volume & NVMe Telemetry',
      scriptPath: 'C:\\ProgramData\\digitalresolve\\wol-listener.ps1',
      route: 'Desktop (192.168.2.62) -> Cluster Telemetry',
      schedule: 'Continuous 10s cache',
      description: 'Primary workstation NVMe OS, media staging, and high-capacity local volumes monitored for thermals and bare-metal DR.',
      pipelineId: 'baremetal-desktop'
    },
    'desktop-qbit': {
      title: 'Desktop qBittorrent Ingest (:8080)',
      scriptName: 'qBittorrent Workstation Swarm',
      scriptPath: 'C:\\ProgramData\\qBittorrent-Automation\\PostProcess-Torrent.ps1',
      route: 'WAN Swarm -> Desktop Staging -> NUC Hot Media',
      schedule: 'Event-driven on torrent completion',
      description: 'High-speed workstation torrent ingest feeding PostProcess 7z extraction and NUC media library.',
      pipelineId: 'postprocess-torrent'
    },
    'postprocess-7z': {
      title: 'PostProcess 7z Archive Extractor',
      scriptName: 'qBittorrent Post-Process Hook',
      scriptPath: 'C:\\ProgramData\\qBittorrent-Automation\\PostProcess-Torrent.ps1',
      route: 'Completed Downloads -> Extracted Arr Staging',
      schedule: 'Triggered on torrent completion',
      description: 'Automatically extracts multi-part 7z/RAR archives for Sonarr, Radarr, and Readarr import.',
      pipelineId: 'postprocess-torrent'
    },
    'audible-sync': {
      title: 'Audible Library Sync',
      scriptName: 'Audible Sync & M4B Pipeline',
      scriptPath: 'C:\\ProgramData\\qBittorrent-Automation\\sync_audible.py',
      route: 'Audible Cloud -> QNAP SMB / Audiobookshelf',
      schedule: 'Scheduled daily sync',
      description: 'Downloads and converts newly purchased Audible titles into DRM-free M4B audiobooks.',
      pipelineId: 'audible-sync'
    },
    'nuc-c': {
      title: 'NUC C: NVMe OS & Homelab Core',
      scriptName: 'Intel NUC 24/7 Core Volume',
      scriptPath: 'C:\\ProgramData\\digitalresolve\\Backup-HomelabResilience.ps1',
      route: 'NUC C:\\ -> QNAP iSCSI LUN (E:) & OneDrive',
      schedule: 'Daily snapshots + 24/7 services',
      description: 'Hosts 24/7 homelab gateway, go2rtc, Jellyfin, Arr stack, and Antigravity automation scripts.',
      pipelineId: 'homelab-resilience'
    },
    'nuc-d': {
      title: 'NUC D: 1.86 TB FireCuda SSHD (30% Guardrail)',
      scriptName: 'Tier-ColdStorage & SSD Guardrail',
      scriptPath: 'C:\\ProgramData\\StreamHub\\Tier-ColdStorage.ps1',
      route: 'NUC D:\\ -> \\\\192.168.2.125\\Torrents (Q:)',
      schedule: 'Enforced at 30% free-space threshold',
      description: 'Hot 24/7 media buffer; automatically tiers older completed media to QNAP SMB cold archive when free space drops below 30%.',
      pipelineId: 'tier-coldstorage'
    },
    'nuc-qbit': {
      title: 'NUC qBittorrent 24/7 Seeder (:8081)',
      scriptName: 'NUC Swarm & Free-Space Guardrail',
      scriptPath: 'C:\\ProgramData\\digitalresolve\\Enforce-SsdFreeSpace.ps1',
      route: 'NUC D:\\ Active Seeds <-> Space Guardrail',
      schedule: 'Every 30 minutes',
      description: '24/7 low-power torrent seeding engine protected by Enforce-SsdFreeSpace.ps1.',
      pipelineId: 'ssd-guard'
    },
    'qnap-smb': {
      title: 'QNAP TS-639 SMB Cold Archive (Q:)',
      scriptName: 'Cold Media Archive Share',
      scriptPath: '\\\\192.168.2.125\\Torrents',
      route: 'NUC D:\\ -> QNAP SMB :445 (9.16 TB)',
      schedule: 'Continuous SMB mount + Tiering',
      description: '9.16 TB RAID cold storage archive holding tiered movies, TV series, and audiobooks.',
      pipelineId: 'tier-coldstorage'
    },
    'qnap-iscsi-nuc': {
      title: 'QNAP NUC iSCSI LUN (E: • 2.05 TB)',
      scriptName: 'NUC iSCSI Block Target & Watchdog',
      scriptPath: 'C:\\ProgramData\\digitalresolve\\Watchdog-QnapIscsi.ps1',
      route: 'NUC -> QNAP iSCSI :3260 (E:)',
      schedule: 'Watchdog every 5 min + Nightly/Weekly DR',
      description: 'Dedicated 2.05 TB iSCSI block LUN storing Homelab Resilience snapshots and WindowsImageBackup.',
      pipelineId: 'homelab-resilience'
    },
    'qnap-iscsi-desktop': {
      title: 'QNAP Desktop iSCSI LUN (E: • 2.05 TB)',
      scriptName: 'Desktop iSCSI Block Target & Mirror',
      scriptPath: 'C:\\Users\\CoryTownsend\\Projects\\Sync-QNAP-HomelabBackups.ps1',
      route: 'Desktop -> QNAP iSCSI :3260 (E:)',
      schedule: 'Scheduled Mirror + Weekly Bare-Metal',
      description: 'Dedicated 2.05 TB iSCSI block LUN for Desktop bare-metal images and mirrored NUC snapshots.',
      pipelineId: 'sync-qnap-backups'
    },
    'onedrive-vault': {
      title: 'OneDrive Offsite Cloud Vault',
      scriptName: 'Cloud Daily & DR Nightly Sync',
      scriptPath: 'C:\\Users\\CoryTownsend\\Projects\\scripts\\Backup-Homelab-Cloud.py',
      route: 'NUC C:\\ -> OneDrive - digitalresolve.ca\\Antigravity-Backups',
      schedule: 'Daily / Nightly cloud sync',
      description: 'Offsite Microsoft 365 OneDrive vault storing critical homelab scripts, configs, and website backups.',
      pipelineId: 'cloud-daily'
    }
  };

  function safeStr(val, fallback) {
    if (val === null || val === undefined) return fallback;
    const s = String(val).trim();
    if (!s || s === '--' || s === 'null' || s === 'undefined' || s === 'NaN') return fallback;
    return s;
  }

  function safeNum(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function fmtGB(gb) {
    const n = safeNum(gb, 0);
    if (n >= 1024) return (n / 1024).toFixed(2) + ' TB';
    return n.toFixed(1) + ' GB';
  }

  function fmtRelativeTime(isoStr) {
    if (!isoStr) return 'Scheduled';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return 'Scheduled';
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (diffSec < 60) return diffSec + 's ago';
    if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
    if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
    return Math.floor(diffSec / 86400) + 'd ago';
  }

  function fmtNextTime(isoStr) {
    if (!isoStr) return 'Next Cycle';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return 'Next Cycle';
    const diffSec = Math.floor((d.getTime() - Date.now()) / 1000);
    if (diffSec <= 0) return 'Next Cycle';
    if (diffSec < 60) return 'In ' + diffSec + 's';
    if (diffSec < 3600) return 'In ' + Math.floor(diffSec / 60) + 'm';
    if (diffSec < 86400) return 'In ' + Math.floor(diffSec / 3600) + 'h';
    return 'In ' + Math.floor(diffSec / 86400) + 'd';
  }

  function fmtBytes(bytes) {
    const b = safeNum(bytes, 0);
    if (b <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return (b / Math.pow(1024, i)).toFixed(i >= 2 ? 2 : 0) + ' ' + units[i];
  }

  function matchesFilter(category, filter) {
    if (filter === 'all') return true;
    const c = String(category || '').toLowerCase();
    if (filter === 'guardrail') return c === 'guard' || c === 'guardrail';
    return c === filter;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function fetchStorageFlow() {
    if (state.inFlight) return;
    state.inFlight = true;
    try {
      const gatewayUrl = `${GATEWAY}/api/storage-flow`;
      const lanUrl = `${LAN_BASE}/api/storage-flow`;
      const primaryUrl = isHttps ? gatewayUrl : lanUrl;
      const primaryOpts = isHttps
        ? { credentials: 'include', signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined }
        : { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined };

      let res = null;
      try {
        res = await fetch(primaryUrl, primaryOpts);
      } catch (err) {
        if (!isHttps && primaryUrl !== gatewayUrl) {
          try {
            res = await fetch(gatewayUrl, { credentials: 'include', signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
          } catch (_gwErr) {
            renderOfflineFallback();
            return;
          }
        } else if (isHttps && err && err.name === 'TypeError') {
          state.unauthenticated = true;
          renderAuthFallback();
          return;
        } else {
          renderOfflineFallback();
          return;
        }
      }

      if (!res || !res.ok) {
        if (res && (res.status === 401 || res.status === 403)) {
          state.unauthenticated = true;
          renderAuthFallback();
        } else {
          renderOfflineFallback();
        }
        return;
      }

      let json;
      try {
        json = await res.json();
      } catch (_parseErr) {
        renderOfflineFallback();
        return;
      }
      state.unauthenticated = false;
      state.data = json;
      const banner = document.getElementById('storage-sso-banner');
      if (banner) banner.style.display = 'none';

      pushWaveformSample(json);
      renderAll(json);
    } finally {
      state.inFlight = false;
    }
  }

  function renderAuthFallback() {
    const banner = document.getElementById('storage-sso-banner');
    if (banner) banner.style.display = 'flex';
    setText('storage-route-text', 'M365 SSO');
    setText('storage-updated-text', 'Sign in for Live Telemetry');
    setText('kpi-last-sync', 'M365 SSO');
    setText('kpi-last-sync-sub', 'Sign in for Live Telemetry');
  }

  function renderOfflineFallback() {
    setText('storage-route-text', 'Gateway Standby');
    setText('storage-updated-text', 'Retrying Telemetry');
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function pushWaveformSample(data) {
    const lf = (data && data.liveFlow) || {};
    const nucIO = safeNum(lf.nucDiskReadMBps) + safeNum(lf.nucDiskWriteMBps);
    const qnapIO = safeNum(lf.nucIscsiWriteMBps) + safeNum(lf.nucNetMBps);
    const deskIO = safeNum(lf.desktopDiskMBps) + safeNum(lf.desktopNetMBps);
    state.waveformHistory.push({ nuc: nucIO, qnap: qnapIO, desk: deskIO, t: Date.now() });
    if (state.waveformHistory.length > state.maxWaveformPoints) {
      state.waveformHistory.shift();
    }
  }

  function renderAll(data) {
    renderKPIs(data);
    renderTierNodes(data);
    renderCapacityBars(data);
    renderWaveform();
    renderMatrix(data);
    renderActivityTable(data);
    renderPipesSVG(data);
    updateInspector();
  }

  function renderKPIs(data) {
    const t = data.tiers || {};
    const totalGB =
      safeNum(t.desktop_hot && t.desktop_hot.totalGB) +
      safeNum(t.nuc_hot && t.nuc_hot.totalGB) +
      safeNum(t.qnap_smb && t.qnap_smb.totalGB) +
      safeNum(t.qnap_iscsi_nuc && t.qnap_iscsi_nuc.totalGB) +
      safeNum(t.qnap_iscsi_desktop && t.qnap_iscsi_desktop.totalGB) +
      safeNum(t.cloud_onedrive && t.cloud_onedrive.totalGB);

    setText('kpi-total-capacity', fmtGB(totalGB));
    setText('kpi-total-capacity-sub', 'Desktop + NUC + QNAP SMB & Dual iSCSI + OneDrive');

    const qOnline = Boolean(data.qnapOnline);
    const lat = safeNum(data.qnapLatencyMs, 0);
    setText('kpi-qnap-link', qOnline ? `Online (${lat.toFixed(1)} ms)` : 'Standby');
    setText('kpi-qnap-sub', `SMB :445 ${data.qnapSmbOnline ? 'OK' : 'Offline'} • iSCSI :3260 ${data.qnapIscsiOnline ? 'OK' : 'Offline'}`);

    const lf = data.liveFlow || {};
    const totalFlow = safeNum(lf.totalFlowMBps, 0);
    const pipelines = Array.isArray(data.pipelines) ? data.pipelines : [];
    const bestRate = pipelines.reduce((m, p) => Math.max(m, safeNum(p.rateMBps, 0)), 0);
    const displayRate = totalFlow > 0 ? totalFlow : bestRate;
    setText('kpi-flowrate', displayRate.toFixed(2) + ' MB/s');
    setText('kpi-flowrate-sub', totalFlow > 0 ? 'Active live disk & network I/O' : 'Peak measured pipeline rate');

    const sortedRuns = pipelines
      .filter(p => p.lastRunAt)
      .sort((a, b) => new Date(b.lastRunAt) - new Date(a.lastRunAt));
    if (sortedRuns.length > 0) {
      const latest = sortedRuns[0];
      setText('kpi-last-sync', fmtRelativeTime(latest.lastRunAt));
      setText('kpi-last-sync-sub', safeStr(latest.name, 'Pipeline Run'));
    } else {
      setText('kpi-last-sync', 'Scheduled');
      setText('kpi-last-sync-sub', 'All pipelines armed');
    }

    const totalBytesMoved = pipelines.reduce((sum, p) => sum + safeNum(p.bytesCopied, 0), 0);
    setText('kpi-data-moved', fmtBytes(totalBytesMoved));
    setText('kpi-data-moved-sub', `${pipelines.length} tracked automation pipelines`);

    setText('storage-route-text', isHttps ? 'CF Zero Trust Gateway' : 'Direct LAN :8082');
    setText('storage-updated-text', 'Synced: ' + fmtRelativeTime(data.timestamp || new Date().toISOString()));

    const activeProcs = Array.isArray(lf.activeProcesses) && lf.activeProcesses.length > 0
      ? lf.activeProcesses.join(', ')
      : 'Idle / Ready';
    setText('waveform-active-badge', activeProcs);
  }

  function getMaxNvmeTemp(tier) {
    if (!tier) return null;
    if (tier.nvmeMaxTempC !== undefined && tier.nvmeMaxTempC !== null && Number.isFinite(Number(tier.nvmeMaxTempC))) {
      return Number(tier.nvmeMaxTempC);
    }
    if (tier.nvme && !Array.isArray(tier.nvme) && tier.nvme.maxTempC !== undefined && tier.nvme.maxTempC !== null && Number.isFinite(Number(tier.nvme.maxTempC))) {
      return Number(tier.nvme.maxTempC);
    }
    if (Array.isArray(tier.nvme)) {
      let best = null;
      tier.nvme.forEach(item => {
        if (Array.isArray(item)) {
          item.forEach(sub => {
            if (sub && sub.temperature !== undefined && sub.temperature !== null && Number.isFinite(Number(sub.temperature))) {
              best = best === null ? Number(sub.temperature) : Math.max(best, Number(sub.temperature));
            }
          });
        } else if (item && item.temperature !== undefined && item.temperature !== null && Number.isFinite(Number(item.temperature))) {
          best = best === null ? Number(item.temperature) : Math.max(best, Number(item.temperature));
        }
      });
      return best;
    }
    return null;
  }

  function renderTierNodes(data) {
    const t = data.tiers || {};
    const desk = t.desktop_hot || {};
    setText('node-tag-desktop-drives', desk.online ? 'Online' : 'Standby');
    const deskTempVal = getMaxNvmeTemp(desk);
    const deskTemp = deskTempVal !== null ? ` • NVMe ${deskTempVal}°C` : '';
    setText('node-meta-desktop-drives', `${fmtGB(desk.freeGB)} Free / ${fmtGB(desk.totalGB)}${deskTemp}`);

    const nuc = t.nuc_hot || {};
    const dFreeGB = safeNum(nuc.dDriveFreeGB, 0);
    const dTotalGB = safeNum(nuc.dDriveTotalGB, 0);
    const dUsedPct = dTotalGB > 0 ? Math.min(100, Math.max(0, (safeNum(nuc.dDriveUsedGB, Math.max(0, dTotalGB - dFreeGB)) / dTotalGB) * 100)) : 0;
    setText('node-tag-nuc-d', dTotalGB > 0 ? `${Math.round(dFreeGB)} GB Free` : '--');
    setText('node-meta-nuc-d', dTotalGB > 0 ? `${fmtGB(dFreeGB)} Free / ${fmtGB(dTotalGB)} • 30% Offload Guardrail` : 'Awaiting telemetry...');
    const fillEl = document.getElementById('nuc-d-threshold-fill');
    if (fillEl) fillEl.style.width = dUsedPct.toFixed(1) + '%';
    setText('nuc-d-used-lbl', dTotalGB > 0 ? `${dUsedPct.toFixed(0)}% Used` : '--');

    const cVol = Array.isArray(nuc.volumes) ? nuc.volumes.find(v => v && v.drive === 'C:') : null;
    const cTotalGB = cVol ? safeNum(cVol.totalGB, 0) : Math.max(0, safeNum(nuc.totalGB, 0) - dTotalGB);
    const cFreeGB = cVol ? safeNum(cVol.freeGB, 0) : Math.max(0, safeNum(nuc.freeGB, 0) - dFreeGB);
    const nucTempVal = getMaxNvmeTemp(nuc);
    const nucTemp = nucTempVal !== null ? ` • NVMe ${nucTempVal}°C` : '';
    setText('node-tag-nuc-c', nuc.online ? 'Online' : 'Standby');
    setText('node-meta-nuc-c', `192.168.2.35 • ${fmtGB(cFreeGB)} Free / ${fmtGB(cTotalGB)}${nucTemp}`);

    const smb = t.qnap_smb || {};
    setText('node-tag-qnap-smb', safeNum(smb.totalGB, 0) > 0 ? fmtGB(smb.totalGB) : '--');
    setText('node-meta-qnap-smb', `${safeStr(smb.path, '\\\\192.168.2.125\\Torrents')} • ${fmtGB(smb.freeGB)} Free`);

    const iNuc = t.qnap_iscsi_nuc || {};
    setText('node-tag-qnap-iscsi-nuc', safeNum(iNuc.totalGB, 0) > 0 ? fmtGB(iNuc.totalGB) : '--');
    setText('node-meta-qnap-iscsi-nuc', `${safeStr(iNuc.drive, 'E:')} • ${fmtGB(iNuc.freeGB)} Free • ${iNuc.sessionConnected ? 'iSCSI Connected' : 'Standby'}`);

    const iDesk = t.qnap_iscsi_desktop || {};
    setText('node-tag-qnap-iscsi-desktop', safeNum(iDesk.totalGB, 0) > 0 ? fmtGB(iDesk.totalGB) : '--');
    setText('node-meta-qnap-iscsi-desktop', `${safeStr(iDesk.drive, 'E:')} • ${fmtGB(iDesk.freeGB)} Free • Mirrored Snapshots`);

    const od = t.cloud_onedrive || {};
    setText('node-tag-onedrive-vault', od.online ? fmtGB(od.totalGB) : 'Synced');
    setText('node-meta-onedrive-vault', `${safeNum(od.fileCount, 0).toLocaleString()} files • ${safeNum(od.snapshotCount, 0)} snapshots`);

    // Apply category dimming on node cards
    document.querySelectorAll('.storage-node-card').forEach(card => {
      const cats = (card.getAttribute('data-category') || '').split(',');
      const visible = state.filter === 'all' || cats.some(c => matchesFilter(c, state.filter));
      card.classList.toggle('is-dimmed', !visible);
    });
  }

  function renderPipesSVG(data) {
    const svg = document.getElementById('storage-flow-svg');
    const stage = document.getElementById('storage-flow-stage');
    if (!svg || !stage) return;

    const pipelines = Array.isArray(data && data.pipelines) ? data.pipelines : [];
    const filtered = pipelines.filter(p => matchesFilter(p.category, state.filter));
    setText('flow-active-count', `${filtered.length} Active Pipelines`);

    const stageRect = stage.getBoundingClientRect();
    if (stageRect.width < 100 || window.innerWidth <= 1024) {
      svg.innerHTML = '';
      return;
    }

    svg.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);

    let html = `<defs>
      <filter id="pipe-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

    pipelines.forEach((p, idx) => {
      const cfg = PIPE_NODE_MAP[p.id];
      if (!cfg) return;
      const fromEl = stage.querySelector(`[data-node-id="${cfg.from}"]`);
      const toEl = stage.querySelector(`[data-node-id="${cfg.to}"]`);
      if (!fromEl || !toEl) return;

      const r1 = fromEl.getBoundingClientRect();
      const r2 = toEl.getBoundingClientRect();

      const sameCol = Math.abs(r1.left - r2.left) < 40;
      let x1, y1, x2, y2, dStr, mx, my;

      if (sameCol) {
        x1 = r1.right - stageRect.left;
        y1 = r1.top - stageRect.top + r1.height * 0.5;
        x2 = r2.right - stageRect.left;
        y2 = r2.top - stageRect.top + r2.height * 0.5;
        const arcX = Math.max(x1, x2) + 30;
        dStr = `M ${x1} ${y1} C ${arcX} ${y1}, ${arcX} ${y2}, ${x2} ${y2}`;
        mx = arcX;
        my = (y1 + y2) / 2;
      } else {
        const goRight = r2.left > r1.left;
        x1 = (goRight ? r1.right : r1.left) - stageRect.left;
        y1 = r1.top - stageRect.top + r1.height * 0.5 + (cfg.dy || 0);
        x2 = (goRight ? r2.left : r2.right) - stageRect.left;
        y2 = r2.top - stageRect.top + r2.height * 0.5 + (cfg.dy || 0);
        const dx = Math.abs(x2 - x1) * 0.45;
        const cx1 = goRight ? x1 + dx : x1 - dx;
        const cx2 = goRight ? x2 - dx : x2 + dx;
        dStr = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
        // Place pill strictly in the immediate gutter next to the source/target card so it never crosses intermediate columns
        mx = goRight ? (x1 + 32) : (x1 - 32);
        my = y1 + ((idx % 3) - 1) * 18;
      }

      const isVisible = matchesFilter(p.category, state.filter);
      const isSelected = state.selectedType === 'pipeline' && state.selectedId === p.id;
      const opacity = isVisible ? (isSelected ? 1 : 0.82) : 0.12;
      const strokeW = isSelected ? 3.2 : 2.2;
      const rate = safeNum(p.rateMBps, 0);
      const animDur = rate > 50 ? '0.8s' : rate > 10 ? '1.3s' : rate > 1 ? '1.9s' : '2.8s';
      const shortName = p.id.replace('postprocess-torrent', 'postproc').replace('homelab-resilience', 'resilience').replace('baremetal-desktop', 'bm-desk').replace('baremetal-nuc', 'bm-nuc').replace('iscsi-watchdog', 'iscsi-wd').replace('tier-coldstorage', 'cold-tier');
      const label = `${shortName} • ${rate > 0 ? rate.toFixed(1) + 'M/s' : safeStr(p.bytesCopiedFormatted, 'Ready')}`;
      const pillW = Math.min(116, Math.max(68, label.length * 5.6 + 10));

      html += `
        <g opacity="${opacity}" data-pipe-id="${escapeHtml(p.id)}">
          <title>${escapeHtml(p.name)} (${escapeHtml(safeStr(p.bytesCopiedFormatted, '0 B'))} • ${rate.toFixed(1)} MB/s)</title>
          <path d="${dStr}" class="storage-pipe-path" stroke="${cfg.color}" stroke-width="${strokeW}" filter="url(#pipe-glow)" />
          <path d="${dStr}" class="storage-pipe-dashed" stroke="#ffffff" stroke-width="1.4" stroke-opacity="0.65" style="animation-duration: ${animDur};" />
          ${isVisible && !state.animPaused ? `
          <circle r="3.2" fill="${cfg.color}" filter="url(#pipe-glow)">
            <animateMotion dur="${animDur}" repeatCount="indefinite" path="${dStr}" />
          </circle>` : ''}
          <path d="${dStr}" class="storage-pipe-hit" stroke="transparent" stroke-width="14" fill="none" />
          ${isVisible && (isSelected || ['tier-coldstorage', 'postprocess-torrent', 'homelab-resilience', 'cloud-daily', 'sync-qnap-backups', 'ssd-guard'].includes(p.id)) ? `
          <g class="storage-pipe-pill-group ${isSelected ? 'is-selected' : ''}" transform="translate(${mx - pillW / 2}, ${my - 9})">
            <rect width="${pillW}" height="18" rx="9" class="storage-pipe-pill-bg" />
            <text x="${pillW / 2}" y="12.5" text-anchor="middle" class="storage-pipe-pill-text" style="font-size:9px;">${escapeHtml(label)}</text>
          </g>` : ''}
        </g>`;
    });

    svg.innerHTML = html;

    svg.querySelectorAll('[data-pipe-id]').forEach(g => {
      g.addEventListener('click', () => {
        const id = g.getAttribute('data-pipe-id');
        selectItem('pipeline', id);
      });
    });
  }

  function renderWaveform() {
    const canvas = document.getElementById('storage-waveform-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const pts = state.waveformHistory.length > 1
      ? state.waveformHistory
      : [{ nuc: 0, qnap: 0, desk: 0 }, state.waveformHistory[0] || { nuc: 0, qnap: 0, desk: 0 }];

    const maxVal = Math.max(10, ...pts.map(p => Math.max(p.nuc, p.qnap, p.desk)));

    function drawSeries(key, color, fillAlpha) {
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const x = (idx / Math.max(1, pts.length - 1)) * (w - 16) + 8;
        const y = h - 14 - (safeNum(p[key]) / maxVal) * (h - 28);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.lineTo(w - 8, h - 14);
      ctx.lineTo(8, h - 14);
      ctx.closePath();
      ctx.fillStyle = fillAlpha;
      ctx.fill();
    }

    drawSeries('nuc', '#38bdf8', 'rgba(56, 189, 248, 0.12)');
    drawSeries('qnap', '#a855f7', 'rgba(168, 85, 247, 0.10)');
    drawSeries('desk', '#10b981', 'rgba(16, 185, 129, 0.08)');

    // Scale label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(`Peak Scale: ${maxVal.toFixed(1)} MB/s`, 10, 16);
  }

  function renderCapacityBars(data) {
    const t = data.tiers || {};
    const nucHot = t.nuc_hot || {};
    const nucDTotal = safeNum(nucHot.dDriveTotalGB, 0);
    const nucDFree = safeNum(nucHot.dDriveFreeGB, 0);
    const nucCVol = Array.isArray(nucHot.volumes) ? nucHot.volumes.find(v => v && v.drive === 'C:') : null;
    const nucCTotal = nucCVol ? safeNum(nucCVol.totalGB, 0) : Math.max(0, safeNum(nucHot.totalGB, 0) - nucDTotal);
    const nucCFree = nucCVol ? safeNum(nucCVol.freeGB, 0) : Math.max(0, safeNum(nucHot.freeGB, 0) - nucDFree);
    const nucCUsed = nucCVol ? safeNum(nucCVol.usedGB, Math.max(0, nucCTotal - nucCFree)) : Math.max(0, nucCTotal - nucCFree);
    const rows = [
      {
        label: 'QNAP SMB Cold Archive (Q:)',
        used: safeNum(t.qnap_smb && t.qnap_smb.usedGB),
        total: safeNum(t.qnap_smb && t.qnap_smb.totalGB, 0),
        color: '#10b981'
      },
      {
        label: 'Desktop Hot Array (C:/D:/F:)',
        used: safeNum(t.desktop_hot && t.desktop_hot.usedGB),
        total: safeNum(t.desktop_hot && t.desktop_hot.totalGB, 0),
        color: '#3b82f6'
      },
      {
        label: 'NUC C: NVMe OS (C:)',
        used: nucCUsed,
        total: nucCTotal,
        color: '#ec4899'
      },
      {
        label: 'NUC D: FireCuda SSHD (30% Marker)',
        used: safeNum(nucHot.dDriveUsedGB),
        total: nucDTotal,
        color: '#a855f7',
        marker70: true
      },
      {
        label: 'NUC iSCSI LUN (E:)',
        used: safeNum(t.qnap_iscsi_nuc && t.qnap_iscsi_nuc.usedGB),
        total: safeNum(t.qnap_iscsi_nuc && t.qnap_iscsi_nuc.totalGB, 0),
        color: '#38bdf8'
      },
      {
        label: 'Desktop iSCSI LUN (E:)',
        used: safeNum(t.qnap_iscsi_desktop && t.qnap_iscsi_desktop.usedGB),
        total: safeNum(t.qnap_iscsi_desktop && t.qnap_iscsi_desktop.totalGB, 0),
        color: '#60a5fa'
      },
      {
        label: 'OneDrive Cloud Vault',
        used: safeNum(t.cloud_onedrive && t.cloud_onedrive.totalGB),
        total: safeNum(t.cloud_onedrive && t.cloud_onedrive.totalGB, 0),
        color: '#f59e0b',
        isCloud: true
      }
    ];

    const totalCluster = rows.reduce((s, r) => s + r.total, 0) || 1;
    const stackedEl = document.getElementById('storage-capacity-stacked');
    if (stackedEl) {
      stackedEl.innerHTML = rows
        .map(r => `<div class="storage-cap-seg" style="width:${((r.total / totalCluster) * 100).toFixed(2)}%;background:${r.color};" title="${escapeHtml(r.label)}: ${fmtGB(r.total)}"></div>`)
        .join('');
    }

    const barsEl = document.getElementById('storage-capacity-bars');
    if (barsEl) {
      barsEl.innerHTML = rows.map(r => {
        const pct = r.isCloud ? Math.min(100, Math.max(0, (r.used / 1024) * 100)) : Math.min(100, Math.max(0, r.total > 0 ? (r.used / r.total) * 100 : 0));
        const rightLbl = r.isCloud ? `${fmtGB(r.used)} Synced` : `${fmtGB(r.used)} / ${fmtGB(r.total)} (${pct.toFixed(0)}%)`;
        return `
          <div class="storage-cap-row">
            <div class="storage-cap-row-top">
              <span>${escapeHtml(r.label)}</span>
              <span>${escapeHtml(rightLbl)}</span>
            </div>
            <div class="storage-cap-track">
              <div class="storage-cap-fill" style="width:${pct.toFixed(1)}%;background:${r.color};"></div>
              ${r.marker70 ? '<div class="storage-threshold-marker" title="30% Free Offload Threshold"></div>' : ''}
            </div>
          </div>`;
      }).join('');
    }
  }

  function updateInspector() {
    const pipelines = Array.isArray(state.data && state.data.pipelines) ? state.data.pipelines : [];
    let p = null;
    let nodeInfo = null;

    if (state.selectedType === 'node') {
      nodeInfo = NODE_DETAILS[state.selectedId] || null;
      if (nodeInfo && nodeInfo.pipelineId) {
        p = pipelines.find(item => item.id === nodeInfo.pipelineId) || null;
      }
    } else {
      p = pipelines.find(item => item.id === state.selectedId) || pipelines[0] || null;
    }

    if (nodeInfo && !p) {
      setText('insp-title', nodeInfo.title);
      setText('insp-desc', nodeInfo.description);
      setText('insp-script-name', nodeInfo.scriptName);
      setText('insp-script-path', nodeInfo.scriptPath);
      setText('insp-route', nodeInfo.route);
      setText('insp-schedule', nodeInfo.schedule);
      setText('insp-last-sync', 'Live Telemetry');
      setText('insp-bytes', 'Cluster Active');
      setText('insp-rate', '0.0 MB/s');
      setText('insp-exit', 'Healthy');
      setText('insp-health-badge', 'Online');
      const trigBtn = document.getElementById('insp-trigger-btn');
      if (trigBtn) {
        trigBtn.disabled = true;
        trigBtn.textContent = 'Node Telemetry Only';
        trigBtn.onclick = null;
      }
      return;
    }

    if (!p) return;

    setText('insp-title', nodeInfo ? `${nodeInfo.title} — ${p.name}` : p.name);
    setText('insp-desc', safeStr(p.description || p.summary, 'Automated storage pipeline.'));
    setText('insp-script-name', safeStr(p.id, 'pipeline'));
    setText('insp-script-path', safeStr(p.scriptPath, 'C:\\ProgramData\\digitalresolve\\'));
    setText('insp-route', `${safeStr(p.sourceTier, 'source')} -> ${safeStr(p.targetTier, 'target')}`);
    const nextStr = p.nextRunAt ? ` (Next: ${fmtNextTime(p.nextRunAt)})` : '';
    setText('insp-schedule', safeStr(p.schedule, 'Scheduled') + nextStr);
    setText('insp-last-sync', p.lastRunAt ? `${fmtRelativeTime(p.lastRunAt)} (${new Date(p.lastRunAt).toLocaleTimeString()})` : 'Scheduled');
    setText('insp-bytes', `${safeStr(p.bytesCopiedFormatted, fmtBytes(p.bytesCopied))} (${safeNum(p.filesMoved, 0)} files)`);
    setText('insp-rate', `${safeNum(p.durationSec, 0)}s • ${safeNum(p.rateMBps, 0).toFixed(2)} MB/s`);
    setText('insp-exit', safeStr(p.summary, safeStr(p.status, 'Healthy')));

    const badge = document.getElementById('insp-health-badge');
    if (badge) {
      const st = String(p.status || 'success').toLowerCase();
      badge.textContent = st === 'success' ? 'Healthy' : st.toUpperCase();
      badge.className = 'storage-node-tag ' + (st === 'error' ? 'warn' : st === 'warning' ? 'warn' : 'ok');
    }

    const trigBtn = document.getElementById('insp-trigger-btn');
    if (trigBtn) {
      if (p.triggerAction) {
        trigBtn.disabled = false;
        trigBtn.textContent = 'Run Pipeline Now (M365 SSO)';
        trigBtn.onclick = () => triggerPipeline(p);
      } else {
        trigBtn.disabled = true;
        trigBtn.textContent = 'Scheduled / Hook-Driven';
        trigBtn.onclick = null;
      }
    }
  }

  function renderMatrix(data) {
    const grid = document.getElementById('storage-matrix-grid');
    if (!grid) return;
    const pipelines = Array.isArray(data && data.pipelines) ? data.pipelines : [];
    const filtered = pipelines.filter(p => matchesFilter(p.category, state.filter));
    const maxRate = Math.max(10, ...pipelines.map(p => safeNum(p.rateMBps, 0)));

    grid.innerHTML = filtered.map(p => {
      const rate = safeNum(p.rateMBps, 0);
      const pct = Math.min(100, Math.max(4, (rate / maxRate) * 100));
      const st = String(p.status || 'success').toLowerCase();
      const tagClass = st === 'error' || st === 'warning' ? 'warn' : 'ok';
      return `
        <article class="storage-script-card" data-pipeline-card="${escapeHtml(p.id)}">
          <div>
            <div class="storage-node-top">
              <span class="storage-node-name">${escapeHtml(p.name)}</span>
              <span class="storage-node-tag ${tagClass}">${escapeHtml(st === 'success' ? 'Healthy' : st)}</span>
            </div>
            <div class="storage-script-path">${escapeHtml(safeStr(p.scriptPath, ''))}</div>
            <p class="storage-script-desc" style="margin: 8px 0;">${escapeHtml(safeStr(p.description, p.summary || ''))}</p>
          </div>
          <div>
            <div class="storage-cap-row-top" style="margin-bottom: 4px;">
              <span>Last: ${escapeHtml(fmtRelativeTime(p.lastRunAt))}</span>
              <span>${escapeHtml(safeStr(p.bytesCopiedFormatted, fmtBytes(p.bytesCopied)))} &bull; ${rate.toFixed(1)} MB/s</span>
            </div>
            <div class="storage-rate-bar-bg" style="margin-bottom: 10px;">
              <div class="storage-rate-bar-fill" style="width: ${pct.toFixed(1)}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
              <button type="button" class="btn btn-secondary" data-inspect-id="${escapeHtml(p.id)}" style="padding: 5px 10px; font-size: 0.75rem;">Inspect</button>
              ${p.triggerAction
                ? `<button type="button" class="btn btn-primary" data-trigger-id="${escapeHtml(p.id)}" style="padding: 5px 12px; font-size: 0.75rem;">Run Now</button>`
                : `<span style="font-size: 0.72rem; color: #64748b; font-family: var(--font-mono);">Hook / Scheduled</span>`}
            </div>
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('[data-inspect-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectItem('pipeline', btn.getAttribute('data-inspect-id'));
        const insp = document.getElementById('storage-inspector-card');
        if (insp) insp.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    grid.querySelectorAll('[data-trigger-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-trigger-id');
        const p = pipelines.find(item => item.id === id);
        if (p) triggerPipeline(p);
      });
    });
  }

  function renderActivityTable(data) {
    const tbody = document.getElementById('storage-activity-tbody');
    if (!tbody) return;
    const events = Array.isArray(data && data.recentEvents) ? data.recentEvents : [];
    if (events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#94a3b8;text-align:center;">No recent transfer events recorded yet.</td></tr>';
      return;
    }

    const pipelines = Array.isArray(data && data.pipelines) ? data.pipelines : [];
    const pipeById = {};
    pipelines.forEach(p => { pipeById[p.id] = p; });

    tbody.innerHTML = events.slice(0, 20).map(ev => {
      const p = pipeById[ev.pipelineId] || {};
      const lvl = String(ev.level || 'info').toLowerCase();
      const tagCls = lvl === 'error' || lvl === 'warn' || lvl === 'warning' ? 'warn' : 'ok';
      const ts = ev.timestamp ? new Date(ev.timestamp).toLocaleString() : 'Recent';
      return `
        <tr>
          <td class="mono" style="font-size:0.76rem;color:#94a3b8;">${escapeHtml(ts)}</td>
          <td><strong>${escapeHtml(safeStr(p.name, ev.pipelineId))}</strong></td>
          <td class="mono" style="font-size:0.75rem;">${escapeHtml(safeStr(ev.host, 'NUC'))}</td>
          <td class="mono" style="font-size:0.76rem;">${ev.bytesFormatted ? escapeHtml(ev.bytesFormatted) : '--'}</td>
          <td class="mono" style="font-size:0.76rem;">${ev.rateMBps != null ? safeNum(ev.rateMBps, 0).toFixed(1) + ' MB/s' : '--'}</td>
          <td><span class="storage-node-tag ${tagCls}">${escapeHtml(safeStr(ev.level, 'INFO').toUpperCase())}</span> <span style="font-size:0.76rem;color:#cbd5e1;margin-left:6px;">${escapeHtml(safeStr(ev.message, ''))}</span></td>
        </tr>`;
    }).join('');
  }

  function selectItem(type, id) {
    state.selectedType = type;
    state.selectedId = id;
    document.querySelectorAll('.storage-node-card').forEach(card => {
      card.classList.toggle('is-selected', type === 'node' && card.getAttribute('data-node-id') === id);
    });
    renderPipesSVG(state.data || {});
    updateInspector();
  }

  function triggerPipeline(pipeline) {
    if (!pipeline || !pipeline.triggerAction) return;
    const isAuthed = typeof window.isSSOAuthenticated === 'function' && window.isSSOAuthenticated();
    if (!isAuthed) {
      if (typeof window.openGlobalSSOModal === 'function') {
        window.openGlobalSSOModal(`Run Storage Pipeline: ${pipeline.name}`, () => executePipelineTrigger(pipeline));
      } else if (typeof window.unlockSSO === 'function') {
        window.unlockSSO('m365');
      }
      return;
    }
    executePipelineTrigger(pipeline);
  }

  async function executePipelineTrigger(pipeline, retried = false) {
    const base = isHttps ? GATEWAY : LAN_BASE;
    const url = `${base}/api/storage-flow/trigger`;
    const headers = typeof window.getAdminAuthHeaders === 'function'
      ? window.getAdminAuthHeaders({ 'Content-Type': 'application/json' })
      : { 'Content-Type': 'application/json' };

    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ action: pipeline.triggerAction })
      });
      if (res.status === 401 || res.status === 403) {
        if (!retried && typeof window.openGlobalSSOModal === 'function') {
          window.openGlobalSSOModal(`Authorize Pipeline: ${pipeline.name}`, () => executePipelineTrigger(pipeline, true));
        } else if (typeof window.showToast === 'function') {
          window.showToast('error', 'Authorization Required', `Pipeline trigger returned HTTP ${res.status}.`, 4500);
        }
        return;
      }
      if (!res.ok) {
        if (typeof window.showToast === 'function') {
          window.showToast('error', 'Pipeline Trigger Failed', `HTTP ${res.status}`, 4500);
        }
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data || data.status !== 'success') {
        throw new Error((data && data.message) || 'Gateway rejected request');
      }
      if (typeof window.showToast === 'function') {
        window.showToast('success', 'Pipeline Triggered', `${pipeline.name} dispatched on cluster.`, 4500);
      }
      setTimeout(fetchStorageFlow, 1500);
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast('error', 'Trigger Error', err.message || 'Gateway unreachable', 4500);
      }
    }
  }

  function init() {
    // Wire filter pills
    document.querySelectorAll('#storage-filter-pills .storage-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        state.filter = pill.getAttribute('data-filter') || 'all';
        document.querySelectorAll('#storage-filter-pills .storage-filter-pill').forEach(b => {
          const active = b === pill;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (state.data) {
          renderTierNodes(state.data);
          renderPipesSVG(state.data);
          renderMatrix(state.data);
        }
      });
    });

    // Wire node clicks
    document.querySelectorAll('.storage-node-card').forEach(card => {
      card.addEventListener('click', () => {
        selectItem('node', card.getAttribute('data-node-id'));
      });
    });

    // Wire Pause/Play animation
    const animBtn = document.getElementById('btn-toggle-flow-anim');
    if (animBtn) {
      animBtn.addEventListener('click', () => {
        state.animPaused = !state.animPaused;
        const stage = document.getElementById('storage-flow-stage');
        if (stage) stage.classList.toggle('is-paused', state.animPaused);
        animBtn.textContent = state.animPaused ? 'Resume Flow Animation' : 'Pause Flow Animation';
        if (state.data) renderPipesSVG(state.data);
      });
    }

    // Wire Refresh button
    const refBtn = document.getElementById('btn-refresh-storage-flow');
    if (refBtn) {
      refBtn.addEventListener('click', () => fetchStorageFlow());
    }

    window.addEventListener('resize', () => {
      if (state.data) renderPipesSVG(state.data);
      renderWaveform();
    });

    fetchStorageFlow();
    state.pollTimer = setInterval(() => {
      if (!document.hidden && !state.inFlight) fetchStorageFlow();
    }, 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
