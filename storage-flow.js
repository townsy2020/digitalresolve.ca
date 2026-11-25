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
    unauthenticated: false,
    triggerInFlight: new Set()
  };

  // Semantic category-colored node-to-node routing (#a855f7 Media, #10b981 Backup/DR, #f59e0b Guardrail)
  const PIPE_NODE_MAP = {
    'postprocess-torrent': { from: 'postprocess-7z', to: 'nuc-d', color: '#a855f7', dy: 0, shortLabel: '7z PostProcess' },
    'tier-coldstorage': { from: 'nuc-d', to: 'qnap-smb', color: '#a855f7', dy: -6, shortLabel: 'Cold-Storage Tiering' },
    'audible-sync': { from: 'audible-sync', to: 'qnap-smb', color: '#a855f7', dy: 0, dy2: 18, shortLabel: 'Audible Cloud Sync' },
    'audiobook-ingest': { from: 'nuc-c', to: 'qnap-smb', color: '#a855f7', dy: 18, dy2: 6, shortLabel: 'Audiobook Ingest' },
    'homelab-resilience': { from: 'nuc-c', to: 'qnap-iscsi-nuc', color: '#10b981', dy: -8, shortLabel: 'Resilience Snapshot' },
    'iscsi-watchdog': { from: 'nuc-qbit', to: 'qnap-iscsi-nuc', color: '#f59e0b', dy: 0, dy2: 14, shortLabel: 'iSCSI Watchdog' },
    'baremetal-nuc': { from: 'nuc-c', to: 'qnap-iscsi-nuc', color: '#10b981', dy: 6, shortLabel: 'NUC Bare-Metal' },
    'baremetal-desktop': { from: 'desktop-drives', to: 'qnap-iscsi-desktop', color: '#10b981', dy: 12, shortLabel: 'Desktop Bare-Metal' },
    'sync-qnap-backups': { from: 'qnap-iscsi-nuc', to: 'qnap-iscsi-desktop', color: '#10b981', dy: 0, shortLabel: 'QNAP LUN Mirror' },
    'cloud-daily': { from: 'nuc-c', to: 'onedrive-vault', color: '#10b981', dy: -14, dy2: -6, shortLabel: 'Cloud Daily Backup' },
    'dr-nightly': { from: 'nuc-c', to: 'onedrive-vault', color: '#10b981', dy: -2, dy2: 10, shortLabel: 'Nightly DR Sync' },
    'ssd-guard': { from: 'nuc-c', to: 'nuc-qbit', color: '#f59e0b', dy: 0, shortLabel: 'NVMe 20% Space Guard' }
  };

  const PIPELINE_FALLBACKS = {
    'tier-coldstorage': { id: 'tier-coldstorage', name: 'Media Cold-Storage Tiering', category: 'media', sourceTier: 'nuc_hot', targetTier: 'qnap_smb', scriptPath: 'C:\\ProgramData\\StreamHub\\Tier-ColdStorage.ps1', schedule: 'Every 2 hours', description: 'Offloads completed qBittorrent media packages from NUC D: 2 TB SATA Hybrid HDD to QNAP SMB cold archive whenever NUC D: drops below 30% free.', triggerAction: 'run-tier-coldstorage' },
    'audible-sync': { id: 'audible-sync', name: 'Audible Library Sync', category: 'media', sourceTier: 'audible_cloud', targetTier: 'qnap_smb', scriptPath: 'C:\\ProgramData\\qBittorrent-Automation\\sync_audible.py', schedule: 'Daily 05:00', description: 'Downloads new Audible audiobooks & vouchers directly into QNAP SMB cold storage.', triggerAction: 'run-audible-sync' },
    'audiobook-ingest': { id: 'audiobook-ingest', name: 'Audiobook Sort & Ingest', category: 'media', sourceTier: 'nuc_hot', targetTier: 'qnap_smb', scriptPath: 'C:\\ProgramData\\qBittorrent-Automation\\sort_and_ingest_audiobooks.py', schedule: 'Post-Sync', description: 'Organizes ingested audiobooks into QNAP SMB Progression Fantasy library and triggers Audiobookshelf scan.', triggerAction: 'run-audiobook-ingest' },
    'postprocess-torrent': { id: 'postprocess-torrent', name: 'qBittorrent Post-Process Hook', category: 'media', sourceTier: 'nuc_hot', targetTier: 'nuc_hot', scriptPath: 'C:\\ProgramData\\qBittorrent-Automation\\PostProcess-Torrent.ps1', schedule: 'On Completion', description: 'Extracts 7z/RAR/ZIP archives and stages completed torrent media into NUC D: hot library.', triggerAction: '' },
    'homelab-resilience': { id: 'homelab-resilience', name: 'Homelab Resilience Snapshot', category: 'backup', sourceTier: 'nuc_hot', targetTier: 'qnap_iscsi_nuc', scriptPath: 'C:\\ProgramData\\digitalresolve\\Backup-HomelabResilience.ps1', schedule: 'Weekly Sun 03:30', description: 'Snapshots critical homelab scripts, configs, Caddy, and go2rtc state to NUC E: iSCSI LUN and OneDrive.', triggerAction: 'run-resilience-backup' },
    'sync-qnap-backups': { id: 'sync-qnap-backups', name: 'Desktop QNAP Backup Mirror', category: 'backup', sourceTier: 'qnap_iscsi_nuc', targetTier: 'qnap_iscsi_desktop', scriptPath: '%USERPROFILE%\\Projects\\Sync-QNAP-HomelabBackups.ps1', schedule: 'Daily 03:45', description: 'Mirrors NUC E: Homelab-Resilience snapshots onto Desktop E: QNAP iSCSI LUN with retention pruning.', triggerAction: 'run-qnap-sync' },
    'baremetal-nuc': { id: 'baremetal-nuc', name: 'NUC Weekly Bare-Metal Image', category: 'backup', sourceTier: 'nuc_hot', targetTier: 'qnap_iscsi_nuc', scriptPath: 'C:\\ProgramData\\digitalresolve\\Run-BareMetalBackup.ps1', schedule: 'Weekly Sun 04:30', description: 'Creates full wbadmin WindowsImageBackup of NUC C: OS NVMe onto NUC E: QNAP iSCSI LUN.', triggerAction: '' },
    'baremetal-desktop': { id: 'baremetal-desktop', name: 'Desktop Weekly Bare-Metal Image', category: 'backup', sourceTier: 'desktop_hot', targetTier: 'qnap_iscsi_desktop', scriptPath: 'C:\\ProgramData\\digitalresolve\\Run-BareMetalBackup.ps1', schedule: 'Weekly Sun 04:00', description: 'Creates full wbadmin WindowsImageBackup of Desktop C: OS NVMe onto Desktop E: QNAP iSCSI LUN.', triggerAction: '' },
    'cloud-daily': { id: 'cloud-daily', name: 'Cloud Daily Offsite Backup', category: 'backup', sourceTier: 'nuc_hot', targetTier: 'cloud_onedrive', scriptPath: '%USERPROFILE%\\Projects\\scripts\\Backup-Homelab-Cloud.py', schedule: 'Daily 02:00', description: 'Replicates daily homelab configs and database snapshots offsite to OneDrive Antigravity-Backups.', triggerAction: 'run-cloud-backup' },
    'dr-nightly': { id: 'dr-nightly', name: 'Nightly Disaster Recovery Sync', category: 'backup', sourceTier: 'nuc_hot', targetTier: 'cloud_onedrive', scriptPath: 'C:\\ProgramData\\digitalresolve\\Backup-DisasterRecovery.ps1', schedule: 'Daily 03:00', description: 'Backs up qBittorrent state, cloudflared configs, and StreamHub metadata to OneDrive Nightly-Backups.', triggerAction: '' },
    'ssd-guard': { id: 'ssd-guard', name: 'NVMe & SSD Free-Space Guard', category: 'guard', sourceTier: 'nuc_hot', targetTier: 'nuc_hot', scriptPath: 'C:\\ProgramData\\digitalresolve\\Enforce-SsdFreeSpace.ps1', schedule: 'Every 30 min', description: 'Monitors C: NVMe headroom (20% floor) and SMART thermals across NUC and Desktop.', triggerAction: 'run-ssd-guard-nuc' },
    'iscsi-watchdog': { id: 'iscsi-watchdog', name: 'QNAP iSCSI Persistent Watchdog', category: 'guard', sourceTier: 'nuc_hot', targetTier: 'qnap_iscsi_nuc', scriptPath: 'C:\\ProgramData\\digitalresolve\\Watchdog-QnapIscsi.ps1', schedule: 'Every 3 min', description: 'Verifies QNAP TS-639 iSCSI TCP :3260 session health and E: drive availability.', triggerAction: 'run-iscsi-watchdog-nuc' }
  };

  const NODE_DETAILS = {
    'desktop-drives': {
      title: 'Desktop NVMe (C: / F:) + 6 TB HDD (D:)',
      scriptName: 'Desktop Volume & NVMe Telemetry',
      scriptPath: 'C:\\ProgramData\\digitalresolve\\wol-listener.ps1',
      route: 'Desktop Workstation -> Cluster Telemetry',
      schedule: 'Continuous 10s cache',
      description: 'Samsung 970 EVO 500 GB NVMe (C:), WD SN750 500 GB NVMe (F:), and WD Black 6 TB SATA HDD (D:) monitored for thermals and bare-metal DR.',
      pipelineId: 'baremetal-desktop'
    },
    'desktop-qbit': {
      title: 'Desktop qBittorrent Ingest (:8080)',
      scriptName: 'qBittorrent Workstation Swarm',
      scriptPath: 'Desktop qBittorrent WebUI (:8080)',
      route: 'WAN Swarm -> Desktop Staging -> PostProcess 7z',
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
      description: 'Automatically extracts multi-part 7z/RAR/ZIP archives for Sonarr, Radarr, and Readarr import.',
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
      title: 'NUC C: 1 TB Crucial P1 NVMe SSD (OS)',
      scriptName: 'Intel NUC 24/7 Core NVMe Volume',
      scriptPath: 'C:\\ProgramData\\digitalresolve\\Backup-HomelabResilience.ps1',
      route: 'NUC C:\\ -> QNAP iSCSI LUN (E:) & OneDrive',
      schedule: 'Daily snapshots + 20% SSD Guard',
      description: 'Crucial P1 1 TB NVMe SSD (930 GB) hosting 24/7 gateway, go2rtc, Jellyfin, Arr stack, and Enforce-SsdFreeSpace.ps1 20% headroom guard.',
      pipelineId: 'homelab-resilience'
    },
    'nuc-d': {
      title: 'NUC D: 2 TB SATA Hybrid HDD (30% Guardrail)',
      scriptName: 'Tier-ColdStorage Offload Guardrail',
      scriptPath: 'C:\\ProgramData\\StreamHub\\Tier-ColdStorage.ps1',
      route: 'NUC D:\\ -> QNAP SMB Cold Archive (Q:)',
      schedule: 'Enforced at 30% free-space threshold',
      description: 'Seagate FireCuda ST2000LX001 2 TB 2.5" 5400 RPM SATA Hybrid HDD (1.86 TiB formatted — mechanical SSHD, not NVMe); auto-tiers completed media to QNAP SMB below 30% free.',
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
      scriptPath: '\\\\QNAP-NAS\\Torrents (Q:)',
      route: 'NUC D:\\ -> QNAP SMB :445 Cold Archive',
      schedule: 'Continuous SMB mount + Tiering',
      description: 'RAID cold storage archive holding tiered movies, TV series, and audiobooks.',
      pipelineId: 'tier-coldstorage'
    },
    'qnap-iscsi-nuc': {
      title: 'QNAP NUC iSCSI LUN (E:)',
      scriptName: 'NUC iSCSI Block Target & Watchdog',
      scriptPath: 'C:\\ProgramData\\digitalresolve\\Watchdog-QnapIscsi.ps1',
      route: 'NUC -> QNAP iSCSI :3260 (E:)',
      schedule: 'Watchdog every 3 min + Nightly/Weekly DR',
      description: 'Dedicated iSCSI block LUN storing Homelab Resilience snapshots and WindowsImageBackup.',
      pipelineId: 'homelab-resilience'
    },
    'qnap-iscsi-desktop': {
      title: 'QNAP Desktop iSCSI LUN (E:)',
      scriptName: 'Desktop iSCSI Block Target & Mirror',
      scriptPath: '%USERPROFILE%\\Projects\\Sync-QNAP-HomelabBackups.ps1',
      route: 'Desktop -> QNAP iSCSI :3260 (E:)',
      schedule: 'Scheduled Mirror + Weekly Bare-Metal',
      description: 'Dedicated iSCSI block LUN for Desktop bare-metal images and mirrored NUC snapshots.',
      pipelineId: 'sync-qnap-backups'
    },
    'onedrive-vault': {
      title: 'OneDrive Offsite Cloud Vault',
      scriptName: 'Cloud Daily & DR Nightly Sync',
      scriptPath: '%USERPROFILE%\\Projects\\scripts\\Backup-Homelab-Cloud.py',
      route: 'NUC C:\\ -> %OneDriveCommercial%\\Antigravity-Backups',
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
    if (val === null || val === undefined || val === '') return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  function isValidNum(val) {
    return val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val));
  }

  function fmtGB(gb) {
    if (!isValidNum(gb)) return '--';
    const n = Number(gb);
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
    const i = Math.max(0, Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024))));
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
        } else if (isHttps && err && err.name === 'TypeError' && !(typeof window.isSSOAuthenticated === 'function' && window.isSSOAuthenticated())) {
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
      if (!json || typeof json !== 'object' || Array.isArray(json) || (json.status !== 'success' && !json.tiers && !Array.isArray(json.pipelines))) {
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

  function resetCapacityFallbacks(fallbackMessage) {
    [
      'kpi-total-capacity',
      'kpi-qnap-link',
      'kpi-flowrate',
      'kpi-data-moved',
      'flow-active-count',
      'node-tag-desktop-drives',
      'node-tag-nuc-c',
      'node-tag-nuc-d',
      'nuc-d-used-lbl',
      'node-tag-qnap-smb',
      'node-tag-qnap-iscsi-nuc',
      'node-tag-qnap-iscsi-desktop',
      'node-tag-onedrive-vault',
      'waveform-active-badge',
      'capacity-summary-badge'
    ].forEach(id => {
      setText(id, '--');
    });
    setText('kpi-qnap-sub', 'QNAP NAS • SMB :445 + iSCSI :3260');
    [
      'node-tag-desktop-drives',
      'node-tag-nuc-c',
      'node-tag-nuc-d',
      'node-tag-qnap-smb',
      'node-tag-qnap-iscsi-nuc',
      'node-tag-qnap-iscsi-desktop',
      'waveform-active-badge'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.className = 'storage-node-tag info';
    });
    const fillEl = document.getElementById('nuc-d-threshold-fill');
    if (fillEl) fillEl.style.width = '0%';
    setText('node-meta-desktop-drives', 'C: + D: + F: • Standby');
    setText('node-meta-nuc-c', 'NUC Core • --');
    setText('node-meta-nuc-d', 'D: Staging • 30% Offload Guardrail');
    setText('node-meta-qnap-smb', 'SMB Share (Q:) • --');
    setText('node-meta-qnap-iscsi-nuc', 'E: • -- • Homelab Resilience & WindowsImageBackup');
    setText('node-meta-qnap-iscsi-desktop', 'E: • -- • Mirrored Snapshots & Bare-Metal');
    setText('node-meta-onedrive-vault', 'Offsite Encrypted Cloud Vault');
    const odTagFallback = document.getElementById('node-tag-onedrive-vault');
    if (odTagFallback) odTagFallback.className = 'storage-node-tag info';
    applyNodeCategoryFilter();
    const stackedEl = document.getElementById('storage-capacity-stacked');
    if (stackedEl) stackedEl.innerHTML = '';
    const barsEl = document.getElementById('storage-capacity-bars');
    if (barsEl) {
      barsEl.innerHTML = `<div style="padding:14px;color:#94a3b8;font-size:0.84rem;">${escapeHtml(fallbackMessage || 'Cluster Gateway Standby — Awaiting Live Storage Telemetry')}</div>`;
    }
    const gridEl = document.getElementById('storage-matrix-grid');
    if (gridEl) {
      gridEl.innerHTML = `<div style="grid-column:1/-1;padding:16px;color:#94a3b8;font-size:0.84rem;">${escapeHtml(fallbackMessage || 'Sign in or connect on LAN to inspect live pipeline metrics.')}</div>`;
    }
    const tbodyEl = document.getElementById('storage-activity-tbody');
    if (tbodyEl) {
      tbodyEl.innerHTML = `<tr><td colspan="6" style="color:#94a3b8;text-align:center;">${escapeHtml(fallbackMessage || 'Telemetry standby — awaiting live gateway connection.')}</td></tr>`;
    }
    renderPipesSVG(null);
    updateInspector();
  }

  function renderAuthFallback() {
    state.data = null;
    state.unauthenticated = true;
    const banner = document.getElementById('storage-sso-banner');
    if (banner) banner.style.display = 'flex';
    setText('storage-route-text', 'M365 SSO');
    setText('storage-updated-text', 'Sign in for Live Telemetry');
    setText('kpi-last-sync', 'M365 SSO');
    setText('kpi-last-sync-sub', 'Sign in for Live Telemetry');
    resetCapacityFallbacks('Sign In via M365 SSO to load live cluster drive capacities.');
  }

  function renderOfflineFallback() {
    state.data = null;
    state.unauthenticated = false;
    const banner = document.getElementById('storage-sso-banner');
    if (banner) banner.style.display = 'none';
    setText('storage-route-text', 'Gateway Offline');
    setText('storage-updated-text', 'Retrying Telemetry');
    setText('kpi-last-sync', 'Offline');
    setText('kpi-last-sync-sub', 'Gateway Unavailable — Retrying');
    resetCapacityFallbacks('Gateway Offline — Cluster storage telemetry temporarily unavailable.');
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function pushWaveformSample(data) {
    const lf = (data && data.liveFlow) || {};
    const nucIO = safeNum(lf.nucDiskReadMBps) + safeNum(lf.nucDiskWriteMBps);
    const qnapIO = Math.max(safeNum(lf.nucIscsiWriteMBps), safeNum(lf.nucNetMBps));
    const deskIO = Math.max(safeNum(lf.desktopDiskMBps), safeNum(lf.desktopNetMBps));
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
      safeNum(t.qnap_iscsi_desktop && t.qnap_iscsi_desktop.totalGB);

    setText('kpi-total-capacity', totalGB > 0 ? fmtGB(totalGB) : '--');
    setText('kpi-total-capacity-sub', 'Desktop + NUC + QNAP SMB & Dual iSCSI (+ Offsite Cloud)');

    const qOnline = Boolean(data.qnapOnline);
    const lat = safeNum(data.qnapLatencyMs, 0);
    setText('kpi-qnap-link', qOnline ? `Online (${lat.toFixed(1)} ms)` : 'Standby');
    setText('kpi-qnap-sub', `SMB :445 ${data.qnapSmbOnline ? 'OK' : 'Offline'} • iSCSI :3260 ${data.qnapIscsiOnline ? 'OK' : 'Offline'}`);

    const lf = data.liveFlow || {};
    const totalFlow = safeNum(lf.totalFlowMBps, 0);
    const pipelines = Array.isArray(data && data.pipelines) ? data.pipelines.filter(p => p && typeof p === 'object') : [];
    const bestRate = pipelines.reduce((m, p) => Math.max(m, safeNum(p.rateMBps, 0)), 0);
    const displayRate = totalFlow > 0 ? totalFlow : bestRate;
    setText('kpi-flowrate', displayRate.toFixed(2) + ' MB/s');
    setText('kpi-flowrate-sub', totalFlow > 0 ? 'Active live disk & network I/O' : 'Peak measured pipeline rate');

    const sortedRuns = pipelines
      .filter(p => p.lastRunAt && Number.isFinite(Date.parse(p.lastRunAt)))
      .sort((a, b) => Date.parse(b.lastRunAt) - Date.parse(a.lastRunAt));
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
    const wfBadgeEl = document.getElementById('waveform-active-badge');
    if (wfBadgeEl) wfBadgeEl.className = 'storage-node-tag ok';
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
    const deskTagEl = document.getElementById('node-tag-desktop-drives');
    if (deskTagEl) deskTagEl.className = 'storage-node-tag ' + (desk.online ? 'ok' : 'info');
    const deskTempVal = getMaxNvmeTemp(desk);
    const deskTemp = deskTempVal !== null ? ` • NVMe ${deskTempVal}°C` : '';
    const deskCapMeta = isValidNum(desk.totalGB) && Number(desk.totalGB) > 0
      ? `${fmtGB(desk.freeGB)} Free / ${fmtGB(desk.totalGB)}`
      : '--';
    setText('node-meta-desktop-drives', `${deskCapMeta}${deskTemp}`);

    const nuc = t.nuc_hot || {};
    const dFreeGB = safeNum(nuc.dDriveFreeGB, 0);
    const dTotalGB = safeNum(nuc.dDriveTotalGB, 0);
    const dUsedPct = dTotalGB > 0 ? Math.min(100, Math.max(0, (safeNum(nuc.dDriveUsedGB, Math.max(0, dTotalGB - dFreeGB)) / dTotalGB) * 100)) : 0;
    setText('node-tag-nuc-d', dTotalGB > 0 ? `${Math.round(dFreeGB)} GB Free` : '--');
    const nucDTagEl = document.getElementById('node-tag-nuc-d');
    if (nucDTagEl) nucDTagEl.className = 'storage-node-tag ' + (dTotalGB > 0 ? (dUsedPct >= 70 ? 'warn' : 'ok') : 'info');
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
    const nucTagEl = document.getElementById('node-tag-nuc-c');
    if (nucTagEl) nucTagEl.className = 'storage-node-tag ' + (nuc.online ? 'ok' : 'info');
    const cCapMeta = cTotalGB > 0 ? `${fmtGB(cFreeGB)} Free / ${fmtGB(cTotalGB)}` : '--';
    setText('node-meta-nuc-c', `NUC Core • ${cCapMeta}${nucTemp}`);

    const smb = t.qnap_smb || {};
    setText('node-tag-qnap-smb', safeNum(smb.totalGB, 0) > 0 ? fmtGB(smb.totalGB) : '--');
    const smbTagEl = document.getElementById('node-tag-qnap-smb');
    if (smbTagEl) smbTagEl.className = 'storage-node-tag ' + (smb.online && safeNum(smb.totalGB, 0) > 0 ? 'ok' : 'info');
    setText('node-meta-qnap-smb', `${safeStr(smb.shareName ? ('SMB Share (' + smb.shareName + ')') : null, 'SMB Share (Q:)')} • ${isValidNum(smb.freeGB) ? fmtGB(smb.freeGB) + ' Free' : '--'}`);

    const iNuc = t.qnap_iscsi_nuc || {};
    setText('node-tag-qnap-iscsi-nuc', safeNum(iNuc.totalGB, 0) > 0 ? fmtGB(iNuc.totalGB) : '--');
    const iNucTagEl = document.getElementById('node-tag-qnap-iscsi-nuc');
    if (iNucTagEl) iNucTagEl.className = 'storage-node-tag ' + (iNuc.online && safeNum(iNuc.totalGB, 0) > 0 ? 'ok' : 'info');
    setText('node-meta-qnap-iscsi-nuc', `${safeStr(iNuc.drive, 'E:')} • ${isValidNum(iNuc.freeGB) ? fmtGB(iNuc.freeGB) + ' Free' : '--'} • ${iNuc.sessionConnected ? 'iSCSI Connected' : 'Standby'}`);

    const iDesk = t.qnap_iscsi_desktop || {};
    setText('node-tag-qnap-iscsi-desktop', safeNum(iDesk.totalGB, 0) > 0 ? fmtGB(iDesk.totalGB) : '--');
    const iDeskTagEl = document.getElementById('node-tag-qnap-iscsi-desktop');
    if (iDeskTagEl) iDeskTagEl.className = 'storage-node-tag ' + (iDesk.online && safeNum(iDesk.totalGB, 0) > 0 ? 'ok' : 'info');
    setText('node-meta-qnap-iscsi-desktop', `${safeStr(iDesk.drive, 'E:')} • ${isValidNum(iDesk.freeGB) ? fmtGB(iDesk.freeGB) + ' Free' : '--'} • Mirrored Snapshots`);

    const od = t.cloud_onedrive || {};
    setText('node-tag-onedrive-vault', od.online ? fmtGB(od.totalGB) : '--');
    const odTagEl = document.getElementById('node-tag-onedrive-vault');
    if (odTagEl) odTagEl.className = 'storage-node-tag ' + (od.online ? 'ok' : 'info');
    setText('node-meta-onedrive-vault', `${safeNum(od.fileCount, 0).toLocaleString()} files • ${safeNum(od.snapshotCount, 0)} snapshots`);

    applyNodeCategoryFilter();
  }

  function applyNodeCategoryFilter() {
    document.querySelectorAll('.storage-node-card').forEach(card => {
      const cats = (card.getAttribute('data-category') || '').split(',');
      const visible = state.filter === 'all' || cats.some(c => matchesFilter(c, state.filter));
      card.classList.toggle('is-dimmed', !visible);
      if (!visible) {
        card.classList.remove('is-selected', 'is-route-endpoint');
      } else if (state.selectedType === 'node') {
        card.classList.toggle('is-selected', card.getAttribute('data-node-id') === state.selectedId);
      }
    });
  }

  function renderPipeSelectorBar(pipelines, hasLive) {
    const bar = document.getElementById('storage-pipe-selector-bar');
    if (!bar) return;
    const visiblePipes = pipelines.filter(p => matchesFilter(p.category, state.filter));
    const activePipeId = state.selectedType === 'pipeline'
      ? state.selectedId
      : ((NODE_DETAILS[state.selectedId] && NODE_DETAILS[state.selectedId].pipelineId) || '');
    bar.innerHTML = visiblePipes.map(p => {
      const cfg = PIPE_NODE_MAP[p.id] || { color: '#38bdf8', shortLabel: p.name };
      const isSel = p.id === activePipeId;
      const rate = safeNum(p.rateMBps, 0);
      const hasBytes = safeNum(p.bytesCopied, 0) > 0;
      const metricTxt = hasLive
        ? (rate > 0 ? `${rate.toFixed(1)} MB/s` : (hasBytes ? safeStr(p.bytesCopiedFormatted, 'Ready') : safeStr(p.schedule, 'Ready')))
        : safeStr(p.schedule, 'Scheduled');
      return `<button type="button" class="storage-pipe-chip ${isSel ? 'is-selected' : ''}" data-chip-pipe-id="${escapeHtml(p.id)}" title="${escapeHtml(p.name)} — Click to highlight route &amp; inspect">
        <span class="storage-pipe-chip-dot" style="background:${cfg.color};box-shadow:0 0 6px ${cfg.color};"></span>
        <span class="storage-pipe-chip-name">${escapeHtml(cfg.shortLabel || p.name)}</span>
        <span class="storage-pipe-chip-meta">${escapeHtml(metricTxt)}</span>
      </button>`;
    }).join('');
    bar.querySelectorAll('[data-chip-pipe-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectItem('pipeline', btn.getAttribute('data-chip-pipe-id'));
      });
    });
  }

  function renderPipesSVG(data) {
    const svg = document.getElementById('storage-flow-svg');
    const stage = document.getElementById('storage-flow-stage');
    if (!svg || !stage) return;

    const livePipelines = Array.isArray(data && data.pipelines) ? data.pipelines.filter(p => p && typeof p === 'object') : [];
    const hasLive = livePipelines.length > 0;
    const pipelines = hasLive ? livePipelines : Object.values(PIPELINE_FALLBACKS);
    const filtered = pipelines.filter(p => matchesFilter(p.category, state.filter));
    setText('flow-active-count', hasLive ? `${filtered.length} Active Pipelines` : '--');
    renderPipeSelectorBar(pipelines, hasLive);

    const activePipeId = state.selectedType === 'pipeline'
      ? state.selectedId
      : ((NODE_DETAILS[state.selectedId] && NODE_DETAILS[state.selectedId].pipelineId) || '');
    const selectedNodeId = state.selectedType === 'node' ? state.selectedId : '';
    const activePipeObj = pipelines.find(item => item.id === activePipeId) || null;
    const activeCfg = (activePipeObj && matchesFilter(activePipeObj.category, state.filter))
      ? (PIPE_NODE_MAP[activePipeId] || null)
      : null;

    const docEl = document.documentElement;
    const isForcedDesktop = docEl.classList.contains('desktop-forced');
    const isMobileLayout = docEl.classList.contains('mobile-layout') || (!isForcedDesktop && window.innerWidth <= 1024);

    document.querySelectorAll('.storage-node-card').forEach(card => {
      const nid = card.getAttribute('data-node-id');
      const isDimmed = card.classList.contains('is-dimmed');
      if (isDimmed) card.classList.remove('is-selected');
      const isEp = Boolean(!isMobileLayout && !isDimmed && activeCfg && (nid === activeCfg.from || nid === activeCfg.to) && nid !== selectedNodeId);
      card.classList.toggle('is-route-endpoint', isEp);
    });

    const stageRect = stage.getBoundingClientRect();
    if (stageRect.width < 100 || isMobileLayout) {
      svg.innerHTML = '';
      return;
    }

    svg.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);

    let html = `<defs>
      <filter id="pipe-glow" filterUnits="userSpaceOnUse" x="-40" y="-40" width="${Math.ceil(stageRect.width + 80)}" height="${Math.ceil(stageRect.height + 80)}">
        <feGaussianBlur stdDeviation="2.2" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

    const pipeItems = pipelines.map(p => ({ p, cfg: PIPE_NODE_MAP[p.id], structural: false }));
    if (pipelines.length > 0) {
      const ppRef = pipelines.find(item => item.id === 'postprocess-torrent') || { id: 'postprocess-torrent', name: 'Desktop qBittorrent Ingest -> PostProcess 7z', category: 'media', rateMBps: 0, bytesCopiedFormatted: 'Ready' };
      pipeItems.push({ p: ppRef, cfg: { from: 'desktop-qbit', to: 'postprocess-7z', color: '#a855f7', dy: 0, shortLabel: 'Ingest Hook' }, structural: true });
    }

    // Render unselected background pipes first, then highlighted/selected pipes on top
    const orderedItems = pipeItems.slice().sort((a, b) => {
      const aHi = (a.p.id === activePipeId) || (selectedNodeId && a.cfg && (a.cfg.from === selectedNodeId || a.cfg.to === selectedNodeId));
      const bHi = (b.p.id === activePipeId) || (selectedNodeId && b.cfg && (b.cfg.from === selectedNodeId || b.cfg.to === selectedNodeId));
      return (aHi ? 1 : 0) - (bHi ? 1 : 0);
    });

    orderedItems.forEach(({ p, cfg, structural }) => {
      if (!cfg) return;
      const fromEl = stage.querySelector(`[data-node-id="${cfg.from}"]`);
      const toEl = stage.querySelector(`[data-node-id="${cfg.to}"]`);
      if (!fromEl || !toEl) return;

      const r1 = fromEl.getBoundingClientRect();
      const r2 = toEl.getBoundingClientRect();

      const sameCol = Math.abs(r1.left - r2.left) < 40;
      let x1, y1, x2, y2, dStr;

      if (sameCol) {
        x1 = r1.right - stageRect.left;
        y1 = r1.top - stageRect.top + r1.height * 0.5;
        x2 = r2.right - stageRect.left;
        y2 = r2.top - stageRect.top + r2.height * 0.5;
        const arcX = Math.max(x1, x2) + 22;
        dStr = `M ${x1} ${y1} C ${arcX} ${y1}, ${arcX} ${y2}, ${x2} ${y2}`;
      } else {
        const goRight = r2.left > r1.left;
        x1 = (goRight ? r1.right : r1.left) - stageRect.left;
        y1 = r1.top - stageRect.top + r1.height * 0.5 + (cfg.dy || 0);
        x2 = (goRight ? r2.left : r2.right) - stageRect.left;
        y2 = r2.top - stageRect.top + r2.height * 0.5 + (cfg.dy2 !== undefined ? cfg.dy2 : (cfg.dy || 0));
        if (Math.abs(y2 - y1) < 6) y2 += 8;
        const dx = Math.min(90, Math.abs(x2 - x1) * 0.42);
        const cx1 = goRight ? x1 + dx : x1 - dx;
        const cx2 = goRight ? x2 - dx : x2 + dx;
        dStr = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
      }

      const isVisible = matchesFilter(p.category, state.filter);
      const isHighlighted = !structural
        ? (p.id === activePipeId || (selectedNodeId && (cfg.from === selectedNodeId || cfg.to === selectedNodeId)))
        : (activePipeId === 'postprocess-torrent' || selectedNodeId === 'desktop-qbit' || selectedNodeId === 'postprocess-7z');
      const isCategoryFiltered = state.filter !== 'all' && isVisible;
      const showFlowAnim = isVisible && (isHighlighted || isCategoryFiltered);
      const opacity = !isVisible ? 0.06 : (isHighlighted ? 0.98 : (isCategoryFiltered ? 0.72 : 0.28));
      const strokeW = isHighlighted ? 3.2 : (isCategoryFiltered ? 2.2 : 1.6);
      const rate = safeNum(p.rateMBps, 0);
      const animDur = rate > 50 ? '0.9s' : rate > 10 ? '1.4s' : rate > 1 ? '2.0s' : '2.8s';

      html += `
        <g opacity="${opacity}" ${isVisible ? `data-pipe-id="${escapeHtml(p.id)}"` : 'style="pointer-events:none;"'}>
          <title>${escapeHtml(p.name)} (${escapeHtml(safeStr(p.bytesCopiedFormatted, '0 B'))} • ${rate.toFixed(1)} MB/s)</title>
          <path d="${dStr}" class="storage-pipe-path" stroke="${cfg.color}" stroke-width="${strokeW}" ${isHighlighted ? 'filter="url(#pipe-glow)"' : ''} />
          ${showFlowAnim ? `<path d="${dStr}" class="storage-pipe-dashed" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.75" style="animation-duration: ${animDur};" />` : ''}
          ${hasLive && showFlowAnim && !state.animPaused ? `
          <circle r="3.6" fill="${cfg.color}" filter="url(#pipe-glow)">
            <animateMotion dur="${animDur}" repeatCount="indefinite" path="${dStr}" />
          </circle>` : ''}
          ${isVisible ? `<path d="${dStr}" class="storage-pipe-hit" stroke="transparent" stroke-width="16" fill="none" />` : ''}
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
        label: 'Desktop NVMe (C:/F:) + 6 TB HDD (D:)',
        used: safeNum(t.desktop_hot && t.desktop_hot.usedGB),
        total: safeNum(t.desktop_hot && t.desktop_hot.totalGB, 0),
        color: '#3b82f6'
      },
      {
        label: 'NUC C: 1 TB NVMe SSD (OS)',
        used: nucCUsed,
        total: nucCTotal,
        color: '#ec4899'
      },
      {
        label: 'NUC D: 2 TB SATA Hybrid HDD (30% Marker)',
        used: safeNum(nucHot.dDriveUsedGB, Math.max(0, nucDTotal - nucDFree)),
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
        label: 'OneDrive Cloud Vault (Offsite)',
        used: safeNum(t.cloud_onedrive && t.cloud_onedrive.totalGB),
        total: 0,
        color: '#f59e0b',
        isCloud: true
      }
    ];

    const physicalRows = rows.filter(r => !r.isCloud);
    const totalCluster = physicalRows.reduce((s, r) => s + r.total, 0) || 1;
    setText('capacity-summary-badge', `${physicalRows.length} Drives • 4 Tiers`);
    const stackedEl = document.getElementById('storage-capacity-stacked');
    if (stackedEl) {
      stackedEl.innerHTML = physicalRows
        .map(r => `<div class="storage-cap-seg" style="width:${((r.total / totalCluster) * 100).toFixed(2)}%;background:${r.color};" title="${escapeHtml(r.label)}: ${r.total > 0 ? fmtGB(r.total) : '--'}"></div>`)
        .join('');
    }

    const barsEl = document.getElementById('storage-capacity-bars');
    if (barsEl) {
      barsEl.innerHTML = rows.map(r => {
        const pct = r.isCloud ? Math.min(100, Math.max(0, (r.used / 1024) * 100)) : Math.min(100, Math.max(0, r.total > 0 ? (r.used / r.total) * 100 : 0));
        const rightLbl = r.isCloud
          ? (r.used > 0 ? `${fmtGB(r.used)} Offsite Synced` : '--')
          : (r.total > 0 ? `${fmtGB(r.used)} / ${fmtGB(r.total)} (${pct.toFixed(0)}%)` : '--');
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
    const pipelines = Array.isArray(state.data && state.data.pipelines) ? state.data.pipelines.filter(item => item && typeof item === 'object') : [];
    const hasLiveData = pipelines.length > 0;
    let p = null;
    let nodeInfo = null;

    if (state.selectedType === 'node') {
      nodeInfo = NODE_DETAILS[state.selectedId] || null;
      if (nodeInfo && nodeInfo.pipelineId) {
        p = pipelines.find(item => item.id === nodeInfo.pipelineId) || PIPELINE_FALLBACKS[nodeInfo.pipelineId] || null;
      }
    } else {
      p = pipelines.find(item => item.id === state.selectedId) || PIPELINE_FALLBACKS[state.selectedId] || pipelines[0] || PIPELINE_FALLBACKS['tier-coldstorage'];
    }

    const offlineStatusLabel = state.unauthenticated ? 'M365 SSO Required' : 'Gateway Standby';

    if (nodeInfo && !hasLiveData) {
      setText('insp-title', nodeInfo.title);
      setText('insp-desc', nodeInfo.description);
      setText('insp-script-name', nodeInfo.scriptName);
      setText('insp-script-path', nodeInfo.scriptPath);
      setText('insp-route', nodeInfo.route);
      setText('insp-schedule', nodeInfo.schedule);
      setText('insp-last-sync', '--');
      setText('insp-bytes', '--');
      setText('insp-rate', '--');
      setText('insp-exit', offlineStatusLabel);
      const badge = document.getElementById('insp-health-badge');
      if (badge) {
        badge.textContent = offlineStatusLabel;
        badge.className = 'storage-node-tag info';
      }
      const trigBtn = document.getElementById('insp-trigger-btn');
      if (trigBtn) {
        if (p && p.triggerAction) {
          trigBtn.disabled = false;
          trigBtn.textContent = 'Run Pipeline Now (M365 SSO)';
          trigBtn.onclick = () => triggerPipeline(p);
        } else {
          trigBtn.disabled = true;
          trigBtn.textContent = 'Scheduled / Hook-Driven';
          trigBtn.onclick = null;
        }
      }
      return;
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
      const badge = document.getElementById('insp-health-badge');
      if (badge) {
        badge.textContent = 'Online';
        badge.className = 'storage-node-tag ok';
      }
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
    const nextStr = (hasLiveData && p.nextRunAt) ? ` (Next: ${fmtNextTime(p.nextRunAt)})` : '';
    setText('insp-schedule', safeStr(p.schedule, 'Scheduled') + nextStr);
    const lastRunDate = p.lastRunAt ? new Date(p.lastRunAt) : null;
    const lastRunValid = Boolean(lastRunDate && Number.isFinite(lastRunDate.getTime()));
    setText('insp-last-sync', hasLiveData ? (lastRunValid ? `${fmtRelativeTime(p.lastRunAt)} (${lastRunDate.toLocaleTimeString()})` : 'Scheduled') : '--');
    setText('insp-bytes', hasLiveData ? `${safeStr(p.bytesCopiedFormatted, fmtBytes(p.bytesCopied))} (${safeNum(p.filesMoved, 0)} files)` : '--');
    setText('insp-rate', hasLiveData ? `${safeNum(p.durationSec, 0)}s • ${safeNum(p.rateMBps, 0).toFixed(2)} MB/s` : '--');
    setText('insp-exit', hasLiveData ? safeStr(p.summary, safeStr(p.status, 'Healthy')) : offlineStatusLabel);

    const badge = document.getElementById('insp-health-badge');
    if (badge) {
      if (!hasLiveData) {
        badge.textContent = offlineStatusLabel;
        badge.className = 'storage-node-tag info';
      } else {
        const st = String(p.status || 'success').toLowerCase();
        badge.textContent = st === 'success' ? 'Healthy' : st.toUpperCase();
        badge.className = 'storage-node-tag ' + (st === 'error' ? 'warn' : st === 'warning' ? 'warn' : 'ok');
      }
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
    const pipelines = Array.isArray(data && data.pipelines) ? data.pipelines.filter(p => p && typeof p === 'object') : [];
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
    const events = Array.isArray(data && data.recentEvents) ? data.recentEvents.filter(ev => ev && typeof ev === 'object') : [];
    if (events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#94a3b8;text-align:center;">No recent transfer events recorded yet.</td></tr>';
      return;
    }

    const pipelines = Array.isArray(data && data.pipelines) ? data.pipelines.filter(p => p && typeof p === 'object') : [];
    const pipeById = {};
    pipelines.forEach(p => { pipeById[p.id] = p; });

    tbody.innerHTML = events.slice(0, 20).map(ev => {
      const p = pipeById[ev.pipelineId] || {};
      const lvl = String(ev.level || 'info').toLowerCase();
      const tagCls = lvl === 'error' || lvl === 'warn' || lvl === 'warning' ? 'warn' : 'ok';
      const evDate = ev.timestamp ? new Date(ev.timestamp) : null;
      const ts = (evDate && Number.isFinite(evDate.getTime())) ? evDate.toLocaleString() : 'Recent';
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
    renderPipesSVG(state.data);
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
    const actionKey = pipeline && pipeline.triggerAction ? String(pipeline.triggerAction) : '';
    if (!actionKey || state.triggerInFlight.has(actionKey)) return;
    state.triggerInFlight.add(actionKey);
    const triggerBtn = document.getElementById('insp-trigger-btn');
    if (triggerBtn) triggerBtn.disabled = true;

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
        body: JSON.stringify({ action: pipeline.triggerAction }),
        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(15000) : undefined
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
    } finally {
      state.triggerInFlight.delete(actionKey);
      if (triggerBtn) triggerBtn.disabled = false;
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
        const livePipes = Array.isArray(state.data && state.data.pipelines) ? state.data.pipelines.filter(p => p && typeof p === 'object') : [];
        const allPipes = livePipes.length > 0 ? livePipes : Object.values(PIPELINE_FALLBACKS);
        let selectionMatches = state.filter === 'all';
        if (!selectionMatches) {
          if (state.selectedType === 'node') {
            const selCard = document.querySelector(`.storage-node-card[data-node-id="${state.selectedId}"]`);
            const cats = selCard ? (selCard.getAttribute('data-category') || '').split(',') : [];
            selectionMatches = cats.some(c => matchesFilter(c, state.filter));
          } else {
            const selPipe = allPipes.find(p => p.id === state.selectedId);
            selectionMatches = Boolean(selPipe && matchesFilter(selPipe.category, state.filter));
          }
        }
        if (!selectionMatches) {
          const firstVisible = allPipes.find(p => matchesFilter(p.category, state.filter));
          if (firstVisible) {
            state.selectedType = 'pipeline';
            state.selectedId = firstVisible.id;
          }
        }
        if (state.data) {
          renderTierNodes(state.data);
          renderPipesSVG(state.data);
          renderMatrix(state.data);
        } else {
          applyNodeCategoryFilter();
          renderPipesSVG(null);
        }
        updateInspector();
      });
    });

    // Wire node clicks
    document.querySelectorAll('.storage-node-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('is-dimmed')) return;
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
        renderPipesSVG(state.data);
      });
    }

    // Wire Refresh button
    const refBtn = document.getElementById('btn-refresh-storage-flow');
    if (refBtn) {
      refBtn.addEventListener('click', () => fetchStorageFlow());
    }

    window.addEventListener('resize', () => {
      renderPipesSVG(state.data);
      renderWaveform();
    });
    window.addEventListener('dr:layoutmodechange', () => {
      renderPipesSVG(state.data);
      renderWaveform();
    });

    if (typeof ResizeObserver !== 'undefined') {
      const stageEl = document.getElementById('storage-flow-stage');
      if (stageEl) {
        const ro = new ResizeObserver(() => {
          renderPipesSVG(state.data);
        });
        ro.observe(stageEl);
      }
    }

    renderPipesSVG(null);
    updateInspector();
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
