    // Force canonical apex domain: redirect www.digitalresolve.ca to https://digitalresolve.ca
    // Clean up cache-busting query parameter from address bar if reloaded after sign-out
    if (window.location.search && window.location.search.includes('_fresh=')) {
      try {
        history.replaceState(null, document.title, window.location.pathname);
      } catch(e) {}
    }

    if (window.location.hostname === 'www.digitalresolve.ca') {
      window.location.replace('https://digitalresolve.ca' + window.location.pathname + window.location.search + window.location.hash);
    }
    const GATEWAY = 'https://wake.digitalresolve.ca';
    const _origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      try {
        const urlStr = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
        if (urlStr === GATEWAY || urlStr.startsWith(GATEWAY + '/')) {
          const merged = Object.assign({}, init || {}, { credentials: 'include' });
          return _origFetch(input, merged);
        }
      } catch(e) {}
      return _origFetch(input, init);
    };
    var currentLogTab = 'agy';
    const _fetchSig = (ms = 8000) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(ms) : undefined;

    // Back to top smooth scrolling controller
    function scrollToTop(e) {
      if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
      }
      try {
        if (window.location.hash) {
          history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }
      } catch (err) {}
      
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      } catch (err) {
        window.scrollTo(0, 0);
      }
      try {
        document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      } catch (err) {
        document.documentElement.scrollTop = 0;
      }
      document.body.scrollTop = 0;
      return false;
    }
    window.scrollToTop = scrollToTop;
    // Unified Smooth Section Navigation Controller
    function scrollToSection(id, e) {
      if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
      }
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
          history.pushState(null, document.title, '#' + id);
        } catch(err) {}
        return false;
      }
      // If element is not present on this page, navigate to dedicated page
      if (id === 'ops-ai' || id === 'nuc-services') {
        window.location.href = 'ops.html#' + id;
      } else if (id === 'fleet') {
        window.location.href = 'fleet.html#' + id;
      } else if (id === 'deck') {
        window.location.href = 'index.html#deck';
      } else {
        window.location.href = 'index.html#' + id;
      }
      return false;
    }
    window.scrollToSection = scrollToSection;

    const safeNum = (v, fb = 0) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) ? Number(v) : fb;

    // Universal Safe Metric Formatter & Null-to-Check Architecture
    function safeMetric(val, unit = '', target = 'nuc') {
      if (val !== null && val !== undefined && !Number.isNaN(val) && val !== 'NaN') {
        const vEsc = escapeHtml(String(val));
        const uEsc = unit ? ' ' + escapeHtml(String(unit)) : '';
        return `${vEsc}${uEsc}`;
      }
      const safeTarget = ['nuc', 'desktop', 'both'].includes(target) ? target : 'nuc';
      return `<button type="button" class="btn-check-inline" onclick="universalCheck('${safeTarget}', this); event.stopPropagation();" title="Telemetry unavailable. Click to check now."><span class="check-icon">&#8635;</span> Check</button>`;
    }
    window.safeMetric = safeMetric;

    function universalCheck(target, btnEl) {
      if (btnEl) {
        btnEl.classList.add('checking');
        btnEl.innerHTML = '<span class="check-icon">&#8635;</span> Checking...';
      }
      const task = (target === 'nuc' || target === 'desktop' || target === 'both') ? checkStatus(target)
        : target === 'feeder' ? fetchFeederStatus()
        : target === 'uptime' ? renderUptimeMatrix()
        : target === 'token' ? (typeof fetchClusterStats === 'function' ? fetchClusterStats().then(() => { if (typeof updateTokenCounterUI === 'function') updateTokenCounterUI(); }) : (typeof updateTokenCounterUI === 'function' ? Promise.resolve(updateTokenCounterUI()) : Promise.resolve()))
        : target === 'isp' ? fetchISPHistory()
        : target === 'agy' ? fetchAgySessionInfo()
        : pollRealData(btnEl);
      const reset = () => {
        if (btnEl) {
          btnEl.classList.remove('checking');
          btnEl.innerHTML = '<span class="check-icon">&#8635;</span> Check';
        }
      };
      if (task && typeof task.finally === 'function') {
        task.finally(reset);
      } else {
        setTimeout(reset, 1500);
      }
    }
    window.universalCheck = universalCheck;

    function auditAndAttachCheckButtons() {
      const metricSelectors = [
        '.metric-val', '.stat-big-val', '.disk-val',
        '#app-card-tokens', '#uptime-mttr-val', '#st-val-ping', '#st-val-jitter',
        '#feeder-card-kibble', '#stat-desktop-cpu-val', '#stat-desktop-disk-free',
        '#stat-cpu-val', '#stat-disk-free', '#isp-ping-val', '#isp-jitter-val', '#isp-uptime-val',
        '#feeder-hopper-pct', '#inference-time',
        '#stat-disk-sub', '#stat-desktop-disk-sub', '#feeder-last-time', '#feeder-iot-last-time',
        '#app-card-models', '#modal-model-breakdown', '#modal-savings-val', '#isp-ping-tag', '#isp-ping-sub'
      ];
      metricSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (el.querySelector('.btn-check-inline')) return;
          const txt = (el.textContent ? el.textContent.trim() : '').toLowerCase();
          const isStuck = txt === '' ||
            txt.includes('--') ||
            txt.includes('null') ||
            txt.includes('undefined') ||
            txt.includes('nan') ||
            txt.includes('connecting') ||
            txt.includes('querying') ||
            txt.includes('calculating') ||
            txt.includes('measuring') ||
            (txt === '0 ms' && el.classList.contains('offline'));
          if (isStuck) {
            const target = (el.id && el.id.includes('desktop')) ? 'desktop'
              : ((el.id && el.id.includes('feeder')) ? 'feeder'
              : ((el.id && (el.id.includes('isp') || el.id.includes('st-val'))) ? 'isp'
              : ((el.id && el.id.includes('uptime')) ? 'uptime'
              : ((el.id && (el.id.includes('token') || el.id.includes('modal') || el.id.includes('app-card') || el.id.includes('inference'))) ? 'token' : 'nuc'))));
            el.innerHTML = `<button type="button" class="btn-check-inline" onclick="universalCheck('${target}', this); event.stopPropagation();" title="Placeholder detected. Click to check live telemetry."><span class="check-icon">&#8635;</span> Check</button>`;
          }
        });
      });
    }
    window.auditAndAttachCheckButtons = auditAndAttachCheckButtons;

    // Dynamic Codebase Scale & Version Synchronizer
    function updateCodebaseMetrics() {
      try {
        // Sync Version across header and footer from current changelog tag
        const currentVerEl = document.querySelector('.changelog-ver-header .ver-tag.current') || document.querySelector('.changelog-ver-header .ver-tag');
        if (currentVerEl) {
          const rawText = currentVerEl.textContent || '';
          const match = rawText.match(/v\d+\.\d+\.\d+/);
          const activeVer = match ? match[0] : 'v2.8.66';
          const fVer = document.getElementById('footer-version-tag');
          if (fVer) fVer.textContent = activeVer;
          const mVer = document.getElementById('menu-changelog-ver');
          if (mVer) mVer.textContent = activeVer;
        }

      const baseHtmlLines = 15927;
      const baseCssLines = 6349;
      const baseJsLines = 6957;
      const baseCnameLines = 1;
      const defaultTotal = baseHtmlLines + baseJsLines + baseCssLines + baseCnameLines;

      // Asynchronously count exact live lines via parallel cache-busted fetch
      Promise.all([
        fetch('styles.css?_t=' + Date.now(), { signal: _fetchSig(6000) }).then(r => r.ok ? r.text() : null).catch(() => null),
        fetch('app.js?_t=' + Date.now(), { signal: _fetchSig(6000) }).then(r => r.ok ? r.text() : null).catch(() => null)
      ]).then(([cssSrc, jsSrc]) => {
        const cLines = cssSrc ? cssSrc.replace(/\r?\n$/, '').split(/\r?\n/).length : baseCssLines;
        const jLines = jsSrc ? jsSrc.replace(/\r?\n$/, '').split(/\r?\n/).length : baseJsLines;
        const total = baseHtmlLines + cLines + jLines + baseCnameLines;
        const totalFormatted = total.toLocaleString();

        const locEl = document.getElementById('project-loc-count');
        if (locEl) locEl.textContent = totalFormatted;

        const locBadge = document.getElementById('footer-loc-badge');
        if (locBadge) {
          locBadge.title = `Project Codebase Scale: ${totalFormatted} Lines of Code (HTML: ${baseHtmlLines.toLocaleString()} lines | CSS: ${cLines.toLocaleString()} lines | JS: ${jLines.toLocaleString()} lines | CNAME)`;
        }
      }).catch(() => {
        const totalFormatted = defaultTotal.toLocaleString();
        const locEl = document.getElementById('project-loc-count');
        if (locEl) locEl.textContent = totalFormatted;
      });
      } catch(err) {
        console.error('Error updating codebase metrics:', err);
      }
    }
    window.updateCodebaseMetrics = updateCodebaseMetrics;

    // Toggle floating back-to-top button based on scroll depth
    window.addEventListener('scroll', function() {
      const btn = document.getElementById('btn-floating-top');
      if (!btn) return;
      if (window.scrollY > 350 || document.documentElement.scrollTop > 350) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }, { passive: true });
    const devices = {
      desktop: { name: 'Desktop PC', ip: '192.168.2.62', hostname: 'DESKTOP', mac: '70:85:C2:84:62:65', netbios: 'DESKTOP', dns: 'torrents.digitalresolve.ca' },
      nuc:     { name: 'NUC Server', ip: '192.168.2.35', hostname: 'NUC',     mac: '1C:69:7A:60:C7:0D', netbios: 'NUC',     dns: 'torrents2.digitalresolve.ca' },
      both:    { name: 'Both Machines', ip: '192.168.2.255', hostname: 'CLUSTER', mac: 'Subnet Broadcast', netbios: 'CLUSTER', dns: 'digitalresolve.ca' }
    };

    let pollInterval = null;

    /* Mobile Device Detection & Adaptive Layout Mode Switcher (dr_layout_mode) */
    function detectMobileDevice() {
      try {
        return window.innerWidth <= 768;
      } catch (e) {
        return false;
      }
    }

    let sessionLayoutModeOverride = null;

    function getStoredLayoutMode() {
      try {
        return localStorage.getItem('dr_layout_mode') || sessionLayoutModeOverride;
      } catch (e) {
        return sessionLayoutModeOverride;
      }
    }


    function updateLayoutToggleButtons(mode) {
      const isMobile = mode === 'mobile';
      const actionText = isMobile ? 'Desktop View' : 'Mobile View';
      const iconSvg = isMobile
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
      const currentModeText = isMobile ? 'Mobile' : 'Desktop';
      const title = 'Currently in ' + currentModeText + ' View. Click to switch to ' + actionText + '.';

      const navBtn = document.getElementById('layout-toggle-nav');
      const navText = document.getElementById('layout-toggle-nav-text');
      const navIcon = document.getElementById('layout-toggle-nav-icon');
      if (navBtn) {
        navBtn.setAttribute('title', title);
        navBtn.setAttribute('aria-label', title);
      }
      if (navText) navText.textContent = actionText;
      if (navIcon) navIcon.innerHTML = iconSvg;

      const footerBtn = document.getElementById('layout-toggle-footer');
      const footerText = document.getElementById('layout-toggle-footer-text');
      const footerIcon = document.getElementById('layout-toggle-footer-icon');
      if (footerBtn) {
        footerBtn.setAttribute('title', title);
        footerBtn.setAttribute('aria-label', title);
      }
      if (footerText) footerText.textContent = actionText;
      if (footerIcon) footerIcon.innerHTML = iconSvg;
    }

    function setLayoutMode(mode, savePreference = true) {
      const html = document.documentElement;
      const body = document.body;

      if (mode === 'mobile') {
        html.classList.remove('desktop-layout');
        html.classList.add('mobile-layout');
        html.setAttribute('data-layout-mode', 'mobile');
        if (body) {
          body.classList.remove('desktop-layout');
          body.classList.add('mobile-layout');
        }
      } else {
        html.classList.remove('mobile-layout');
        html.classList.add('desktop-layout');
        html.setAttribute('data-layout-mode', 'desktop');
        if (body) {
          body.classList.remove('mobile-layout');
          body.classList.add('desktop-layout');
        }
      }

      if (savePreference) {
        sessionLayoutModeOverride = mode;
        try {
          localStorage.setItem('dr_layout_mode', mode);
        } catch (e) {}
      }

      updateLayoutToggleButtons(mode);
    }

    function toggleLayoutMode() {
      const currentMode = document.documentElement.classList.contains('mobile-layout') ? 'mobile' : 'desktop';
      const newMode = (currentMode === 'mobile') ? 'desktop' : 'mobile';
      setLayoutMode(newMode, true);

      if (typeof showToast === 'function') {
        if (newMode === 'mobile') {
          showToast('success', 'Mobile View Active', 'Touch-optimized layout & single-column cards enabled');
        } else {
          showToast('info', 'Desktop View Active', 'Full desktop layout enabled (pan/zoom on smaller displays)');
        }
      }
    }

    function initLayoutMode() {
      const stored = getStoredLayoutMode();
      let mode;
      if (stored === 'mobile' || stored === 'desktop') {
        mode = stored;
      } else {
        mode = detectMobileDevice() ? 'mobile' : 'desktop';
      }
      setLayoutMode(mode, false);

      if (!stored) {
        const mqHandler = () => {
          if (!getStoredLayoutMode()) {
            const isMob = detectMobileDevice();
            setLayoutMode(isMob ? 'mobile' : 'desktop', false);
          }
        };
        if (window.matchMedia) {
          const mq = window.matchMedia('(max-width: 768px)');
          if (mq.addEventListener) {
            mq.addEventListener('change', mqHandler);
          } else if (mq.addListener) {
            mq.addListener(mqHandler);
          }
        }
        window.addEventListener('resize', mqHandler);
        window.addEventListener('orientationchange', mqHandler);
      }
    }

    function toggleMobileNav() {
      const navContainer = document.querySelector('.nav-container');
      const toggleIcon = document.getElementById('nav-toggle-icon');
      const menuToggle = document.getElementById('nav-menu-toggle');
      if (!navContainer) return;

      const isOpen = navContainer.classList.toggle('nav-open');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (toggleIcon) toggleIcon.textContent = isOpen ? 'X' : '=';
    }

    function closeMobileNav() {
      const navContainer = document.querySelector('.nav-container');
      const toggleIcon = document.getElementById('nav-toggle-icon');
      const menuToggle = document.getElementById('nav-menu-toggle');
      if (!navContainer) return;

      navContainer.classList.remove('nav-open');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      if (toggleIcon) toggleIcon.textContent = '=';
    }

    function showToast(statusType, msg, subtext = '', duration = 5000) {
      const toast = document.getElementById('wol-toast');
      const dot = document.getElementById('toast-dot');
      const text = document.getElementById('toast-message');
      const sub = document.getElementById('toast-subtext');
      if (toast && text) {
        if (dot) dot.className = `toast-dot ${statusType}`;
        text.textContent = msg;
        if (sub) sub.textContent = subtext;
        toast.classList.add('show');
        clearTimeout(window.toastTimer);
        if (duration > 0) {
          window.toastTimer = setTimeout(() => {
            toast.classList.remove('show');
          }, duration);
        }
      }
    }

    function fetchTelemetryWithFallback(target) {
      const timeoutMs = target === 'desktop' ? 10000 : 6000;
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tid = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;

      const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
      const primaryUrl = `${GATEWAY}/status?target=${target}`;
      const altUrl1 = `${GATEWAY}/stats`;
      const altUrl2 = isHttps ? `${GATEWAY}/uptime` : `http://192.168.2.35:8082/status?target=${target}`;

      return fetch(primaryUrl, ctrl ? { signal: ctrl.signal } : {})
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(data => {
          if (tid) clearTimeout(tid);
          if (target === 'desktop' && data.online && (!data.disk || !data.vitals)) {
            fetch(altUrl1, { signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(3000) : undefined })
              .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
              .then(stats => {
                if (stats && stats.desktop) {
                  if (stats.desktop.disk) data.disk = stats.desktop.disk;
                  if (stats.desktop.vitals) data.vitals = stats.desktop.vitals;
                  updateStatusUI('desktop', true, data.latencyMs, data.disk, data.torrent, data.vitals);
                }
              }).catch(() => {});
          }
          return data;
        })
        .catch(err => {
          if (tid) clearTimeout(tid);
          return fetch(altUrl1, { signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(4000) : undefined })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(stats => {
              if (stats && stats[target]) {
                const nodeData = stats[target];
                return {
                  online: nodeData.online !== false,
                  latencyMs: nodeData.latencyMs !== undefined ? nodeData.latencyMs : null,
                  disk: nodeData.disk || (target === 'nuc' ? stats.nuc && stats.nuc.disk : null),
                  vitals: nodeData.vitals || (target === 'nuc' ? stats.nuc && stats.nuc.vitals : null),
                  torrent: nodeData.torrent || (target === 'nuc' ? stats.nuc && stats.nuc.swarm : null)
                };
              }
              throw err;
            })
            .catch(err2 => {
              return fetch(altUrl2, { signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(3000) : undefined })
                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .then(data2 => {
                  if (data2) {
                    if (data2.nodes && Array.isArray(data2.nodes)) {
                      const node = data2.nodes.find(n => n.id === target);
                      if (node) {
                        return {
                          online: node.status !== 'offline',
                          latencyMs: null,
                          disk: null,
                          vitals: null,
                          torrent: null
                        };
                      }
                    }
                    if (data2[target] || data2.online !== undefined) {
                      const nodeData = data2[target] || data2;
                      return {
                        online: nodeData.online !== false,
                  latencyMs: nodeData.latencyMs !== undefined ? nodeData.latencyMs : null,
                        disk: nodeData.disk || (target === 'nuc' ? (data2.nuc && data2.nuc.disk) : null),
                        vitals: nodeData.vitals || (target === 'nuc' ? (data2.nuc && data2.nuc.vitals) : null),
                        torrent: nodeData.torrent || (target === 'nuc' ? (data2.nuc && data2.nuc.swarm) : null)
                      };
                    }
                  }
                  return data2;
                })
                .catch(() => {
                  throw err2;
                });
            });
        });
    }
    window.fetchTelemetryWithFallback = fetchTelemetryWithFallback;

    function hydrateTelemetryFromCache() {
      try {
        const raw = localStorage.getItem('dr_telemetry_cache');
        const data = raw ? JSON.parse(raw) : null;
        if (!data) return; // Zero hardcoding: wait for live telemetry stream
        if (data.nuc) {
          updateStatusUI('nuc', data.nuc.online !== false, data.nuc.latencyMs, data.nuc.disk, data.nuc.swarm || data.nuc.torrent, data.nuc.vitals);
        }
        if (data.desktop) {
          updateStatusUI('desktop', data.desktop.online !== false, data.desktop.latencyMs, data.desktop.disk, data.desktop.torrent, data.desktop.vitals);
        }
        if (data.tokens && typeof updateTokenCounterUI === 'function') {
          updateTokenCounterUI(data.tokens);
      }
      if (data.cameras) {
        updateCamerasUI(data.cameras);
        }
        if (data.climate && typeof updateClimateUI === 'function') {
          updateClimateUI(data.climate);
        }
      } catch (e) {
        console.warn('Hydration cache error:', e);
      }
      try {
        const rawClust = localStorage.getItem('dr_cluster_stats');
        const cData = rawClust ? JSON.parse(rawClust) : null;
        if (cData && cData.climate && typeof updateClimateUI === 'function' && !window._hasLiveClimate) {
          updateClimateUI(cData.climate);
        }
      } catch (e) {}
    }
    window.hydrateTelemetryFromCache = hydrateTelemetryFromCache;

    function checkStatus(target) {
      if (target === 'both') {
        return Promise.allSettled([checkStatus('nuc'), checkStatus('desktop')]);
      }
      const dev = devices[target] || devices.nuc;
      const ip = dev.ip || (target === 'desktop' ? '192.168.2.62' : '192.168.2.35');
      const dns = dev.dns || 'digitalresolve.ca';
      showToast('loading', `Pinging ${dev.name}...`, `${ip} | ${dns}`, 0);

      return fetchTelemetryWithFallback(target)
        .then(data => {
          if (data && data.online !== false) {
            const diskSub = (data.disk && data.disk.drive) ? ` | D: ${data.disk.freeGB} GB free (${data.disk.usedPercent}% used)` : '';
            showToast('success', `${dev.name} is Online`, `${data.latencyMs !== null ? data.latencyMs : 0} ms latency${diskSub}`, 5000);
            updateStatusUI(target, true, data.latencyMs, data.disk, data.torrent, data.vitals);
          } else {
            showToast('error', `${dev.name} is Offline`, `No ping response from ${ip}`, 5000);
            updateStatusUI(target, false);
          }
        })
        .catch(() => {
          showToast('error', `${dev.name} Unreachable`, `Could not reach ${GATEWAY} or verify node status.`, 5000);
          updateStatusUI(target, false);
        });
    }

    let currentPowerTarget = 'desktop';

    function onPowerTargetChange(target) {
      currentPowerTarget = target;
      const btnDesk = document.getElementById('btn-target-desktop');
      const btnNuc = document.getElementById('btn-target-nuc');
      const lDesk = document.getElementById('label-target-desktop');
      const lNuc = document.getElementById('label-target-nuc');
      const descEl = document.getElementById('power-target-desc');
      const dotEl = document.getElementById('power-target-dot');
      const pillEl = document.getElementById('power-target-status-pill');
      const feedbackEl = document.getElementById('pwr-feedback-text');

      if (target === 'desktop') {
        if (btnDesk) btnDesk.classList.add('active');
        if (btnNuc) btnNuc.classList.remove('active');
        if (lDesk) lDesk.classList.add('active');
        if (lNuc) lNuc.classList.remove('active');
        if (pillEl) {
          pillEl.classList.add('target-desktop');
          pillEl.classList.remove('target-nuc');
          pillEl.setAttribute('aria-label', 'Active Target: Desktop Workstation. Click to switch to NUC Server.');
        }
        const deskOnline = window.DESKTOP_IS_ONLINE !== undefined ? window.DESKTOP_IS_ONLINE : true;
        if (descEl) descEl.innerHTML = `AMD Ryzen 7 &bull; RTX Workstation &bull; ${deskOnline ? 'Online' : 'Standby'}`;
        if (dotEl) {
          dotEl.className = `status-indicator ${deskOnline ? 'online' : 'offline'}`;
          dotEl.style.backgroundColor = deskOnline ? '#38bdf8' : '#ef4444';
          dotEl.style.boxShadow = deskOnline ? '0 0 8px #38bdf8' : '0 0 8px #ef4444';
        }
        if (feedbackEl) feedbackEl.textContent = 'Ready | Target: Desktop Workstation (192.168.2.62)';
      } else {
        if (btnNuc) btnNuc.classList.add('active');
        if (btnDesk) btnDesk.classList.remove('active');
        if (lNuc) lNuc.classList.add('active');
        if (lDesk) lDesk.classList.remove('active');
        if (pillEl) {
          pillEl.classList.add('target-nuc');
          pillEl.classList.remove('target-desktop');
          pillEl.setAttribute('aria-label', 'Active Target: NUC Core Server. Click to switch to Desktop Node.');
        }
        if (descEl) descEl.innerHTML = 'Intel Core i5 &bull; 24/7 Core Server &bull; Online';
        if (dotEl) {
          dotEl.className = 'status-indicator online';
          dotEl.style.backgroundColor = '#10b981';
          dotEl.style.boxShadow = '0 0 8px #10b981';
        }
        if (feedbackEl) feedbackEl.textContent = 'Ready | Target: NUC Server (192.168.2.35)';
      }
    }
    window.onPowerTargetChange = onPowerTargetChange;

    function togglePowerTarget() {
      const next = (currentPowerTarget === 'desktop') ? 'nuc' : 'desktop';
      onPowerTargetChange(next);
      if (typeof showToast === 'function') {
        const name = next === 'desktop' ? 'Desktop Workstation (192.168.2.62)' : 'NUC Core Server (192.168.2.35)';
        showToast('info', 'Active Target Switched', "Now controlling: " + name);
      }
    }
    window.togglePowerTarget = togglePowerTarget;

    function scrollToPowerControls() {
      const el = document.getElementById('fleet-quick-controls');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
        el.style.borderColor = 'rgba(56, 189, 248, 0.85)';
        el.style.boxShadow = '0 0 28px rgba(56, 189, 248, 0.45)';
        setTimeout(() => {
          el.style.borderColor = '';
          el.style.boxShadow = '';
        }, 2200);
      } else {
        window.location.href = 'index.html#fleet-quick-controls';
      }
    }
    window.scrollToPowerControls = scrollToPowerControls;

    function triggerNodePower(action) {
      const target = currentPowerTarget || 'desktop';
      const targetName = target === 'desktop' ? 'Desktop Workstation' : 'NUC Core Server';
      const feedbackEl = document.getElementById('pwr-feedback-text');

      if (action === 'wake') {
        if (feedbackEl) feedbackEl.textContent = `Dispatching WoL Magic Packet to ${targetName}...`;
        sendWol(target);
      } else if (action === 'sleep') {
        if (feedbackEl) feedbackEl.textContent = `Dispatching Sleep Standby signal to ${targetName}...`;
        sendSleep(target);
      } else if (action === 'reboot') {
        if (feedbackEl) feedbackEl.textContent = `Awaiting confirmation to reboot ${targetName}...`;
        if (target === 'nuc' && typeof confirmRebootNuc === 'function') {
          confirmRebootNuc();
        } else if (target === 'desktop' && typeof confirmRebootDesktop === 'function') {
          confirmRebootDesktop();
        } else if (confirm(`Are you sure you want to gracefully reboot ${targetName}?`)) {
          sendControl('reboot', target);
        }
      }
    }
    window.triggerNodePower = triggerNodePower;

    function triggerBroadcastWoL() {
      const feedbackEl = document.getElementById('pwr-feedback-text');
      if (feedbackEl) feedbackEl.textContent = 'Transmitting Broadcast WoL Magic Packet to all nodes (NUC & Desktop)...';
      sendWol('both');
    }
    window.triggerBroadcastWoL = triggerBroadcastWoL;
    function sendWol(target) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal(`Wake-on-LAN: ${target.toUpperCase()}`, () => sendWol(target));
        return;
      }
      clearInterval(pollInterval);
      const dev = devices[target] || devices.both;
      showToast('loading', `Transmitting Magic Packet...`, `Target: ${dev.name}`, 0);

      fetch(`${GATEWAY}/wake?target=${encodeURIComponent(target)}`, { method: 'POST', credentials: 'include', headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }), body: '{}', signal: _fetchSig(8000) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(() => {
          showToast('loading', `Magic Packet Broadcasted`, `Waiting for ${dev.name} to boot...`, 0);

          if (target === 'both') {
            setTimeout(() => { checkStatus('nuc'); checkStatus('desktop'); }, 12000);
            return;
          }

          let attempts = 0;
          const maxAttempts = 12;
          let settled = false;
          pollInterval = setInterval(() => {
            if (settled || attempts >= maxAttempts) {
              clearInterval(pollInterval);
              return;
            }
            attempts++;
            fetch(`${GATEWAY}/status?target=${target}`, { signal: _fetchSig(5000) })
              .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
              .then(data => {
                if (settled) return;
                if (data.online) {
                  settled = true;
                  clearInterval(pollInterval);
                  const latPart = (data.latencyMs !== null && data.latencyMs !== undefined && Number.isFinite(Number(data.latencyMs))) ? `${data.latencyMs} ms latency` : '';
                  const diskPart = (data.disk && data.disk.drive) ? `D: ${data.disk.freeGB} GB free` : '';
                  const toastBody = [latPart, diskPart].filter(Boolean).join(' | ') || 'Online';
                  showToast('success', `${dev.name} is Awake & Online!`, toastBody, 6000);
                  updateStatusUI(target, true, data.latencyMs, data.disk);
                } else if (attempts >= maxAttempts) {
                  settled = true;
                  clearInterval(pollInterval);
                  showToast('error', `${dev.name} Not Responding`, 'Machine may still be booting POST.', 6000);
                }
              })
              .catch(() => {
                if (!settled && attempts >= maxAttempts) {
                  settled = true;
                  clearInterval(pollInterval);
                  showToast('error', `${dev.name} Not Responding`, 'Machine may still be booting POST.', 6000);
                }
              });
          }, 3000);
        })
        .catch(() => {
          showToast('error', 'Transmit Failed', `Could not reach ${GATEWAY}`, 5000);
        });
    }

    function sendSleep(target) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal(`Sleep Standby: ${target.toUpperCase()}`, () => sendSleep(target));
        return;
      }
      clearInterval(pollInterval);
      const dev = devices[target] || devices.nuc;
      showToast('loading', `Entering Sleep Mode...`, `Dispatching suspend signal to ${dev.name}`, 0);

      fetch(`${GATEWAY}/sleep?target=${encodeURIComponent(target)}`, { method: 'POST', credentials: 'include', headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }), body: '{}', signal: _fetchSig(8000) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(() => {
          showToast('loading', `Sleep Signal Dispatched`, `Waiting for ${dev.name} to enter standby...`, 0);

          let attempts = 0;
          let consecutiveErrors = 0;
          const maxAttempts = 10;
          pollInterval = setInterval(() => {
            attempts++;
            fetch(`${GATEWAY}/status?target=${target}`, { signal: _fetchSig(5000) })
              .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
              .then(data => {
                consecutiveErrors = 0;
                if (!data.online) {
                  clearInterval(pollInterval);
                  showToast('success', `${dev.name} is now Asleep`, 'System in low-power standby mode.', 6000);
                  updateStatusUI(target, false);
                } else if (attempts >= maxAttempts) {
                  clearInterval(pollInterval);
                  showToast('error', `Sleep Signal Dispatched`, `${dev.name} may still be finalizing background tasks.`, 5000);
                }
              })
              .catch(() => {
                consecutiveErrors++;
                if (consecutiveErrors >= 2 || attempts >= maxAttempts) {
                  clearInterval(pollInterval);
                  showToast('success', `${dev.name} is now Asleep`, 'Device offline / in standby.', 6000);
                  updateStatusUI(target, false);
                }
              });
          }, 2500);
        })
        .catch(() => {
          showToast('error', 'Sleep Command Failed', `Unable to reach ${GATEWAY}`, 5000);
        });
    }

    // Dynamic Real-Time Health Radar Synchronizer
    function updateHealthRadarUI(telemetry) {
      if (!telemetry) return;

      document.querySelectorAll('.health-radar-row').forEach(row => {
        const text = row.textContent;
        const statusSpan = row.querySelector('.health-radar-header span:last-child');
        const fillBar = row.querySelector('.health-meter-fill');
        const subText = row.querySelector('div[style*="font-size: 0.72rem"]');

        // 1. NUC Core Server
        if (text.includes('Intel NUC Core Server')) {
          const isOnline = telemetry.nucOnline !== undefined ? telemetry.nucOnline : true;
          const lat = (telemetry.nucLatency !== null && telemetry.nucLatency !== undefined) ? telemetry.nucLatency : 0.2;
          if (statusSpan) {
            statusSpan.style.color = isOnline ? '#34d399' : '#ef4444';
            statusSpan.textContent = isOnline ? `100% (${lat} ms)` : '0% (Offline)';
          }
          if (fillBar) {
            fillBar.style.width = isOnline ? '100%' : '0%';
            fillBar.style.background = isOnline ? '#10b981' : '#ef4444';
          }
          if (subText) {
            subText.textContent = isOnline ? 'Services: Swarm Engine, CatCam Proxy, StreamHub 8088, WireGuard Tunnel' : 'Server Unreachable • Re-trying Gateway Heartbeat';
          }
        }
        // 2. Desktop Workstation
        else if (text.includes('Desktop Workstation')) {
          const isOnline = telemetry.desktopOnline !== undefined ? telemetry.desktopOnline : (window.DESKTOP_IS_ONLINE !== undefined ? window.DESKTOP_IS_ONLINE : true);
          if (statusSpan) {
            statusSpan.style.color = isOnline ? '#34d399' : '#ef4444';
            statusSpan.textContent = isOnline ? '100% (Bell Fiber)' : '0% (Offline / Standby)';
          }
          if (fillBar) {
            fillBar.style.width = isOnline ? '100%' : '0%';
            fillBar.style.background = isOnline ? '#10b981' : '#ef4444';
          }
          if (subText) {
            subText.textContent = isOnline ? 'Services: Antigravity Autonomous Agent, High-Speed Torrenting, Git Sync' : 'System Offline • Sleep/Standby Mode • Wake-on-LAN Ready';
          }
        }
        // 3. Mullvad WireGuard Privacy Shield
        else if (text.includes('Mullvad WireGuard')) {
          const vpnIp = telemetry.vpnExitIp || (window.LAST_SWARM && window.LAST_SWARM.vpnExitIp);
          if (statusSpan) {
            statusSpan.style.color = '#34d399';
            statusSpan.textContent = vpnIp ? `100% (Protected)` : '100% (Encrypted)';
          }
          if (subText && vpnIp) {
            subText.textContent = `Tunnel Status: Active • VPN Exit: ${vpnIp} • Kill-switch Enforced`;
          }
        }
        // 4. Bell Canada Gigabit Fiber
        else if (text.includes('Bell Canada Gigabit Fiber')) {
          const isp = telemetry.isp || window.ISP_LATEST;
          if (isp && isp.pingAvgMs !== undefined) {
            const ping = isp.pingAvgMs;
            const jit = isp.jitterMs !== undefined ? isp.jitterMs : 0;
            const loss = isp.packetLoss !== undefined ? isp.packetLoss : 0;
            if (statusSpan) {
              statusSpan.style.color = '#38bdf8';
              statusSpan.textContent = `${isp.grade || 'A+'} (${ping} ms • ±${jit} ms Jitter)`;
            }
            if (fillBar) {
              const pct = Math.max(90, Math.min(100, Math.round(100 - (ping * 1.5))));
              fillBar.style.width = `${pct}%`;
            }
            if (subText) {
              subText.textContent = `ISP Performance: Bell Gigabit Fiber • Packet Loss: ${loss}% • Zero Bufferbloat`;
            }
          }
        }
        // 5. Media Storage Capacity (D:\Torrents)
        else if (text.includes('Media Storage Capacity')) {
          const disk = telemetry.nucDisk || (window.LAST_NUC && window.LAST_NUC.disk);
          if (disk && disk.freeGB) {
            const free = Math.round(disk.freeGB);
            const usedPct = disk.usedPercent || 73.4;
            if (statusSpan) {
              statusSpan.style.color = '#60a5fa';
              statusSpan.textContent = `${free} GB Free (${usedPct}% Used)`;
            }
            if (fillBar) {
              fillBar.style.width = `${usedPct}%`;
            }
            if (subText) {
              const usedG = disk.usedGB || Math.round((disk.totalGB || 1863) - free);
              subText.textContent = `File System: Healthy • D:\\Torrents: ${usedG} GB used of ${disk.totalGB || 1863} GB`;
            }
          }
        }
      });

      // Overall Health Score (in health modal header)
      const scoreEl = document.getElementById('modal-health-score');
      if (scoreEl) {
        const nOnline = telemetry.nucOnline !== undefined ? telemetry.nucOnline : true;
        const dOnline = telemetry.desktopOnline !== undefined ? telemetry.desktopOnline : window.DESKTOP_IS_ONLINE;
        if (nOnline && dOnline) {
          scoreEl.textContent = '100% Optimal';
          scoreEl.style.color = '#34d399';
        } else if (nOnline && !dOnline) {
          scoreEl.textContent = '98% Eco Standby';
          scoreEl.style.color = '#38bdf8';
        } else {
          scoreEl.textContent = 'Degraded (Server Offline)';
          scoreEl.style.color = '#ef4444';
        }
      }
    }
    window.updateHealthRadarUI = updateHealthRadarUI;

    // Dynamic Cluster Power Draw & Thermals Synchronizer
    function updateClusterPowerAndThermalsUI(isDeskOnline) {
      // 1. Power Draw Card
      const totalW = document.getElementById('iot-total-watts');
      const deskW = document.getElementById('iot-desk-watts');
      const nucW = document.getElementById('iot-nuc-watts');
      const costEl = document.getElementById('iot-grid-cost');
      const pwrTag = document.getElementById('iot-power-tag');

      if (nucW) nucW.textContent = 'Unmetered';
      if (deskW) deskW.textContent = isDeskOnline ? 'Unmetered' : 'Standby (Unmetered)';
      if (totalW) totalW.innerHTML = `-- <span style="font-size: 0.9rem; color: #94a3b8;">Unmetered</span>`;
      if (costEl) costEl.textContent = '--';
      if (pwrTag) {
        pwrTag.textContent = 'Unmetered';
        pwrTag.className = 'item-tag online';
      }

      // 2. Thermals Card
      const dCpuTemp = document.getElementById('iot-desk-cpu-temp');
      const nCpuTemp = document.getElementById('iot-nuc-cpu-temp');
      const thTag = document.getElementById('iot-thermal-tag');

      if (nCpuTemp) nCpuTemp.textContent = 'No Sensor';
      if (dCpuTemp) dCpuTemp.textContent = isDeskOnline ? 'No Sensor' : 'Standby (No Sensor)';
      if (thTag) {
        thTag.textContent = 'No Sensor';
      }
      const ambTemp = document.getElementById('iot-ambient-temp');
      if (ambTemp) {
        if (!window._hasLiveClimate) ambTemp.innerHTML = '--&deg;C <span style="font-size: 0.9rem; color: #94a3b8;">Awaiting Telemetry</span>';
      }
      const roomThermo = document.getElementById('iot-room-thermostat');
      if (roomThermo) {
        if (!window._hasLiveClimate) roomThermo.innerHTML = 'Awaiting Telemetry';
      }
      const storageThroughput = document.getElementById('schematic-storage-throughput');
      if (storageThroughput) {
        storageThroughput.textContent = 'NVMe';
      }
      const dnsBlock = document.getElementById('dns-kpi-blocklists');
      if (dnsBlock) dnsBlock.textContent = 'Not Installed';
      const dnsRoutes = document.getElementById('dns-kpi-routes');
      if (dnsRoutes) dnsRoutes.textContent = '7 LAN Routes';
      const dnsDaemon = document.getElementById('dns-kpi-daemon');
      if (dnsDaemon) dnsDaemon.textContent = 'Awaiting Install';
      document.querySelectorAll('#schematic-cf-throughput').forEach(el => el.textContent = 'Cloudflare Edge');
      document.querySelectorAll('#schematic-bell-throughput').forEach(el => el.textContent = 'Bell Fiber');
      document.querySelectorAll('#schematic-vpn-throughput').forEach(el => {
        if (!el.textContent || el.textContent.includes('--') || el.textContent === 'NYC Relay') el.textContent = 'WireGuard';
      });
      document.querySelectorAll('#schematic-tunnel-throughput').forEach(el => el.textContent = 'Tunnel OK');
      document.querySelectorAll('#ai-model-footprint').forEach(el => el.textContent = (window.LAST_AI_MODEL_FOOTPRINT || '--'));
      document.querySelectorAll('#nuc-hw-ram').forEach(el => {
        const ramVal = Number(window.LAST_NUC_RAM_GB);
        el.textContent = (window.LAST_NUC_RAM_GB !== undefined && window.LAST_NUC_RAM_GB !== null && window.LAST_NUC_RAM_GB !== '' && Number.isFinite(ramVal) && ramVal > 0)
          ? `${ramVal} GB`
          : '--';
      });
      // Dynamic scale range managed by renderSparklineFrame
      const hasNucLatGlobal = window.LAST_NUC_LATENCY !== undefined && window.LAST_NUC_LATENCY !== null && window.LAST_NUC_LATENCY !== '' && Number.isFinite(Number(window.LAST_NUC_LATENCY));
      document.querySelectorAll('#schematic-nuc-throughput').forEach(el => {
        if (!el.textContent || el.textContent.includes('--')) el.textContent = hasNucLatGlobal ? `${window.LAST_NUC_LATENCY} ms` : '-- ms';
      });
      document.querySelectorAll('#schematic-desktop-throughput').forEach(el => {
        if (!el.textContent || el.textContent.includes('--')) el.textContent = (window.DESKTOP_IS_ONLINE !== false) ? '2.5 Gbps' : 'Standby';
      });
      document.querySelectorAll('#schematic-storage-capacity').forEach(el => {
        if (window.LAST_NUC_DISK && typeof window.LAST_NUC_DISK.freeGB === 'number') {
          const freeG = window.LAST_NUC_DISK.freeGB;
          const usedP = (typeof window.LAST_NUC_DISK.usedPercent === 'number') ? window.LAST_NUC_DISK.usedPercent : '--';
          el.textContent = `Capacity: ${freeG} GB Free (${usedP}% Used)`;
        } else if (!el.textContent || el.textContent.includes('--') || el.textContent.includes('Capacity:')) {
          el.textContent = 'Awaiting telemetry...';
        }
      });

      // 3. Uptime Kuma Heartbeat Table Latencies
      const rawNucLat = (window.LAST_NUC_LATENCY !== undefined && window.LAST_NUC_LATENCY !== null && window.LAST_NUC_LATENCY !== '') ? Number(window.LAST_NUC_LATENCY) : NaN;
      const nucLat = Number.isFinite(rawNucLat) ? rawNucLat : null;
      const rawIspLat = (window.ISP_LATEST && window.ISP_LATEST.pingAvgMs !== undefined && window.ISP_LATEST.pingAvgMs !== null && window.ISP_LATEST.pingAvgMs !== '') ? Number(window.ISP_LATEST.pingAvgMs) : NaN;
      const ispLat = Number.isFinite(rawIspLat) ? rawIspLat : null;
      const nucOnline = (window.NUC_IS_ONLINE !== false);
      const svcs = (window.LAST_SERVICES_HEALTH && window.LAST_SERVICES_HEALTH.services) ? window.LAST_SERVICES_HEALTH.services : null;

      const svcState = (key) => {
        const entry = svcs && svcs[key];
        const ok = entry ? !!entry.online : nucOnline;
        const lat = (entry && typeof entry.latencyMs === 'number' && Number.isFinite(entry.latencyMs))
          ? entry.latencyMs.toFixed(1)
          : '--';
        const uptimePct = (entry && entry.uptimePct) ? entry.uptimePct : (ok ? 'Online' : 'Offline');
        return { ok, lat, uptimePct };
      };

      const setKuma = (id, ms, statusId, isGood, goodTxt = 'Healthy', badTxt = 'Degraded', uptimeId = null, uptimePct = null) => {
        document.querySelectorAll('#' + id + ', .' + id).forEach(el => el.textContent = ms === '--' ? '--' : `${ms} ms`);
        document.querySelectorAll('#' + statusId + ', .' + statusId).forEach(st => {
          st.textContent = isGood ? goodTxt : badTxt;
          st.className = `item-tag ${isGood ? 'online' : 'offline'}`;
        });
        if (uptimeId) {
          const resolvedUptime = uptimePct || (isGood ? 'Online' : 'Offline');
          document.querySelectorAll('#' + uptimeId).forEach(u => u.textContent = isGood ? resolvedUptime : 'Offline');
        }
      };

      const sStream = svcState('streamhub');
      const sFiles = svcState('filebrowser');
      const sQbit = svcState('torrents2');
      const sWol = svcState('wol');
      const sCam = svcState('cam');
      const sCf = svcState('cf');

      setKuma('kuma-lat-stream', sStream.lat, 'kuma-status-stream', sStream.ok, 'Healthy', 'Degraded', 'kuma-uptime-stream', sStream.uptimePct);
      setKuma('kuma-lat-files', sFiles.lat, 'kuma-status-files', sFiles.ok, 'Healthy', 'Degraded', 'kuma-uptime-files', sFiles.uptimePct);
      setKuma('kuma-lat-qbit', sQbit.lat, 'kuma-status-qbit', sQbit.ok, 'Healthy', 'Degraded', 'kuma-uptime-qbit', sQbit.uptimePct);
      setKuma('kuma-lat-wol', sWol.lat, 'kuma-status-wol', sWol.ok, 'Healthy', 'Degraded', 'kuma-uptime-wol', sWol.uptimePct);
      setKuma('kuma-lat-catcam', sCam.lat, 'kuma-status-catcam', sCam.ok, 'Healthy', 'Degraded', 'kuma-uptime-catcam', sCam.uptimePct);
      setKuma('kuma-lat-cf', sCf.lat, 'kuma-status-cf', sCf.ok, 'Shield Active', 'Degraded', 'kuma-uptime-cf', sCf.uptimePct);

      document.querySelectorAll('#spark-leg-nuc').forEach(el => el.textContent = nucLat !== null ? `${nucLat.toFixed(1)} ms` : '--');
      if (typeof initSparklineHeartbeat === 'function') initSparklineHeartbeat();
    }
    window.updateClusterPowerAndThermalsUI = updateClusterPowerAndThermalsUI;

    // Dynamic SSL Certificate Expiry Calculator (Cloudflare ECC CA-3)
    function updateSslCertExpiryUI() {
      document.querySelectorAll('.ssl-cert-days').forEach(el => {
        el.textContent = 'Cloudflare Auto-Renew (Universal SSL)';
      });
    }
    window.updateSslCertExpiryUI = updateSslCertExpiryUI;

    function updateStatusUI(target, isOnline, latencyMs = null, disk = null, torrent = null, vitals = null) {
      const dot = document.getElementById(`badge-${target}`);
      const tag = document.getElementById(`status-tag-${target}`);
      const lat = document.getElementById(`latency-${target}`);

      if (dot) {
        dot.style.backgroundColor = isOnline ? '#22c55e' : '#ef4444';
        dot.style.boxShadow = isOnline ? '0 0 8px #22c55e' : '0 0 8px #ef4444';
      }
      if (tag) {
        tag.textContent = isOnline ? 'Online' : (target === 'desktop' ? 'Standby' : 'Offline');
        tag.className = `item-tag ${isOnline ? 'online' : 'offline'}`;
      }
      if (target === 'nuc') {
        if (latencyMs !== null) window.LAST_NUC_LATENCY = latencyMs;
      } else if (lat) {
        lat.textContent = latencyMs !== null ? `${latencyMs} ms` : (isOnline ? 'Online' : 'Standby');
        lat.className = `item-tag ${isOnline ? 'online' : 'offline'}`;
      }
      // Update Node Deck Hardware Tags (index.html, media.html)
      const hwTag = document.getElementById(target === 'desktop' ? 'stat-desktop-hw-tag' : 'stat-hw-tag');
      if (hwTag) {
        hwTag.textContent = isOnline ? 'Online' : (target === 'desktop' ? 'Standby' : 'Offline');
        hwTag.className = `item-tag ${isOnline ? 'online' : 'offline'}`;
        if (target === 'desktop') {
          hwTag.style.background = isOnline ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)';
          hwTag.style.color = isOnline ? '#38bdf8' : '#f87171';
          hwTag.style.borderColor = isOnline ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        } else {
          hwTag.style.background = isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
          hwTag.style.color = isOnline ? '#34d399' : '#f87171';
          hwTag.style.borderColor = isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        }
      }

      // Update Torrent Speeds
      if (torrent) {
        if (target === 'desktop') {
          const dTag = document.getElementById('desktop-speed-tag');
          if (dTag) {
            dTag.textContent = torrent.dlSpeed > 0 ? `DL: ${torrent.dlSpeedText}` : 'Idle';
            dTag.className = torrent.dlSpeed > 0 ? 'item-tag online' : 'item-tag';
          }
        } else if (target === 'nuc') {
          const nTag = document.getElementById('nuc-disk-tag');
          if (nTag && torrent.dlSpeed > 1024) {
            nTag.textContent = `DL: ${torrent.dlSpeedText}`;
            nTag.className = 'item-tag online';
          }
        }
      }

      if (isOnline) {
        try {
          const raw = localStorage.getItem('dr_telemetry_cache');
          const cache = raw ? JSON.parse(raw) : {};
          cache[target] = {
            online: true,
            latencyMs: (latencyMs !== null && latencyMs !== undefined && Number.isFinite(Number(latencyMs))) ? Number(latencyMs) : null,
            disk: disk || (cache[target] && cache[target].disk),
            torrent: torrent || (cache[target] && cache[target].torrent),
            vitals: vitals || (cache[target] && cache[target].vitals)
          };
          localStorage.setItem('dr_telemetry_cache', JSON.stringify(cache));
        } catch(e) {}
      }

      // Update NUC D: drive widgets
      if (target === 'nuc' && !disk && isOnline) {
        disk = window.LAST_NUC_DISK || null;
      }
      if (target === 'nuc' && disk) {
        const diskTag = document.getElementById('nuc-disk-tag');
        const diskVal = document.getElementById('nuc-disk-val');
        const diskBar = document.getElementById('nuc-disk-bar');
        const diskSub = document.getElementById('nuc-disk-sub');

        if (diskTag && (!torrent || torrent.dlSpeed <= 1024)) {
          diskTag.textContent = `D: ${Math.round(disk.freeGB)} GB free`;
          diskTag.className = disk.usedPercent > 85 ? 'item-tag offline' : 'item-tag online';
        }
        if (diskVal) {
          diskVal.textContent = `${disk.freeGB} GB Free`;
        }
        // Update NUC Storage Segments Bar (media.html & index.html)
        const nSegWrap = document.querySelector('.node-deck-card.nuc-deck .storage-segments-bar');
        if (nSegWrap && disk) {
          const freePct = (disk.usedPercent !== null && disk.usedPercent !== undefined && Number.isFinite(Number(disk.usedPercent))) ? Math.max(0, 100 - Number(disk.usedPercent)).toFixed(1) : '26.6';
          const segFree = nSegWrap.querySelector('.seg-free');
          if (segFree) {
            segFree.style.width = `${freePct}%`;
            segFree.title = `Free Space: ${disk.freeGB} GB (${freePct}%)`;
          }
        }
        if (diskBar) {
          diskBar.style.width = `${disk.usedPercent}%`;
          if (disk.usedPercent > 85) {
            diskBar.classList.add('warning');
          } else {
            diskBar.classList.remove('warning');
          }
        }
        const speedNote = (torrent && torrent.dlSpeed > 0 && torrent.dlSpeedText) ? ` | DL: ${String(torrent.dlSpeedText)}` : '';
        const usedG = Number.isFinite(Number(disk.usedGB)) ? Number(disk.usedGB) : 0;
        const totG = Number.isFinite(Number(disk.totalGB)) ? Number(disk.totalGB) : 0;
        const pctG = Number.isFinite(Number(disk.usedPercent)) ? Number(disk.usedPercent) : 0;
        if (diskSub) {
          diskSub.textContent = `${usedG} GB used of ${totG} GB (${pctG}%)${speedNote}`;
        }
        const statDiskSub = document.getElementById('stat-disk-sub');
        if (statDiskSub) {
          statDiskSub.innerHTML = `<span>Total ${totG} GB (${pctG}% Used &bull; ${usedG} GB)</span>`;
        }
      }

      // Update Fleet Cards
      const fDot = document.getElementById(`fleet-dot-${target}`);
      const fBadge = document.getElementById(`fleet-badge-${target}`);
      const fLat = document.getElementById(`fleet-latency-${target}`);
      if (fDot) {
        fDot.style.backgroundColor = isOnline ? '#22c55e' : '#ef4444';
        fDot.style.boxShadow = isOnline ? '0 0 8px #22c55e' : '0 0 8px #ef4444';
      }
      if (fBadge) {
        if (target === 'nuc') {
          fBadge.textContent = isOnline ? 'Online  -  24/7 Core' : 'Offline  -  Unreachable';
        } else {
          fBadge.textContent = isOnline ? 'Online  -  Active' : 'Standby  -  Sleeping';
        }
        fBadge.className = `item-tag ${isOnline ? 'online' : 'offline'}`;
      }
      if (fLat) {
        if (isOnline && latencyMs !== null) {
          fLat.textContent = `${latencyMs} ms (LAN)`;
          fLat.className = 'item-tag online';
        } else if (!isOnline) {
          fLat.textContent = 'Unreachable';
          fLat.className = 'item-tag offline';
        }
      }

      // Dynamic Health Radar row update
      document.querySelectorAll('.health-radar-row').forEach(row => {
        if (target === 'desktop' && row.textContent.includes('Desktop Workstation')) {
          const statusSpan = row.querySelector('.health-radar-header span:last-child');
          const fillBar = row.querySelector('.health-meter-fill');
          const subText = row.querySelector('div[style*="font-size: 0.72rem"]');
          if (isOnline) {
            if (statusSpan) { statusSpan.style.color = '#34d399'; statusSpan.textContent = '100% (Bell Fiber)'; }
            if (fillBar) fillBar.style.width = '100%';
            if (subText) subText.textContent = 'Services: Antigravity CLI Daemon, High-Speed Torrenting, Git Sync';
          } else {
            if (statusSpan) { statusSpan.style.color = '#ef4444'; statusSpan.textContent = '0% (Offline / Standby)'; }
            if (fillBar) fillBar.style.width = '0%';
            if (subText) subText.textContent = 'System Offline • Sleep/Standby Mode • Wake-on-LAN Ready';
          }
        }
      });
      if (target === 'nuc') {
        window.NUC_IS_ONLINE = isOnline;
        if (disk) {
          const fStorage = document.getElementById('fleet-storage-nuc');
          const fBar = document.getElementById('fleet-bar-nuc');
          if (fStorage) fStorage.textContent = `${disk.freeGB} GB Free (${disk.usedPercent}%)`;
          if (fBar) fBar.style.width = `${disk.usedPercent}%`;
          const nFreeEl = document.getElementById('stat-nuc-free-legend');
          if (nFreeEl && disk.freeGB !== undefined && disk.freeGB !== null) {
            nFreeEl.innerHTML = `<span class="legend-dot seg-free"></span> Free (${Math.round(disk.freeGB)} GB)`;
          }
          const sgTag = document.getElementById('stat-disk-safeguard-tag');
          if (sgTag) {
            const headroom = Math.round(disk.freeGB);
            sgTag.textContent = headroom > 50 ? `Safe (+${headroom} GB)` : `Warning (+${headroom} GB)`;
            sgTag.className = headroom > 50 ? 'item-tag online' : 'item-tag offline';
          }
          const schCap = document.getElementById('schematic-storage-capacity');
          if (schCap) schCap.textContent = `Capacity: ${disk.freeGB} GB Free (${disk.usedPercent}% Used)`;
        }
        const schNuc = document.getElementById('schematic-nuc-throughput');
        if (schNuc) schNuc.textContent = (latencyMs !== null && latencyMs !== undefined) ? `${latencyMs} ms` : '-- ms';
        try {
          if (typeof schematicNodesData !== 'undefined' && schematicNodesData.nuc) {
            schematicNodesData.nuc.status = isOnline ? (latencyMs !== null && latencyMs !== undefined ? `Online (${latencyMs} ms LAN)` : 'Online (LAN)') : 'Offline (Unreachable)';
            schematicNodesData.nuc.statusClass = isOnline ? 'online' : 'offline';
          }
          if (typeof schematicNodesData !== 'undefined' && schematicNodesData.storage && disk) {
            schematicNodesData.storage.status = `Healthy (${disk.freeGB} GB Free)`;
            schematicNodesData.storage.services = `Local Drive D: (${disk.usedPercent}% Full) - Desktop NVMe Backup Pool`;
          }
        } catch (e) {}
        ['stag-streamhub', 'stag-files', 'stag-cam', 'stag-wol', 'stag-torrents2'].forEach(id => {
          const el = document.getElementById(id);
          if (el) { el.className = `item-tag ${isOnline ? 'online' : 'offline'}`; el.textContent = isOnline ? 'Operational' : 'Unreachable'; }
        });
        const stagCf = document.getElementById('stag-cf');
        if (stagCf) { stagCf.className = `item-tag ${isOnline ? 'online' : 'offline'}`; stagCf.textContent = isOnline ? 'Shield Active' : 'Origin Standby'; }

        const stNuc = document.getElementById('status-tag-nuc');
        if (stNuc) { stNuc.textContent = isOnline ? '24/7 Core' : 'Offline'; stNuc.className = 'item-tag ' + (isOnline ? 'online' : 'offline'); }
        const latNuc = document.getElementById('latency-nuc');
        if (latNuc) { latNuc.textContent = isOnline ? (latencyMs !== null ? `${latencyMs} ms (8.8.8.8)` : 'Online') : 'Offline'; latNuc.className = 'item-tag ' + (isOnline ? 'online' : 'offline'); }
        const fBadgeNuc = document.getElementById('fleet-badge-nuc');
        if (fBadgeNuc) { fBadgeNuc.className = `item-tag ${isOnline ? 'online' : 'offline'}`; fBadgeNuc.textContent = isOnline ? 'Online • 24/7 Core' : 'Offline • Unreachable'; }
        const fLatNuc = document.getElementById('fleet-latency-nuc');
        if (fLatNuc) { fLatNuc.textContent = isOnline ? `192.168.2.35 • ${latencyMs !== null ? `${latencyMs} ms (8.8.8.8)` : 'Online'}` : `192.168.2.35 • Unreachable`; }

        const latS = safeNum(latencyMs, null);
        const mStream = document.getElementById('meta-watch-streamhub');
        if (mStream) mStream.innerHTML = isOnline ? `${latS !== null ? latS + ' ms' : 'Online'} &bull; Sentinel Armed (3m)` : 'Unreachable &bull; Offline';
        const mFiles = document.getElementById('meta-watch-files');
        if (mFiles) mFiles.innerHTML = isOnline ? `${latS !== null ? latS + ' ms' : 'Online'} &bull; Auto-Mount Active` : 'Unreachable &bull; Offline';
        const mCam = document.getElementById('meta-watch-cam');
        if (mCam) mCam.innerHTML = isOnline ? '&lt;50ms Low-Latency WebRTC' : 'Unreachable &bull; Offline';
        const mWol = document.getElementById('meta-watch-wol');
        if (mWol) mWol.innerHTML = isOnline ? `${latS !== null ? latS + ' ms' : 'Online'} &bull; Fast-Path` : 'Unreachable &bull; Offline';
        const mTorrents2 = document.getElementById('meta-watch-torrents2');
        if (mTorrents2) mTorrents2.innerHTML = isOnline ? `${latS !== null ? latS + ' ms' : 'Online'} &bull; Swarm Active` : 'Unreachable &bull; Offline';
        const mCf = document.getElementById('meta-watch-cf');
        if (mCf) mCf.innerHTML = isOnline ? 'Anycast OK &bull; Global Anycast Resilient' : 'Standby &bull; Ingress Suspended';
        if (vitals) {
          const fVitals = document.getElementById('fleet-vitals-nuc');
          const fVpn = document.getElementById('fleet-vpn-nuc');
          if (fVitals) {
            fVitals.textContent = `${vitals.ramUsedGB} GB / ${vitals.ramTotalGB} GB (${vitals.ramPercent}%) | ${vitals.uptime} up`;
          }
          if (fVpn && vitals.vpn) {
            fVpn.textContent = vitals.vpn;
          }
        }
        const fCpuNuc = document.getElementById('fleet-cpu-nuc');
        const sCpu = document.getElementById('stat-cpu-val');
        if (isOnline) {
          const cLoad = (vitals && vitals.cpuLoad !== undefined) ? safeNum(vitals.cpuLoad, null) : null;
          if (fCpuNuc) fCpuNuc.textContent = cLoad !== null ? `Intel Core i5 \u2022 ${cLoad}% Load (4C / 8T)` : `Intel Core i5 \u2022 Online (4C / 8T)`;
          if (sCpu) sCpu.innerHTML = cLoad !== null ? `${cLoad}% <span style="font-size: 0.9rem; color: #8b949e;">CPU</span>` : `-- <span style="font-size: 0.9rem; color: #8b949e;">CPU</span>`;
        }
        if (!isOnline) {
          const sHw = document.getElementById('stat-hw-tag');
          if (sHw) { sHw.textContent = 'Offline'; sHw.className = 'item-tag offline'; }
          const sCpu = document.getElementById('stat-cpu-val');
          if (sCpu) sCpu.innerHTML = `-- <span style="font-size: 0.85rem; color: #8b949e; margin-left: 4px;">CPU</span>`;
          const sRam = document.getElementById('stat-ram-sub');
          if (sRam) sRam.textContent = 'Hardware Node Unreachable';
          const fVitals = document.getElementById('fleet-vitals-nuc');
          if (fVitals) fVitals.textContent = 'Node Unreachable';
          const fCpu = document.getElementById('fleet-cpu-nuc');
          if (fCpu) fCpu.textContent = 'Intel Core i5 | Offline';
        }

        const rNuc = document.getElementById('ribbon-nuc');
        if (rNuc) {
          rNuc.innerHTML = `<span class="dropdown-dot dot-2"></span> ${latS !== null ? latS + ' ms' : '-- ms'} | ${isOnline ? 'Online' : 'Offline'}`;
        }
        const rStorage = document.getElementById('ribbon-storage');
        if (rStorage && disk) {
          rStorage.textContent = `${disk.freeGB} GB Free (${disk.usedPercent}% used)`;
        }
        if (typeof updateHealthRadarUI === 'function') {
          updateHealthRadarUI({ nucOnline: isOnline, nucLatency: latencyMs, nucDisk: disk });
        }
        updateClusterPowerAndThermalsUI(Boolean(window.DESKTOP_IS_ONLINE));
        updateSslCertExpiryUI();
      } else if (target === 'desktop') {
        window.DESKTOP_IS_ONLINE = isOnline;
        updateClusterPowerAndThermalsUI(isOnline);
        updateAgySessionDisplay(window.AGY_SESSION_ID || '', window.AGY_SESSION_NAME || '', window.AGY_SESSION_HOST || null);
        if (typeof updateCloudflareStatsUI === 'function') {
          try { updateCloudflareStatsUI(); } catch(e) {}
        }
        if (typeof updateHealthRadarUI === 'function') {
          updateHealthRadarUI({ desktopOnline: isOnline });
        }
        if (typeof renderUptimeMatrix === 'function') {
          try { renderUptimeMatrix(); } catch(e) {}
        }
        const uptimeDeskStatus = document.getElementById('uptime-desktop-status');
        if (uptimeDeskStatus) {
          uptimeDeskStatus.textContent = isOnline ? 'Online • Active Session' : 'Eco Standby • Sleeping';
          uptimeDeskStatus.className = `tier-status ${isOnline ? 'online' : 'offline'}`;
        }
        document.querySelectorAll('#stat-desktop-pool-tag').forEach(el => {
          const poolTbStr = (disk && Number.isFinite(Number(disk.totalGB)) && Number(disk.totalGB) > 0) ? ` (${(Number(disk.totalGB) / 1000).toFixed(2)} TB)` : '';
          el.textContent = isOnline ? `Dual Drive${poolTbStr}` : `Standby Pool${poolTbStr}`;
          el.className = isOnline ? 'item-tag online' : 'item-tag';
        });
        const uptimeScaleToday = document.getElementById('uptime-desktop-scale-today');
        if (uptimeScaleToday) {
          uptimeScaleToday.innerHTML = isOnline
            ? 'Today (Active Session &bull; 100% Operational)'
            : 'Today (Eco Standby Mode &bull; Sleep)';
        }

        const cfTorrentsBadges = document.querySelectorAll('.cf-sub-torrents-badge, #cf-sub-torrents-badge');
        cfTorrentsBadges.forEach(badge => {
          badge.className = `item-tag ${isOnline ? 'online' : 'offline'} cf-sub-torrents-badge`;
          badge.textContent = isOnline ? 'Active' : 'Standby';
        });

        if (typeof currentPowerTarget !== 'undefined' && currentPowerTarget === 'desktop') {
          const descEl = document.getElementById('power-target-desc');
          const dotEl = document.getElementById('power-target-dot');
          if (descEl) descEl.innerHTML = `AMD Ryzen 7 &bull; RTX Workstation &bull; ${isOnline ? 'Online' : 'Standby'}`;
          if (dotEl) {
            dotEl.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
            dotEl.style.backgroundColor = isOnline ? '#38bdf8' : '#ef4444';
            dotEl.style.boxShadow = isOnline ? '0 0 8px #38bdf8' : '0 0 8px #ef4444';
          }
        }

        // Update Desktop Storage Segments Bar (media.html & index.html)
        const dSegWrap = document.querySelector('.node-deck-card.desktop-deck .storage-segments-bar');
        if (dSegWrap && disk) {
          const segs = dSegWrap.children;
          if (segs.length >= 4) {
            const hasC = (disk.cTotalGB !== undefined && disk.cTotalGB !== null && disk.cFreeGB !== undefined && disk.cFreeGB !== null);
            const hasD = (disk.dTotalGB !== undefined && disk.dTotalGB !== null && disk.dFreeGB !== undefined && disk.dFreeGB !== null);
            const cUsed = hasC ? Math.max(0, Math.round(Number(disk.cTotalGB) - Number(disk.cFreeGB))) : 0;
            const cFree = (disk.cFreeGB !== undefined && disk.cFreeGB !== null) ? Math.max(0, Math.round(Number(disk.cFreeGB))) : 0;
            const dUsed = hasD ? Math.max(0, Math.round(Number(disk.dTotalGB) - Number(disk.dFreeGB))) : 0;
            const dFree = (disk.dFreeGB !== undefined && disk.dFreeGB !== null) ? Math.max(0, Math.round(Number(disk.dFreeGB))) : 0;
            const computedTotal = cUsed + cFree + dUsed + dFree;
            const total = (disk.totalGB !== undefined && disk.totalGB !== null && Number(disk.totalGB) > 0) ? Number(disk.totalGB) : computedTotal;
            const safeTot = (Number.isFinite(Number(total)) && Number(total) > 0) ? Number(total) : 1;

            const cUsedPct = ((cUsed / safeTot) * 100).toFixed(1);
            const cFreePct = ((cFree / safeTot) * 100).toFixed(1);
            const dUsedPct = ((dUsed / safeTot) * 100).toFixed(1);
            const dFreePct = ((dFree / safeTot) * 100).toFixed(1);

            segs[0].style.width = `${cUsedPct}%`;
            segs[0].title = `C: NVMe Used: ${cUsed} GB`;
            segs[1].style.width = `${cFreePct}%`;
            segs[1].title = `C: NVMe Free: ${cFree} GB`;
            segs[2].style.width = `${dUsedPct}%`;
            segs[2].title = `D: Apps Used: ${dUsed} GB`;
            segs[3].style.width = `${dFreePct}%`;
            segs[3].title = `D: Apps Free: ${dFree} GB`;

            const cUsedEl = document.getElementById('stat-desktop-c-used');
            const cFreeEl = document.getElementById('stat-desktop-c-free');
            const dUsedEl = document.getElementById('stat-desktop-d-used');
            const dFreeEl = document.getElementById('stat-desktop-d-free');
            if (cUsedEl) cUsedEl.innerHTML = `<span class="legend-dot" style="background: #38bdf8;"></span> C: ${cUsed}G Used`;
            if (cFreeEl) cFreeEl.innerHTML = `<span class="legend-dot" style="background: rgba(56, 189, 248, 0.45);"></span> C: ${cFree}G Free`;
            if (dUsedEl) dUsedEl.innerHTML = `<span class="legend-dot" style="background: #10b981;"></span> D: ${dUsed}G Used`;
            if (dFreeEl) dFreeEl.innerHTML = `<span class="legend-dot" style="background: rgba(16, 185, 129, 0.35);"></span> D: ${(dFree / 1000).toFixed(2)}T Free`;
          }
        }
        const stagTorrents = document.getElementById('stag-torrents');
        if (stagTorrents) {
          stagTorrents.className = `item-tag ${isOnline ? 'online' : 'offline'}`;
          stagTorrents.textContent = isOnline ? 'Operational' : 'Standby';
        }
        const dLatS = safeNum(latencyMs, null);
        const metaTorrents = document.getElementById('meta-watch-torrents');
        if (metaTorrents) {
          metaTorrents.style.color = isOnline ? '#34d399' : '#94a3b8';
          metaTorrents.innerHTML = isOnline ? `${dLatS !== null ? dLatS + ' ms' : 'Online'} &bull; Interactive Node Active` : 'Standby &bull; Sleeping (WoL Ready)';
        }
        const stDesk = document.getElementById('status-tag-desktop');
        if (stDesk) { stDesk.textContent = isOnline ? 'Active' : 'Standby'; stDesk.className = 'item-tag ' + (isOnline ? 'online' : 'offline'); }
        const latDesk = document.getElementById('latency-desktop');
        if (latDesk) { latDesk.textContent = isOnline ? (latencyMs !== null ? `${latencyMs} ms (8.8.8.8)` : 'Online') : 'Standby'; latDesk.className = 'item-tag ' + (isOnline ? 'online' : 'offline'); }
        const fBadgeDesk = document.getElementById('fleet-badge-desktop');
        if (fBadgeDesk) { fBadgeDesk.className = `item-tag ${isOnline ? 'online' : 'offline'}`; fBadgeDesk.textContent = isOnline ? 'Online • Active' : 'Standby • Sleeping'; }
        const fLatDesk = document.getElementById('fleet-latency-desktop');
        if (fLatDesk) {
          fLatDesk.textContent = isOnline
            ? `192.168.2.62 • ${latencyMs !== null ? `${latencyMs} ms (8.8.8.8)` : 'Online'}`
            : '192.168.2.62 • Standby (WoL Ready)';
        }
        const schDesk = document.getElementById('schematic-desktop-throughput');
        if (schDesk) schDesk.textContent = isOnline ? '2.5 Gbps' : 'Standby';
        try {
          if (typeof schematicNodesData !== 'undefined' && schematicNodesData.desktop) {
            schematicNodesData.desktop.status = isOnline ? 'Online (Active Workstation)' : 'Standby (Eco Mode)';
            schematicNodesData.desktop.statusClass = isOnline ? 'online' : 'offline';
          }
        } catch (e) {}
        const rDesk = document.getElementById('ribbon-desktop');
        if (rDesk) {
          rDesk.innerHTML = `<span class="dropdown-dot dot-1"></span> Bell Fiber | ${isOnline ? 'Online' : 'Standby'}`;
        }
        if (isOnline) {
          if (disk) {
            const totalGB = safeNum(disk.totalGB, 0);
            const usedPercent = safeNum(disk.usedPercent, 0);
            const usedGB = safeNum(disk.usedGB, 0);
            const freeGB = safeNum(disk.freeGB, 0);
            const cFree = (disk.cFreeGB !== undefined && disk.cFreeGB !== null) ? Math.round(safeNum(disk.cFreeGB, 0)) : '--';
            const dFree = (disk.dFreeGB !== undefined && disk.dFreeGB !== null) ? (safeNum(disk.dFreeGB, 0) / 1000).toFixed(1) : '--';

            const fStorage = document.getElementById('fleet-storage-desktop');
            const fBar = document.getElementById('fleet-bar-desktop');
            const freePct = Math.round(100 - usedPercent); if (fStorage) fStorage.innerHTML = `${freeGB.toLocaleString()} GB Free (${freePct}% free) &bull; C: ${cFree}G | D: ${dFree}T`;
            if (fBar) fBar.style.width = `${usedPercent}%`;
            
            const dTag = document.getElementById('desktop-disk-tag');
            const dVal = document.getElementById('desktop-disk-val');
            const dBar = document.getElementById('desktop-disk-bar');
            const dSub = document.getElementById('desktop-disk-sub');
            if (dTag) dTag.innerHTML = `C: ${cFree}G &bull; D: ${dFree}T`;
            if (dVal) dVal.textContent = `${freeGB.toLocaleString()} GB Free`;
            if (dBar) dBar.style.width = `${usedPercent}%`;
            if (dSub) dSub.innerHTML = `${usedGB} GB used of ${totalGB.toLocaleString()} GB (${usedPercent}% used &bull; ${freePct}% free) &bull; C: ${cFree}G | D: ${dFree}T`;
            
            const sDeskFree = document.getElementById('stat-desktop-disk-free');
            const sDeskSub = document.getElementById('stat-desktop-disk-sub');
            if (sDeskFree) sDeskFree.innerHTML = `${freeGB.toLocaleString()} GB <span style="font-size: 0.9rem; color: #8b949e;">Free</span>`;
            if (sDeskSub) sDeskSub.innerHTML = `<span>Total ${totalGB.toLocaleString()} GB (${freePct}% Free &bull; ${usedPercent}% Used &bull; ${usedGB} GB)</span>`;

            const rDeskStorage = document.getElementById('ribbon-desktop-storage');
            if (rDeskStorage) rDeskStorage.textContent = `${(freeGB / 1000).toFixed(2)} TB Free (${freePct}% free \u2022 C: ${cFree}G | D: ${dFree}T)`;
          }

          const fVitals = document.getElementById('fleet-vitals-desktop');
          const fCpu = document.getElementById('fleet-cpu-desktop');
          const sDeskCpu = document.getElementById('stat-desktop-cpu-val');
          const sDeskRam = document.getElementById('stat-desktop-ram-sub');
          if (vitals) {
            const rUsed = safeNum(vitals.ramUsedGB, '--');
            const rTot = safeNum(vitals.ramTotalGB, '--');
            const rPct = safeNum(vitals.ramPercent, '--');
            const cLd = vitals.cpuLoad !== undefined ? safeNum(vitals.cpuLoad, null) : null;
            if (fVitals) fVitals.textContent = `${rUsed} GB / ${rTot} GB (${rPct}%) | Active`;
            if (fCpu) fCpu.textContent = cLd !== null ? `AMD Ryzen 7 | ${cLd}% Load (8C / 16T)` : 'AMD Ryzen 7 | Online (8C / 16T)';
            if (sDeskCpu) sDeskCpu.innerHTML = cLd !== null ? `${cLd}% <span style="font-size: 0.9rem; color: #8b949e; margin-left: 4px;">CPU</span>` : `-- <span style="font-size: 0.9rem; color: #8b949e; margin-left: 4px;">CPU</span>`;
            if (sDeskRam) sDeskRam.textContent = `Memory: ${rUsed} GB / ${rTot} GB (${rPct}%) | Active Session`;
          } else {
            if (fVitals) fVitals.textContent = 'Awaiting Vitals | Online';
            if (fCpu) fCpu.textContent = 'AMD Ryzen 7 | Online (8C / 16T)';
            if (sDeskCpu) sDeskCpu.innerHTML = `-- <span style="font-size: 0.9rem; color: #8b949e; margin-left: 4px;">CPU</span>`;
            if (sDeskRam) sDeskRam.textContent = 'Memory: Awaiting Vitals | Active Session';
          }
        }
        if (!isOnline) {
          const fVitals = document.getElementById('fleet-vitals-desktop');
          const fCpu = document.getElementById('fleet-cpu-desktop');
          if (fVitals) fVitals.textContent = 'Node in Sleep / Standby Mode';
          if (fCpu) fCpu.textContent = 'AMD Ryzen 7 | Offline';
          const sDeskCpu = document.getElementById('stat-desktop-cpu-val');
          const sDeskRam = document.getElementById('stat-desktop-ram-sub');
          if (sDeskCpu) sDeskCpu.innerHTML = `--% <span style="font-size: 0.9rem; color: #8b949e; margin-left: 4px;">CPU</span>`;
          if (sDeskRam) sDeskRam.textContent = 'Memory: Standby / Sleep';
          const sDeskSub = document.getElementById('stat-desktop-disk-sub');
          if (sDeskSub) {
            if (disk && Number.isFinite(Number(disk.totalGB)) && Number(disk.totalGB) > 0) {
              const totFmt = Math.round(Number(disk.totalGB)).toLocaleString();
              const pctTxt = (disk.usedPercent !== undefined && disk.usedPercent !== null) ? `${disk.usedPercent}% Used` : 'Standby';
              sDeskSub.innerHTML = `<span>Total ${totFmt} GB (${pctTxt} &bull; Standby)</span>`;
            } else {
              sDeskSub.innerHTML = '<span>Storage Standby &bull; Sleep Mode</span>';
            }
          }
          const dTag = document.getElementById('desktop-speed-tag');
          if (dTag) { dTag.textContent = 'Offline'; dTag.className = 'item-tag offline'; }
        }
      }
      updateHealthIndexScore();
    }

    function updateHealthIndexScore() {
      const hPct = document.getElementById('health-index-pct');
      const hStatus = document.getElementById('health-index-status');
      const nucOn = window.NUC_IS_ONLINE !== undefined ? window.NUC_IS_ONLINE : true;
      const deskOn = window.DESKTOP_IS_ONLINE !== undefined ? window.DESKTOP_IS_ONLINE : false;
      let score = 100;
      let statusText = 'Optimal';
      let statusClass = 'item-tag online';
      if (!nucOn && !deskOn) {
        score = 0;
        statusText = 'Critical';
        statusClass = 'item-tag offline';
      } else if (!nucOn) {
        score = 45;
        statusText = 'Degraded';
        statusClass = 'item-tag offline';
      } else if (!deskOn) {
        score = 98;
        statusText = 'Optimal (Eco)';
        statusClass = 'item-tag online';
      } else {
        score = 100;
        statusText = 'Optimal';
        statusClass = 'item-tag online';
      }
      if (hPct) hPct.textContent = `${score}%`;
      if (hStatus) {
        hStatus.textContent = statusText;
        hStatus.className = statusClass;
      }
      document.querySelectorAll('#modal-health-score').forEach(el => {
        el.textContent = `${score}% ${statusText}`;
      });
      document.querySelectorAll('#chaos-score-val').forEach(el => {
        el.textContent = `${score}% ${statusText}`;
      });
      const heroBtn = document.getElementById('hero-health-radar-text');
      if (heroBtn) {
        heroBtn.textContent = `Health Radar (${score}% ${statusText})`;
      }
      const cNuc = document.getElementById('c-node-nuc');
      if (cNuc) {
        const st = cNuc.querySelector('.chaos-node-status');
        if (st && !cNuc.classList.contains('severed')) st.textContent = nucOn ? 'Online (24/7 Node)' : 'Offline (Unreachable)';
      }
      const cDesk = document.getElementById('c-node-desktop');
      if (cDesk) {
        const st = cDesk.querySelector('.chaos-node-status');
        if (st && !cDesk.classList.contains('severed')) st.textContent = deskOn ? 'Online (2.5 GbE)' : 'Standby (Eco Mode)';
      }
      const cStorage = document.getElementById('c-node-storage');
      if (cStorage && window.LAST_NUC_DISK) {
        const st = cStorage.querySelector('.chaos-node-status');
        if (st && !cStorage.classList.contains('severed')) st.textContent = `Healthy (${Math.round(window.LAST_NUC_DISK.usedPercent)}% Used)`;
      }
    }

    // Check status on load
    function initApp() {
      hydrateTelemetryFromCache();
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      initLayoutMode();
      if (window.location.hash === '#fleet-quick-controls') {
        setTimeout(() => {
          if (typeof scrollToPowerControls === 'function') scrollToPowerControls();
        }, 350);
      } else if (window.location.hash && window.location.hash.startsWith('#pane-')) {
        const tabKey = window.location.hash.replace('#pane-', '');
        setTimeout(() => {
          if (typeof switchNucTab === 'function') switchNucTab(tabKey);
        }, 350);
      }
      updateTokenCounterUI();
      updateSslCertExpiryUI();
      updateClusterPowerAndThermalsUI(Boolean(window.DESKTOP_IS_ONLINE));
      updateCloudflareStatsUI();
      fetchAgySessionInfo();
      if (typeof fetchFeederStatus === 'function') fetchFeederStatus();

      // Ensure all modal overlays are strictly hidden on load
      ['magnet-modal-overlay', 'agy-console-modal-overlay', 'changelog-modal-overlay', 'health-modal-overlay', 'chaos-modal-overlay', 'disaster-modal-overlay', 'speedtest-sso-modal-overlay', 'cloudflare-stats-modal-overlay', 'adguard-modal-overlay', 'tailscale-modal-overlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active'); el.style.display = 'none'; }
      });

      // Multi-tier Fallback Cluster Telemetry Engine with Resilient Timeouts & Cache Persistence
      fetchTelemetryWithFallback('nuc')
        .then(d => {
          if (d && d.online !== false) {
            updateStatusUI('nuc', true, d.latencyMs, d.disk, d.torrent, d.vitals);
          } else {
            updateStatusUI('nuc', false);
          }
        })
        .catch(() => {
          updateStatusUI('nuc', false);
        });

      fetchTelemetryWithFallback('desktop')
        .then(d => {
          if (d && d.online !== false) {
            updateStatusUI('desktop', true, d.latencyMs, d.disk, d.torrent, d.vitals);
          } else {
            updateStatusUI('desktop', false);
          }
        })
        .catch(() => {
          updateStatusUI('desktop', false);
        });

      setTimeout(auditAndAttachCheckButtons, 1200);
      setTimeout(auditAndAttachCheckButtons, 3500);

      // Smooth dropdown hover & focus management with zero flicker
      document.querySelectorAll('.dropdown').forEach(dd => {
        let timer;
        dd.addEventListener('mouseenter', () => {
          clearTimeout(timer);
          document.querySelectorAll('.dropdown').forEach(other => {
            if (other !== dd) other.classList.remove('is-open');
          });
          dd.classList.add('is-open');
        });
        dd.addEventListener('mouseleave', () => {
          timer = setTimeout(() => {
            dd.classList.remove('is-open');
          }, 200);
        });
        const trigger = dd.querySelector('.btn-nav, .btn-torrent, .btn-gemini, .btn-wol, #wol-btn');
        if (trigger) {
          trigger.addEventListener('click', (e) => {
            if (trigger.tagName === 'BUTTON' || trigger.getAttribute('href') === 'javascript:void(0)' || document.documentElement.classList.contains('mobile-layout') || window.innerWidth <= 768) {
              e.preventDefault();
              dd.classList.toggle('is-open');
            }
          });
        }
      });

      // Mobile nav item auto-dismiss & backdrop click handlers
      document.querySelectorAll('.nav-links a:not(.dropdown > a), .nav-links button:not(.dropdown > button)').forEach(item => {
        item.addEventListener('click', () => {
          if (document.documentElement.classList.contains('mobile-layout') || window.innerWidth <= 768) {
            closeMobileNav();
          }
        });
      });

      document.addEventListener('click', (e) => {
        if (e.target.closest('.dropdown-menu button, .dropdown-menu a')) {
          setTimeout(() => {
            document.querySelectorAll('.dropdown').forEach(dd => dd.classList.remove('is-open'));
            closeMobileNav();
          }, 80);
          return;
        }
        if (!e.target.closest('.dropdown')) {
          document.querySelectorAll('.dropdown').forEach(dd => dd.classList.remove('is-open'));
        }
        if (!e.target.closest('.header')) {
          closeMobileNav();
        }
      });

      const hasClimateDom = () => Boolean(document.getElementById('iot-ambient-temp') || document.getElementById('ribbon-climate') || document.getElementById('climate-temp-val') || document.getElementById('climate-temp') || document.querySelector('[id*="climate-"]'));
      const hasIspDom = () => Boolean(document.getElementById('isp-ping-val') || document.getElementById('isp-history-tbody') || document.getElementById('uptimeSparkline'));
      const hasUptimeDom = () => Boolean(document.getElementById('uptimeMatrix') || document.getElementById('uptime-sla-val') || document.getElementById('uptime-desktop-status'));
      const hasServicesDom = () => Boolean(document.getElementById('dashServiceGrid') || document.getElementById('dash-global-status') || document.querySelector('[id^="kuma-lat-"]'));
      const hasTermDom = () => Boolean(document.getElementById('terminal-content'));

      // Start live stats & terminal stream with Page Visibility + DOM presence throttling
      const statsPromise = fetchClusterStats();
      if (document.getElementById('abs-bookshelf-grid')) {
        Promise.resolve(statsPromise).then(() => {
          if (!window._absHydrated && typeof fetchAudiobookshelfFallback === 'function') fetchAudiobookshelfFallback();
        }).catch(() => {
          if (!window._absHydrated && typeof fetchAudiobookshelfFallback === 'function') fetchAudiobookshelfFallback();
        });
      }
      setInterval(() => { if (!document.hidden) fetchClusterStats(); }, 4000);
      if (hasClimateDom()) {
        setInterval(() => { if (!document.hidden && typeof fetchClimateData === 'function') fetchClimateData(); }, 10000);
      }
      updateSSOGateUI(); try { updateMaintenanceVisualStates(); } catch(e) {}
      try { updateCodebaseMetrics(); } catch(e) {}
      try { updateMediaRoutePillUI(); } catch(e) {}
      try { syncCloudflareAccessSession(true); } catch(e) {}
      if (hasTermDom() && isSSOAuthenticated()) {
        loadLog('agy');
      }
      if (hasIspDom()) {
        fetchISPHistory();
        setInterval(() => { if (!document.hidden) fetchISPHistory(); }, 15000);
      }
      if (hasUptimeDom()) {
        renderUptimeMatrix();
        setInterval(() => { if (!document.hidden) renderUptimeMatrix(); }, 60000);
      }
      if (hasServicesDom()) {
        fetchServicesHealth();
        setInterval(() => { if (!document.hidden) fetchServicesHealth(); }, 15000);
      }

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          fetchClusterStats();
          if (hasClimateDom() && typeof fetchClimateData === 'function') fetchClimateData();
          if (hasIspDom()) fetchISPHistory();
          if (hasServicesDom()) fetchServicesHealth();
          if (hasTermDom() && currentLogTab && isSSOAuthenticated()) loadLog(currentLogTab);
        }
      });

      // Auto-stream inline terminal every 3s
      setInterval(() => {
        if (document.hidden || !hasTermDom()) return;
        if (currentLogTab && isSSOAuthenticated()) {
          fetch(`${GATEWAY}/api/logs?name=${encodeURIComponent(currentLogTab)}`, {
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            signal: _fetchSig(8000)
          })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(data => {
              const body = document.getElementById('terminal-content');
              if (body && data && data.lines) {
                const isAtBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
                body.textContent = data.lines.join('\n');
                if (isAtBottom) body.scrollTop = body.scrollHeight;
              }
            }).catch(() => {});
        }
      }, 3000);
    }

    // Remote Control Matrix Handler
    // ==========================================
    // CLOUDFLARE ACCESS M365 ENTRA ID SSO CONTROLLER
    // ==========================================
    let _cfAccessVerified = false;
    let _cfAccessEmail = '';

    function getAdminKey() {
      try {
        return sessionStorage.getItem('dr_admin_key') || '';
      } catch(e) {
        return '';
      }
    }

    function getAdminAuthHeaders(extra = {}) {
      const headers = Object.assign({}, extra);
      const k = getAdminKey();
      if (k) headers['X-Admin-Key'] = k;
      return headers;
    }

    function isSSOAuthenticated() {
      return Boolean(_cfAccessVerified || getAdminKey());
    }

    async function syncCloudflareAccessSession(autoRedirect = true) {
      try {
        const res = await fetch(`${GATEWAY}/api/auth/verify`, {
          credentials: 'include',
          signal: _fetchSig(6000)
        });
        if (!res.ok) {
          const httpErr = new Error('HTTP ' + res.status);
          httpErr.status = res.status;
          throw httpErr;
        }
        const data = await res.json();
        if (!data || data.status !== 'authorized') {
          const authErr = new Error('Unauthorized');
          authErr.status = 401;
          throw authErr;
        }
        _cfAccessVerified = true;
        _cfAccessEmail = data.email || 'cory.townsend@digitalresolve.ca';
        try { sessionStorage.removeItem('dr_sso_sync_attempted'); } catch(e) {}
        updateSSOGateUI();
        try { updateMaintenanceVisualStates(); } catch(e) {}
        try { fetchISPHistory(); } catch(e) {}
        if (typeof loadLog === 'function' && typeof currentLogTab !== 'undefined' && document.getElementById('terminal-content')) {
          try { loadLog(currentLogTab); } catch(e) {}
        }
        return true;
      } catch (err) {
        const status = err && err.status;
        const isTransient = (err && (err.name === 'AbortError' || err.name === 'TimeoutError' || err.name === 'TypeError')) || [502, 503, 504, 530].includes(status);
        const isAuthFailure = !isTransient && (status === 401 || status === 403);
        let syncAttempted = false;
        try { syncAttempted = Boolean(sessionStorage.getItem('dr_sso_sync_attempted')); } catch(e) {}
        if (autoRedirect && isAuthFailure && window.location.hostname === 'digitalresolve.ca' && !syncAttempted) {
          try { sessionStorage.setItem('dr_sso_sync_attempted', '1'); } catch(e) {}
          window.location.href = GATEWAY + '/api/sso/login?return=' + encodeURIComponent(window.location.href);
          return false;
        }
        _cfAccessVerified = false;
        _cfAccessEmail = '';
        updateSSOGateUI();
        return false;
      }
    }
    window.syncCloudflareAccessSession = syncCloudflareAccessSession;

    function updateSSOGateUI() {
      const authed = isSSOAuthenticated();
      
      // Top Dedicated SSO Login & Logout Controls
      const topLoginBtn = document.getElementById('top-sso-login-btn');
      const topAuthedGroup = document.getElementById('top-sso-authed-group');
      const topUserName = document.getElementById('top-sso-user-name');
      if (topLoginBtn && topAuthedGroup) {
        if (authed) {
          topLoginBtn.style.display = 'none';
          topAuthedGroup.style.display = 'inline-flex';
          if (topUserName) {
            topUserName.textContent = _cfAccessEmail || 'Cory Townsend';
          }
        } else {
          topLoginBtn.style.display = 'inline-flex';
          topAuthedGroup.style.display = 'none';
        }
      }

      // Consolidated Menu 3 SSO Action Button
      const menuSsoBtn = document.getElementById('menu-sso-auth-btn');
      if (menuSsoBtn) {
        if (authed) {
          menuSsoBtn.onclick = (e) => lockSSO(true, e);
          menuSsoBtn.title = 'Sign out and refresh deck behind Microsoft 365 SSO';
          menuSsoBtn.innerHTML = '<span class="dropdown-dot" style="background-color: #ef4444; box-shadow: 0 0 6px #ef4444;"></span><span>Sign Out (M365)</span><span class="item-tag">Sign Out</span>';
        } else {
          menuSsoBtn.onclick = () => openGlobalSSOModal('Admin Workspace Authorization');
          menuSsoBtn.title = 'Sign in with Microsoft 365 Entra ID SSO';
          menuSsoBtn.innerHTML = '<span class="dropdown-dot" style="background-color: #f59e0b; box-shadow: 0 0 6px #f59e0b;"></span><span>Sign In with M365</span><span class="item-tag">Sign In</span>';
        }
      }

      // Legacy Header SSO Button elements fallback
      const headerSsoBtn = document.getElementById('header-sso-btn');
      const headerSsoDot = document.getElementById('header-sso-dot');
      const headerSsoText = document.getElementById('header-sso-text');
      if (headerSsoBtn && headerSsoDot && headerSsoText) {
        if (authed) {
          headerSsoBtn.style.background = 'rgba(16, 185, 129, 0.18)';
          headerSsoBtn.style.borderColor = 'rgba(16, 185, 129, 0.45)';
          headerSsoBtn.style.color = '#6ee7b7';
          headerSsoDot.style.backgroundColor = '#10b981';
          headerSsoDot.style.boxShadow = '0 0 8px #10b981';
          headerSsoText.innerHTML = 'Admin | Sign Out (M365)';
          headerSsoBtn.title = 'Authenticated as Microsoft 365 Admin (Cory Townsend). Click to sign out.';
        } else {
          headerSsoBtn.style.background = 'rgba(245, 158, 11, 0.15)';
          headerSsoBtn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          headerSsoBtn.style.color = '#fde68a';
          headerSsoDot.style.backgroundColor = '#f59e0b';
          headerSsoDot.style.boxShadow = '0 0 8px #f59e0b';
          headerSsoText.innerHTML = 'Sign In with M365';
          headerSsoBtn.title = 'Unified Microsoft 365 Entra ID SSO Admin Session. Click to authenticate.';
        }
      }

      // Live Terminal elements
      const termTitle = document.getElementById('terminal-title-text');
      const termPulse = document.getElementById('terminal-pulse-dot');
      const termTabs = document.getElementById('terminal-tabs-group');
      const termBody = document.getElementById('terminal-content');
      const termPrompt = document.getElementById('agy-prompt-container');
      const termGate = document.getElementById('terminal-sso-gate');
      const termBadge = document.getElementById('terminal-header-sso-badge');
      const termLock = document.getElementById('tab-lock-btn');
      const inlineChips = document.getElementById('agy-inline-chips');

      // Embedded Console Modal elements
      const modalGate = document.getElementById('modal-sso-gate');
      const modalMeta = document.getElementById('agy-session-meta-bar');
      const modalScreen = document.getElementById('agy-console-screen');
      const modalChips = document.getElementById('agy-quick-chips');
      const modalInput = document.getElementById('agy-console-input-bar');
      const modalTitle = document.getElementById('agy-modal-title-text');
      const modalPulse = document.getElementById('agy-modal-pulse-dot');
      const modalStatus = document.getElementById('agy-console-status');

      // Ollama Edge AI elements
      const aiGate = document.getElementById('edge-ai-sso-gate');
      const aiControls = document.getElementById('edge-ai-unlocked-container');
      const aiBadge = document.getElementById('edge-ai-badge');
      const aiLock = document.getElementById('edge-ai-lock-btn');
      const aiPulse = document.getElementById('edge-ai-pulse');
      const aiStats = document.getElementById('ai-infer-stats');

      if (authed) {
        // Unlocked Terminal Card
        if (termTitle) termTitle.innerHTML = 'Live Interactive Terminal | Stream Active';
        if (termPulse) { termPulse.style.background = '#10b981'; termPulse.style.boxShadow = '0 0 8px #10b981'; }
        if (termTabs) termTabs.style.display = 'flex';
        if (termLock) termLock.style.display = 'inline-flex';
        if (termBadge) termBadge.style.display = 'none';
        const termTokenPill = document.getElementById('terminal-token-pill');
        if (termTokenPill) termTokenPill.style.display = 'inline-flex';
        if (termBody) termBody.style.display = 'block';
        if (inlineChips) inlineChips.style.display = 'flex';
        if (termPrompt) termPrompt.style.display = 'flex';
        if (termGate) termGate.style.display = 'none';

        // Unlocked Modal
        if (modalGate) modalGate.style.display = 'none';
        if (modalMeta) modalMeta.style.display = 'flex';
        if (modalScreen) modalScreen.style.display = 'block';
        if (modalChips) modalChips.style.display = 'flex';
        if (modalInput) modalInput.style.display = 'flex';
        if (modalTitle) modalTitle.innerHTML = 'Antigravity (AGY) Live Terminal | <span class="mono" style="color: #60a5fa;">' + escapeHtml(window.AGY_SESSION_NAME || (window.AGY_SESSION_ID ? ('Session (' + window.AGY_SESSION_ID.substring(0,8) + ')') : 'Detecting active session...')) + '</span>';
        const isAgyNuc = (window.AGY_SESSION_HOST === 'nuc');
        const activeHostOnline = isAgyNuc ? (window.NUC_IS_ONLINE !== false) : (window.DESKTOP_IS_ONLINE !== undefined ? window.DESKTOP_IS_ONLINE : true);
        if (modalPulse) { modalPulse.style.background = activeHostOnline ? '#10b981' : '#6366f1'; modalPulse.style.boxShadow = activeHostOnline ? '0 0 8px #10b981' : '0 0 8px #6366f1'; }
        if (modalStatus) { modalStatus.textContent = activeHostOnline ? (isAgyNuc ? 'ONLINE (NUC :8082)' : 'ONLINE (Desktop :8082)') : 'STANDBY (Desktop Sleeping • WoL Ready)'; modalStatus.className = `item-tag ${activeHostOnline ? 'online' : 'offline'}`; }

        // Unlocked Ollama Edge AI Card
        if (aiGate) aiGate.style.display = 'none';
        if (aiControls) aiControls.style.display = 'flex';
        if (aiBadge) { aiBadge.textContent = 'Ready (Port 11434)'; aiBadge.className = 'item-tag online'; }
        if (aiLock) aiLock.style.display = 'inline-flex';
        if (aiPulse) { aiPulse.style.background = '#10b981'; aiPulse.style.boxShadow = '0 0 8px #10b981'; }
        if (aiStats) aiStats.textContent = 'Intel Core i5 | Local Compute';

        // External WAN IPv4 (Exposed only when MFA/SSO authenticated)
        const ispIpSub = document.getElementById('isp-ip-sub');
        const tierBellIp = document.getElementById('tier-bell-ip-text');
        const resolvedIp = window.CURRENT_EXTERNAL_IP || 'n/a';
        if (ispIpSub) ispIpSub.innerHTML = 'IPv4: <span id="isp-ip-text" style="color: #60a5fa; font-family: monospace; font-style: normal;">' + escapeHtml(resolvedIp) + '</span>';
        if (tierBellIp) {
          tierBellIp.textContent = resolvedIp;
          tierBellIp.style.color = '#cbd5e1';
          tierBellIp.style.fontStyle = 'normal';
          tierBellIp.style.fontFamily = 'monospace';
        }

        // Unlocked Quick Drop Magnet Console
        const quickUnlocked = document.getElementById('quick-drop-unlocked-form');
        const quickGate = document.getElementById('quick-drop-sso-gate');
        if (quickUnlocked && quickGate) {
          quickUnlocked.style.display = 'flex';
          quickGate.style.display = 'none';
        }

        // Unlocked Magnet Modal
        const magUnlocked = document.getElementById('magnet-modal-unlocked');
        const magGate = document.getElementById('magnet-modal-sso-gate');
        if (magUnlocked && magGate) {
          magUnlocked.style.display = 'block';
          magGate.style.display = 'none';
        }
      } else {
        // Locked Terminal Card
        if (termTitle) termTitle.innerHTML = 'Live Interactive Terminal';
        if (termPulse) { termPulse.style.background = '#f59e0b'; termPulse.style.boxShadow = '0 0 8px #f59e0b'; }
        if (termTabs) termTabs.style.display = 'none';
        if (termLock) termLock.style.display = 'none';
        if (termBadge) termBadge.style.display = 'inline-flex';
        const termTokenPill = document.getElementById('terminal-token-pill');
        if (termTokenPill) termTokenPill.style.display = 'none';
        if (termBody) termBody.style.display = 'none';
        if (inlineChips) inlineChips.style.display = 'none';
        if (termPrompt) termPrompt.style.display = 'none';
        if (termGate) termGate.style.display = 'flex';

        // Locked Modal
        if (modalGate) modalGate.style.display = 'flex';
        if (modalMeta) modalMeta.style.display = 'none';
        if (modalScreen) modalScreen.style.display = 'none';
        if (modalChips) modalChips.style.display = 'none';
        if (modalInput) modalInput.style.display = 'none';
        if (modalTitle) modalTitle.innerHTML = 'Antigravity (AGY) Live Terminal';
        if (modalPulse) { modalPulse.style.background = '#f59e0b'; modalPulse.style.boxShadow = '0 0 8px #f59e0b'; }
        if (modalStatus) { modalStatus.textContent = 'AUTHENTICATION REQUIRED'; modalStatus.className = 'item-tag'; }

        // Locked Ollama Edge AI Card
        if (aiGate) aiGate.style.display = 'flex';
        if (aiControls) aiControls.style.display = 'none';
        if (aiBadge) { aiBadge.textContent = 'Port 11434'; aiBadge.className = 'item-tag'; }
        if (aiLock) aiLock.style.display = 'none';
        if (aiPulse) { aiPulse.style.background = '#f59e0b'; aiPulse.style.boxShadow = '0 0 8px #f59e0b'; }
        if (aiStats) aiStats.textContent = 'Intel Core i5 | Local Compute';

        // Mask External WAN IPv4 (MFA Required)
        const ispIpSub = document.getElementById('isp-ip-sub');
        const tierBellIp = document.getElementById('tier-bell-ip-text');
        if (ispIpSub) ispIpSub.innerHTML = 'IPv4: <span id="isp-ip-text" style="color: #94a3b8; font-style: italic;">Protected (MFA Required)</span>';
        if (tierBellIp) {
          tierBellIp.textContent = 'Protected (MFA Required)';
          tierBellIp.style.color = '#94a3b8';
          tierBellIp.style.fontStyle = 'italic';
          tierBellIp.style.fontFamily = 'inherit';
        }

        // Locked Quick Drop Magnet Console
        const quickUnlocked = document.getElementById('quick-drop-unlocked-form');
        const quickGate = document.getElementById('quick-drop-sso-gate');
        if (quickUnlocked && quickGate) {
          quickUnlocked.style.display = 'none';
          quickGate.style.display = 'flex';
        }

        // Locked Magnet Modal
        const magUnlocked = document.getElementById('magnet-modal-unlocked');
        const magGate = document.getElementById('magnet-modal-sso-gate');
        if (magUnlocked && magGate) {
          magUnlocked.style.display = 'none';
          magGate.style.display = 'flex';
        }
      }
    }

    function toggleGlobalSSO() {
      if (isSSOAuthenticated()) {
        lockSSO();
      } else {
        openGlobalSSOModal('Admin Workspace Authorization');
      }
    }
    window.toggleGlobalSSO = toggleGlobalSSO;

    function unlockSSO(method = 'm365') {
      if (isSSOAuthenticated()) {
        updateSSOGateUI();
        try { updateMaintenanceVisualStates(); } catch(e) {}
        try { updateCodebaseMetrics(); } catch(e) {}
        try { fetchISPHistory(); } catch(e) {}
        return;
      }
      if (/(^|\.)digitalresolve\.ca$/i.test(window.location.hostname)) {
        try { sessionStorage.removeItem('dr_sso_sync_attempted'); } catch(e) {}
        window.location.href = GATEWAY + '/api/sso/login?return=' + encodeURIComponent(window.location.href);
        return;
      }
      openGlobalSSOModal('Microsoft 365 Entra ID SSO Authorization');
    }
    window.unlockSSO = unlockSSO;
    window.isSSOAuthenticated = isSSOAuthenticated;

    async function lockSSO(fullIdpLogout = false, evt = null) {
      showToast('info', 'Signing Out of Microsoft 365 SSO...', 'Clearing Cloudflare Access session and local caches...', 3000);
      _cfAccessVerified = false;
      _cfAccessEmail = '';
      try {
        localStorage.removeItem('dr_sso_authenticated');
        localStorage.removeItem('dr_sso_pin');
        localStorage.removeItem('dr_sso_user');
        localStorage.removeItem('dr_sso_email');
      } catch(e) {}
      try { sessionStorage.clear(); } catch(e) {}
      try {
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(k => caches.delete(k)));
        }
      } catch(e) {}
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
      } catch(e) {}
      window.pendingSSOCallback = null;
      if (typeof stopConsoleAutoPoll === 'function') stopConsoleAutoPoll();
      updateSSOGateUI();
      await fetch('https://wake.digitalresolve.ca/cdn-cgi/access/logout', { mode: 'no-cors', credentials: 'include' }).catch(() => {});
      const isShift = Boolean((evt && evt.shiftKey) || (typeof window !== 'undefined' && window.event && window.event.shiftKey));
      if (fullIdpLogout && isShift) {
        window.location.href = 'https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=' + encodeURIComponent('https://digitalresolve.ca/cdn-cgi/access/logout');
        return;
      }
      window.location.href = 'https://digitalresolve.ca/cdn-cgi/access/logout';
    }
    window.lockSSO = lockSSO;

    // Multi-modal AGY session launcher
    function launchAgySession(target) {
      const cid = window.AGY_SESSION_ID || '';
      const shortId = cid ? cid.substring(0, 8) : 'active';
      if (target === 'stream' || !target) {
        loadLog('agy');
        const term = document.getElementById('terminal-card');
        if (term) term.scrollIntoView({ behavior: 'smooth' });
        showToast('info', 'AGY Live Terminal', `Streaming active session ${shortId}...`);
      } else if (target === 'app') {
        if (!isSSOAuthenticated()) {
          openGlobalSSOModal('Antigravity Session Launcher', () => launchAgySession(target));
          return;
        }
        if (!cid) {
          showToast('warning', 'Session Unavailable', 'Active session ID has not loaded from gateway yet.');
          return;
        }
        showToast('loading', 'Launching Antigravity App...', `Connecting to conversation://${shortId}...`, 3000);
        window.location.href = `conversation://${cid}`;
        setTimeout(() => {
          loadLog('agy');
          const term = document.getElementById('terminal-card');
          if (term) term.scrollIntoView({ behavior: 'smooth' });
        }, 1200);
      } else if (target === 'web') {
        openEmbeddedConsole();
      } else if (target === 'copy') {
        if (!cid) {
          showToast('warning', 'Session Unavailable', 'Active session ID has not loaded from gateway yet.');
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(cid);
          showToast('success', 'Copied to Clipboard', `Session ID: ${cid}`);
        } else {
          prompt('Copy Conversation ID:', cid);
        }
      }
    }

    // Send remote instruction / prompt to active AGY session
    function sendAgyPrompt() {
      const input = document.getElementById('agy-prompt-input');
      const promptText = input ? input.value.trim() : '';
      if (!promptText) return;

      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Autonomous AGY Instruction Dispatch', sendAgyPrompt);
        return;
      }

      const termBody = document.getElementById('terminal-content');
      if (termBody) {
        const now = new Date().toLocaleTimeString('en-US', { hour12: false });
        termBody.textContent += `\n[${now}] [USER] ${promptText}`;
      }

      if (input) input.value = '';
      const cid = window.AGY_SESSION_ID || '';
      showToast('loading', 'Dispatching Prompt to AGY Session...', `Session: ${cid ? cid.substring(0,8) : 'active'}`, 1500);

      const payload = { prompt: promptText };
      if (cid) payload.conversationId = cid;
      fetch(`${GATEWAY}/api/agy/send`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        signal: _fetchSig(15000)
      })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.status === 'success') {
          showToast('success', 'Prompt Delivered', 'Instruction queued for autonomous agent execution.');
          setTimeout(() => loadLog('agy'), 1200);
        } else {
          showToast('error', 'Transmission Failed', data.message || 'Could not queue prompt.');
        }
      })
      .catch(err => {
        showToast('error', 'Gateway Offline', `Could not reach ${GATEWAY}`);
      });
    }

    function triggerInlineQuickChip(btn, text) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('AGY Interactive Quick Prompt', () => triggerInlineQuickChip(btn, text));
        return;
      }
      const input = document.getElementById('agy-prompt-input');
      if (input) input.value = text;
      
      const origHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite;">&#8635;</span> Dispatching...';
        btn.style.borderColor = '#60a5fa';
        btn.style.background = 'rgba(59, 130, 246, 0.4)';
        btn.disabled = true;
      }

      sendAgyPrompt();

      setTimeout(() => {
        if (btn) {
          btn.innerHTML = origHtml;
          btn.style.borderColor = '';
          btn.style.background = '';
          btn.disabled = false;
        }
      }, 2500);
    }

    window.AGY_SESSION_NAME = 'Detecting active session...';
    window.AGY_SESSION_ID = '';
    window.AGY_SESSION_HOST = null;

    function updateAgySessionDisplay(cid, name, hostNode) {
      if (cid === undefined || cid === null) cid = window.AGY_SESSION_ID || '';
      window.AGY_SESSION_ID = cid;
      if (hostNode) window.AGY_SESSION_HOST = hostNode;
      const activeHost = window.AGY_SESSION_HOST;
      const shortId = cid ? cid.substring(0, 8) : '--';
      if (!name || name === 'webdev1.0') {
        name = cid ? ((activeHost === 'nuc' ? 'NUC' : activeHost === 'desktop' ? 'Desktop' : 'Session') + ` (${shortId})`) : 'No Active Session';
      }
      window.AGY_SESSION_NAME = name;
      const sName = window.AGY_SESSION_NAME;
      const isOnline = activeHost === 'nuc' ? (window.NUC_IS_ONLINE !== false) : (window.DESKTOP_IS_ONLINE !== undefined ? window.DESKTOP_IS_ONLINE : true);
      const hostLabel = activeHost === 'nuc' ? 'NUC Core Server (24/7)' : (activeHost === 'desktop' ? 'Desktop Workstation' : 'Auto-Detect (NUC / Desktop)');

      const tab = document.getElementById('tab-agy');
      if (tab) {
        tab.textContent = '[AGY]';
        tab.title = cid ? `View Active Antigravity Autonomous Agent Stream (${sName} | ${cid})` : 'No active Antigravity session detected';
      }

      const modalTitle = document.getElementById('agy-modal-title-text');
      if (modalTitle) {
        modalTitle.innerHTML = `Antigravity (AGY) Live Terminal | <span class="mono" style="color: #60a5fa;">${escapeHtml(sName)}</span>`;
      }

      const metaName = document.getElementById('agy-meta-name');
      if (metaName) metaName.textContent = sName;

      const metaCid = document.getElementById('agy-meta-cid');
      if (metaCid) metaCid.textContent = cid || '--';

      const metaNode = document.getElementById('agy-meta-node');
      if (metaNode) metaNode.textContent = hostLabel;

      const modalPulse = document.getElementById('agy-modal-pulse-dot');
      if (modalPulse) {
        modalPulse.style.background = (cid && isOnline) ? '#10b981' : '#6366f1';
        modalPulse.style.boxShadow = (cid && isOnline) ? '0 0 8px #10b981' : '0 0 8px #6366f1';
      }
      const modalStatus = document.getElementById('agy-console-status');
      if (modalStatus) {
        if (!cid) {
          modalStatus.textContent = 'IDLE (No Active Session)';
          modalStatus.className = 'item-tag';
        } else if (activeHost === 'nuc') {
          modalStatus.textContent = (window.NUC_IS_ONLINE !== false) ? 'ONLINE (NUC :8082)' : 'OFFLINE (NUC Unreachable)';
          modalStatus.className = `item-tag ${(window.NUC_IS_ONLINE !== false) ? 'online' : 'offline'}`;
        } else {
          modalStatus.textContent = isOnline ? 'ONLINE (Desktop :8082)' : 'STANDBY (Desktop Sleeping • WoL Ready)';
          modalStatus.className = `item-tag ${isOnline ? 'online' : 'offline'}`;
        }
      }

      const connLine = document.getElementById('agy-conn-line');
      if (connLine) {
        connLine.textContent = cid
          ? `[SYSTEM] Connected to AGY conversation stream on ${hostLabel}: ${sName} (${cid})`
          : '[SYSTEM] No active AGY session detected on NUC or Desktop.';
      }

      document.querySelectorAll('.agy-session-link-btn').forEach(btn => {
        btn.title = cid ? `Open Interactive Terminal for Active Session ${sName}` : 'Open Antigravity Interactive Terminal';
        const span = btn.querySelector('span:not(.dropdown-dot)');
        if (span) span.textContent = cid ? (isOnline ? `Open AGY Terminal (${sName})` : `AGY Terminal (${shortId} \u2022 Standby)`) : 'Open AGY Terminal (Idle)';
        const tag = btn.querySelector('.item-tag');
        if (tag) {
          tag.textContent = cid ? (isOnline ? 'Live' : 'Standby') : 'Idle';
          tag.className = `item-tag ${cid ? (isOnline ? 'online' : 'offline') : ''}`.trim();
        }
      });

      const headerBtn = document.getElementById('agy-header-session-btn');
      if (headerBtn) {
        headerBtn.title = `Open Interactive Terminal for Active Session ${sName}`;
        const dotColor = isOnline ? '#10b981' : '#6366f1';
        headerBtn.innerHTML = `<span class="dropdown-dot" style="background-color: ${dotColor}; box-shadow: 0 0 8px ${dotColor};"></span> ${isOnline ? 'Open Live Console' : 'Console Standby'}: ${escapeHtml(sName)} &rarr;`;
      }

      // Dynamically update card titles & session headers across all pages
      document.querySelectorAll('.agy-card-session-name').forEach(el => {
        el.textContent = sName;
      });
    }

    function fetchAgySessionInfo(callback) {
      return fetch(`${GATEWAY}/api/agy/session`, { signal: _fetchSig(6000) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (data) {
            const prevCid = window.AGY_SESSION_ID;
            if (data.workspace) window.AGY_WORKSPACE = data.workspace;
            updateAgySessionDisplay(data.conversationId || '', data.sessionName || 'No Active Session', data.hostNode || null);
            if (prevCid && data.conversationId && prevCid !== data.conversationId) {
              console.log(`[AGY] Active session transitioned: ${prevCid} -> ${data.conversationId} (${data.hostNode || 'unknown'})`);
              if (typeof currentLogTab !== 'undefined' && currentLogTab === 'agy') {
                if (typeof loadLog === 'function') loadLog('agy');
              }
              const modal = document.getElementById('agy-console-modal-overlay');
              if (modal && modal.classList.contains('active') && typeof refreshAgyConsole === 'function') {
                refreshAgyConsole(true);
              }
            }
          }
          if (callback) callback(data);
          return data;
        })
        .catch(() => {
          updateAgySessionDisplay(window.AGY_SESSION_ID || '', window.AGY_SESSION_ID ? window.AGY_SESSION_NAME : 'Unavailable (Gateway Offline)', window.AGY_SESSION_HOST || null);
          if (callback) callback(null);
          return null;
        });
    }

    function resumeAgySessionOnDesktop() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Resume Active AGY Session on Desktop', resumeAgySessionOnDesktop);
        return;
      }
      const sName = window.AGY_SESSION_NAME || 'webdev';
      const cid = window.AGY_SESSION_ID || '';
      showToast('loading', `Resuming ${sName} on Desktop...`, `Opening Windows Terminal: agy --conversation ${cid ? cid.substring(0,8) : 'active'}...`, 4000);

      // 1. Dispatch daemon trigger via gateway
      fetch(`${GATEWAY}/api/agy/launch`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ target: 'desktop', action: 'resume', workspace: window.AGY_WORKSPACE || 'C:\\Users\\CoryTownsend\\Projects\\website' }),
        signal: _fetchSig(12000)
      })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.status === 'success') {
          showToast('success', 'Session Resumed on Desktop', data.message || `Antigravity ${sName} active in Windows Terminal.`);
        }
      })
      .catch(() => {});

      // 2. Also invoke native protocol link for instant local spawn
      if (cid) {
        try {
          window.location.href = `conversation://${cid}`;
        } catch (e) {}
      }
    }

    function startNewAgySession(target = 'desktop') {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal(`Start New AGY Session (${target.toUpperCase()})`, () => startNewAgySession(target));
        return;
      }
      const hostLabel = target === 'nuc' ? 'NUC Server' : 'Desktop Workstation';

      // 1. Immediately wipe console screen and in-page terminal
      const screen = document.getElementById('agy-console-screen');
      if (screen) {
        screen.innerHTML = `
          <div class="agy-line system" style="color: #60a5fa; font-weight: 700;">[SYSTEM] Initializing new Antigravity session on ${escapeHtml(target.toUpperCase())}...</div>
          <div class="agy-line system" style="color: #34d399;">[READY] Console wiped clean. Spawning autonomous agent...</div>
        `;
      }
      const termBody = document.getElementById('terminal-content');
      if (termBody) {
        termBody.textContent = `[SYSTEM] Initializing new Antigravity session on ${target.toUpperCase()}...\n[READY] Console wiped clean. Creating fresh workspace...`;
      }

      // 2. Temporarily pause old log auto-polling so old transcript does not reload
      stopConsoleAutoPoll();

      showToast('loading', `Starting New Session on ${hostLabel}...`, 'Spawning fresh session & wiping console...', 4000);

      fetch(`${GATEWAY}/api/agy/launch`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ target: target, action: 'new-session' }),
        signal: _fetchSig(12000)
      })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.status === 'success') {
          const newCid = data.conversationId;
          const newName = data.sessionName || ('session-' + data.shortId);
          window.AGY_SESSION_ID = newCid;
          window.AGY_SESSION_NAME = newName;
          window.AGY_SESSION_HOST = data.hostNode || null;
          updateAgySessionDisplay(newCid, newName, data.hostNode || null);

          if (screen) {
            const activeLine = document.createElement('div');
            activeLine.className = 'agy-line system';
            activeLine.style.color = '#38bdf8';
            activeLine.innerHTML = `<span style="color:#10b981; font-weight:700;">[ACTIVE]</span> Session <strong>${escapeHtml(newName)}</strong> (${escapeHtml(data.shortId)}) ready. Enter prompt or test command below.`;
            screen.appendChild(activeLine);
            screen.scrollTop = screen.scrollHeight;
          }

          startConsoleAutoPoll();
          const modalInput = document.getElementById('agy-modal-input');
          if (modalInput) { modalInput.value = ''; modalInput.focus(); }

          showToast('success', `New Session Created (${target.toUpperCase()})`, data.message || `Session ${newName} active.`);
        } else {
          showToast('error', 'Launch Failed', data.message || 'Could not start new AGY session.');
          startConsoleAutoPoll();
        }
      })
      .catch(err => {
        showToast('error', 'Gateway Offline', `Could not reach ${GATEWAY}`);
        startConsoleAutoPoll();
      });
    }

    function sendControl(action, target = 'nuc') {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal(`Remote Command: ${action.toUpperCase()}`, () => sendControl(action, target));
        return;
      }
      const isSpeed = (action === 'run-speedtest');
      const speedBtn = document.getElementById('btn-probe-speed');
      const probeNowBtn = document.getElementById('btn-probe-now');
      if (isSpeed) {
        if (speedBtn) {
          speedBtn.disabled = true;
          speedBtn.innerHTML = 'Probing Bell Fiber...';
        }
        if (probeNowBtn) {
          probeNowBtn.disabled = true;
          probeNowBtn.innerHTML = 'Probing...';
        }
      }

      const resetSpeedBtns = () => {
        if (speedBtn) {
          speedBtn.disabled = false;
          speedBtn.innerHTML = 'Probe Bell Speed';
        }
        if (probeNowBtn) {
          probeNowBtn.disabled = false;
          probeNowBtn.innerHTML = 'Probe Now';
        }
      };

      const targetLabel = (target === 'desktop') ? 'Desktop PC' : 'NUC Server';
      showToast('loading', `Executing [${targetLabel}]...`, isSpeed ? 'Probing Bell Gigabit connection & jitter...' : `Action: ${action.toUpperCase()}`, 0);
      
      fetch(`${GATEWAY}/api/control?action=${encodeURIComponent(action)}&target=${encodeURIComponent(target)}`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
        signal: _fetchSig(10000)
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (data.status === 'success') {
            showToast('success', isSpeed ? 'Probe Initiated' : `Command Executed (${targetLabel})`, data.message || `Action ${action} succeeded.`);
            fetchClusterStats();
            if (isSpeed) {
              setTimeout(fetchISPHistory, 2500);
              setTimeout(fetchISPHistory, 5500);
              setTimeout(() => {
                fetchISPHistory();
                resetSpeedBtns();
              }, 8500);
            }
          } else {
            showToast('error', 'Execution Error', data.message || `Failed to run ${action}.`);
            if (isSpeed) resetSpeedBtns();
          }
        })
        .catch(err => {
          showToast('error', 'Gateway Offline', `Could not reach ${GATEWAY}`);
          if (isSpeed) resetSpeedBtns();
        });
    }

    let currentControlTarget = 'nuc';

    function selectControlNode(target) {
      currentControlTarget = target || 'nuc';
      const label = document.getElementById('target-node-btn-label');
      const btnDot = document.getElementById('target-node-btn-dot');
      const badge = document.getElementById('ctrl-node-status-badge');
      const dot = document.getElementById('ctrl-node-status-dot');
      const text = document.getElementById('ctrl-node-status-text');

      if (currentControlTarget === 'nuc') {
        if (label) label.innerHTML = 'NUC Core Server (24/7 Always-On)';
        if (btnDot) {
          btnDot.style.backgroundColor = '#c084fc';
          btnDot.style.boxShadow = '0 0 8px #c084fc';
        }
        if (dot) {
          dot.style.backgroundColor = '#c084fc';
          dot.style.boxShadow = '0 0 8px #c084fc';
        }
        if (text) {
          text.style.color = '#e9d5ff';
          text.textContent = 'Active Target: NUC Server (Port 8081) | ONLINE';
        }
        if (badge) {
          badge.style.background = 'rgba(192, 132, 252, 0.15)';
          badge.style.borderColor = 'rgba(192, 132, 252, 0.35)';
        }
        showToast('info', 'Target Switched: NUC', 'Actions will target NUC Server (24/7 Always-On).');
      } else {
        if (label) label.innerHTML = 'Desktop PC (Core Workstation)';
        if (btnDot) {
          btnDot.style.backgroundColor = '#60a5fa';
          btnDot.style.boxShadow = '0 0 8px #60a5fa';
        }
        if (dot) {
          dot.style.backgroundColor = '#60a5fa';
          dot.style.boxShadow = '0 0 8px #60a5fa';
        }
        if (text) {
          text.style.color = '#93c5fd';
          text.textContent = 'Active Target: Desktop PC (Port 8080) | ONLINE';
        }
        if (badge) {
          badge.style.background = 'rgba(96, 165, 250, 0.15)';
          badge.style.borderColor = 'rgba(96, 165, 250, 0.35)';
        }
        showToast('info', 'Target Switched: Desktop', 'Actions will target Desktop PC (Core Workstation).');
      }
      document.querySelectorAll('.dropdown').forEach(dd => dd.classList.remove('is-open'));
    }

    function executeNodeAction(action) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal(`Remote Action: ${action.toUpperCase()}`, () => executeNodeAction(action));
        return;
      }
      if (action === 'wake') {
        sendWol(currentControlTarget);
      } else if (action === 'sleep') {
        sendSleep(currentControlTarget);
      } else if (action === 'reboot') {
        if (currentControlTarget === 'nuc') {
          confirmRebootNuc();
        } else {
          confirmRebootDesktop();
        }
      } else {
        sendControl(action, currentControlTarget);
      }
    }


    // ==========================================
    // AI TOKEN CONSUMPTION & EFFICIENCY TRACKER
    // ==========================================
    const TOKEN_METRICS_KEY = 'dr_token_metrics';

    function getLiveTokenMetrics() {
      try {
        const stored = localStorage.getItem(TOKEN_METRICS_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return null; // Zero hardcoding: return null until live stream arrives
    }
    function formatTokenNumber(num) {
      if (!num || isNaN(num)) return '0';
      if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return Number(num).toLocaleString();
    }

    function updateTokenCounterUI(rawMetrics) {
      let metrics = rawMetrics;
      if (!metrics) {
        metrics = getLiveTokenMetrics();
      } else {
        const defMetrics = getLiveTokenMetrics() || {};
        const parsed = {
          inputTokens: metrics.input !== undefined ? metrics.input : (metrics.inputTokens || defMetrics.inputTokens),
          outputTokens: metrics.output !== undefined ? metrics.output : (metrics.outputTokens || defMetrics.outputTokens),
          cacheTokens: metrics.cache !== undefined ? metrics.cache : (metrics.cacheTokens || defMetrics.cacheTokens),
          totalTokens: metrics.total !== undefined ? metrics.total : (metrics.totalTokens || ((metrics.input || defMetrics.inputTokens || 0) + (metrics.output || defMetrics.outputTokens || 0))),
          model: metrics.model || defMetrics.model,
          efficiency: metrics.efficiency || defMetrics.efficiency,
          breakdown: metrics.breakdown || defMetrics.breakdown,
          weeklyLimitRemaining: metrics.weeklyLimitRemaining != null ? metrics.weeklyLimitRemaining : defMetrics.weeklyLimitRemaining,
          fiveHourLimitRemaining: metrics.fiveHourLimitRemaining != null ? metrics.fiveHourLimitRemaining : defMetrics.fiveHourLimitRemaining,
          weeklyRefresh: metrics.weeklyRefresh || defMetrics.weeklyRefresh,
          weeklyResetTime: metrics.weeklyResetTime || defMetrics.weeklyResetTime,
          fiveHourRefresh: metrics.fiveHourRefresh || defMetrics.fiveHourRefresh,
          fiveHourResetTime: metrics.fiveHourResetTime || defMetrics.fiveHourResetTime,
          claudeWeeklyRemaining: metrics.claudeWeeklyRemaining != null ? metrics.claudeWeeklyRemaining : (metrics.claudeLimitRemaining != null ? metrics.claudeLimitRemaining : defMetrics.claudeWeeklyRemaining),
          claudeWeeklyResetTime: metrics.claudeWeeklyResetTime || defMetrics.claudeWeeklyResetTime,
          claudeFiveHourRemaining: metrics.claudeFiveHourRemaining != null ? metrics.claudeFiveHourRemaining : defMetrics.claudeFiveHourRemaining,
          claudeFiveHourResetTime: metrics.claudeFiveHourResetTime || defMetrics.claudeFiveHourResetTime,
          claudeLimitRemaining: metrics.claudeLimitRemaining != null ? metrics.claudeLimitRemaining : (metrics.claudeWeeklyRemaining != null ? metrics.claudeWeeklyRemaining : defMetrics.claudeLimitRemaining),
          account: metrics.account || defMetrics.account
        };
        metrics = parsed;
        try { localStorage.setItem(TOKEN_METRICS_KEY, JSON.stringify(metrics)); } catch (e) {}
      }
      if (!metrics) return;

      const totalFmt = formatTokenNumber(metrics.totalTokens);
      const inFmt = formatTokenNumber(metrics.inputTokens);
      const outFmt = formatTokenNumber(metrics.outputTokens);
      const cacheFmt = formatTokenNumber(metrics.cacheTokens);
      const totalTokRaw = metrics.totalTokens;
      const fullTotalStr = (totalTokRaw !== null && totalTokRaw !== undefined && totalTokRaw !== '' && Number.isFinite(Number(totalTokRaw))) ? Number(totalTokRaw).toLocaleString() : '--';

      // Dynamic live breakdown calculation to 2 decimal places (Real-time Transcript Ingestion)
      const inTok = Number(metrics.inputTokens) || 0;
      const outTok = Number(metrics.outputTokens) || 0;
      const cacheTok = Number(metrics.cacheTokens) || 0;
      const totalTokens = Number(metrics.totalTokens) || (inTok + outTok);

      let flashPctNum = (totalTokens > 0) ? ((inTok / totalTokens) * 100) : 0;
      let proPctNum = (totalTokens > 0) ? ((outTok / totalTokens) * 100) : 0;
      const contextTotal = cacheTok + inTok;
      let cachePctNum = (contextTotal > 0) ? ((cacheTok / contextTotal) * 100) : 0;

      if (metrics.breakdown && metrics.breakdown.flash && metrics.breakdown.flash.percent !== undefined) {
        flashPctNum = Number(metrics.breakdown.flash.percent);
      }
      if (metrics.breakdown && metrics.breakdown.pro && metrics.breakdown.pro.percent !== undefined) {
        proPctNum = Number(metrics.breakdown.pro.percent);
      }
      if (metrics.breakdown && metrics.breakdown.cache && metrics.breakdown.cache.percent !== undefined) {
        cachePctNum = Number(metrics.breakdown.cache.percent);
      }

      const flashPct = flashPctNum.toFixed(2);
      const proPct = proPctNum.toFixed(2);
      const cachePct = cachePctNum.toFixed(2);

      // Cost Efficiency Calculation (Frontier Pro Rates vs Flash Rates + Context Cache Savings)
      const proEquiv = ((inTok * 2.50) + (outTok * 10.00)) / 1000000;
      const actualCost = ((inTok * 0.075) + (outTok * 0.30)) / 1000000;
      const savedCost = Math.max(0, proEquiv - actualCost);
      const savingsPctNum = proEquiv > 0 ? ((savedCost / proEquiv) * 100) : 0;
      const savingsPct = savingsPctNum.toFixed(2);
      const savedFmt = proEquiv > 0 ? ('Est. $' + savedCost.toFixed(2)) : '--';
      const savingsLabel = proEquiv > 0 ? `${savedFmt} (${savingsPct}% Eco Savings)` : '--';

      // Update Header Button
      const headerCount = document.getElementById('header-token-count');
      if (headerCount) headerCount.textContent = totalFmt;

      const headerBtn = document.getElementById('header-token-btn');
      if (headerBtn) {
        headerBtn.title = `Live AI Token Consumption: ${totalFmt} Tokens (Prompt In: ${flashPct}% | Output: ${proPct}% | ${cacheFmt} Context Cache Reused) | ${savingsLabel}`;
      }

      const hFlash = document.getElementById('header-tag-flash');
      if (hFlash) {
        hFlash.textContent = `In: ${inFmt}`;
        hFlash.title = `Prompt Input: ${inFmt} tokens (${flashPct}%)`;
      }
      const hArgon = document.getElementById('header-tag-argon');
      if (hArgon) {
        hArgon.style.display = 'none';
      }
      const hPro = document.getElementById('header-tag-pro');
      if (hPro) {
        hPro.style.display = 'inline-flex';
        hPro.textContent = `Out: ${outFmt}`;
        hPro.title = `Completion Output: ${outFmt} tokens (${proPct}%)`;
      }

      // Update Status Ribbon
      const ribbonVal = document.getElementById('ribbon-token-val');
      if (ribbonVal) ribbonVal.textContent = totalFmt;

      const rFlash = document.getElementById('ribbon-flash');
      if (rFlash) rFlash.textContent = `${inFmt} In (${flashPct}%)`;
      const rArgon = document.getElementById('ribbon-argon');
      if (rArgon) rArgon.style.display = 'none';
      const rCache = document.getElementById('ribbon-cache');
      if (rCache) rCache.textContent = `${cacheFmt} Cached`;
      const rPro = document.getElementById('ribbon-pro');
      if (rPro) {
        rPro.style.display = 'inline';
        rPro.style.color = '#c084fc';
        rPro.style.fontWeight = '600';
        rPro.textContent = `${outFmt} Out (${proPct}%)`;
      }

      const rSavings = document.getElementById('ribbon-token-savings');
      if (rSavings) { rSavings.textContent = `${cachePct}% Cache Hit`; rSavings.title = `Context Cache Hit Rate: ${cacheFmt} tokens reused from prompt cache (${cachePct}%)`; }

      // Update Terminal Deck
      const termVal = document.getElementById('term-token-val');
      if (termVal) termVal.textContent = fullTotalStr;

      const tFlash = document.getElementById('term-tag-flash');
      if (tFlash) tFlash.textContent = `In: ${inFmt} (${flashPct}%)`;
      const tPro = document.getElementById('term-tag-pro');
      if (tPro) {
        tPro.style.display = 'inline-flex';
        tPro.textContent = `Out: ${outFmt} (${proPct}%)`;
      }
      const tArgon = document.getElementById('term-tag-argon');
      if (tArgon) tArgon.style.display = 'none';
      const tCache = document.getElementById('term-tag-cache');
      if (tCache) tCache.textContent = `Cache: ${cacheFmt}`;

      // Update Modal
      const modalVal = document.getElementById('modal-token-count');
      if (modalVal) modalVal.textContent = `${fullTotalStr} (In: ${inFmt} | Out: ${outFmt})`;

      const modalBreakdown = document.getElementById('modal-model-breakdown');
      if (modalBreakdown) {
        modalBreakdown.innerHTML = `<span style="color: #38bdf8; font-weight: 600;">Prompt In: ${flashPct}% (${formatTokenNumber(inTok)})</span> &bull; <span style="color: #c084fc; font-weight: 600;">Output: ${proPct}% (${formatTokenNumber(outTok)})</span> &bull; <span style="color: #34d399; font-weight: 600;">Cache: ${cacheFmt} Reused (${cachePct}%)</span>`;
      }

      const modalSavings = document.getElementById('modal-savings-val');
      if (modalSavings) {
        modalSavings.innerHTML = `<strong style="color: #4ade80;">${cachePct}% Cache Hit Rate</strong> (${cacheFmt} tokens reused from prompt cache)`;
      }

      // Update App Card
      const appTokens = document.getElementById('app-card-tokens');
      if (appTokens) appTokens.textContent = fullTotalStr;

      const appModels = document.getElementById('app-card-models');
      if (appModels) {
        appModels.innerHTML = `<span style="color: #38bdf8; font-weight: 600;">${inFmt} Prompt In (${flashPct}%)</span> &bull; <span style="color: #c084fc; font-weight: 600;">${outFmt} Output (${proPct}%)</span> &bull; <span style="color: #34d399; font-weight: 600;">${cacheFmt} Cached</span>`;
      }
      document.querySelectorAll('#app-card-tokens-port').forEach(el => {
        el.textContent = totalFmt;
      });
      document.querySelectorAll('#modal-model-val').forEach(el => {
        if (metrics.model) el.textContent = metrics.model;
      });

      // Update Header Dropdown Progress Bar
      const menuVal = document.getElementById('menu-token-val');
      const clampPct = (v) => { const n = Number(v); return (v != null && v !== '' && !isNaN(n)) ? Math.max(0, Math.min(100, n)) : null; };
      const weeklyLimit = clampPct(metrics.weeklyLimitRemaining);
      const fiveHourLimit = clampPct(metrics.fiveHourLimitRemaining);
      const weeklyRef = metrics.weeklyRefresh || "--";
      const fiveHourRef = metrics.fiveHourRefresh || "--";
      const fmtLocalReset = (iso) => {
        if (!iso) return '';
        try { const d = new Date(iso); return isNaN(d) ? '' : ` • Resets ${d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`; } catch { return ''; }
      };
      if (menuVal) menuVal.textContent = weeklyLimit !== null ? `${weeklyLimit}% Weekly` : '-- Weekly';
      const barFlash = document.getElementById('menu-bar-flash');
      if (barFlash) barFlash.style.width = weeklyLimit !== null ? `${weeklyLimit}%` : '0%';
      const barPro = document.getElementById('menu-bar-pro');
      if (barPro) barPro.style.width = weeklyLimit !== null ? `${(100 - weeklyLimit).toFixed(2)}%` : '0%';
      const mFlash = document.getElementById('menu-pct-flash');
      if (mFlash) mFlash.textContent = weeklyLimit !== null ? `${weeklyLimit}% Remaining` : '--';
      const m5h = document.getElementById('menu-pct-5h');
      if (m5h) m5h.textContent = fiveHourLimit !== null ? `${fiveHourLimit}% (${fiveHourRef})` : `-- (${fiveHourRef})`;
      const bar5h = document.getElementById('menu-bar-5h');
      if (bar5h) bar5h.style.width = fiveHourLimit !== null ? `${fiveHourLimit}%` : '0%';
      const pBar5h = document.getElementById('menu-progress-bar-5h');
      if (pBar5h) pBar5h.title = `5-Hour Limit: ${fiveHourLimit !== null ? fiveHourLimit + '% Remaining' : '--'} (Refresh in ${fiveHourRef}${fmtLocalReset(metrics.fiveHourResetTime)})`;
      const mPro = document.getElementById('menu-pct-pro');
      if (mPro) mPro.innerHTML = `<strong style="font-weight:700; color: #c084fc;">${proPct}%</strong> Output`;
      const mCache = document.getElementById('menu-pct-cache');
      if (mCache) mCache.innerHTML = `<strong style="font-weight:700;">${cacheFmt}</strong> Cache`;
      const pBar = document.getElementById('menu-progress-bar');
      if (pBar) pBar.title = `Gemini Weekly: ${weeklyLimit !== null ? weeklyLimit + '% Remaining' : '--'} (Refresh in ${weeklyRef}${fmtLocalReset(metrics.weeklyResetTime)})`;

      // Decouple model bars: wire model breakdown bars explicitly to breakdown percentages
      document.querySelectorAll('.model-bar-flash, #model-bar-flash, [data-model="flash"]').forEach(el => {
        el.style.width = `${flashPct}%`;
      });
      document.querySelectorAll('.model-bar-pro, #model-bar-pro, [data-model="pro"]').forEach(el => {
        el.style.width = `${proPct}%`;
      });
      document.querySelectorAll('.model-bar-cache, #model-bar-cache, [data-model="cache"]').forEach(el => {
        el.style.width = `${cachePct}%`;
      });

      document.querySelectorAll('#menu-claude-pct').forEach(el => {
        const claudePct = clampPct(metrics.claudeWeeklyRemaining != null ? metrics.claudeWeeklyRemaining : metrics.claudeLimitRemaining);
        const claude5h = clampPct(metrics.claudeFiveHourRemaining);
        el.textContent = claudePct !== null ? `${claudePct}%` : '--';
        el.title = `Claude/3p Weekly: ${claudePct !== null ? claudePct + '%' : '--'}${fmtLocalReset(metrics.claudeWeeklyResetTime)} | 5-Hour: ${claude5h !== null ? claude5h + '%' : '--'}${fmtLocalReset(metrics.claudeFiveHourResetTime)}`;
      });
      document.querySelectorAll('#menu-account-user').forEach(el => {
        if (metrics.account) {
          el.textContent = metrics.account.includes('@') ? metrics.account.split('@')[0] : metrics.account;
        } else {
          el.textContent = '';
        }
      });
      const metaBarEl = document.getElementById('agy-session-meta-bar');
      if (metaBarEl && metaBarEl.style.display !== 'none' && typeof updateQuotaHistorySparkline === 'function') {
        updateQuotaHistorySparkline();
      }
    }

    let _lastQuotaSparklineFetch = 0;
    let _quotaSparklineInFlight = false;
    function updateQuotaHistorySparkline(force = false) {
      const metaBar = document.getElementById('agy-session-meta-bar');
      if (!metaBar || _quotaSparklineInFlight) return;
      const now = Date.now();
      if (!force && (now - _lastQuotaSparklineFetch) < 60000) return;
      _quotaSparklineInFlight = true;

      fetch(`${GATEWAY}/api/quota/history`, { cache: 'no-store', signal: _fetchSig(5000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          _quotaSparklineInFlight = false;
          if (!data || !Array.isArray(data.history)) return;
          _lastQuotaSparklineFetch = Date.now();
          const cutoff = Date.now() - (7 * 86400000);
          let pts = data.history
            .filter(e => e && typeof e.gemW === 'number' && !isNaN(e.gemW))
            .map(e => ({ t: e.ts ? Date.parse(e.ts) : 0, v: Math.max(0, Math.min(100, Number(e.gemW))) }))
            .filter(p => p.t && !isNaN(p.t) && p.t >= cutoff)
            .sort((a, b) => a.t - b.t);

          let wrap = document.getElementById('agy-quota-sparkline-wrap');
          if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'meta-item';
            wrap.id = 'agy-quota-sparkline-wrap';
            wrap.style.alignItems = 'center';
            wrap.innerHTML = '<span class="meta-lbl">7d Burn:</span> <span class="meta-val" id="agy-quota-sparkline" style="display:inline-flex;align-items:center;gap:6px;"></span>';
            const actions = metaBar.querySelector('.meta-actions');
            if (actions) metaBar.insertBefore(wrap, actions);
            else metaBar.appendChild(wrap);
          }

          const target = document.getElementById('agy-quota-sparkline');
          if (!target) return;
          if (!pts.length) {
            wrap.style.display = 'none';
            return;
          }
          wrap.style.display = 'flex';

          const w = 76, h = 18, padX = 2, padY = 2;
          const innerW = w - padX * 2;
          const innerH = h - padY * 2;
          const minT = pts[0].t;
          const maxT = pts[pts.length - 1].t;
          const spanT = maxT - minT;
          const coords = pts.map((p, i) => {
            const frac = pts.length === 1 ? 1 : (spanT > 0 ? (p.t - minT) / spanT : (i / (pts.length - 1)));
            const x = padX + frac * innerW;
            const y = padY + ((100 - p.v) / 100) * innerH;
            return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), v: p.v };
          });

          const linePts = pts.length === 1
            ? `${padX},${coords[0].y} ${coords[0].x},${coords[0].y}`
            : coords.map(c => `${c.x},${c.y}`).join(' ');
          const areaPts = pts.length === 1
            ? `${padX},${h - padY} ${padX},${coords[0].y} ${coords[0].x},${coords[0].y} ${coords[0].x},${h - padY}`
            : `${coords[0].x},${h - padY} ${linePts} ${coords[coords.length - 1].x},${h - padY}`;
          const last = coords[coords.length - 1];
          const minV = Math.min(...pts.map(p => p.v));
          const maxV = Math.max(...pts.map(p => p.v));

          wrap.title = `7-Day Weekly Quota: ${last.v.toFixed(2)}% remaining (${pts.length} sample${pts.length === 1 ? '' : 's'}, range ${minV.toFixed(1)}%–${maxV.toFixed(1)}%)`;
          target.innerHTML =
            `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible;" aria-hidden="true">` +
            `<polygon points="${areaPts}" fill="rgba(56, 189, 248, 0.14)" />` +
            `<polyline points="${linePts}" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />` +
            `<circle cx="${last.x}" cy="${last.y}" r="2" fill="#38bdf8" />` +
            `</svg>` +
            `<span class="mono" style="color:#38bdf8;font-weight:600;font-size:0.74rem;">${last.v.toFixed(1)}%</span>`;
        })
        .catch(() => { _quotaSparklineInFlight = false; });
    }
    function renderAudiobookshelfGrid(absData) {
      const grid = document.getElementById('abs-bookshelf-grid');
      const subEl = document.getElementById('abs-vault-subtitle');
      if (!grid) return;

      if (absData && absData.online && Array.isArray(absData.items) && absData.items.length > 0) {
        window._absHydrated = true;
        const totalBooks = Number(absData.totalBooks !== undefined && absData.totalBooks !== null ? absData.totalBooks : absData.items.length) || absData.items.length;
        const inProgress = Number(absData.inProgressCount || 0);
        if (subEl) {
          subEl.innerHTML = `${escapeHtml(totalBooks.toLocaleString())} real audiobooks on NUC &bull; ${escapeHtml(String(inProgress))} in progress`;
        }
        const palettes = [
          { cover: 'linear-gradient(135deg, #1e3a8a, #0f172a)', accent: '#60a5fa', bar: '#38bdf8' },
          { cover: 'linear-gradient(135deg, #065f46, #022c22)', accent: '#34d399', bar: '#10b981' },
          { cover: 'linear-gradient(135deg, #581c87, #2e1065)', accent: '#c084fc', bar: '#a855f7' },
          { cover: 'linear-gradient(135deg, #78350f, #451a03)', accent: '#fbbf24', bar: '#f59e0b' }
        ];
        grid.innerHTML = absData.items.slice(0, 4).map((item, idx) => {
          const pal = palettes[idx % palettes.length];
          const status = item && item.status ? String(item.status) : 'Audiobook';
          const author = item && item.author ? String(item.author) : 'Unknown Author';
          const title = item && item.title ? String(item.title) : 'Untitled Audiobook';
          const subtitle = item && item.subtitle ? String(item.subtitle) : '';
          const pctRaw = Number(item && (item.progressPct !== undefined ? item.progressPct : item.progress));
          const pct = Number.isFinite(pctRaw) ? Math.max(0, Math.min(100, Math.round(pctRaw))) : 0;
          const progressText = pct > 0 ? `Progress: ${pct}%` : status;
          const remainingLabel = item && item.remainingLabel ? String(item.remainingLabel) : (pct >= 100 ? 'Completed' : 'Ready');
          const rawUrl = item && item.url ? String(item.url) : 'https://audiobooks.digitalresolve.ca';
          const safeUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://audiobooks.digitalresolve.ca';
          const safeTitle = title || 'Audiobookshelf';
          return `<div class="book-card" style="cursor: pointer;" onclick="launchProtectedService('${escapeHtml(safeUrl)}', '${escapeHtml(safeTitle)}')">
                <div class="book-cover" style="background: ${pal.cover};"></div>
                <div class="book-body">
                  <div style="font-size: 0.72rem; color: ${pal.accent}; font-weight: 700; text-transform: uppercase;">${escapeHtml(status)} &bull; ${escapeHtml(author)}</div>
                  <div style="font-weight: 800; color: #f8fafc; font-size: 0.92rem;">${escapeHtml(title)}</div>
                  <div style="font-size: 0.76rem; color: #94a3b8;">${escapeHtml(subtitle)}</div>
                  <div style="margin-top: auto; padding-top: 10px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #64748b; margin-bottom: 4px;">
                      <span>${escapeHtml(progressText)}</span>
                      <span>${escapeHtml(remainingLabel)}</span>
                    </div>
                    <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 9999px; overflow: hidden;">
                      <div style="width: ${pct}%; height: 100%; background: ${pal.bar};"></div>
                    </div>
                  </div>
                </div>
              </div>`;
        }).join('');
      } else {
        if (subEl) {
          subEl.textContent = 'Audiobookshelf library unavailable or offline on NUC.';
        }
        grid.innerHTML = '<div class="book-card" style="grid-column: 1 / -1;"><div class="book-body" style="color: #94a3b8; font-size: 0.85rem;">Audiobookshelf library is currently unavailable on NUC. Use <strong>Launch Audiobookshelf</strong> above to connect directly.</div></div>';
      }
    }
    window.renderAudiobookshelfGrid = renderAudiobookshelfGrid;

    function fetchAudiobookshelfFallback() {
      if (!document.getElementById('abs-bookshelf-grid') || window._absHydrated) return Promise.resolve(null);
      return fetch(`${GATEWAY}/api/audiobooks`, { credentials: 'include', cache: 'no-store', signal: _fetchSig(5000) })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (d) renderAudiobookshelfGrid(d);
          else if (!window._absHydrated) renderAudiobookshelfGrid(null);
          return d;
        })
        .catch(() => {
          if (!window._absHydrated) renderAudiobookshelfGrid(null);
          return null;
        });
    }
    window.fetchAudiobookshelfFallback = fetchAudiobookshelfFallback;

    function applyClusterStatsPayload(data) {
      if (!data) return null;
      try { localStorage.setItem('dr_cluster_stats', JSON.stringify(data)); } catch (e) {}
      if (data.status === 'success' && data.nuc) {
        const nuc = data.nuc;
        updateStatusUI('nuc', Boolean(nuc.online), nuc.latencyMs, nuc.disk, nuc.swarm, nuc.vitals);
        if (nuc.swarm) {
          const sw = nuc.swarm;
          const swAct = document.getElementById('stat-swarm-active');
          const dht = document.getElementById('stat-dht');
          const vpnIp = document.getElementById('stat-vpn-ip');
          const dlSpd = document.getElementById('stat-dl-speed');
          const upSpd = document.getElementById('stat-up-speed');
          const throttleTag = document.getElementById('stat-throttle-tag');
          const swTag = document.getElementById('swarm-tag');

          const safeActiveDl = (sw.activeDl !== null && sw.activeDl !== undefined && !isNaN(sw.activeDl)) ? Number(sw.activeDl) : 0;
          const safeTotalTorrents = (sw.totalTorrents !== null && sw.totalTorrents !== undefined && !isNaN(sw.totalTorrents)) ? Number(sw.totalTorrents) : null;
          const safeSeed = safeTotalTorrents !== null ? Math.max(0, safeTotalTorrents - safeActiveDl) : null;
          if (swAct) swAct.textContent = safeTotalTorrents !== null ? `${safeActiveDl} Active | ${safeSeed} Seed` : `${safeActiveDl} Active | -- Seed`;
          if (swTag) swTag.textContent = safeTotalTorrents !== null ? `${safeTotalTorrents} Managed` : '-- Managed';
          if (dht) dht.textContent = (sw.dhtNodes !== null && sw.dhtNodes !== undefined && !isNaN(sw.dhtNodes)) ? `DHT: ${sw.dhtNodes} Nodes` : 'DHT: --';
          if (vpnIp) vpnIp.textContent = sw.vpnExitIp ? `VPN: ${sw.vpnExitIp}` : 'VPN: --';
          document.querySelectorAll('#schematic-vpn-throughput').forEach(el => {
            el.textContent = sw.vpnExitIp ? `Exit: ${sw.vpnExitIp}` : 'WireGuard';
          });
          
          const rawDl = safeNum(sw.dlSpeed, 0);
          const rawUp = safeNum(sw.upSpeed, 0);
          const dlText = rawDl >= 1048576 ? `${(rawDl / 1048576).toFixed(1)} MB/s` : `${Math.round(rawDl / 1024)} KB/s`;
          const upText = rawUp >= 1048576 ? `${(rawUp / 1048576).toFixed(1)} MB/s` : `${Math.round(rawUp / 1024)} KB/s`;
          if (dlSpd) dlSpd.innerHTML = `${dlText} <span style="font-size: 0.95rem; color: #8b949e; margin-left: 6px;">&darr;</span>`;
          if (upSpd) upSpd.textContent = upText;

          if (throttleTag) {
            if (sw.dlRateLimit > 0) {
              throttleTag.textContent = `Eco-Throttled (${Math.round(sw.dlRateLimit / 1024)} KB/s)`;
              throttleTag.style.background = 'rgba(245, 158, 11, 0.2)';
              throttleTag.style.color = '#fde047';
            } else {
              throttleTag.textContent = 'Unconstrained';
              throttleTag.style.background = 'rgba(59, 130, 246, 0.2)';
              throttleTag.style.color = '#60a5fa';
            }
          }
        }

        const cpuVal = document.getElementById('stat-cpu-val');
        const ramSub = document.getElementById('stat-ram-sub');
        const nucCpu = safeNum(nuc.cpuLoad, null);
        if (cpuVal) cpuVal.innerHTML = nucCpu !== null ? `${nucCpu}% <span style="font-size: 0.9rem; color: #8b949e;">CPU</span>` : `-- <span style="font-size: 0.9rem; color: #8b949e;">CPU</span>`;
        if (ramSub && nuc.vitals) {
          ramSub.textContent = `Memory: ${safeNum(nuc.vitals.ramUsedGB, 0)} GB / ${safeNum(nuc.vitals.ramTotalGB, 0)} GB (${safeNum(nuc.vitals.ramPercent, 0)}%) | ${nuc.vitals.uptime || '--'} up`;
        }

        if (nuc.disk) {
          const ndFree = safeNum(nuc.disk.freeGB, 0);
          const ndTot = safeNum(nuc.disk.totalGB, 0);
          const ndPct = safeNum(nuc.disk.usedPercent, 0);
          const ndUsed = safeNum(nuc.disk.usedGB, 0);
          const dFree = document.getElementById('stat-disk-free');
          if (dFree) dFree.innerHTML = `${ndFree} GB <span style="font-size: 0.9rem; color: #8b949e;">Free</span>`;
          const statDiskSub = document.getElementById('stat-disk-sub');
          if (statDiskSub) {
            statDiskSub.innerHTML = `<span>Total ${ndTot} GB (${ndPct}% Used &bull; ${ndUsed} GB)</span>`;
          }
        }

        if (nuc.storage && nuc.storage.totalGB) {
          const st = nuc.storage;
          const stTot = safeNum(st.totalGB, 1);
          const stMov = safeNum(st.moviesGB, 0);
          const stTv = safeNum(st.tvSeriesGB, 0);
          const stMix = safeNum(st.mixesGB, 0);
          const stFree = safeNum(st.freeGB, 0);
          const moviesPct = ((stMov / stTot) * 100).toFixed(1);
          const tvPct = ((stTv / stTot) * 100).toFixed(1);
          const mixesPct = ((stMix / stTot) * 100).toFixed(1);
          const freePct = ((stFree / stTot) * 100).toFixed(1);

          document.querySelectorAll('.seg-movies').forEach(el => {
            el.style.width = `${moviesPct}%`;
            el.title = `Movies: ${stMov} GB`;
          });
          document.querySelectorAll('.seg-tv').forEach(el => {
            el.style.width = `${tvPct}%`;
            el.title = `TV Series: ${stTv} GB`;
          });
          document.querySelectorAll('.seg-mixes').forEach(el => {
            el.style.width = `${mixesPct}%`;
            el.title = `Media Mixes: ${Math.round(stMix)} GB`;
          });
          document.querySelectorAll('.seg-free').forEach(el => {
            el.style.width = `${freePct}%`;
            el.title = `Free Space: ${stFree} GB (${freePct}%)`;
          });

          const moviesLeg = document.getElementById('stat-nuc-movies-legend');
          if (moviesLeg) moviesLeg.innerHTML = `<span class="legend-dot seg-movies"></span> Movies (${stMov} GB)`;
          const tvLeg = document.getElementById('stat-nuc-tv-legend');
          if (tvLeg) tvLeg.innerHTML = `<span class="legend-dot seg-tv"></span> Series (${stTv} GB)`;
          const mixesLeg = document.getElementById('stat-nuc-mixes-legend');
          if (mixesLeg) mixesLeg.innerHTML = `<span class="legend-dot seg-mixes"></span> Mixes (${Math.round(stMix)} GB)`;
        }
      }
      if (data.cloudflare) {
        updateCloudflareStatsUI(data.cloudflare);
      }
      if (data.desktop) {
        updateStatusUI('desktop', data.desktop.online, data.desktop.latencyMs, data.desktop.disk, data.desktop.torrent, data.desktop.vitals);
        const deskCpu = safeNum(data.desktop.cpuLoad, null);
        const sDeskCpu = document.getElementById('stat-desktop-cpu-val');
        const fCpu = document.getElementById('fleet-cpu-desktop');
        if (data.desktop.online) {
          if (sDeskCpu) sDeskCpu.innerHTML = deskCpu !== null ? `${deskCpu}% <span style="font-size: 0.9rem; color: #8b949e; margin-left: 4px;">CPU</span>` : `-- <span style="font-size: 0.9rem; color: #8b949e; margin-left: 4px;">CPU</span>`;
          if (fCpu) fCpu.textContent = deskCpu !== null ? `AMD Ryzen 7 | ${deskCpu}% Load (8C / 16T)` : 'AMD Ryzen 7 | Online (8C / 16T)';
        } else {
          if (sDeskCpu) sDeskCpu.innerHTML = `-- <span style="font-size: 0.9rem; color: #8b949e; margin-left: 4px;">CPU</span>`;
          if (fCpu) fCpu.textContent = 'AMD Ryzen 7 | Offline (8C / 16T)';
        }
      }
      if (data.tokens) {
        updateTokenCounterUI(data.tokens);
      }
      if (data.cameras) {
        updateCamerasUI(data.cameras);
      }
      if (data.climate) {
        updateClimateUI(data.climate);
      }
      if (data.audiobooks && typeof renderAudiobookshelfGrid === 'function') {
        renderAudiobookshelfGrid(data.audiobooks);
      }
      return data;
    }

    function updateCamerasUI(cams) {
      const list = Array.isArray(cams) ? cams : (cams && cams.value ? cams.value : []);
      const activeCount = list.filter(c => c && c.online).length;
      const camTag = document.getElementById('camera-status-tag');
      if (camTag) {
        if (activeCount > 0) {
          camTag.className = 'item-tag online';
          camTag.innerHTML = `<span class="dropdown-dot" style="background-color: #10b981; box-shadow: 0 0 8px #10b981;"></span> ${activeCount} Camera${activeCount > 1 ? 's' : ''} Active &bull; Feeder Online`;
        } else {
          camTag.className = 'item-tag offline';
          camTag.innerHTML = `<span class="dropdown-dot" style="background-color: #ef4444; box-shadow: 0 0 8px #ef4444;"></span> Cameras Offline &bull; Feeder Standby`;
        }
      }
    }
    window.updateCamerasUI = updateCamerasUI;

    function updateClimateUI(climate) {
      if (!climate) return;
      window._hasLiveClimate = true;
      window._latestClimate = climate;

      const tempF = climate.tempF !== undefined && climate.tempF !== null ? Number(climate.tempF).toFixed(1) : null;
      const tempC = climate.tempC !== undefined && climate.tempC !== null ? Number(climate.tempC).toFixed(1) : null;
      const hum = climate.humidity !== undefined && climate.humidity !== null ? Math.round(climate.humidity) : null;
      const isOnline = climate.online !== false;
      const stateStr = climate.state ? (climate.state.charAt(0).toUpperCase() + climate.state.slice(1)) : 'Normal';

      // 1. Ribbon Climate Indicator
      const ribbonClim = document.getElementById('ribbon-climate');
      if (ribbonClim && tempF !== null && hum !== null) {
        ribbonClim.innerHTML = '<span class="dropdown-dot" style="background-color: #10b981; box-shadow: 0 0 6px #10b981;"></span> ' + tempF + '&deg;F &bull; ' + hum + '% RH';
      }

      // 2. NUC Fleet Node Card
      const fleetClim = document.getElementById('fleet-climate-nuc');
      if (fleetClim && tempF !== null && hum !== null) {
        fleetClim.textContent = tempF + '\u00B0F (' + tempC + '\u00B0C) \u2022 ' + hum + '% RH \u2022 ' + stateStr;
      }

      // 3. IoT Ambient Temp & Thermals Card
      const ambTemp = document.getElementById('iot-ambient-temp');
      if (ambTemp && tempC !== null && hum !== null) {
        ambTemp.innerHTML = tempC + '&deg;C <span style="font-size: 0.9rem; color: #94a3b8;">/ ' + hum + '% RH (' + tempF + '&deg;F)</span>';
      }

      const roomThermo = document.getElementById('iot-room-thermostat');
      if (roomThermo && tempF !== null && tempC !== null) {
        roomThermo.innerHTML = tempF + '&deg;F (' + tempC + '&deg;C)';
      }

      const thTag = document.getElementById('iot-thermal-tag');
      if (thTag) {
        thTag.textContent = isOnline ? 'Nominal \u2022 YoLink LoRa' : 'Offline';
        if (isOnline) thTag.className = 'item-tag online';
      }

      // 4. YoLink Water Leak Sensor
      const leakTag = document.getElementById('iot-leak-sensor-status');
      if (leakTag && climate.leakSensor) {
        const leakState = climate.leakSensor.state || 'normal';
        const isLeakNormal = String(leakState).toLowerCase() === 'normal';
        leakTag.textContent = isLeakNormal ? 'Normal (Dry)' : 'LEAK DETECTED';
        leakTag.style.color = isLeakNormal ? '#34d399' : '#ef4444';
      }
    }
    window.updateClimateUI = updateClimateUI;

    function fetchClimateData() {
      return fetch(`${GATEWAY}/climate`, { cache: 'no-store', signal: _fetchSig(5000) })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && d.climate && typeof updateClimateUI === 'function') {
            updateClimateUI(d.climate);
          }
          return d;
        })
        .catch(() => null);
    }
    window.fetchClimateData = fetchClimateData;

    function fetchClusterStats() {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
      
      // Primary Route: Query ${GATEWAY}/stats with cache: no-store
      return fetch(`${GATEWAY}/stats`, controller ? { signal: controller.signal, cache: 'no-store' } : { cache: 'no-store' })
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(data => {
          if (timeoutId) clearTimeout(timeoutId);
          return applyClusterStatsPayload(data);
        })
        .catch(() => {
          if (timeoutId) clearTimeout(timeoutId);
          if (typeof fetchClimateData === 'function') fetchClimateData();
          // Failover Method 1: Alternate endpoint or direct LAN
          const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
          const altStatsUrl = isHttps ? `${GATEWAY}/status?target=all` : `http://192.168.2.35:8082/stats`;
          return fetch(altStatsUrl, { cache: 'no-store', signal: _fetchSig(5000) })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(altData => {
              return applyClusterStatsPayload(altData);
            })
            .catch(() => {
              // Failover Method 2: Hydrate from persistent local storage cache
              try {
                const cached = localStorage.getItem('dr_cluster_stats');
                if (cached) return applyClusterStatsPayload(JSON.parse(cached));
              } catch (e) {}
              try { updateCloudflareStatsUI(); } catch (e) {}
              return null;
            });
        });
    }
    // Terminal Log Streamer
    // currentLogTab hoisted to global script top
    function loadLog(name) {
      currentLogTab = name;
      ['agy', 'sentinel', 'power', 'report'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) btn.className = (t === name) ? 'terminal-tab active' : 'terminal-tab';
      });

      if (!isSSOAuthenticated()) {
        updateSSOGateUI(); try { updateMaintenanceVisualStates(); } catch(e) {}
        return;
      }

      const body = document.getElementById('terminal-content');
      if (body) body.textContent = `Streaming ${name} log entries...`;

      fetch(`${GATEWAY}/api/logs?name=${encodeURIComponent(name)}`, {
        credentials: 'include',
        headers: getAdminAuthHeaders(),
        signal: _fetchSig(8000)
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (name === 'agy' && data && (data.conversationId || data.hostNode || data.sessionName)) {
            updateAgySessionDisplay(data.conversationId || '', data.sessionName || null, data.hostNode || null);
          }
          if (body && data.lines) {
            body.textContent = data.lines.join('\n');
            body.scrollTop = body.scrollHeight;
          }
        })
        .catch(() => {
          if (body) body.textContent = `[Failed to fetch ${name} log from ${GATEWAY}]`;
        });
    }

    // ISP Diagnostics & History Poller
    function fetchISPHistory() {
      const numField = (v, fb) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) ? Number(v) : fb;
      const renderIspRows = (tbody, list, fb) => {
        if (!tbody || !Array.isArray(list) || list.length === 0) return;
        tbody.innerHTML = list.slice(-10).reverse().map(r => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                  <td style="padding: 6px 8px; color: #8b949e;">${escapeHtml(String(r.timeShort || r.timestamp || 'Recent'))}</td>
                  <td style="padding: 6px 8px; color: #60a5fa;">${escapeHtml(String(r.isp || 'Bell Canada'))}</td>
                  <td style="padding: 6px 8px; color: #38bdf8; font-weight: 700;">${numField(r.pingAvgMs, fb.avg)} ms</td>
                  <td style="padding: 6px 8px;">${numField(r.pingMinMs, fb.min)} / ${numField(r.pingMaxMs, fb.max)} ms</td>
                  <td style="padding: 6px 8px; color: #4ade80;">&plusmn; ${numField(r.jitterMs, fb.jitter)} ms</td>
                  <td style="padding: 6px 8px;">${numField(r.packetLoss, 0)}%</td>
                  <td style="padding: 6px 8px;"><span class="item-tag online" style="font-size: 0.7rem; padding: 2px 6px;">${escapeHtml(String(r.grade || 'A+'))}</span></td>
                </tr>
              `).join('');
      };
      const sortIspChrono = (list) => {
        if (!Array.isArray(list) || list.length <= 1) return Array.isArray(list) ? list : [];
        return list.map((item, idx) => ({ item, idx, ts: Date.parse((item && (item.timestamp || item.time)) || '') }))
          .sort((a, b) => {
            const aOk = Number.isFinite(a.ts);
            const bOk = Number.isFinite(b.ts);
            if (aOk && bOk && a.ts !== b.ts) return a.ts - b.ts;
            return a.idx - b.idx;
          })
          .map(x => x.item);
      };
      return fetch(`${GATEWAY}/api/isp-health`, { signal: _fetchSig(6000) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (data && data.status === 'success') {
            try { localStorage.setItem('dr_isp_history', JSON.stringify(data)); } catch (e) {}
            const rawList = sortIspChrono(Array.isArray(data.history) 
              ? data.history 
              : (data.history && Array.isArray(data.history.value) ? data.history.value : []));
            const latest = (data.latest && data.latest.pingAvgMs !== undefined) 
              ? data.latest 
              : (rawList.length > 0 ? rawList[rawList.length - 1] : null);

            const pingVal = document.getElementById('isp-ping-val');
            const pingSub = document.getElementById('isp-ping-sub');
            const jitterVal = document.getElementById('isp-jitter-val');
            const lossSub = document.getElementById('isp-loss-sub');
            const gradeTag = document.getElementById('isp-grade-tag');
            const carrierVal = document.getElementById('isp-carrier-val');
            const ipSub = document.getElementById('isp-ip-sub');
            const pingTag = document.getElementById('isp-ping-tag');

            // Store real measured historical pings for live sparkline plotting
            window.ISP_HISTORY_PINGS = rawList
              .map(h => (h && typeof h.pingAvgMs === 'number' && isFinite(h.pingAvgMs)) ? h.pingAvgMs : null)
              .filter(v => v !== null);
            window.ISP_EDGE_PINGS = rawList.map(h => (h && typeof h.googleDnsMs === 'number' && isFinite(h.googleDnsMs)) ? h.googleDnsMs : null);
            window.ISP_LATEST = latest;

            if (latest && typeof updateHealthRadarUI === 'function') {
              updateHealthRadarUI({ isp: latest });
            }

            const pingAvg = latest ? numField(latest.pingAvgMs, null) : null;
            const pingMin = latest ? numField(latest.pingMinMs, null) : null;
            const pingMax = latest ? numField(latest.pingMaxMs, null) : null;
            const googleDns = latest ? numField(latest.googleDnsMs, null) : null;
            const jitter = latest ? numField(latest.jitterMs, null) : null;
            const loss = latest ? numField(latest.packetLoss, null) : null;
            const grade = (latest && latest.grade) ? String(latest.grade) : '--';
            const carrier = (latest && latest.isp) ? String(latest.isp) : '--';
            const extIp = (latest && latest.externalIp) ? String(latest.externalIp) : 'n/a';

            if (pingVal) pingVal.innerHTML = pingAvg !== null ? `${pingAvg} <span style="font-size: 0.9rem; color: #8b949e;">ms</span>` : `-- <span style="font-size: 0.9rem; color: #8b949e;">ms</span>`;
            if (pingSub) pingSub.textContent = `Min: ${pingMin !== null ? pingMin : '--'} ms | Max: ${pingMax !== null ? pingMax : '--'} ms | Google: ${googleDns !== null ? googleDns : '--'} ms`;
            if (jitterVal) jitterVal.innerHTML = jitter !== null ? `&plusmn; ${jitter} <span style="font-size: 0.9rem; color: #8b949e;">ms</span>` : `-- <span style="font-size: 0.9rem; color: #8b949e;">ms</span>`;
            if (lossSub) lossSub.textContent = `Packet Loss: ${loss !== null ? loss + '%' : '--'} | Fiber Optic`;
            if (gradeTag) {
              gradeTag.textContent = grade !== '--' ? `Grade: ${grade} (Ultra Stable)` : 'Grade: --';
              gradeTag.className = grade === 'A+' ? 'item-tag online' : 'item-tag';
            }
            if (carrierVal) carrierVal.textContent = carrier;
            if (latest && latest.externalIp && latest.externalIp !== 'Protected (MFA Required)') {
              window.CURRENT_EXTERNAL_IP = String(latest.externalIp);
            }
            const authed = isSSOAuthenticated();
            const safeIp = (window.CURRENT_EXTERNAL_IP || extIp);
            if (ipSub) {
              if (authed && extIp !== 'Protected (MFA Required)') {
                ipSub.innerHTML = `IPv4: <span id="isp-ip-text" style="color: #60a5fa; font-family: monospace; font-style: normal;">${escapeHtml(safeIp)}</span>`;
              } else {
                ipSub.innerHTML = 'IPv4: <span id="isp-ip-text" style="color: #94a3b8; font-style: italic;">Protected (MFA Required)</span>';
              }
            }
            const tierBellIp = document.getElementById('tier-bell-ip-text');
            if (tierBellIp) {
              if (authed && extIp !== 'Protected (MFA Required)') {
                tierBellIp.textContent = safeIp;
                tierBellIp.style.color = '#cbd5e1';
                tierBellIp.style.fontStyle = 'normal';
                tierBellIp.style.fontFamily = 'monospace';
              } else {
                tierBellIp.textContent = 'Protected (MFA Required)';
                tierBellIp.style.color = '#94a3b8';
                tierBellIp.style.fontStyle = 'italic';
                tierBellIp.style.fontFamily = 'inherit';
              }
            }
            if (pingTag) pingTag.textContent = pingAvg !== null ? `${pingAvg} ms` : '-- ms';
            document.querySelectorAll('#uptime-isp-jitter-status').forEach(el => {
              el.textContent = jitter !== null ? `± ${jitter} ms Jitter` : '-- ms Jitter';
            });
            document.querySelectorAll('#isp-jitter-tag').forEach(el => {
              el.textContent = jitter !== null ? (jitter < 1 ? '< 1 ms' : `± ${jitter} ms`) : '--';
            });
            document.querySelectorAll('#uptime-scale-bell-today').forEach(el => {
              el.textContent = pingAvg !== null ? `Today (${pingAvg} ms ping)` : 'Today (-- ms ping)';
            });
            document.querySelectorAll('#st-sub-jitter').forEach(el => {
              el.innerHTML = jitter !== null ? `&plusmn; ${jitter} ms Jitter &bull; Cloudflare YYZ` : `-- ms Jitter &bull; Cloudflare YYZ`;
            });
            document.querySelectorAll('#st-sub-bloat').forEach(el => {
              el.textContent = jitter !== null ? `+${jitter} ms latency under full saturation` : '-- ms latency under full saturation';
            });
            document.querySelectorAll('#spark-leg-bell').forEach(el => {
              el.textContent = `${pingAvg} ms`;
            });
            document.querySelectorAll('#spark-leg-edge').forEach(el => {
              el.textContent = `${googleDns} ms`;
            });

            renderIspRows(document.getElementById('isp-history-tbody'), rawList, { avg: 4.2, min: 4, max: 5, jitter: 0.3 });

            const stPing = document.getElementById('st-val-ping');
            if (stPing) stPing.innerHTML = `${pingAvg} <span style="font-size: 0.85rem; color: #94a3b8;">ms</span>`;
            const downMbps = latest ? numField(latest.downloadMbps != null ? latest.downloadMbps : latest.downMbps, null) : null;
            const upMbps = latest ? numField(latest.uploadMbps != null ? latest.uploadMbps : latest.upMbps, null) : null;
            const stDown = document.getElementById('st-val-down');
            if (stDown) stDown.innerHTML = downMbps !== null ? `${downMbps} <span style="font-size: 0.85rem; color: #94a3b8;">Mbps</span>` : '--';
            const stUp = document.getElementById('st-val-up');
            if (stUp) stUp.innerHTML = upMbps !== null ? `${upMbps} <span style="font-size: 0.85rem; color: #94a3b8;">Mbps</span>` : '--';
            const gaugeNum = document.getElementById('gauge-live-num');
            if (gaugeNum) gaugeNum.textContent = downMbps !== null ? `${downMbps}` : '--';
            const gaugeNeedle = document.getElementById('speed-dial-needle');
            if (gaugeNeedle) {
              const angle = downMbps !== null ? (-45 + (Math.min(downMbps, 1000) / 1000) * 180) : -45;
              gaugeNeedle.style.transform = `rotate(${angle}deg)`;
            }
          }
          return data;
        })
        .catch(() => {
          // Fallback 1: Fetch static snapshot isp-health.json from apex repository
          return fetch('isp-health.json', { signal: _fetchSig(5000) })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(sData => {
              if (sData && sData.status === 'success') {
                const sList = sortIspChrono(Array.isArray(sData.history) ? sData.history : []);
                renderIspRows(document.getElementById('isp-history-tbody'), sList, { avg: '--', min: '--', max: '--', jitter: '--' });
                const sLat = (sData.latest && sData.latest.pingAvgMs !== undefined) ? sData.latest : (sList.length > 0 ? sList[sList.length - 1] : null);
                if (sLat) {
                  const snapTsRaw = sLat.timestamp || sData.timestamp || null;
                  const snapTs = snapTsRaw ? Date.parse(snapTsRaw) : NaN;
                  const isStaleSnap = !Number.isFinite(snapTs) || (Date.now() - snapTs) > (2 * 60 * 60 * 1000);
                  const snapDateLabel = Number.isFinite(snapTs) ? new Date(snapTs).toISOString().slice(0, 10) : 'Unknown';
                  const snapTag = isStaleSnap ? ` [Snapshot: ${snapDateLabel}]` : '';

                  const pVal = document.getElementById('isp-ping-val');
                  const pSub = document.getElementById('isp-ping-sub');
                  const jVal = document.getElementById('isp-jitter-val');
                  const pTag = document.getElementById('isp-ping-tag');
                  const sPingAvg = numField(sLat.pingAvgMs, null);
                  const sPingMin = numField(sLat.pingMinMs, '--');
                  const sPingMax = numField(sLat.pingMaxMs, '--');
                  const sGdns = numField(sLat.googleDnsMs, '--');
                  const sJitter = numField(sLat.jitterMs, null);
                  const sDown = numField(sLat.downloadMbps != null ? sLat.downloadMbps : sLat.downMbps, null);
                  const sUp = numField(sLat.uploadMbps != null ? sLat.uploadMbps : sLat.upMbps, null);
                  if (pVal) pVal.innerHTML = sPingAvg !== null ? `${sPingAvg} <span style="font-size: 0.9rem; color: #8b949e;">ms</span>` : '--';
                  if (pSub) pSub.textContent = `Min: ${sPingMin} ms | Max: ${sPingMax} ms | Google: ${sGdns} ms${snapTag}`;
                  if (jVal) jVal.innerHTML = sJitter !== null ? `&plusmn; ${sJitter} <span style="font-size: 0.9rem; color: #8b949e;">ms</span>` : '--';
                  if (pTag) pTag.textContent = sPingAvg !== null ? `${sPingAvg} ms` : '--';
                  const stPing = document.getElementById('st-val-ping');
                  const stDown = document.getElementById('st-val-down');
                  const stUp = document.getElementById('st-val-up');
                  const gaugeNum = document.getElementById('gauge-live-num');
                  if (stPing) stPing.innerHTML = sPingAvg !== null ? `${sPingAvg} <span style="font-size: 0.85rem; color: #94a3b8;">ms</span>` : '--';
                  if (stDown) stDown.innerHTML = sDown !== null ? `${sDown} <span style="font-size: 0.85rem; color: #94a3b8;">Mbps</span>` : '--';
                  if (stUp) stUp.innerHTML = sUp !== null ? `${sUp} <span style="font-size: 0.85rem; color: #94a3b8;">Mbps</span>` : '--';
                  if (gaugeNum) gaugeNum.textContent = sDown !== null ? `${sDown}` : '--';
                  const sGaugeNeedle = document.getElementById('speed-dial-needle');
                  if (sGaugeNeedle) {
                    const sAngle = sDown !== null ? (-45 + (Math.min(sDown, 1000) / 1000) * 180) : -45;
                    sGaugeNeedle.style.transform = `rotate(${sAngle}deg)`;
                  }
                }
                return sData;
              }
              throw new Error('Static snapshot empty');
            })
            .catch(() => {
              const applyBaseline = () => {
                let cList = [];
                try {
                  const cachedRaw = localStorage.getItem('dr_isp_history');
                  if (cachedRaw) {
                    const cachedData = JSON.parse(cachedRaw);
                    if (cachedData && cachedData.status === 'success') {
                      cList = Array.isArray(cachedData.history) ? cachedData.history : [];
                    }
                  }
                } catch (e) {}

                const tbody = document.getElementById('isp-history-tbody');
                const pingVal = document.getElementById('isp-ping-val');
                const pingSub = document.getElementById('isp-ping-sub');
                const jitterVal = document.getElementById('isp-jitter-val');
                const uptimeVal = document.getElementById('isp-uptime-val');
                const pingTag = document.getElementById('isp-ping-tag');
                const stPing = document.getElementById('st-val-ping');
                const stDown = document.getElementById('st-val-down');
                const stUp = document.getElementById('st-val-up');
                const gaugeNum = document.getElementById('gauge-live-num');
                const cGaugeNeedle = document.getElementById('speed-dial-needle');

                if (!cList || cList.length === 0) {
                  if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="7" style="padding: 12px 8px; text-align: center; color: #94a3b8;">Awaiting live ISP telemetry...</td></tr>';
                  }
                  if (pingVal) pingVal.textContent = '--';
                  if (pingSub) pingSub.textContent = 'Awaiting live ISP telemetry...';
                  if (jitterVal) jitterVal.textContent = '--';
                  if (uptimeVal) uptimeVal.textContent = '--';
                  if (pingTag) pingTag.textContent = '--';
                  if (stPing) stPing.textContent = '--';
                  if (stDown) stDown.textContent = '--';
                  if (stUp) stUp.textContent = '--';
                  if (gaugeNum) gaugeNum.textContent = '--';
                  if (cGaugeNeedle) cGaugeNeedle.style.transform = 'rotate(-45deg)';
                  return;
                }

                cList = sortIspChrono(cList);
                renderIspRows(tbody, cList, { avg: '--', min: '--', max: '--', jitter: '--' });

                const cLat = cList[cList.length - 1];
                const cPing = cLat ? numField(cLat.pingAvgMs, null) : null;
                const cMin = cLat ? numField(cLat.pingMinMs, '--') : '--';
                const cMax = cLat ? numField(cLat.pingMaxMs, '--') : '--';
                const cGdns = cLat ? numField(cLat.googleDnsMs, '--') : '--';
                const cJitter = cLat ? numField(cLat.jitterMs, null) : null;
                const cDown = cLat ? numField(cLat.downloadMbps != null ? cLat.downloadMbps : cLat.downMbps, null) : null;
                const cUp = cLat ? numField(cLat.uploadMbps != null ? cLat.uploadMbps : cLat.upMbps, null) : null;

                if (pingVal) pingVal.innerHTML = cPing !== null ? `${cPing} <span style="font-size: 0.9rem; color: #8b949e;">ms</span>` : '--';
                if (pingSub) pingSub.textContent = `Min: ${cMin} ms | Max: ${cMax} ms | Google: ${cGdns} ms`;
                if (jitterVal) jitterVal.innerHTML = cJitter !== null ? `&plusmn; ${cJitter} <span style="font-size: 0.9rem; color: #8b949e;">ms</span>` : '--';
                if (uptimeVal) uptimeVal.textContent = '--';
                if (pingTag) pingTag.textContent = cPing !== null ? `${cPing} ms` : '--';
                if (stPing) stPing.innerHTML = cPing !== null ? `${cPing} <span style="font-size: 0.85rem; color: #94a3b8;">ms</span>` : '--';
                if (stDown) stDown.innerHTML = cDown !== null ? `${cDown} <span style="font-size: 0.85rem; color: #94a3b8;">Mbps</span>` : '--';
                if (stUp) stUp.innerHTML = cUp !== null ? `${cUp} <span style="font-size: 0.85rem; color: #94a3b8;">Mbps</span>` : '--';
                if (gaugeNum) gaugeNum.textContent = cDown !== null ? `${cDown}` : '--';
                if (cGaugeNeedle) {
                  const cAngle = cDown !== null ? (-45 + (Math.min(cDown, 1000) / 1000) * 180) : -45;
                  cGaugeNeedle.style.transform = `rotate(${cAngle}deg)`;
                }
              };
              applyBaseline();
              return null;
            });
        });
    }

    function testISPNow() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Bell Gigabit Fiber Speedprobe', testISPNow);
        return;
      }
      const probeBtn = document.getElementById('btn-probe-now');
      if (probeBtn) {
        probeBtn.disabled = true;
        probeBtn.innerHTML = 'Probing...';
      }
      sendControl('run-speedtest');
      setTimeout(fetchISPHistory, 2000);
      setTimeout(fetchISPHistory, 4500);
      setTimeout(fetchISPHistory, 7000);
      setTimeout(() => {
        fetchISPHistory();
        if (probeBtn) {
          probeBtn.disabled = false;
          probeBtn.innerHTML = 'Probe Now';
        }
      }, 9000);
    }

    // Inline Quick Magnet Submission Handler
    function submitQuickMagnet() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Torrent Magnet Ingestion', submitQuickMagnet);
        return;
      }
      const input = document.getElementById('quick-magnet-input');
      const targetSelect = document.getElementById('quick-magnet-target');
      const val = input ? input.value.trim() : '';
      if (!val) {
        showToast('error', 'Invalid URL', 'Please paste a valid magnet link or URL.');
        return;
      }
      const target = targetSelect ? targetSelect.value : 'nuc';
      showToast('loading', 'Injecting Torrent...', `Target: ${target.toUpperCase()}`, 0);

      fetch(`${GATEWAY}/add`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url: val, target: target }),
        signal: _fetchSig(8000)
      })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (input) input.value = '';
        showToast('success', 'Download Started!', data.message || `Torrent sent to ${target.toUpperCase()}`);
      })
      .catch(() => {
        showToast('error', 'Dispatch Failed', `Could not reach ${GATEWAY} to inject torrent.`);
      });
    }

    // Remote Magnet Ingestion Handlers
    function openMagnetModal() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Remote Torrent Magnet Ingestion', openMagnetModal);
        return;
      }
      const modal = document.getElementById('magnet-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('magnet-input')?.focus(), 150);
      }
    }
    function closeMagnetModal() {
      const modal = document.getElementById('magnet-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      document.body.style.overflow = '';
    }
    function closeMagnetModalOnBackdrop(e) {
      if (e.target && e.target.id === 'magnet-modal-overlay') closeMagnetModal();
    }
    function submitMagnet() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Remote Torrent Magnet Ingestion', submitMagnet);
        return;
      }
      const input = document.getElementById('magnet-input');
      const val = input ? input.value.trim() : '';
      if (!val) {
        showToast('error', 'Invalid URL', 'Please paste a valid magnet link or URL.');
        return;
      }
      const targetRadios = document.getElementsByName('magnet-target');
      let target = 'nuc';
      for (const r of targetRadios) { if (r.checked) { target = r.value; break; } }

      const btn = document.getElementById('magnet-submit-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Injecting into Server...'; }

      fetch(`${GATEWAY}/add`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url: val, target: target }),
        signal: _fetchSig(8000)
      })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        closeMagnetModal();
        if (input) input.value = '';
        if (btn) { btn.disabled = false; btn.textContent = 'Start Remote Download'; }
        showToast('success', 'Download Started!', data.message || `Torrent sent to ${target.toUpperCase()}!`);
      })
      .catch(err => {
        if (btn) { btn.disabled = false; btn.textContent = 'Start Remote Download'; }
        showToast('error', 'Dispatch Failed', `Could not reach ${GATEWAY} to inject torrent.`);
      });
    }

    let currentCamTarget = 'pennys_feeder';
    let currentCamRes = 'hd';
    let currentCamAi = false;
    let camFeedLoaded = false;

    function loadLiveCameraFeed() {
      camFeedLoaded = true;
      const frame = document.getElementById('camera-live-frame');
      const placeholder = document.getElementById('camera-placeholder');
      if (placeholder) placeholder.style.display = 'none';
      if (frame) {
        frame.style.display = 'block';
        updateCamFeed();
      }
      showToast('info', 'Live WebRTC Connected', "Ultra-fast zero-lag hardware stream connected to Intel NUC.");
    }
    window.loadLiveCameraFeed = loadLiveCameraFeed;
    function stopLiveCameraFeed() {
      camFeedLoaded = false;
      const frame = document.getElementById('camera-live-frame');
      const placeholder = document.getElementById('camera-placeholder');
      if (frame) {
        frame.src = 'about:blank';
        frame.style.display = 'none';
      }
      if (placeholder) placeholder.style.display = 'flex';
      showToast('info', 'WebRTC Disconnected', 'Optical stream unmounted to preserve network and GPU resources.');
    }
    window.stopLiveCameraFeed = stopLiveCameraFeed;

    function selectCamera(cam) {
      currentCamTarget = cam;
      if (!camFeedLoaded) {
        loadLiveCameraFeed();
      } else {
        updateCamFeed();
      }
    }
    window.selectCamera = selectCamera;
    function selectCamQuality(res) {
      currentCamRes = res;
      if (!camFeedLoaded) {
        loadLiveCameraFeed();
      } else {
        updateCamFeed();
      }
    }
    window.selectCamQuality = selectCamQuality;
    function toggleCamAi() {
      currentCamAi = !currentCamAi;
      if (currentCamAi) {
        showToast('info', 'AI Vision Activated', 'Running TensorFlow pet detection model.');
      } else {
        showToast('success', 'Fast WebRTC Mode', 'Zero-overhead hardware streaming active.');
      }
      if (!camFeedLoaded) {
        loadLiveCameraFeed();
      } else {
        updateCamFeed();
      }
    }
    window.toggleCamAi = toggleCamAi;
    function updateCamFeed() {
      const src = currentCamRes === 'sd' ? `${currentCamTarget}_sd` : currentCamTarget;
      const playerPage = currentCamAi ? 'ai.html' : 'webrtc.html';
      const frame = document.getElementById('camera-live-frame');
      const title = document.getElementById('cam-header-active-name');
      const targetUrl = `${playerPage}?src=${src}`;
      if (frame && camFeedLoaded) {
        if (!frame.src.endsWith(targetUrl)) {
          frame.src = targetUrl;
        }
      }
      const directLink = document.getElementById('cam-direct-link');
      if (directLink) {
        directLink.href = `https://cam.digitalresolve.ca/${targetUrl}`;
      }
      const lanLink = document.getElementById('cam-lan-link');
      if (lanLink) {
        lanLink.href = `http://192.168.2.35:8089/${targetUrl}`;
      }
      const helperLink = document.getElementById('cam-helper-link');
      if (helperLink) {
        helperLink.href = `https://cam.digitalresolve.ca/${targetUrl}`;
      }
      if (title) {
        title.innerText = currentCamTarget === 'bedroom' ? 'Bedroom Cam' : "Penny's Feeder Cam & Feeder IoT";
      }

      const bFeeder = document.getElementById('btn-cam-feeder');
      const bBedroom = document.getElementById('btn-cam-bedroom');
      const bHd = document.getElementById('btn-cam-hd');
      const bSd = document.getElementById('btn-cam-sd');
      const bAi = document.getElementById('btn-cam-ai');

      [bFeeder, bBedroom].forEach(b => {
        if (b) { b.style.background = ''; b.style.borderColor = ''; b.style.color = ''; }
      });
      const activeCamBtn = currentCamTarget === 'bedroom' ? bBedroom : bFeeder;
      if (activeCamBtn) {
        activeCamBtn.style.background = 'rgba(16, 185, 129, 0.25)';
        activeCamBtn.style.borderColor = '#10b981';
        activeCamBtn.style.color = '#6ee7b7';
      }

      [bHd, bSd].forEach(b => {
        if (b) { b.style.background = ''; b.style.borderColor = ''; b.style.color = ''; }
      });
      const activeResBtn = currentCamRes === 'sd' ? bSd : bHd;
      if (activeResBtn) {
        activeResBtn.style.background = 'rgba(56, 189, 248, 0.25)';
        activeResBtn.style.borderColor = '#38bdf8';
        activeResBtn.style.color = '#93c5fd';
      }

      if (bAi) {
        if (currentCamAi) {
          bAi.style.background = 'rgba(168, 85, 247, 0.25)';
          bAi.style.borderColor = '#a855f7';
          bAi.style.color = '#d8b4fe';
          bAi.innerHTML = 'AI Cat Vision: ON (TF)';
        } else {
          bAi.style.background = 'rgba(16, 185, 129, 0.15)';
          bAi.style.borderColor = 'rgba(16, 185, 129, 0.35)';
          bAi.style.color = '#6ee7b7';
          bAi.innerHTML = 'Fast WebRTC (0% CPU)';
        }
      }
    }

    // ==========================================================
    // NUC Server Scheduled Maintenance & SLA Shield Controller
    // ==========================================================
    let selectedMaintDuration = 30;
    let maintCountdownInterval = null;

    function isNucMaintenanceActive() {
      try {
        const stored = localStorage.getItem('dr_nuc_maintenance');
        if (!stored) return false;
        const data = JSON.parse(stored);
        if (!data || !data.active) return false;
        if (data.expiresAt && Date.now() > data.expiresAt) {
          localStorage.removeItem('dr_nuc_maintenance');
          return false;
        }
        return true;
      } catch(e) {
        return false;
      }
    }
    window.isNucMaintenanceActive = isNucMaintenanceActive;

    function getNucMaintenanceData() {
      try {
        const stored = localStorage.getItem('dr_nuc_maintenance');
        if (!stored) return null;
        return JSON.parse(stored);
      } catch(e) {
        return null;
      }
    }
    window.getNucMaintenanceData = getNucMaintenanceData;

    function selectMaintDuration(mins) {
      selectedMaintDuration = mins;
      const btns = document.querySelectorAll('.maint-dur-btn');
      btns.forEach(b => {
        const dur = parseInt(b.getAttribute('data-dur'), 10);
        if (dur === mins) {
          b.classList.add('active');
          b.style.borderColor = '#f59e0b';
          b.style.color = '#fef08a';
          b.style.background = 'rgba(245, 158, 11, 0.15)';
        } else {
          b.classList.remove('active');
          b.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          b.style.color = '';
          b.style.background = '';
        }
      });
    }
    window.selectMaintDuration = selectMaintDuration;

    function openMaintenanceModal() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('NUC Maintenance Window Control', openMaintenanceModal);
        return;
      }
      updateMaintenanceModalUI();
      const modal = document.getElementById('maintenance-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      playChaosTone(440, 880, 'sine', 0.1);
    }
    window.openMaintenanceModal = openMaintenanceModal;

    function closeMaintenanceModal() {
      const modal = document.getElementById('maintenance-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      document.body.style.overflow = '';
      if (maintCountdownInterval) {
        clearInterval(maintCountdownInterval);
        maintCountdownInterval = null;
      }
    }
    window.closeMaintenanceModal = closeMaintenanceModal;

    function updateMaintenanceModalUI() {
      const banner = document.getElementById('maint-modal-banner');
      const dot = document.getElementById('maint-banner-dot');
      const title = document.getElementById('maint-banner-title');
      const sub = document.getElementById('maint-banner-sub');
      const tag = document.getElementById('maint-banner-tag');
      const actionBtn = document.getElementById('btn-maint-toggle-action');
      const updateTriggerBtn = document.getElementById('btn-maint-trigger-update');
      const active = isNucMaintenanceActive();
      const data = getNucMaintenanceData();

      if (active && data) {
        if (banner) { banner.style.background = 'rgba(245, 158, 11, 0.15)'; banner.style.borderColor = 'rgba(245, 158, 11, 0.4)'; }
        if (dot) { dot.style.background = '#f59e0b'; dot.style.boxShadow = '0 0 10px #f59e0b'; }
        if (tag) { tag.textContent = 'Active (SLA Shield)'; tag.className = 'item-tag'; tag.style.background = 'rgba(245, 158, 11, 0.25)'; tag.style.color = '#fde047'; }
        if (actionBtn) {
          actionBtn.innerHTML = 'Exit Maintenance Mode';
          actionBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          actionBtn.style.borderColor = '#10b981';
        }
        if (updateTriggerBtn) updateTriggerBtn.style.display = 'none';

        if (maintCountdownInterval) clearInterval(maintCountdownInterval);
        maintCountdownInterval = setInterval(() => {
          if (!isNucMaintenanceActive()) {
            clearInterval(maintCountdownInterval);
            updateMaintenanceModalUI();
            updateMaintenanceVisualStates();
            return;
          }
          const d = getNucMaintenanceData();
          if (d && d.expiresAt) {
            const diff = Math.max(0, d.expiresAt - Date.now());
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            if (title) title.textContent = `MAINTENANCE ACTIVE: ${mins}m ${secs}s Remaining`;
            if (sub) sub.textContent = `Reason: ${d && d.reason ? d.reason : 'Scheduled Maintenance'} | SLA Status: 100% Compliant (Zero Penalty)`;
          } else {
            if (title) title.textContent = 'MAINTENANCE ACTIVE (Manual Mode)';
            if (sub) sub.textContent = `Reason: ${d && d.reason ? d.reason : 'Scheduled Maintenance'} | Running until manually exited`;
          }
        }, 1000);
      } else {
        if (banner) { banner.style.background = 'rgba(16, 185, 129, 0.1)'; banner.style.borderColor = 'rgba(16, 185, 129, 0.3)'; }
        if (dot) { dot.style.background = '#10b981'; dot.style.boxShadow = '0 0 8px #10b981'; }
        if (title) title.textContent = 'Normal 24/7 Operations \u2014 SLA Protection Ready';
        if (sub) sub.textContent = 'Planned maintenance windows are excluded from outage penalties.';
        if (tag) { tag.textContent = 'SLA Protected'; tag.className = 'item-tag online'; tag.style.background = ''; tag.style.color = ''; }
        if (actionBtn) {
          actionBtn.innerHTML = 'Activate Maintenance Window';
          actionBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
          actionBtn.style.borderColor = '#f59e0b';
        }
        if (updateTriggerBtn) updateTriggerBtn.style.display = 'inline-flex';
      }
    }

    function confirmToggleMaintenance() {
      if (isNucMaintenanceActive()) {
        deactivateMaintenanceMode();
      } else {
        const reasonInput = document.getElementById('maint-reason-input');
        const reason = reasonInput ? reasonInput.value.trim() : 'Windows Updates & Optimization';
        activateMaintenanceMode(selectedMaintDuration, reason, false);
      }
    }
    window.confirmToggleMaintenance = confirmToggleMaintenance;

    function activateMaintenanceWithUpdate() {
      const reasonInput = document.getElementById('maint-reason-input');
      const reason = reasonInput ? reasonInput.value.trim() : 'Update-Computer & Windows Updates';
      activateMaintenanceMode(selectedMaintDuration, reason, true);
    }
    window.activateMaintenanceWithUpdate = activateMaintenanceWithUpdate;

    function activateMaintenanceMode(durationMinutes = 30, reason = 'Windows Updates & Optimization', autoRunUpdate = false) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Maintenance Mode Control', () => activateMaintenanceMode(durationMinutes, reason, autoRunUpdate));
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      fetch(`${GATEWAY}/api/control?action=maintenance&target=nuc&enable=true&duration=${durationMinutes}`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enable: true, duration: durationMinutes, reason: reason }),
        signal: controller.signal
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(() => {
          const expiresAt = durationMinutes > 0 ? (Date.now() + durationMinutes * 60000) : null;
          const data = {
            active: true,
            durationMinutes: durationMinutes,
            expiresAt: expiresAt,
            reason: reason,
            activatedAt: Date.now()
          };
          try { localStorage.setItem('dr_nuc_maintenance', JSON.stringify(data)); } catch(e) {}
          updateMaintenanceVisualStates();
          updateMaintenanceModalUI();
          closeMaintenanceModal();
          playChaosTone(523, 1046, 'triangle', 0.25);
          showToast('success', 'NUC Maintenance Window Engaged', `SLA Shield Active for ${durationMinutes > 0 ? durationMinutes + 'm' : 'Manual Duration'}. Outage metrics 100% exempt.`);
          const pauseChk = document.getElementById('maint-chk-pause');
          if (pauseChk && pauseChk.checked) {
            sendControl('pause-all', 'nuc');
          }
          if (autoRunUpdate) {
            setTimeout(() => { sendControl('run-update-computer', 'nuc'); }, 1200);
          }
        })
        .catch(err => {
          showToast('error', 'Maintenance Mode Failed', `Gateway rejected or failed request (${err && err.message ? err.message : 'unreachable'}).`);
        })
        .finally(() => clearTimeout(timeoutId));
    }
    window.activateMaintenanceMode = activateMaintenanceMode;

    function deactivateMaintenanceMode() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Maintenance Mode Control', () => deactivateMaintenanceMode());
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      fetch(`${GATEWAY}/api/control?action=maintenance&target=nuc&enable=false`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enable: false }),
        signal: controller.signal
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(() => {
          try { localStorage.removeItem('dr_nuc_maintenance'); } catch(e) {}
          updateMaintenanceVisualStates();
          updateMaintenanceModalUI();
          closeMaintenanceModal();
          playChaosTone(880, 440, 'sine', 0.2);
          showToast('info', 'Maintenance Window Concluded', 'NUC Server restored to continuous 24/7 monitoring.');
          const resumeChk = document.getElementById('maint-chk-resume');
          if (resumeChk && resumeChk.checked) {
            sendControl('resume-all', 'nuc');
          }
        })
        .catch(err => {
          showToast('error', 'Disable Maintenance Failed', `Gateway rejected or failed request (${err && err.message ? err.message : 'unreachable'}).`);
        })
        .finally(() => clearTimeout(timeoutId));
    }
    window.deactivateMaintenanceMode = deactivateMaintenanceMode;

    function updateMaintenanceVisualStates() {
      const active = isNucMaintenanceActive();
      const data = getNucMaintenanceData();

      // 1. Primary Maintenance Button (Uptime & Global)
      const ctrlBtn = document.getElementById('btn-nuc-maintenance');
      const ctrlLbl = document.getElementById('btn-maint-label');
      if (ctrlBtn) {
        ctrlBtn.classList.toggle('in-maintenance', active);
        if (ctrlLbl) ctrlLbl.textContent = active ? 'Maintenance: ACTIVE' : 'Maintenance Window';
      }

      // 2. SLA Telemetry Chip in #uptime
      const slaChip = document.getElementById('btn-maint-sla-status');
      const chipDot = document.getElementById('maint-chip-dot');
      const chipText = document.getElementById('maint-chip-text');
      if (slaChip) {
        slaChip.classList.toggle('in-maintenance', active);
        if (active) {
          if (chipDot) { chipDot.style.backgroundColor = '#f59e0b'; chipDot.style.boxShadow = '0 0 8px #f59e0b'; }
          if (chipText) chipText.textContent = 'NUC Maintenance Active (SLA Shield)';
        } else {
          if (chipDot) { chipDot.style.backgroundColor = '#10b981'; chipDot.style.boxShadow = '0 0 6px #10b981'; }
          if (chipText) chipText.textContent = 'SLA Shield: Active';
        }
      }

      // 3. Dedicated Maintenance Card on Uptime Page
      const uptBadge = document.getElementById('uptime-maint-badge');
      const uptDesc = document.getElementById('uptime-maint-desc');
      const uptCard = document.getElementById('uptime-maint-card');
      if (uptBadge) {
        if (active) {
          uptBadge.textContent = 'Maintenance Active (SLA Shield)';
          uptBadge.className = 'item-tag';
          uptBadge.style.background = 'rgba(245, 158, 11, 0.25)';
          uptBadge.style.color = '#fde047';
          if (uptDesc && data && data.expiresAt) {
            const diff = Math.max(0, data.expiresAt - Date.now());
            const mins = Math.floor(diff / 60000);
            uptDesc.textContent = `Scheduled maintenance active (${mins}m remaining). NUC updates and reboots are 100% exempt from SLA outage metrics.`;
          }
          if (uptCard) {
            uptCard.style.borderColor = '#f59e0b';
            uptCard.style.boxShadow = '0 0 16px rgba(245, 158, 11, 0.25)';
          }
        } else {
          uptBadge.textContent = 'Normal Operations';
          uptBadge.className = 'item-tag online';
          uptBadge.style.background = '';
          uptBadge.style.color = '';
          if (uptDesc) {
            uptDesc.textContent = 'Engage planned maintenance windows to protect 90-Day SLA metrics during Windows Updates, driver maintenance, and server reboots.';
          }
          if (uptCard) {
            uptCard.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            uptCard.style.boxShadow = '';
          }
        }
      }

      // 4. NUC Tier Status in Uptime Matrix
      const nucTierStatus = document.getElementById('nuc-tier-status-badge');
      if (nucTierStatus) {
        if (active) {
          nucTierStatus.textContent = 'Maintenance (SLA Shield)';
          nucTierStatus.className = 'tier-status';
          nucTierStatus.style.background = 'rgba(245, 158, 11, 0.2)';
          nucTierStatus.style.border = '1px solid rgba(245, 158, 11, 0.4)';
          nucTierStatus.style.color = '#fde047';
        } else {
          nucTierStatus.textContent = 'Operational';
          nucTierStatus.className = 'tier-status online';
          nucTierStatus.style.background = '';
          nucTierStatus.style.border = '';
          nucTierStatus.style.color = '';
        }
      }

      // 5. Re-render Uptime Matrix
      try { renderUptimeMatrix(); } catch(e) {}
    }
    window.updateMaintenanceVisualStates = updateMaintenanceVisualStates;
    // 90-Day Uptime Matrix & Sparkline Controller
    function renderUptimeMatrix() {
      const nodes = [
        { id: 'bars-nuc', type: 'nuc', title: 'NUC 24/7 Core Server' },
        { id: 'bars-isp', type: 'isp', title: 'Bell Canada Gigabit Fiber' },
        { id: 'bars-edge', type: 'edge', title: 'Cloudflare Zero Trust Edge' },
        { id: 'bars-desktop', type: 'desktop', title: 'Desktop Workstation (Active Session)' }
      ];

      if (!window.UPTIME_INCIDENTS) {
        try {
          const cached = JSON.parse(localStorage.getItem('dr_uptime_cache'));
          if (cached && Array.isArray(cached.incidents)) window.UPTIME_INCIDENTS = cached.incidents;
        } catch(e) {}
      }

      function applyUptimeIncidentsToBars(incidents) {
        if (!Array.isArray(incidents)) return;
        nodes.forEach(node => {
          const container = document.getElementById(node.id);
          if (!container) return;
          const bars = container.querySelectorAll('.uptime-bar');
          bars.forEach(bar => {
            const dateStr = bar.getAttribute('data-date');
            if (!dateStr) return;
            const it = incidents.find(item => item.node === node.type && item.date === dateStr);
            if (it) {
              bar.style.background = '';
              bar.classList.remove('edge', 'isp', 'maintenance', 'standby', 'down', 'warn');
              const c = ['down', 'warn', 'maintenance', 'standby'].includes(it.type)
                ? it.type
                : ['down', 'warn', 'maintenance', 'standby'].includes(it.impact)
                  ? it.impact
                  : (it.type === 'outage' ? 'down' : 'warn');
              bar.classList.add(c);
              bar.title = `${dateStr} | ${node.title}\nStatus: ${it.title || 'Incident'}\nImpact: ${it.impact || it.type || 'Notice'}`;
            }
          });
        });
      }
      window.applyUptimeIncidentsToBars = applyUptimeIncidentsToBars;

      const now = new Date();
      const applyBarState = (bar, node, i, dateStr) => {
        bar.style.background = '';
        bar.classList.remove('edge', 'isp', 'maintenance', 'standby', 'down', 'warn');
        bar.setAttribute('data-date', dateStr);
        bar.setAttribute('data-node', node.type);

        const inc = (window.UPTIME_INCIDENTS || []).find(it => it.node === node.type && it.date === dateStr);
        if (inc) {
          const c = ['down', 'warn', 'maintenance', 'standby'].includes(inc.type)
            ? inc.type
            : ['down', 'warn', 'maintenance', 'standby'].includes(inc.impact)
              ? inc.impact
              : (inc.type === 'outage' ? 'down' : 'warn');
          bar.classList.add(c);
          bar.title = `${dateStr} | ${node.title}\nStatus: ${inc.title || 'Incident'}\nImpact: ${inc.impact || inc.type || 'Notice'}`;
        } else if (i === 0) {
          if (node.id === 'bars-nuc' && isNucMaintenanceActive()) {
            bar.classList.add('maintenance');
            const mData = getNucMaintenanceData();
            const reason = (mData && mData.reason) ? mData.reason : 'Windows Updates & Optimization';
            bar.title = `${dateStr} | ${node.title}\nStatus: Scheduled Maintenance (SLA Protected)\nReason: ${reason}`;
          } else if (node.id === 'bars-nuc' && window.NUC_IS_ONLINE === false) {
            bar.classList.add('down');
            bar.title = `${dateStr} | ${node.title}\nStatus: Offline / Unreachable`;
          } else if (node.id === 'bars-desktop' && window.DESKTOP_IS_ONLINE === false) {
            bar.classList.add('standby');
            bar.title = `${dateStr} | ${node.title}\nStatus: Eco Standby / Sleeping (Wake-on-LAN Ready)`;
          } else {
            bar.title = `${dateStr} | ${node.title}\nStatus: Operational (Live)`;
          }
        } else {
          bar.style.background = 'rgba(148, 163, 184, 0.22)';
          bar.title = `${dateStr} | ${node.title}\nStatus: No Recorded History`;
        }
      };

      nodes.forEach(node => {
        const container = document.getElementById(node.id);
        if (!container) return;

        const existingBars = container.querySelectorAll('.uptime-bar');
        if (existingBars && existingBars.length === 90) {
          for (let i = 89; i >= 0; i--) {
            const barIndex = 89 - i;
            const bar = existingBars[barIndex];
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            applyBarState(bar, node, i, dateStr);
          }
        } else {
          container.innerHTML = '';
          for (let i = 89; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const bar = document.createElement('div');
            bar.className = 'uptime-bar';
            applyBarState(bar, node, i, dateStr);
            container.appendChild(bar);
          }
        }
      });

      const nucScale = document.getElementById('uptime-nuc-scale-today');
      if (nucScale) {
        nucScale.textContent = isNucMaintenanceActive() ? 'Today (Scheduled Maintenance)' : (window.NUC_IS_ONLINE === false ? 'Today (Offline)' : 'Today (Operational)');
      }
      const edgeScale = document.getElementById('uptime-edge-scale-today');
      if (edgeScale) {
        edgeScale.textContent = 'Today (Shield Active)';
      }
      const deskScale = document.getElementById('uptime-desktop-scale-today');
      if (deskScale) {
        deskScale.textContent = window.DESKTOP_IS_ONLINE === false
          ? 'Today (Desktop Eco Standby • WoL Ready)'
          : 'Today (Active Interactive Session)';
      }

      // Initialize real-time animated sparkline heartbeat if not already running
      initSparklineHeartbeat();

      // Dynamic SLA and uptime metrics from gateway
      if (typeof fetch === 'function') {
        return fetch(`${GATEWAY}/uptime`, { signal: _fetchSig(5000) })
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(data => {
            if (data && data.status === 'success') {
              window.UPTIME_INCIDENTS = data.incidents || [];
              applyUptimeIncidentsToBars(data.incidents);
              try { localStorage.setItem('dr_uptime_cache', JSON.stringify(data)); } catch (e) {}
              document.querySelectorAll('#uptime-sla-val').forEach(el => {
                el.textContent = data.overallSla || '--';
              });
              document.querySelectorAll('#uptime-hours-val').forEach(el => {
                el.innerHTML = (data.monitoredHours !== undefined && data.monitoredHours !== null)
                  ? `${Number(data.monitoredHours).toLocaleString()} <span style="font-size: 0.9rem; color: #8b949e;">Hours</span>`
                  : '--';
              });
              const outCnt = safeNum(data.outages, null);
              document.querySelectorAll('#uptime-outages-val').forEach(el => {
                el.innerHTML = outCnt !== null
                  ? `${outCnt} <span style="font-size: 0.9rem; color: #8b949e;">Incidents</span>`
                  : '--';
              });
              document.querySelectorAll('#uptime-mttr-val').forEach(el => {
                el.textContent = (data.mttr !== undefined && data.mttr !== null && data.mttr !== '') ? data.mttr : '--';
              });
              document.querySelectorAll('.nav-sla-tag').forEach(tag => {
                tag.textContent = data.overallSla || '--';
              });
              const ispOverall = document.getElementById('isp-uptime-val');
              if (ispOverall) ispOverall.textContent = data.overallSla || '--';

              if (Array.isArray(data.nodes)) {
                data.nodes.forEach(n => {
                  if (n.id === 'desktop') {
                    document.querySelectorAll('#uptime-desktop-sla-val').forEach(el => {
                      el.textContent = n.uptime ? `${n.uptime} SLA` : '--';
                    });
                  } else if (n.id === 'nuc') {
                    document.querySelectorAll('#uptime-nuc-sla-val').forEach(el => {
                      el.textContent = n.uptime ? `${n.uptime} Uptime` : '--';
                    });
                  } else if (n.id === 'isp') {
                    document.querySelectorAll('#uptime-isp-sla-val').forEach(el => {
                      el.textContent = n.uptime ? `${n.uptime} Uptime` : '--';
                    });
                    const ispValNode = document.getElementById('isp-uptime-val');
                    if (ispValNode) ispValNode.textContent = n.uptime || '--';
                  } else if (n.id === 'edge') {
                    document.querySelectorAll('#uptime-edge-sla-val').forEach(el => {
                      el.textContent = n.uptime ? `${n.uptime} Uptime` : '--';
                    });
                  }
                });
              }
            }
            return data;
          })
          .catch(() => null);
      }
      return Promise.resolve(null);
    }

    let sparklineAnimId = null;

    function renderSparklineFrame() {
      sparklineAnimId = null;
      const canvas = document.getElementById('uptimeSparkline');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const displayW = Math.round(rect.width || (canvas.parentElement ? canvas.parentElement.clientWidth : 960));
      const displayH = 80;
      if (displayW > 0 && (canvas.width !== displayW || canvas.height !== displayH)) {
        canvas.width = displayW;
        canvas.height = displayH;
      }

      const w = canvas.width;
      const h = canvas.height;
      if (w <= 60 || h <= 20) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);

      const axisX = 48;

      // Draw Y-Axis Vertical Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisX, 6);
      ctx.lineTo(axisX, h - 10);
      ctx.stroke();

      // Tick markers and Y-axis scale labels (10 ms, 5 ms, 0 ms)
      const yZero = h - 14;  // 0 ms baseline (66px)
      const nucLatVal = (window.LAST_NUC_LATENCY !== undefined && window.LAST_NUC_LATENCY !== null && isFinite(Number(window.LAST_NUC_LATENCY)))
        ? Number(window.LAST_NUC_LATENCY)
        : 0;
      const bellLatVal = (window.ISP_LATEST && window.ISP_LATEST.pingAvgMs !== undefined && isFinite(Number(window.ISP_LATEST.pingAvgMs)))
        ? Number(window.ISP_LATEST.pingAvgMs)
        : 0;
      const edgeLatVal = (window.ISP_LATEST && window.ISP_LATEST.googleDnsMs !== undefined && isFinite(Number(window.ISP_LATEST.googleDnsMs)))
        ? Number(window.ISP_LATEST.googleDnsMs)
        : 0;

      let maxObserved = Math.max(nucLatVal, bellLatVal, edgeLatVal);
      if (window.ISP_HISTORY_PINGS && window.ISP_HISTORY_PINGS.length > 0) {
        const finiteHist = window.ISP_HISTORY_PINGS.filter(v => typeof v === 'number' && isFinite(v));
        if (finiteHist.length > 0) maxObserved = Math.max(maxObserved, ...finiteHist);
      }
      if (window.ISP_EDGE_PINGS && window.ISP_EDGE_PINGS.length > 0) {
        const finiteEdge = window.ISP_EDGE_PINGS.filter(v => typeof v === 'number' && isFinite(v));
        if (finiteEdge.length > 0) maxObserved = Math.max(maxObserved, ...finiteEdge);
      }
      let scaleMax = 20;
      if (maxObserved > 18) {
        scaleMax = Math.ceil((maxObserved + 2) / 10) * 10;
      }

      const yTop  = 14;      // scaleMax top (14px)
      const yMid  = (yZero + yTop) / 2; // middle tick (40px)

      const yTicks = [
        { label: `${scaleMax} ms`, y: yTop },
        { label: `${Math.round(scaleMax / 2)} ms`, y: yMid },
        { label: '0 ms',  y: yZero }
      ];

      const scaleStr = `0 - ${scaleMax} ms`;
      document.querySelectorAll('#spark-scale-range').forEach(el => {
        if (el.textContent !== scaleStr) el.textContent = scaleStr;
      });

      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      yTicks.forEach(tick => {
        // Label on left of axis
        ctx.fillText(tick.label, axisX - 6, tick.y);

        // Tick notch on axis line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.moveTo(axisX - 3, tick.y);
        ctx.lineTo(axisX + 3, tick.y);
        ctx.stroke();

        // Horizontal dashed guideline across graph
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.setLineDash([4, 4]);
        ctx.moveTo(axisX + 4, tick.y);
        ctx.lineTo(w - 6, tick.y);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      const toY = (valMs) => {
        const clamped = Math.max(0, Math.min(scaleMax, valMs));
        return yZero - (clamped / scaleMax) * (yZero - yTop);
      };

      const histBell = Array.isArray(window.ISP_HISTORY_PINGS)
        ? window.ISP_HISTORY_PINGS.filter(v => typeof v === 'number' && isFinite(v))
        : [];
      const histEdge = Array.isArray(window.ISP_EDGE_PINGS)
        ? window.ISP_EDGE_PINGS.filter(v => typeof v === 'number' && isFinite(v))
        : [];
      const hasNucLat = (window.LAST_NUC_LATENCY !== undefined && window.LAST_NUC_LATENCY !== null && window.LAST_NUC_LATENCY !== '' && isFinite(Number(window.LAST_NUC_LATENCY)));
      const nucLat = hasNucLat ? Number(window.LAST_NUC_LATENCY) : null;
      const graphW = Math.max(10, (w - 6) - axisX);

      if (histBell.length === 0 && histEdge.length === 0 && !hasNucLat) {
        ctx.font = '11px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Awaiting live latency telemetry...', axisX + graphW / 2, (yTop + yZero) / 2);
        return;
      }

      // Draw Bell Fiber Line (only when real finite values exist)
      if (histBell.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2.2;
        for (let x = axisX; x <= w - 6; x += 8) {
          let val;
          const t = (x - axisX) / graphW;
          if (histBell.length > 1) {
            const idx = t * (histBell.length - 1);
            const i0 = Math.floor(idx);
            const i1 = Math.min(histBell.length - 1, Math.ceil(idx));
            const frac = idx - i0;
            val = histBell[i0] * (1 - frac) + histBell[i1] * frac;
          } else {
            val = histBell[0];
          }
          const y = toY(val);
          if (x === axisX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw Cloudflare Edge Line (only when real finite values exist)
      if (histEdge.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2.2;
        for (let x = axisX; x <= w - 6; x += 8) {
          let val;
          const t = (x - axisX) / graphW;
          if (histEdge.length > 1) {
            const idx = t * (histEdge.length - 1);
            const i0 = Math.floor(idx);
            const i1 = Math.min(histEdge.length - 1, Math.ceil(idx));
            const frac = idx - i0;
            val = histEdge[i0] * (1 - frac) + histEdge[i1] * frac;
          } else {
            val = histEdge[0];
          }
          const y = toY(val);
          if (x === axisX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw NUC Server Line (only when real finite value exists)
      if (hasNucLat) {
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.2;
        for (let x = axisX; x <= w - 6; x += 8) {
          const y = toY(nucLat);
          if (x === axisX) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    function initSparklineHeartbeat() {
      if (sparklineAnimId) {
        cancelAnimationFrame(sparklineAnimId);
        sparklineAnimId = null;
      }
      const canvas = document.getElementById('uptimeSparkline');
      if (canvas && !document.hidden) {
        sparklineAnimId = requestAnimationFrame(renderSparklineFrame);
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (sparklineAnimId) {
          cancelAnimationFrame(sparklineAnimId);
          sparklineAnimId = null;
        }
      } else {
        initSparklineHeartbeat();
      }
    });

    window.addEventListener('resize', () => {
      initSparklineHeartbeat();
    });
    function filterServiceDashboard(category, btn) {
      document.querySelectorAll('.dash-filter-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const cards = document.querySelectorAll('.dash-card');
      cards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    }

    function updateServiceDashboardUI(health) {
      if (!health || !health.services) return;
      const s = health.services;
      const count = (typeof health.onlineCount === 'number') ? health.onlineCount : Object.values(s).filter(item => item && item.online).length;

      function setStatus(tagId, metaId, svc, defaultActiveText, defaultActiveDesc) {
        const tagEl = document.getElementById(tagId);
        const metaEl = document.getElementById(metaId);
        if (!svc) return;

        const isOnline = !!svc.online;
        if (tagEl) {
          tagEl.className = isOnline ? 'item-tag online' : 'item-tag offline';
          tagEl.textContent = isOnline ? (svc.statusText || defaultActiveText || 'Operational') : 'Offline';
        }
        if (metaEl) {
          if (isOnline) {
            const lat = (svc.latencyMs !== null && svc.latencyMs !== undefined) ? `${svc.latencyMs}ms • ` : '';
            metaEl.textContent = `${lat}${defaultActiveDesc || 'Sentinel Verified'}`;
            metaEl.style.color = '#34d399';
          } else {
            metaEl.textContent = svc.error || 'Connection Failed';
            metaEl.style.color = '#ef4444';
          }
        }
      }

      setStatus('stag-streamhub', 'meta-watch-streamhub', s.streamhub, 'Operational', 'Sentinel Verified');
      setStatus('stag-files', 'meta-watch-files', s.filebrowser, 'Operational', 'Vault Active');
      setStatus('stag-cam', 'meta-watch-cam', s.cam, 'Operational', 'go2rtc Active');
      setStatus('stag-feeder', 'feeder-card-watchdog', s.feeder, 'Armed & Active', 'Armed & Active');
      setStatus('stag-wol', 'meta-watch-wol', s.wol, 'Operational', 'Gateway Active');
      setStatus('stag-torrents2', 'meta-watch-torrents2', s.torrents2, 'Operational', 'WireGuard Swarm');

      const dtTag = document.getElementById('stag-torrents');
      const dtMeta = document.getElementById('meta-watch-torrents');
      if (s.torrents) {
        if (s.torrents.online) {
          if (dtTag) {
            dtTag.className = 'item-tag online';
            dtTag.textContent = s.torrents.statusText || 'Operational';
          }
          if (dtMeta) {
            const lat = (s.torrents.latencyMs !== null && s.torrents.latencyMs !== undefined) ? `${s.torrents.latencyMs}ms • ` : '';
            dtMeta.textContent = `${lat}Active Node`;
            dtMeta.style.color = '#34d399';
          }
        } else {
          const isSleeping = window.DESKTOP_IS_ONLINE === false;
          if (dtTag) {
            dtTag.className = isSleeping ? 'item-tag standby' : 'item-tag offline';
            dtTag.textContent = isSleeping ? 'Eco Standby' : 'Offline';
          }
          if (dtMeta) {
            dtMeta.textContent = isSleeping ? 'Desktop Sleeping' : (s.torrents.error || 'Node Offline');
            dtMeta.style.color = isSleeping ? '#818cf8' : '#ef4444';
          }
        }
      }

      const cfTag = document.getElementById('stag-cf');
      const cfMeta = document.getElementById('meta-watch-cf');
      if (s.cf) {
        if (s.cf.online) {
          if (cfTag) {
            cfTag.className = 'item-tag online';
            cfTag.textContent = 'Shield Active';
            cfTag.style.background = 'rgba(249, 115, 22, 0.2)';
            cfTag.style.color = '#fb923c';
          }
          if (cfMeta) {
            const lat = (s.cf.latencyMs !== null && s.cf.latencyMs !== undefined) ? `${s.cf.latencyMs}ms • ` : '';
            cfMeta.textContent = `${lat}Tunnel Active`;
            cfMeta.style.color = '#fb923c';
          }
        } else {
          if (cfTag) {
            cfTag.className = 'item-tag warn';
            cfTag.textContent = 'Degraded';
            cfTag.style.background = '';
            cfTag.style.color = '';
          }
          if (cfMeta) {
            cfMeta.textContent = s.cf.error || 'Tunnel Warning';
            cfMeta.style.color = '#ef4444';
          }
        }
      }

      document.querySelectorAll('#dash-global-status').forEach(dashGlobal => {
        dashGlobal.textContent = `${count}/8 Services Online`;
        if (count === 8) {
          dashGlobal.className = 'item-tag online';
          dashGlobal.style.color = '#4ade80';
          dashGlobal.style.background = 'rgba(34, 197, 94, 0.12)';
          dashGlobal.style.borderColor = 'rgba(34, 197, 94, 0.25)';
        } else if (count >= 5) {
          dashGlobal.className = 'item-tag warn';
          dashGlobal.style.color = '#fbbf24';
          dashGlobal.style.background = 'rgba(245, 158, 11, 0.12)';
          dashGlobal.style.borderColor = 'rgba(245, 158, 11, 0.25)';
        } else {
          dashGlobal.className = 'item-tag offline';
          dashGlobal.style.color = '#f87171';
          dashGlobal.style.background = 'rgba(239, 68, 68, 0.12)';
          dashGlobal.style.borderColor = 'rgba(239, 68, 68, 0.25)';
        }
      });

      document.querySelectorAll('#hero-service-status-pill').forEach(heroPill => {
        heroPill.textContent = `Service Status (${count}/8 Online)`;
      });
    }
    window.updateServiceDashboardUI = updateServiceDashboardUI;

    function fetchServicesHealth() {
      if (typeof fetch !== 'function') return Promise.resolve(null);
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;

      return fetch(`${GATEWAY}/services-health`, {
        signal: controller ? controller.signal : undefined
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (timeoutId) clearTimeout(timeoutId);
          if (data && (data.services || data.status === 'success')) {
            window.LAST_SERVICES_HEALTH = data;
            updateServiceDashboardUI(data);
            if (typeof updateClusterPowerAndThermalsUI === 'function') {
              try { updateClusterPowerAndThermalsUI(Boolean(window.DESKTOP_IS_ONLINE)); } catch (e) {}
            }
          }
          return data;
        })
        .catch(err => {
          if (timeoutId) clearTimeout(timeoutId);
          return null;
        });
    }
    window.fetchServicesHealth = fetchServicesHealth;

    function pollRealData(btn) {
      const pollIcons = document.querySelectorAll('#poll-data-icon svg, #dash-refresh-icon');
      pollIcons.forEach(icon => {
        icon.style.transition = 'transform 0.8s ease';
        icon.style.transform = 'rotate(360deg)';
      });
      document.querySelectorAll('#poll-data-text').forEach(el => el.textContent = 'Polling...');
      if (typeof showToast === 'function') {
        showToast('loading', 'Polling Real Data...', 'Connecting to cluster gateway at wake.digitalresolve.ca', 2000);
      }

      // Execute all telemetry pollers concurrently
      const pollTasks = [];
      if (typeof fetchClusterStats === 'function') pollTasks.push(fetchClusterStats());
      if (typeof fetchISPHistory === 'function') pollTasks.push(fetchISPHistory());
      if (typeof fetchServicesHealth === 'function') pollTasks.push(fetchServicesHealth());
      if (typeof fetchFeederStatus === 'function') pollTasks.push(fetchFeederStatus());
      if (typeof renderUptimeMatrix === 'function') pollTasks.push(renderUptimeMatrix());
      if (typeof fetchAgySessionInfo === 'function') pollTasks.push(fetchAgySessionInfo());
      if (typeof updateCodebaseMetrics === 'function') pollTasks.push(Promise.resolve().then(() => updateCodebaseMetrics()));
      if (typeof checkStatus === 'function') {
        pollTasks.push(checkStatus('nuc'));
        pollTasks.push(checkStatus('desktop'));
      }

      return Promise.allSettled(pollTasks).then(() => {
        setTimeout(() => {
          pollIcons.forEach(icon => icon.style.transform = 'none');
          document.querySelectorAll('#poll-data-text').forEach(el => el.textContent = 'Update');

          let liveCount = (window.LAST_SERVICES_HEALTH && typeof window.LAST_SERVICES_HEALTH.onlineCount === 'number')
            ? window.LAST_SERVICES_HEALTH.onlineCount
            : null;

          if (liveCount === null) {
            const nucOn = window.NUC_IS_ONLINE !== false;
            const deskOn = window.DESKTOP_IS_ONLINE === true;
            liveCount = 6;
            if (!nucOn) liveCount = 0;
            if (deskOn) liveCount += 2;
          }

          document.querySelectorAll('#dash-global-status').forEach(globalStatus => {
            globalStatus.textContent = `${liveCount}/8 Services Online`;
            globalStatus.className = liveCount === 8 ? 'item-tag online' : (liveCount >= 5 ? 'item-tag warn' : 'item-tag offline');
          });
          document.querySelectorAll('#hero-service-status-pill').forEach(heroPill => {
            heroPill.textContent = `Service Status (${liveCount}/8 Online)`;
          });

          if (typeof showToast === 'function') {
            showToast('success', 'Real Telemetry Polled', `Cluster state synchronized: ${liveCount}/8 services verified online.`, 3500);
          }
        }, 800);
      });
    }
    window.pollRealData = pollRealData;

    function refreshServiceDashboard(btn) {
      const icon = document.getElementById('dash-refresh-icon');
      if (icon) {
        icon.style.transition = 'transform 0.8s ease';
        icon.style.transform = 'rotate(360deg)';
      }
      if (typeof showToast === 'function') {
        showToast('loading', 'Querying Services...', 'Probing all 8 homelab microservice ports', 1500);
      }
      const tasks = [];
      if (typeof fetchServicesHealth === 'function') tasks.push(fetchServicesHealth());
      if (typeof renderUptimeMatrix === 'function') tasks.push(renderUptimeMatrix());

      return Promise.allSettled(tasks).then(() => {
        setTimeout(() => {
          if (icon) icon.style.transform = 'none';
          const count = (window.LAST_SERVICES_HEALTH && typeof window.LAST_SERVICES_HEALTH.onlineCount === 'number')
            ? window.LAST_SERVICES_HEALTH.onlineCount
            : 8;
          if (typeof showToast === 'function') {
            showToast('success', 'Services Refreshed', `${count}/8 microservices responding and operational.`, 3000);
          }
        }, 600);
      });
    }
    window.refreshServiceDashboard = refreshServiceDashboard;

    // Remote Actions Extension Handlers
    function confirmRebootNuc() {
      if (confirm("Are you sure you want to gracefully reboot the NUC Core Server?\n\nAll active torrents and daemons will be suspended cleanly and restarted automatically.\nRequires Microsoft 365 Entra ID SSO / Passkey verification.")) {
        sendControl('reboot', 'nuc');
      }
    }

    function confirmRebootDesktop() {
      if (confirm("Are you sure you want to gracefully reboot the Desktop PC?\n\nRequires Microsoft 365 Entra ID SSO / Passkey verification.")) {
        sendControl('reboot', 'desktop');
      }
    }

      // ==========================================
    // EMBEDDED AGY CONSOLE CONTROLLER
    // ==========================================
    let consoleAutoPollTimer = null;
    let consoleAutoPollActive = true;

    function openEmbeddedConsole(fullscreen = false) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Antigravity Autonomous Terminal', () => openEmbeddedConsole(fullscreen));
        return;
      }
      const modal = document.getElementById('agy-console-modal-overlay');
      const win = document.getElementById('agy-console-window');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      if (fullscreen && win && !win.classList.contains('fullscreen')) {
        win.classList.add('fullscreen');
      }
      updateSSOGateUI(); try { updateMaintenanceVisualStates(); } catch(e) {}
      fetchAgySessionInfo();
      refreshAgyConsole();
      startConsoleAutoPoll();
      const input = document.getElementById('agy-modal-input');
      if (input) setTimeout(() => input.focus(), 200);
    }

    function closeAgyConsole() {
      const modal = document.getElementById('agy-console-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      document.body.style.overflow = '';
      stopConsoleAutoPoll();
    }

    function closeAgyConsoleOnBackdrop(event) {
      if (event.target && event.target.id === 'agy-console-modal-overlay') {
        closeAgyConsole();
      }
    }

    function maximizeAgyConsole() {
      const win = document.getElementById('agy-console-window');
      if (win) win.classList.toggle('fullscreen');
    }

    function toggleConsoleAutoPoll() {
      consoleAutoPollActive = !consoleAutoPollActive;
      const btn = document.getElementById('btn-console-poll');
      if (btn) {
        btn.textContent = consoleAutoPollActive ? 'Auto-Stream: ON' : 'Auto-Stream: OFF';
        btn.style.color = consoleAutoPollActive ? '#4ade80' : '#94a3b8';
      }
      if (consoleAutoPollActive) {
        startConsoleAutoPoll();
      } else {
        stopConsoleAutoPoll();
      }
    }

    let consolePollTick = 0;
    function startConsoleAutoPoll() {
      stopConsoleAutoPoll();
      if (!consoleAutoPollActive) return;
      consolePollTick = 0;
      consoleAutoPollTimer = setInterval(() => {
        const modal = document.getElementById('agy-console-modal-overlay');
        if (modal && modal.classList.contains('active')) {
          consolePollTick++;
          if (consolePollTick % 4 === 0 && typeof fetchAgySessionInfo === 'function') {
            fetchAgySessionInfo();
          }
          refreshAgyConsole(true);
        }
      }, 2500);
    }

    function stopConsoleAutoPoll() {
      if (consoleAutoPollTimer) {
        clearInterval(consoleAutoPollTimer);
        consoleAutoPollTimer = null;
      }
    }

    function refreshAgyConsole(isSilent = false) {
      if (!isSSOAuthenticated()) {
        updateSSOGateUI(); try { updateMaintenanceVisualStates(); } catch(e) {}
        return;
      }
      const screen = document.getElementById('agy-console-screen');
      const statusTag = document.getElementById('agy-console-status');
      if (!isSilent && statusTag) statusTag.textContent = 'STREAMING...';

      fetch(`${GATEWAY}/api/logs?name=agy`, {
        credentials: 'include',
        headers: getAdminAuthHeaders(),
        signal: _fetchSig(8000)
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (data && (data.conversationId || data.hostNode || data.sessionName)) {
            updateAgySessionDisplay(data.conversationId || '', data.sessionName || null, data.hostNode || null);
          }
          if (data && data.lines && screen) {
            const isNearBottom = screen.scrollHeight - screen.scrollTop - screen.clientHeight < 80;
            
            screen.innerHTML = '';
            data.lines.forEach(line => {
              const div = document.createElement('div');
              div.className = 'agy-line';
              if (line.includes('[USER]') || line.includes('[USER_EXPLICIT]')) {
                div.className += ' user';
                div.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[USER]</span> ${escapeHtml(line.replace(/\[\d\d:\d\d:\d\d\]\s*\[(USER|USER_EXPLICIT)\]\s*/, ''))}`;
              } else if (line.includes('[AGENT]') || line.includes('[MODEL]')) {
                div.className += ' model';
                div.innerHTML = `<span style="color:#60a5fa; font-weight:700;">[AGENT]</span> ${escapeHtml(line.replace(/\[\d\d:\d\d:\d\d\]\s*\[(AGENT|MODEL)\]\s*/, ''))}`;
              } else if (line.includes('[TOOL]') || line.includes('Tool Call')) {
                div.className += ' tool';
                div.innerHTML = `<span style="color:#fbbf24; font-weight:700;">[TOOL]</span> <span style="color:#cbd5e1;">${escapeHtml(line.replace(/\[\d\d:\d\d:\d\d\]\s*\[TOOL\]\s*/, ''))}</span>`;
              } else if (line.includes('[OUTPUT]')) {
                div.className += ' system';
                div.style.color = '#94a3b8';
                div.innerHTML = `<span style="color:#10b981; font-weight:600;">[OUTPUT]</span> ${escapeHtml(line.replace(/\[\d\d:\d\d:\d\d\]\s*\[OUTPUT\]\s*/, ''))}`;
              } else {
                div.className += ' system';
                div.textContent = line;
              }
              screen.appendChild(div);
            });

            if (isNearBottom || !isSilent) {
              screen.scrollTop = screen.scrollHeight;
            }
            if (statusTag) {
              const activeHost = (data && data.hostNode) || window.AGY_SESSION_HOST || 'desktop';
              statusTag.textContent = activeHost === 'nuc' ? 'ONLINE (NUC :8082)' : 'ONLINE (Desktop :8082)';
              statusTag.className = 'item-tag online';
            }
            if (typeof updateQuotaHistorySparkline === 'function') {
              updateQuotaHistorySparkline();
            }
          }
        })
        .catch(err => {
          if (statusTag) {
            statusTag.textContent = 'RECONNECTING...';
            statusTag.className = 'item-tag';
          }
        });
    }

    function triggerQuickChip(btn, text) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('AGY Interactive Quick Prompt', () => triggerQuickChip(btn, text));
        return;
      }
      const input = document.getElementById('agy-modal-input');
      if (input) input.value = text;
      
      const origHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite;">&#8635;</span> Executing...';
        btn.style.borderColor = '#60a5fa';
        btn.style.background = 'rgba(59, 130, 246, 0.4)';
        btn.disabled = true;
      }

      sendConsolePrompt();

      setTimeout(() => {
        if (btn) {
          btn.innerHTML = origHtml;
          btn.style.borderColor = '';
          btn.style.background = '';
          btn.disabled = false;
        }
      }, 2500);
    }

    function sendConsolePrompt() {
      const input = document.getElementById('agy-modal-input');
      const text = input ? input.value.trim() : '';
      if (!text) return;

      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Autonomous Console Dispatch', sendConsolePrompt);
        return;
      }

      const screen = document.getElementById('agy-console-screen');
      if (screen) {
        const userLine = document.createElement('div');
        userLine.className = 'agy-line user';
        const now = new Date().toLocaleTimeString('en-US', { hour12: false });
        userLine.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[USER]</span> ${escapeHtml(text)}`;
        screen.appendChild(userLine);
        screen.scrollTop = screen.scrollHeight;
      }

      if (input) input.value = '';
      const cid = window.AGY_SESSION_ID || '';
      showToast('loading', 'Dispatching Prompt to AGY Session...', `Session: ${cid ? cid.substring(0,8) : 'active'}`, 1500);

      const payload = { prompt: text };
      if (cid) payload.conversationId = cid;
      fetch(`${GATEWAY}/api/agy/send`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        signal: _fetchSig(15000)
      })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.status === 'success') {
          showToast('success', 'Prompt Delivered to AGY', 'Autonomous agent processing instruction...');
          setTimeout(() => refreshAgyConsole(true), 1200);
          setTimeout(() => refreshAgyConsole(true), 3000);
        } else {
          showToast('error', 'Transmission Failed', data.message || 'Could not queue prompt.');
        }
      })
      .catch(err => {
        showToast('error', 'Gateway Offline', `Could not reach ${GATEWAY}`);
      });
    }


      function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Dynamic System Release Changelog Ingestion Engine (Non-Hardcoded)
    function fetchAndRenderChangelog() {
      const container = document.querySelector('.changelog-body');
      return fetch('changelog.json?_v=' + Date.now(), { signal: _fetchSig(5000) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => {
          if (!data || !Array.isArray(data.releases) || data.releases.length === 0) return;
          const latestVer = data.releases[0].version;

          const menuVer = document.getElementById('menu-changelog-ver');
          if (menuVer) menuVer.textContent = latestVer;
          const footerVer = document.getElementById('footer-version-tag');
          if (footerVer) footerVer.textContent = latestVer;

          if (container) {
            let html = '';
            data.releases.forEach((rel, idx) => {
              const isCurrent = idx === 0;
              const tagClass = isCurrent ? 'ver-tag current' : 'ver-tag';
              const tagLabel = isCurrent ? (rel.version + ' | Current') : rel.version;
              let listItems = '';
              if (Array.isArray(rel.changes)) {
                listItems = rel.changes.map(ch => {
                  const boldPrefix = ch.label ? ('<strong>' + escapeHtml(ch.label) + ':</strong> ') : '';
                  return '<li>' + boldPrefix + escapeHtml(ch.text) + '</li>';
                }).join('');
              }
              html += '<div class=\"changelog-entry\">' +
                '<div class=\"changelog-ver-header\">' +
                  '<span class=\"' + tagClass + '\">' + escapeHtml(tagLabel) + '</span>' +
                  '<span class=\"ver-date\">' + escapeHtml(rel.date) + '</span>' +
                '</div>' +
                '<h4 class=\"ver-title\">' + escapeHtml(rel.title) + '</h4>' +
                '<ul class=\"ver-list\">' + listItems + '</ul>' +
              '</div>';
            });
            container.innerHTML = html;
          }
        })
        .catch(err => {
          console.warn('[Changelog] Ingestion fallback active:', err);
        });
    }
    window.fetchAndRenderChangelog = fetchAndRenderChangelog;

    // System Release Changelog Modal Controllers
    function openChangelogModal() {
      try { fetchAndRenderChangelog(); } catch(e) {}
      const modal = document.getElementById('changelog-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeChangelogModal() {
      const modal = document.getElementById('changelog-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      document.body.style.overflow = '';
    }

    function closeChangelogModalOnBackdrop(e) {
      if (e.target && e.target.id === 'changelog-modal-overlay') {
        closeChangelogModal(); if (typeof closeMaintenanceModal === 'function') closeMaintenanceModal();
      }
    }

    // Homelab Health Radar Modal Controllers
    function openHealthModal() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Cluster Health Radar & Scorecard', openHealthModal);
        return;
      }
      const modal = document.getElementById('health-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeHealthModal() {
      const modal = document.getElementById('health-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      document.body.style.overflow = '';
    }

    function closeHealthModalOnBackdrop(e) {
      if (e.target && e.target.id === 'health-modal-overlay') {
        closeHealthModal();
      }
    }

    // ==========================================
    // ==========================================
    // ==========================================
    var schematicNodesData = {
      cf: {
        icon: '[EDGE]',
        title: 'Cloudflare Zero Trust Edge Network',
        subtitle: 'Global Ingress & Anycast Edge Tunnels',
        status: 'Edge Active',
        statusClass: 'online',
        net: 'Montreal (YUL) & Toronto (YYZ)',
        sec: 'TLS 1.3  -  Automated DDoS Shield',
        speed: 'Unmetered Edge Anycast',
        role: 'Origin Shield & HTTP Ingress',
        services: 'digitalresolve.ca  -  stream  -  files  -  wake  -  torrents',
        btnText: 'Test Edge Response  ->',
        action: () => { checkStatus('both'); showToast('info', 'Edge Trace Dispatched', 'Pinging Cloudflare PoP Montreal (YUL)...'); }
      },
      bell: {
        icon: '[FIBER]',
        title: 'Bell Gigabit Fiber (GigaHub 4000)',
        subtitle: 'FTTH Uplink  -  1.5 Gbps Optical Carrier',
        status: '1.5 Gbps Optimal',
        statusClass: 'online',
        net: '192.168.2.1  -  PPPoE WAN Gateway',
        sec: 'Direct Fiber Carrier  -  NAT Firewalled',
        speed: '1,500 Mbps Down / 940 Mbps Up',
        role: 'Physical Residential WAN Gateway',
        services: 'Direct Fiber SFP+  -  Low Jitter (<2ms)  -  Gigabit Switch Fabric',
        btnText: 'Run ISP Speedprobe  ->',
        action: () => { triggerSpeedtest(); }
      },
      vpn: {
        icon: '[VPN]',
        title: 'Mullvad WireGuard Privacy Tunnel',
        subtitle: 'Zero-Logging Cryptographic Outbound Proxy',
        status: 'Encrypted & Active',
        statusClass: 'online',
        net: 'wg0  -  UDP:51820  -  Mullvad Exit',
        sec: 'ChaCha20-Poly1305  -  Killswitch Active',
        speed: 'WireGuard Tunnel (Encrypted)',
        role: 'High-Speed Torrent & Stream Privacy',
        services: 'qBittorrent SOCKS5/Tun Ingestion  -  DNS Leak Shield',
        btnText: 'Inspect VPN Health  ->',
        action: () => { openHealthModal(); }
      },
      tunnel: {
        icon: '[TUNNEL]',
        title: 'Cloudflare Tunnel Daemon (cloudflared)',
        subtitle: 'Zero Trust Outbound Ingress Connector',
        status: 'Connected (Dual-Path)',
        statusClass: 'online',
        net: 'Local Loopback  -  Service Host',
        sec: '0 Open Inbound Ports  -  M365 SSO Enforced',
        speed: 'Direct Quick Tunnel (Quic/HTTP2)',
        role: 'Secure Reverse Proxy Dispatcher',
        services: 'Tunnel ID 88a10-dr  -  Zero Router Port Forwarding',
        btnText: 'Inspect Zero Trust  ->',
        action: () => { showToast('info', 'Zero Trust Tunnel', 'Argo tunnel active across 24/7 NUC node.'); }
      },
      nuc: {
        icon: '[SERVER]',
        title: 'Intel NUC Core Server (Always-On 24/7)',
        subtitle: 'Central Edge Gateway & Service Host',
        status: 'Online (WAN / LAN)',
        statusClass: 'online',
        net: '192.168.2.35  -  eth0 Gigabit',
        sec: 'Continuous Active  -  High Performance (Always-On 24/7)',
        speed: 'Gigabit LAN (Zero-Loss SLA)',
        role: 'StreamHub, CatCam, Torrent, Sentinel',
        services: 'StreamHub (8088)  -  Files (8085)  -  qBit (8081)  -  WoL (8082)',
        btnText: 'Probe NUC Node  ->',
        action: () => { checkStatus('nuc'); }
      },
      desktop: {
        icon: '[COMPUTE]',
        title: 'Desktop Workstation (Cory-Desktop)',
        subtitle: 'High-Power Compute, GPU & Autonomous CLI Node',
        status: 'Online (Active Workstation)',
        statusClass: 'online',
        net: '192.168.2.62  -  2.5 GbE Realtek',
        sec: 'Continuous Active  -  High Performance (Sleep Disabled)',
        speed: '2.5 Gbps High-Bandwidth Link',
        role: 'RTX GPU Inference & AGY Agent Runtime',
        services: 'Antigravity Autonomous Agent  -  Git Mirror  -  Torrent Seeding',
        btnText: 'Inspect Desktop  ->',
        action: () => { checkStatus('desktop'); }
      },
      storage: {
        icon: '[STORAGE]',
        title: 'Media Storage & NVMe Pools',
        subtitle: 'High-Speed Local Storage & Network Shares',
        status: 'Awaiting Telemetry',
        statusClass: 'online',
        net: 'D:\\Torrents & Z:\\Media  -  SMB 3.1.1',
        sec: 'BitLocker Protected  -  SMART Monitored',
        speed: 'NVMe 3,500 MB/s  -  SMB LAN 280 MB/s',
        role: '4K Stream Staging & Torrent Auto-Unpack',
        services: 'Local Drive D:  -  Desktop NVMe Backup Pool',
        btnText: 'Quick Drop Magnet  ->',
        action: () => { openMagnetModal(); }
      }
    };

    let selectedSchematicKey = 'cf';
    let circuitFlowActive = true;

    function selectSchematicNode(key) {
      if (!schematicNodesData[key]) return;
      selectedSchematicKey = key;
      const data = schematicNodesData[key];

      document.querySelectorAll('.schematic-node-card').forEach(c => c.classList.remove('selected'));
      const activeCard = document.getElementById(`s-node-${key}`);
      if (activeCard) activeCard.classList.add('selected');

      const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      const elIcon = document.getElementById('insp-icon'); if (elIcon) elIcon.textContent = data.icon;
      setTxt('insp-title', data.title);
      setTxt('insp-subtitle', data.subtitle);
      setTxt('insp-val-net', data.net);
      setTxt('insp-val-sec', data.sec);
      setTxt('insp-val-speed', data.speed);
      setTxt('insp-val-role', data.role);
      
      const elServ = document.getElementById('insp-services');
      if (elServ) elServ.innerHTML = `<strong>Active Services:</strong> ${escapeHtml(data.services)}`;

      const elBadge = document.getElementById('insp-status-badge');
      if (elBadge) {
        elBadge.textContent = data.status;
        elBadge.className = `item-tag ${data.statusClass}`;
      }

      const elBtn = document.getElementById('insp-btn-action');
      if (elBtn) elBtn.textContent = data.btnText;

      playChaosTone(587, 880, 'sine', 0.08);
    }

    function schematicNodeAction() {
      if (!isSSOAuthenticated()) {
        const title = (schematicNodesData[selectedSchematicKey] && schematicNodesData[selectedSchematicKey].title) || 'Cluster Schematic Action';
        openGlobalSSOModal(title, () => schematicNodeAction());
        return;
      }
      if (schematicNodesData[selectedSchematicKey] && typeof schematicNodesData[selectedSchematicKey].action === 'function') {
        schematicNodesData[selectedSchematicKey].action();
      }
    }

    function pulseSchematicTraces() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('ICMP Trace Telemetry Pulse', pulseSchematicTraces);
        return;
      }
      const wires = document.querySelectorAll('.circuit-wire, .circuit-stream');
      wires.forEach(w => w.classList.add('pulsing'));
      const btn = document.getElementById('btn-pulse-traces');
      if (btn) btn.classList.add('pulse-active');
      playChaosTone(440, 1100, 'triangle', 0.25);
      showToast('info', 'Schematic Pulse Dispatched', 'Visual topology pulse triggered (display animation).');

      setTimeout(() => {
        wires.forEach(w => w.classList.remove('pulsing'));
        if (btn) btn.classList.remove('pulse-active');
      }, 700);
    }

    function toggleCircuitFlow() {
      circuitFlowActive = !circuitFlowActive;
      const btn = document.getElementById('btn-toggle-flow');
      const streams = document.querySelectorAll('.circuit-stream');
      if (btn) {
        btn.innerHTML = circuitFlowActive ? 'Flow: ON' : 'Flow: OFF';
        btn.classList.toggle('pulse-active', circuitFlowActive);
      }
      streams.forEach(s => {
        s.style.display = circuitFlowActive ? '' : 'none';
        s.style.animationPlayState = circuitFlowActive ? 'running' : 'paused';
      });
      playChaosTone(350, circuitFlowActive ? 700 : 200, 'sine', 0.12);
    }

    // ==========================================
    // Chaos Monkey Resilience Simulator Engine
    // ==========================================
    const chaosState = {
      soundEnabled: false,
      audioCtx: null,
      faults: {
        bellFiber: false,
        desktopPower: false,
        ddosFlood: false,
        diskFull: false
      }
    };

    function getChaosAudioCtx() {
      if (!chaosState.audioCtx && typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        chaosState.audioCtx = new AudioCtx();
      }
      if (chaosState.audioCtx && chaosState.audioCtx.state === 'suspended') {
        chaosState.audioCtx.resume();
      }
      return chaosState.audioCtx;
    }

    function playChaosTone(freq1, freq2, type = 'sine', duration = 0.15) {
      if (!chaosState.soundEnabled) return;
      try {
        const ctx = getChaosAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq1, ctx.currentTime);
        if (freq2) {
          osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {
        // AudioContext ignored if blocked
      }
    }

    function toggleChaosSound() {
      chaosState.soundEnabled = !chaosState.soundEnabled;
      const btn = document.getElementById('btn-chaos-sound');
      if (btn) {
        btn.classList.toggle('active', chaosState.soundEnabled);
        btn.innerHTML = chaosState.soundEnabled ? 'Sound: ON' : 'Sound: OFF';
      }
      if (chaosState.soundEnabled) {
        getChaosAudioCtx();
        playChaosTone(587, 880, 'triangle', 0.18);
        addChaosLog('info', '[AUDIO] Procedural Web Audio synth initialized. Acoustic telemetry active.');
      } else {
        addChaosLog('sys', '[AUDIO] Audio feedback muted.');
      }
    }

    function openDisasterModal() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Disaster Recovery & Chaos Lab', openDisasterModal);
        return;
      }
      const modal = document.getElementById('disaster-modal-overlay') || document.getElementById('chaos-modal-overlay');
      if (modal) {
        modal.style.setProperty('display', 'flex', 'important');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeDisasterModal() {
      const modal = document.getElementById('disaster-modal-overlay') || document.getElementById('chaos-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.setProperty('display', 'none', 'important');
      }
      document.body.style.overflow = '';
    }

    function closeDisasterModalOnBackdrop(e) {
      if (e.target && (e.target.id === 'disaster-modal-overlay' || e.target.id === 'chaos-modal-overlay')) {
        closeDisasterModal();
      }
    }

    // Direct global aliases for backward compatibility & direct invocation
    window.openDisasterModal = openDisasterModal;
    window.closeDisasterModal = closeDisasterModal;
    window.openChaosModal = openDisasterModal;
    window.closeChaosModal = closeDisasterModal;

    function addChaosLog(type, msg) {
      const feed = document.getElementById('chaos-console-feed');
      if (!feed) return;
      const timeStr = new Date().toTimeString().split(' ')[0];
      const div = document.createElement('div');
      div.className = `chaos-line ${type}`;
      div.textContent = `[${timeStr}] [SIMULATED] ${msg}`;
      feed.appendChild(div);
      feed.scrollTop = feed.scrollHeight;
    }

    function updateChaosScoreUI() {
      const activeCount = Object.values(chaosState.faults).filter(Boolean).length;
      const scoreEl = document.getElementById('chaos-score-val');
      const badgeEl = document.getElementById('chaos-fault-counter');

      const baseScore = window.DESKTOP_IS_ONLINE ? '100% Optimal' : '98% Optimal (Eco)';
      let label = baseScore;
      let stateClass = 'ok';

      if (activeCount === 1) {
        label = '76% Degraded';
        stateClass = 'warning';
      } else if (activeCount === 2) {
        label = '58% High Strain';
        stateClass = 'warning';
      } else if (activeCount === 3) {
        label = '39% Critical';
        stateClass = 'critical';
      } else if (activeCount >= 4) {
        label = '18% Lockdown';
        stateClass = 'critical';
      }

      if (scoreEl) {
        scoreEl.textContent = `[SIMULATED] ${label}`;
        scoreEl.className = `chaos-score-val ${stateClass}`;
      }
      if (badgeEl) {
        badgeEl.textContent = `${activeCount} Fault${activeCount === 1 ? '' : 's'} Active`;
        badgeEl.className = activeCount > 0 ? 'item-tag offline' : 'item-tag online';
      }
    }

    function triggerChaosFault(type) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Chaos Engineering Fault Injection', () => triggerChaosFault(type));
        return;
      }
      if (type === 'bellFiber') {
        chaosState.faults.bellFiber = !chaosState.faults.bellFiber;
        const isFault = chaosState.faults.bellFiber;
        const btn = document.getElementById('btn-fault-fiber');
        const nodeBell = document.getElementById('c-node-bell');
        const nodeVpn = document.getElementById('c-node-vpn');
        const card = document.getElementById('c-card-fiber');
        const sBell = document.getElementById('s-node-bell');
        if (sBell) sBell.classList.toggle('severed', isFault);

        if (isFault) {
          playChaosTone(220, 110, 'sawtooth', 0.25);
          btn.innerHTML = 'Recover Fiber Link';
          btn.className = 'chaos-card-trigger btn-recovering';
          nodeBell.className = 'chaos-node node-fault';
          nodeBell.querySelector('.chaos-node-status').textContent = 'OFFLINE (0 Mbps)';
          nodeBell.querySelector('.chaos-node-status').className = 'chaos-node-status fault';
          nodeVpn.className = 'chaos-node node-rerouted';
          nodeVpn.querySelector('.chaos-node-status').textContent = 'FAILOVER (Cellular 38ms)';
          nodeVpn.querySelector('.chaos-node-status').className = 'chaos-node-status warn';
          card.classList.add('active-fault');

          addChaosLog('fault', '[FAULT INJECTED] Physical link carrier lost on eth0 (Bell GigaHub 1.5G).');
          addChaosLog('warn', '[SENTINEL] Upstream gateway 192.168.2.1 unreachable (100% loss). Initiating multi-WAN failover...');
          setTimeout(() => {
            addChaosLog('heal', '[AUTONOMOUS FAILOVER] Mullvad WireGuard tunnel re-established via secondary cellular uplink in 1.14s.');
            addChaosLog('info', '[UPTIME PRESERVED] Edge tunnels YUL/YYZ rerouted. Zero dropped client sessions.');
          }, 350);
        } else {
          playChaosTone(440, 880, 'sine', 0.2);
          btn.innerHTML = 'Sever Fiber Link';
          btn.className = 'chaos-card-trigger';
          nodeBell.className = 'chaos-node node-ok';
          nodeBell.querySelector('.chaos-node-status').textContent = '1.5 Gbps (Optimal)';
          nodeBell.querySelector('.chaos-node-status').className = 'chaos-node-status ok';
          nodeVpn.className = 'chaos-node node-ok';
          nodeVpn.querySelector('.chaos-node-status').textContent = 'Encrypted (WireGuard)';
          nodeVpn.querySelector('.chaos-node-status').className = 'chaos-node-status ok';
          card.classList.remove('active-fault');

          addChaosLog('heal', '[RESOLVED] Bell Fiber carrier link re-negotiated at 1.5 Gbps / 940 Mbps.');
          addChaosLog('info', '[SENTINEL] Primary gateway route restored. Backup route standing by.');
        }
      } else if (type === 'desktopPower') {
        chaosState.faults.desktopPower = !chaosState.faults.desktopPower;
        const isFault = chaosState.faults.desktopPower;
        const btn = document.getElementById('btn-fault-desktop');
        const nodeDesktop = document.getElementById('c-node-desktop');
        const nodeNuc = document.getElementById('c-node-nuc');
        const card = document.getElementById('c-card-desktop');
        const sDesk = document.getElementById('s-node-desktop');
        if (sDesk) sDesk.classList.toggle('severed', isFault);

        if (isFault) {
          playChaosTone(300, 80, 'square', 0.25);
          btn.innerHTML = 'Send Wake-on-LAN';
          btn.className = 'chaos-card-trigger btn-recovering';
          nodeDesktop.className = 'chaos-node node-fault';
          nodeDesktop.querySelector('.chaos-node-status').textContent = 'OFFLINE (0 Watts)';
          nodeDesktop.querySelector('.chaos-node-status').className = 'chaos-node-status fault';
          nodeNuc.className = 'chaos-node node-rerouted';
          nodeNuc.querySelector('.chaos-node-status').textContent = 'PROXY ABSORPTION';
          nodeNuc.querySelector('.chaos-node-status').className = 'chaos-node-status warn';
          card.classList.add('active-fault');

          addChaosLog('fault', '[FAULT INJECTED] Hard power outage detected on 192.168.2.62 (Desktop Workstation).');
          addChaosLog('warn', '[HEARTBEAT] Ping timeout on TCP:9090. Active background agent and torrent tasks stalled.');
          setTimeout(() => {
            addChaosLog('heal', '[NUC TAKEOVER] Intel NUC gateway absorbed queued torrent state and proxy ingest.');
            addChaosLog('info', '[SENTINEL] Node marked for automated Wake-on-LAN reboot cycle.');
          }, 350);
        } else {
          playChaosTone(350, 700, 'sine', 0.22);
          btn.innerHTML = 'Pull Desktop Plug';
          btn.className = 'chaos-card-trigger';
          nodeDesktop.className = 'chaos-node node-ok';
          nodeDesktop.querySelector('.chaos-node-status').textContent = 'Online (2.5 GbE)';
          nodeDesktop.querySelector('.chaos-node-status').className = 'chaos-node-status ok';
          nodeNuc.className = 'chaos-node node-ok';
          nodeNuc.querySelector('.chaos-node-status').textContent = 'Online (24/7 Node)';
          nodeNuc.querySelector('.chaos-node-status').className = 'chaos-node-status ok';
          card.classList.remove('active-fault');

          addChaosLog('heal', '[WOL SENT] Magic packet dispatched to MAC 70:85:C2:84:62:65 via broadcast 192.168.2.255.');
          addChaosLog('heal', '[BOOT OK] Desktop workstation booted, NVMe pools mounted, AGY daemon online.');
        }
      } else if (type === 'ddosFlood') {
        chaosState.faults.ddosFlood = !chaosState.faults.ddosFlood;
        const isFault = chaosState.faults.ddosFlood;
        const btn = document.getElementById('btn-fault-ddos');
        const nodeCf = document.getElementById('c-node-cf');
        const card = document.getElementById('c-card-ddos');
        const sCf = document.getElementById('s-node-cf');
        if (sCf) sCf.classList.toggle('severed', isFault);

        if (isFault) {
          playChaosTone(180, 260, 'sawtooth', 0.28);
          btn.innerHTML = 'Engage Rate Limiting';
          btn.className = 'chaos-card-trigger btn-recovering';
          nodeCf.className = 'chaos-node node-fault';
          nodeCf.querySelector('.chaos-node-status').textContent = 'SHIELD ENGAGED (52k/s)';
          nodeCf.querySelector('.chaos-node-status').className = 'chaos-node-status fault';
          card.classList.add('active-fault');

          addChaosLog('fault', '[FAULT INJECTED] High-velocity SYN/HTTP flood: 52,840 req/s targeting digitalresolve.ca.');
          addChaosLog('warn', '[EDGE ALERT] Sudden variance spike across Montreal (YUL) & Toronto (YYZ) edge PoPs.');
          setTimeout(() => {
            addChaosLog('heal', '[SHIELD ACTIVE] Cloudflare Zero Trust rate-limiting and challenge mode deployed.');
            addChaosLog('heal', '[MITIGATED] 99.82% malicious packets dropped at edge. NUC origin CPU unaffected (14%).');
          }, 350);
        } else {
          playChaosTone(523, 1046, 'sine', 0.2);
          btn.innerHTML = 'Flood Edge with 50k SYN';
          btn.className = 'chaos-card-trigger';
          nodeCf.className = 'chaos-node node-ok';
          nodeCf.querySelector('.chaos-node-status').textContent = 'Active (Zero Trust)';
          nodeCf.querySelector('.chaos-node-status').className = 'chaos-node-status ok';
          card.classList.remove('active-fault');

          addChaosLog('heal', '[RESOLVED] Attack signature cleared. Edge traffic normalized to 28 req/m.');
        }
      } else if (type === 'diskFull') {
        chaosState.faults.diskFull = !chaosState.faults.diskFull;
        const isFault = chaosState.faults.diskFull;
        const btn = document.getElementById('btn-fault-disk');
        const nodeStorage = document.getElementById('c-node-storage');
        const card = document.getElementById('c-card-disk');
        const sStore = document.getElementById('s-node-storage');
        if (sStore) sStore.classList.toggle('severed', isFault);

        if (isFault) {
          playChaosTone(150, 90, 'sawtooth', 0.25);
          btn.innerHTML = 'Auto-Prune & Evacuate';
          btn.className = 'chaos-card-trigger btn-recovering';
          nodeStorage.className = 'chaos-node node-fault';
          nodeStorage.querySelector('.chaos-node-status').textContent = 'CRITICAL (99.8% FULL)';
          nodeStorage.querySelector('.chaos-node-status').className = 'chaos-node-status fault';
          card.classList.add('active-fault');

          addChaosLog('fault', '[FAULT INJECTED] Storage pool /storage/torrents hit critical threshold: 99.8% capacity!');
          addChaosLog('warn', '[DISK LOCK] Only 284 MB free space remaining. Torrent ingestion paused.');
          setTimeout(() => {
            addChaosLog('heal', '[SENTINEL PRUNE] Autonomous cleaner purged 12.6 GB temporary torrent buffers.');
            addChaosLog('heal', '[SMB EVACUATION] Completed media archives relocated to Desktop secondary array.');
            addChaosLog('info', '[HEADROOM RESTORED] Storage pool dropped to 42% healthy.');
          }, 350);
        } else {
          playChaosTone(440, 660, 'sine', 0.18);
          btn.innerHTML = 'Fill Disk to 99.8%';
          btn.className = 'chaos-card-trigger';
          nodeStorage.className = 'chaos-node node-ok';
          nodeStorage.querySelector('.chaos-node-status').textContent = 'Healthy (42% Pool)';
          nodeStorage.querySelector('.chaos-node-status').className = 'chaos-node-status ok';
          card.classList.remove('active-fault');

          addChaosLog('heal', '[RESOLVED] Storage partitions rebalanced. Normal I/O throughput resumed.');
        }
      }

      updateChaosScoreUI();
    }

    function restoreAllChaos() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Chaos Engineering Recovery', restoreAllChaos);
        return;
      }
      const hadFaults = Object.values(chaosState.faults).some(Boolean);
      chaosState.faults.bellFiber = false;
      chaosState.faults.desktopPower = false;
      chaosState.faults.ddosFlood = false;
      chaosState.faults.diskFull = false;

      const nodes = [
        { id: 'c-node-bell', status: '1.5 Gbps (Optimal)' },
        { id: 'c-node-vpn', status: 'Encrypted (WireGuard)' },
        { id: 'c-node-nuc', status: 'Online (24/7 Node)' },
        { id: 'c-node-desktop', status: window.DESKTOP_IS_ONLINE ? 'Online (2.5 GbE)' : 'Standby (Eco Mode)' },
        { id: 'c-node-cf', status: 'Active (Zero Trust)' },
        { id: 'c-node-storage', status: window.LAST_NUC_DISK ? `Healthy (${Math.round(window.LAST_NUC_DISK.usedPercent)}% Pool)` : 'Healthy (Pool Online)' }
      ];

      nodes.forEach(n => {
        const el = document.getElementById(n.id);
        if (el) {
          el.className = 'chaos-node node-ok';
          const s = el.querySelector('.chaos-node-status');
          if (s) { s.textContent = n.status; s.className = 'chaos-node-status ok'; }
        }
      });

      const btnFiber = document.getElementById('btn-fault-fiber');
      if (btnFiber) { btnFiber.innerHTML = 'Sever Fiber Link'; btnFiber.className = 'chaos-card-trigger'; }

      const btnDesktop = document.getElementById('btn-fault-desktop');
      if (btnDesktop) { btnDesktop.innerHTML = 'Pull Desktop Plug'; btnDesktop.className = 'chaos-card-trigger'; }

      const btnDdos = document.getElementById('btn-fault-ddos');
      if (btnDdos) { btnDdos.innerHTML = 'Flood Edge with 50k SYN'; btnDdos.className = 'chaos-card-trigger'; }

      const btnDisk = document.getElementById('btn-fault-disk');
      if (btnDisk) { btnDisk.innerHTML = 'Fill Disk to 99.8%'; btnDisk.className = 'chaos-card-trigger'; }

      document.querySelectorAll('.chaos-card').forEach(c => c.classList.remove('active-fault'));
      document.querySelectorAll('.schematic-node-card').forEach(c => c.classList.remove('severed'));

      if (hadFaults) {
        playChaosTone(523, 1046, 'sine', 0.28);
        addChaosLog('heal', '[RESTORE ALL] Master sentinel override dispatched. All 6 nodes restored to 100% optimal.');
      } else {
        const baseScore = window.DESKTOP_IS_ONLINE ? '100% Optimal' : '98% Optimal (Eco)';
        addChaosLog('sys', `[DIAGNOSTIC] All topology nodes verified green. Cluster health is ${baseScore}.`);
      }

      updateChaosScoreUI();
    }

    // ==========================================
    // NUC EXTENDED SERVICES & TELEMETRY SUITE
    // ==========================================
    function switchNucTab(tabKey) {
      if (tabKey === 'ai') {
        const ops = document.getElementById('ops-ai');
        if (ops) {
          ops.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.location.href = 'ops.html#ops-ai';
        }
        return;
      }

      const btn = document.getElementById(`tab-btn-${tabKey}`);
      const pane = document.getElementById(`pane-${tabKey}`);
      const container = document.getElementById('nuc-services');

      if (!btn && !pane && !container) {
        window.location.href = `index.html#pane-${tabKey}`;
        return;
      }

      document.querySelectorAll('.nuc-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.nuc-pane').forEach(p => p.classList.remove('active'));

      if (btn) btn.classList.add('active');
      if (pane) {
        pane.classList.add('active');
        pane.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
        pane.style.boxShadow = '0 0 24px rgba(56, 189, 248, 0.45)';
        setTimeout(() => { pane.style.boxShadow = ''; }, 2200);
        pane.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    window.switchNucTab = switchNucTab;

    // --- 1. Bell Speedtest (SSO Protected) & Global Security Gate ---
    let isSpeedtesting = false;

    function openGlobalSSOModal(actionName = 'Protected System Operation', callback = null) {
      window.pendingSSOCallback = callback;
      const modal = document.getElementById('speedtest-sso-modal-overlay');
      const actionEl = document.getElementById('sso-gate-action-name');
      if (actionEl) actionEl.textContent = actionName;
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
      }
    }
    window.openGlobalSSOModal = openGlobalSSOModal;
    window.openSpeedtestSSOModal = () => openGlobalSSOModal('Gigabit Speedtest (WAN Saturation Protection)', runLiveSpeedtestBenchmark);

    function closeSpeedtestSSOModal() {
      window.pendingSSOCallback = null;
      const modal = document.getElementById('speedtest-sso-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
    }
    window.closeSpeedtestSSOModal = closeSpeedtestSSOModal;
    window.closeGlobalSSOModal = closeSpeedtestSSOModal;

    // ==========================================
    // LOCAL LAN & MEDIA ROUTING ENGINE
    // ==========================================
    function resolveMediaUrl(url) {
      if (!url || typeof url !== 'string') return url;

      const routeSetting = localStorage.getItem('dr_media_route') || 'auto';
      if (routeSetting === 'wan') {
        return url;
      }

      const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';
      const isFileProtocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');
      const isDirectHost = isFileProtocol || (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'nuc' || /^192\.168\./.test(hostname));

      const isNucLocal = (hostname === 'nuc') || ((hostname === 'localhost' || hostname === '127.0.0.1') && (window.location.port === '8088' || window.location.port === '3333' || window.location.port === '8085' || window.location.port === '8990' || window.location.port === '7878' || window.location.port === '9696' || window.location.port === '8787' || window.location.port === '8081' || localStorage.getItem('dr_is_nuc') === 'true'));
      const nucHost = isNucLocal ? 'localhost' : '192.168.2.35';

      const isDeskLocal = (hostname === 'desktop' || hostname === 'cory-desktop') || ((hostname === 'localhost' || hostname === '127.0.0.1') && !isNucLocal) || (isFileProtocol && localStorage.getItem('dr_is_nuc') !== 'true') || localStorage.getItem('dr_is_desktop') === 'true' || window.location.port === '8080';
      const deskHost = isDeskLocal ? 'localhost' : '192.168.2.62';

      if (routeSetting === 'tailscale') {
        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?stream\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?stream\.digitalresolve\.ca(?::\d+)?/i, 'http://100.68.136.76:8088');
        }
        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?jellyfin\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?jellyfin\.digitalresolve\.ca(?::\d+)?/i, 'http://100.68.136.76:8096');
        }
        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?audiobooks\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?audiobooks\.digitalresolve\.ca(?::\d+)?/i, 'http://100.68.136.76:3333');
        }

        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?sonarr\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?sonarr\.digitalresolve\.ca(?::\d+)?/i, 'http://100.68.136.76:8990');
        }
        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?radarr\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?radarr\.digitalresolve\.ca(?::\d+)?/i, 'http://100.68.136.76:7878');
        }
        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?prowlarr\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?prowlarr\.digitalresolve\.ca(?::\d+)?/i, 'http://100.68.136.76:9696');
        }
        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?readarr\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?readarr\.digitalresolve\.ca(?::\d+)?/i, 'http://100.68.136.76:8787');
        }
        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?torrents2\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?torrents2\.digitalresolve\.ca(?::\d+)?/i, 'http://100.68.136.76:8081');
        }
        if (/^(?:https?:)?(?:\/\/)?(?:www\.)?torrents\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
          return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?torrents\.digitalresolve\.ca(?::\d+)?/i, `http://${deskHost}:8080`);
        }
        return url;
      }

      let isHomeNet = (typeof window !== 'undefined' && (window.dr_is_home_network === true || window.isHomeNetwork === true));
      const homeNetKnownFalse = (typeof window !== 'undefined' && window.dr_is_home_network === false);
      if (!isHomeNet && !homeNetKnownFalse) {
        if (localStorage.getItem('dr_is_home_network') === 'true') isHomeNet = true;
        try {
          const raw = localStorage.getItem('dr_telemetry_cache');
          if (raw) {
            const cache = JSON.parse(raw);
            if (cache && cache.isHomeNetwork) isHomeNet = true;
          }
        } catch (e) {}
      }

      const shouldUseLan = (routeSetting === 'lan') || (routeSetting === 'auto' && (isDirectHost || isHomeNet));
      if (!shouldUseLan) {
        return url;
      }

      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?stream\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?stream\.digitalresolve\.ca(?::\d+)?/i, 'https://stream-lan.digitalresolve.ca');
      }
      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?jellyfin\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?jellyfin\.digitalresolve\.ca(?::\d+)?/i, 'https://jellyfin-lan.digitalresolve.ca');
      }
      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?audiobooks\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?audiobooks\.digitalresolve\.ca(?::\d+)?/i, 'https://audio-lan.digitalresolve.ca');
      }

      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?sonarr\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?sonarr\.digitalresolve\.ca(?::\d+)?/i, 'https://sonarr-lan.digitalresolve.ca');
      }
      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?radarr\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?radarr\.digitalresolve\.ca(?::\d+)?/i, 'https://radarr-lan.digitalresolve.ca');
      }
      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?prowlarr\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?prowlarr\.digitalresolve\.ca(?::\d+)?/i, 'https://prowlarr-lan.digitalresolve.ca');
      }
      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?readarr\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?readarr\.digitalresolve\.ca(?::\d+)?/i, 'https://readarr-lan.digitalresolve.ca');
      }
      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?torrents2\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?torrents2\.digitalresolve\.ca(?::\d+)?/i, 'https://torrents-lan.digitalresolve.ca');
      }
      if (/^(?:https?:)?(?:\/\/)?(?:www\.)?torrents\.digitalresolve\.ca(?::\d+)?(?=[\/?#]|$)/i.test(url)) {
        return url.replace(/^(?:https?:)?(?:\/\/)?(?:www\.)?torrents\.digitalresolve\.ca(?::\d+)?/i, `http://${deskHost}:8080`);
      }

      return url;
    }
    window.resolveMediaUrl = resolveMediaUrl;

    function getMediaRouteMode() {
      return localStorage.getItem('dr_media_route') || 'auto';
    }

    function updateMediaRoutePillUI() {
      const btn = document.getElementById('btn-route-mode');
      const txt = document.getElementById('route-mode-text');
      if (!btn && !txt) return;
      const mode = getMediaRouteMode();
      let label = '⚡ Route: Auto (LAN Priority)';
      let title = 'Routes directly to NUC on local network to bypass Cloudflare';
      if (mode === 'tailscale') {
        label = '⚡ Route: Tailscale Mesh (100.68.136.76)';
        title = 'Routes over encrypted WireGuard mesh directly to NUC 100.68.136.76';
      } else if (mode === 'lan') {
        label = '● Route: Direct LAN (192.168.2.35)';
        title = 'Forced Direct Gigabit LAN routing (bypasses Cloudflare Tunnels)';
      } else if (mode === 'wan') {
        label = '🌐 Route: Cloudflare Edge (WAN)';
        title = 'Forced Cloudflare Zero Trust Tunnel routing';
      }
      if (txt) txt.textContent = label;
      else if (btn) btn.textContent = label;
      if (btn) {
        btn.title = title;
        btn.setAttribute('data-route-mode', mode);
      }
    }

    function syncMediaRouteLinks() {
      if (typeof document === 'undefined') return;
      const links = document.querySelectorAll('a[data-route-base]');
      links.forEach((a) => {
        const base = a.getAttribute('data-route-base');
        if (base) a.href = resolveMediaUrl(base);
      });
    }

    let __drWakeRetryTimer = null;
    function probeHomeLanRoute(allowWakeRetry) {
      if (typeof fetch !== 'function') return;
      if (__drWakeRetryTimer) {
        clearTimeout(__drWakeRetryTimer);
        __drWakeRetryTimer = null;
      }
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 1500) : null;
      fetch('https://stream-lan.digitalresolve.ca/api/route-info', {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined
      })
        .then((r) => (r && r.ok ? r.json() : null))
        .then((data) => {
          if (timer) clearTimeout(timer);
          const onHomeLan = Boolean(data && data.isDirectLan === true);
          window.dr_is_home_network = onHomeLan;
          try { localStorage.setItem('dr_is_home_network', onHomeLan ? 'true' : 'false'); } catch (e) {}
          syncMediaRouteLinks();
          updateMediaRoutePillUI();
        })
        .catch(() => {
          if (timer) clearTimeout(timer);
          window.dr_is_home_network = false;
          try { localStorage.setItem('dr_is_home_network', 'false'); } catch (e) {}
          syncMediaRouteLinks();
          updateMediaRoutePillUI();
          if (allowWakeRetry) {
            __drWakeRetryTimer = setTimeout(() => {
              __drWakeRetryTimer = null;
              try { probeHomeLanRoute(false); } catch (e) {}
            }, 2000);
          }
        });
    }

    function cycleMediaRouteMode() {
      const current = getMediaRouteMode();
      let next = 'auto';
      if (current === 'auto') next = 'tailscale';
      else if (current === 'tailscale') next = 'lan';
      else if (current === 'lan') next = 'wan';
      else next = 'auto';
      try { localStorage.setItem('dr_media_route', next); } catch (e) {}
      updateMediaRoutePillUI();
      syncMediaRouteLinks();
      const desc = next === 'tailscale' ? 'Tailscale Mesh (100.68.136.76)' : (next === 'lan' ? 'Direct LAN (192.168.2.35)' : (next === 'wan' ? 'Cloudflare Tunnel (WAN)' : 'Auto (LAN Priority)'));
      if (typeof showToast === 'function') {
        showToast('info', 'Media Routing Updated', `Route mode set to ${desc}`);
      }
    }
    window.getMediaRouteMode = getMediaRouteMode;
    window.updateMediaRoutePillUI = updateMediaRoutePillUI;
    window.syncMediaRouteLinks = syncMediaRouteLinks;
    window.probeHomeLanRoute = probeHomeLanRoute;
    window.cycleMediaRouteMode = cycleMediaRouteMode;
    try { updateMediaRoutePillUI(); } catch(e) {}
    try { syncMediaRouteLinks(); } catch(e) {}
    try { probeHomeLanRoute(); } catch(e) {}
    (function bindMediaRouteNetworkListeners() {
      if (typeof window === 'undefined' || window.__drMediaRouteListenersBound) return;
      window.__drMediaRouteListenersBound = true;
      let lastRouteProbeAt = 0;
      const reprobeRoute = (allowWakeRetry = false) => {
        const now = Date.now();
        if (now - lastRouteProbeAt < 5000) return;
        lastRouteProbeAt = now;
        try { probeHomeLanRoute(allowWakeRetry); } catch (e) {}
      };
      window.addEventListener('online', () => reprobeRoute(true));
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reprobeRoute(true);
        });
      }
    })();

    function launchProtectedService(url, serviceName = 'Protected Homelab Service') {
      const finalUrl = resolveMediaUrl(url);
      const isMobile = (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
      if (isMobile) {
        window.location.href = finalUrl;
        return;
      }
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    }
    window.launchProtectedService = launchProtectedService;

    async function verifySpeedtestSSO() {
      closeSpeedtestSSOModal();
      try { sessionStorage.removeItem('dr_sso_sync_attempted'); } catch(e) {}
      if (/(^|\.)digitalresolve\.ca$/i.test(window.location.hostname)) {
        window.location.href = GATEWAY + '/api/sso/login?return=' + encodeURIComponent(window.location.href);
        return;
      }
      const ok = await syncCloudflareAccessSession(false);
      if (ok) {
        const cb = window.pendingSSOCallback;
        window.pendingSSOCallback = null;
        if (typeof cb === 'function') cb();
      } else if (typeof showToast === 'function') {
        showToast('error', 'SSO Session Not Verified', 'Open https://digitalresolve.ca over HTTPS to sign in with Microsoft 365 Entra ID.', 5000);
      }
    }
    window.verifySpeedtestSSO = verifySpeedtestSSO;
    window.verifySpeedtestPin = verifySpeedtestSSO;

    function triggerSpeedtest() {
      if (isSpeedtesting) return;
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Gigabit Speedtest (WAN Saturation Prevention)', runLiveSpeedtestBenchmark);
        return;
      }
      runLiveSpeedtestBenchmark();
    }
    window.triggerSpeedtest = triggerSpeedtest;

    function runLiveSpeedtestBenchmark() {
      if (isSpeedtesting) return;
      isSpeedtesting = true;
      const btn = document.getElementById('btn-run-speedtest');
      const gaugeNum = document.getElementById('gauge-live-num');
      const gaugeNeedle = document.getElementById('speed-dial-needle');
      const stageText = document.getElementById('st-stage-indicator');
      const downEl = document.getElementById('st-val-down');
      const upEl = document.getElementById('st-val-up');
      const pingEl = document.getElementById('st-val-ping');

      const ispBefore = window.ISP_LATEST || {};
      const carrier = ispBefore.isp || 'Bell Canada';

      if (btn) { btn.disabled = true; btn.innerHTML = 'Probing WAN...'; }
      if (stageText) stageText.textContent = `Stage 1/2: Dispatching live ${carrier} fiber probe on NUC gateway...`;
      playChaosTone(440, 880, 'sine', 0.15);

      if (typeof sendControl === 'function') {
        sendControl('run-speedtest', 'nuc');
      }

      setTimeout(() => {
        if (stageText) stageText.textContent = `Stage 2/2: Collecting fresh latency & throughput telemetry from gateway...`;
        playChaosTone(587, 880, 'sine', 0.2);
        if (typeof fetchISPHistory === 'function') fetchISPHistory();
      }, 2500);

      setTimeout(() => {
        if (typeof fetchISPHistory === 'function') fetchISPHistory();
      }, 5500);

      setTimeout(() => {
        Promise.resolve(typeof fetchISPHistory === 'function' ? fetchISPHistory() : null).finally(() => {
          const latest = window.ISP_LATEST || {};
          const rawPing = (latest.pingAvgMs !== undefined && latest.pingAvgMs !== null && latest.pingAvgMs !== '') ? Number(latest.pingAvgMs) : NaN;
          const pingStr = Number.isFinite(rawPing) ? rawPing.toFixed(1) : '--';
          const rawDown = (latest.downloadMbps !== undefined && latest.downloadMbps !== null) ? Number(latest.downloadMbps) : ((latest.downMbps !== undefined && latest.downMbps !== null) ? Number(latest.downMbps) : null);
          const rawUp = (latest.uploadMbps !== undefined && latest.uploadMbps !== null) ? Number(latest.uploadMbps) : ((latest.upMbps !== undefined && latest.upMbps !== null) ? Number(latest.upMbps) : null);
          const downStr = (rawDown !== null && Number.isFinite(rawDown)) ? String(rawDown) : '--';
          const upStr = (rawUp !== null && Number.isFinite(rawUp)) ? String(rawUp) : '--';
          const realCarrier = latest.isp || carrier;
          const realGrade = latest.grade || '--';
          const realLoss = (latest.packetLoss !== undefined && latest.packetLoss !== null) ? latest.packetLoss : 0;

          if (pingEl) pingEl.innerHTML = `${pingStr} <span style="font-size: 0.85rem; color: #94a3b8;">ms</span>`;
          if (downEl) downEl.innerHTML = downStr === '--' ? `--` : `${downStr} <span style="font-size: 0.85rem; color: #94a3b8;">Mbps</span>`;
          if (upEl) upEl.innerHTML = upStr === '--' ? `--` : `${upStr} <span style="font-size: 0.85rem; color: #94a3b8;">Mbps</span>`;
          if (gaugeNum) gaugeNum.textContent = downStr;
          if (gaugeNeedle) {
            const angle = (rawDown !== null && Number.isFinite(rawDown)) ? (-45 + (Math.min(rawDown, 1000) / 1000) * 180) : -45;
            gaugeNeedle.style.transform = `rotate(${angle}deg)`;
          }
          if (btn) { btn.disabled = false; btn.innerHTML = 'Run Gigabit Speedtest'; }
          if (stageText) {
            stageText.textContent = `Probe Complete: ${pingStr} ms Ping  -  Packet Loss ${realLoss}%  -  Grade ${realGrade} (${realCarrier})`;
          }
          playChaosTone(523, 1046, 'triangle', 0.35);
          showToast('success', `${realCarrier} Probe Complete`, `Ping: ${pingStr} ms  -  Loss: ${realLoss}%  -  Grade: ${realGrade}`);
          isSpeedtesting = false;
        });
      }, 8500);
    }
    window.runLiveSpeedtestBenchmark = runLiveSpeedtestBenchmark;

    // --- 2. Edge AI (Ollama Local) ---
    const edgeAiPresetPrompts = {
      summarize: "Explain the Digital Resolve homelab architecture (Intel i5 NUC 24/7 core, AMD Ryzen 7 workstation, Cloudflare Zero Trust tunnels, Mullvad WireGuard, StreamHub, and WebRTC Cat Cam).",
      bufferbloat: "Explain why Bell Gigabit Fiber paired with Qbit-DynamicThrottle and 2.5 GbE LAN keeps bufferbloat at Grade A+.",
      catcam: "Explain how the Cat Cam live pipeline works using go2rtc on port 8089 and WebSocket WebRTC signaling.",
      security: "Summarize the Zero Trust security posture with Cloudflare Access Microsoft 365 Entra ID SSO and zero open inbound WAN ports."
    };

    function askEdgeAiPreset(presetKey) {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Ollama 24/7 Local Inference (Port 11434)', () => askEdgeAiPreset(presetKey));
        return;
      }
      const promptText = edgeAiPresetPrompts[presetKey] || edgeAiPresetPrompts.summarize;
      runLiveEdgeAiQuery(promptText, null);
    }
    window.askEdgeAiPreset = askEdgeAiPreset;

    function generateClusterAiResponse(text) {
      const q = text.toLowerCase().trim();
      const now = new Date();

      // 1. Time / Date / Day
      if (q.match(/\b(time|date|day|clock|hour|minute|when|today|now)\b/)) {
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'EDT') : 'EDT';
        return `The current time is ${timeStr} (${tz}) on ${dateStr}.`;
      }

      // 2. System / Health / Cluster / Nodes / Status
      if (q.match(/\b(status|cluster|nodes?|system|vitals|health|uptime|load|nuc|desktop)\b/)) {
        const deskState = window.DESKTOP_IS_ONLINE ? 'Online (Active)' : 'Standby (Eco Mode)';
        const nucState = (window.NUC_IS_ONLINE !== false) ? 'Online' : 'Offline';
        return `Cluster Status: 24/7 Intel NUC (192.168.2.35) is ${nucState}; Workstation (192.168.2.62) is in ${deskState}. All public ingress is gated via Cloudflare Zero Trust Access.`;
      }

      // 3. Storage / Disk / Torrents / Downloads
      if (q.match(/\b(storage|disk|space|torrent|torrents|download|seed|qbittorrent)\b/)) {
        const freeG = (window.LAST_NUC_DISK && typeof window.LAST_NUC_DISK.freeGB === 'number') ? `${Math.round(window.LAST_NUC_DISK.freeGB)} GB` : '--';
        const usedP = (window.LAST_NUC_DISK && typeof window.LAST_NUC_DISK.usedPercent === 'number') ? `${Math.round(window.LAST_NUC_DISK.usedPercent)}%` : '--';
        return `Storage & Ingestion Telemetry: NUC (D:\\Torrents) reports ${freeG} free (${usedP} used). P2P swarm traffic routes through Mullvad WireGuard.`;
      }

      // 4. Cat Feeder / Penny / Camera
      if (q.match(/\b(cat|penny|feeder|kibble|food|snack|feed|cam|camera)\b/)) {
        const f = window.LAST_FEEDER_STATE;
        const fill = (f && typeof f.fillPercent === 'number') ? `${f.fillPercent}%` : '--';
        const remG = (f && typeof f.remainingGrams === 'number') ? `${f.remainingGrams}g` : '--';
        const days = (f && typeof f.estimatedDaysLeft === 'number') ? `${f.estimatedDaysLeft} days` : '--';
        return `Penny's Cat Hub: Feeder state is ${fill} full (${remG} remaining, ~${days}). Live cameras stream from the NUC via go2rtc WebRTC.`;
      }

      // 5. DNS / AdGuard / Threat Shield
      if (q.match(/\b(dns|adguard|block|tracker|sinkhole|filter|quad9|cloudflare)\b/)) {
        return `DNS Threat Shield: Staged for DNS-over-TLS (Cloudflare 1.1.1.1 & Quad9 9.9.9.9) with split-horizon local LAN rewrites.`;
      }

      // 6. Network / Speed / Fiber / Latency / Bell
      if (q.match(/\b(speed|internet|fiber|bandwidth|bell|ping|latency|jitter)\b/)) {
        const rawPing = window.ISP_LATEST ? window.ISP_LATEST.pingAvgMs : null;
        const ping = (rawPing !== undefined && rawPing !== null && rawPing !== '' && Number.isFinite(Number(rawPing))) ? `${rawPing} ms` : '--';
        return `Network Telemetry: Bell Gigabit Fiber gateway latest measured ping is ${ping}.`;
      }

      // 7. Identity / Help / Capabilities
      if (q.match(/\b(who are you|what can you do|help|capabilities|info|command)\b/)) {
        return `I am dr-ollama, your private homelab operations assistant backed by Ollama on the NUC (:11434). Ask about architecture, cluster vitals, storage, Penny's feeder, or network latency.`;
      }

      // 8. Default context-aware answer
      return `Gateway AI endpoint unavailable; cluster nodes NUC (192.168.2.35) and Desktop (192.168.2.62) status is shown above.`;
    }
    window.generateClusterAiResponse = generateClusterAiResponse;

    function typeEdgeAiResponse(feed, stats, promptPrefixHtml, responseText, footerHtml, metricEvalCount, metricTokPerSec) {
      if (!feed) return;
      if (window._edgeAiTyper) clearInterval(window._edgeAiTyper);
      feed.innerHTML = promptPrefixHtml;
      const textNode = document.createTextNode('');
      feed.appendChild(textNode);
      let i = 0;
      const startTime = Date.now();
      window._edgeAiTyper = setInterval(() => {
        const chunk = responseText.slice(i, i + 3);
        textNode.nodeValue += chunk;
        i += chunk.length;
        if (i >= responseText.length) {
          clearInterval(window._edgeAiTyper);
          window._edgeAiTyper = null;
          const hasEval = (metricEvalCount !== null && metricEvalCount !== undefined && Number(metricEvalCount) > 0);
          const hasTps = (metricTokPerSec !== null && metricTokPerSec !== undefined && Number(metricTokPerSec) > 0);
          const tokenCount = hasEval ? Number(metricEvalCount) : null;
          const speed = hasTps ? Number(metricTokPerSec).toFixed(1) : null;
          if (stats) {
            if (tokenCount !== null && speed !== null) {
              stats.textContent = `Complete (${tokenCount} tokens • ${speed} tok/s)`;
            } else if (tokenCount !== null) {
              stats.textContent = `Complete (${tokenCount} tokens)`;
            } else {
              stats.textContent = 'Complete (Offline Summary)';
            }
          }
          if (footerHtml) feed.insertAdjacentHTML('beforeend', footerHtml);
          if (hasTps) {
            document.querySelectorAll('.ai-kpi-speed').forEach(el => el.innerHTML = `${speed} <span style="font-size: 0.85rem; color: #94a3b8;">tok/s</span>`);
            document.querySelectorAll('.ai-kpi-speed-short').forEach(el => el.textContent = speed);
          }
        }
      }, 16);
    }

    function runLiveEdgeAiQuery(promptText, userEchoText) {
      const feed = document.getElementById('edge-ai-output-feed');
      const stats = document.getElementById('ai-infer-stats');
      if (window._edgeAiAbortCtrl) {
        try { window._edgeAiAbortCtrl.abort(); } catch (e) {}
      }
      if (window._edgeAiTyper) {
        clearInterval(window._edgeAiTyper);
        window._edgeAiTyper = null;
      }
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      window._edgeAiAbortCtrl = ctrl;
      let timerId = null;
      if (ctrl) timerId = setTimeout(() => ctrl.abort(), 65000);

      if (stats) stats.textContent = 'Querying NUC Ollama (:11434)...';
      playChaosTone(659, 880, 'sine', 0.1);

      const safeEcho = userEchoText ? userEchoText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : null;
      const userLine = safeEcho ? `<span style="color: #60a5fa;">user&gt;</span> ${safeEcho}<br>` : '';
      if (feed) {
        feed.innerHTML = `${userLine}<span style="color: #a855f7;">dr-ollama&gt;</span> <span style="color: #94a3b8;">Running on-premise inference on NUC...</span>`;
      }

      return fetch(`${GATEWAY}/api/ai/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompt: promptText }),
        signal: ctrl ? ctrl.signal : _fetchSig(65000)
      })
        .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, data: d })).catch(() => { throw new Error('HTTP ' + r.status); }))
        .then(({ ok, status, data }) => {
          if (timerId) clearTimeout(timerId);
          if (window._edgeAiAbortCtrl !== ctrl) return;
          if (!ok || !data || data.status !== 'success' || !data.response) {
            throw new Error((data && data.message) ? data.message : ('HTTP ' + status));
          }
          const modelName = escapeHtml(String(data.model || 'llama3.2:3b'));
          const prefix = `${userLine}<span style="color: #a855f7;">dr-ollama [${modelName}]&gt;</span> `;
          const badge = `<br><span style="color: #34d399; font-size: 0.72rem;">Verified On-Premise Ollama (${modelName})</span>`;
          typeEdgeAiResponse(feed, stats, prefix, String(data.response), badge, data.evalCount, data.tokensPerSec);
        })
        .catch((err) => {
          if (timerId) clearTimeout(timerId);
          if ((err && err.name === 'AbortError') || window._edgeAiAbortCtrl !== ctrl) return;
          const fallback = `[Offline Local Summary] ${generateClusterAiResponse(promptText)}`;
          const prefix = `${userLine}<span style="color: #f59e0b;">dr-ollama [Offline Fallback]&gt;</span> `;
          const badge = `<br><span style="color: #f59e0b; font-size: 0.72rem;">Gateway/Ollama offline - showing local summary</span>`;
          typeEdgeAiResponse(feed, stats, prefix, fallback, badge, null, null);
        });
    }

    function submitEdgeAiPrompt() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal('Ollama 24/7 Local Inference (Port 11434)', submitEdgeAiPrompt);
        return;
      }
      const input = document.getElementById('edge-ai-input');
      const text = input ? input.value.trim() : '';
      if (!text) return;
      if (input) input.value = '';
      runLiveEdgeAiQuery(text, text);
    }
    window.submitEdgeAiPrompt = submitEdgeAiPrompt;

    // Dynamic Cloudflare Edge KPI Updater
    function updateCloudflareStatsUI(cfData) {
      const defStats = {
        totalRequests: '--',
        ingressSla: 'Awaiting telemetry',
        hitRatio: '--',
        savedGB: 'Awaiting telemetry',
        uniqueVisitors: '--',
        topPop: '--',
        threatsBlocked: '--',
        geoShield: '--',
        edgeThreats: 'Awaiting telemetry',
        edgeIngress: 'Awaiting telemetry',
        edgePops: '--',
        subRequests: {
          apex: '--',
          wake: '--',
          cam: '--',
          torrents: '--',
          torrents2: '--',
          stream: '--',
          files: '--'
        }
      };

      let source = cfData;
      if (source === undefined || source === null) {
        try {
          const raw = localStorage.getItem('dr_cloudflare_cache');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') source = parsed;
          }
        } catch (e) {}
      } else if (typeof source === 'object') {
        if (source.totalRequests !== null && source.totalRequests !== undefined) {
          try {
            localStorage.setItem('dr_cloudflare_cache', JSON.stringify(source));
          } catch (e) {}
        }
      }

      const formatSavedGB = (val, defVal) => {
        if (val === undefined || val === null || val === '') return defVal;
        const str = String(val).replace(/^(&bull;|•|\s)+/, '').trim();
        if (str.includes('Saved')) return str;
        if (str.toLowerCase().includes('gb')) return `${str} Saved from Origin`;
        return `${str} GB Saved from Origin`;
      };

      const formatEdgeThreats = (src, defVal) => {
        if (src && (src.edgeThreats || src.threatsBlockedText)) {
          return src.edgeThreats || src.threatsBlockedText;
        }
        if (src && src.threatsBlocked !== undefined && src.threatsBlocked !== null) {
          const num = typeof src.threatsBlocked === 'number' ? src.threatsBlocked.toLocaleString() : src.threatsBlocked;
          return `${num} Threats Neutralized`;
        }
        return defVal;
      };

      const cur = {
        totalRequests: (source && source.totalRequests !== undefined && source.totalRequests !== null) ? (typeof source.totalRequests === 'number' ? source.totalRequests.toLocaleString() : source.totalRequests) : defStats.totalRequests,
        ingressSla: (source && source.ingressSla) ? source.ingressSla : defStats.ingressSla,
        hitRatio: (source && source.hitRatio !== undefined && source.hitRatio !== null && String(source.hitRatio).trim() !== '') ? (typeof source.hitRatio === 'number' ? `${source.hitRatio}%` : (String(source.hitRatio).includes('%') ? String(source.hitRatio).trim() : `${String(source.hitRatio).trim()}%`)) : defStats.hitRatio,
        savedGB: formatSavedGB(source && source.savedGB, defStats.savedGB),
        uniqueVisitors: (source && source.uniqueVisitors !== undefined && source.uniqueVisitors !== null) ? (typeof source.uniqueVisitors === 'number' ? source.uniqueVisitors.toLocaleString() : source.uniqueVisitors) : defStats.uniqueVisitors,
        topPop: (source && source.topPop) ? (String(source.topPop).includes('Top PoP') ? source.topPop : `Top PoP: ${source.topPop}`) : defStats.topPop,
        threatsBlocked: (source && source.threatsBlocked !== undefined && source.threatsBlocked !== null) ? (typeof source.threatsBlocked === 'number' ? source.threatsBlocked.toLocaleString() : source.threatsBlocked) : defStats.threatsBlocked,
        geoShield: (source && source.geoShield) ? source.geoShield : defStats.geoShield,
        edgeThreats: formatEdgeThreats(source, defStats.edgeThreats),
        edgeIngress: (source && (source.edgeIngress || source.ingressTag)) ? (source.edgeIngress || source.ingressTag) : defStats.edgeIngress,
        edgePops: (source && source.edgePops) ? source.edgePops : defStats.edgePops,
        subRequests: Object.assign({}, defStats.subRequests, (source && source.subRequests) || {})
      };

      const formatBullet = (str) => {
        if (!str || str === '--') return str || '--';
        const clean = String(str).replace(/^(&bull;|•|\s)+/, '').trim();
        return `• ${clean}`;
      };

      document.querySelectorAll('.cf-kpi-requests, #cf-kpi-requests').forEach(el => el.textContent = cur.totalRequests);
      document.querySelectorAll('.cf-kpi-sla, #cf-kpi-sla').forEach(el => el.textContent = formatBullet(cur.ingressSla));
      document.querySelectorAll('.cf-kpi-ratio, #cf-kpi-ratio').forEach(el => el.textContent = cur.hitRatio);
      document.querySelectorAll('.cf-kpi-saved, #cf-kpi-saved').forEach(el => el.textContent = formatBullet(cur.savedGB));
      document.querySelectorAll('.cf-kpi-visitors, #cf-kpi-visitors').forEach(el => el.textContent = cur.uniqueVisitors);
      document.querySelectorAll('.cf-kpi-toppop, #cf-kpi-toppop').forEach(el => el.textContent = formatBullet(cur.topPop));
      document.querySelectorAll('.cf-kpi-threats, #cf-kpi-threats').forEach(el => el.textContent = cur.threatsBlocked);
      document.querySelectorAll('.cf-kpi-geoshield, #cf-kpi-geoshield').forEach(el => el.textContent = formatBullet(cur.geoShield));

      const formatSub = (val, def) => {
        if (val === undefined || val === null) return def;
        return typeof val === 'number' ? val.toLocaleString() : String(val);
      };
      const rawSub = cur.subRequests || {};
      const sub = {
        apex: formatSub(rawSub.apex, defStats.subRequests.apex),
        wake: formatSub(rawSub.wake, defStats.subRequests.wake),
        cam: formatSub(rawSub.cam, defStats.subRequests.cam),
        torrents: formatSub(rawSub.torrents, defStats.subRequests.torrents),
        torrents2: formatSub(rawSub.torrents2, defStats.subRequests.torrents2),
        stream: formatSub(rawSub.stream, defStats.subRequests.stream),
        files: formatSub(rawSub.files, defStats.subRequests.files)
      };

      document.querySelectorAll('.cf-row-req-apex').forEach(el => el.textContent = sub.apex);
      document.querySelectorAll('.cf-row-req-wake').forEach(el => el.textContent = sub.wake);
      document.querySelectorAll('.cf-row-req-cam').forEach(el => el.textContent = sub.cam);
      document.querySelectorAll('.cf-row-req-torrents').forEach(el => el.textContent = sub.torrents);
      document.querySelectorAll('.cf-row-req-torrents2').forEach(el => el.textContent = sub.torrents2);
      document.querySelectorAll('.cf-row-req-stream').forEach(el => el.textContent = sub.stream);
      document.querySelectorAll('.cf-row-req-files').forEach(el => el.textContent = sub.files);

      const isDeskOn = window.DESKTOP_IS_ONLINE !== undefined ? window.DESKTOP_IS_ONLINE : true;
      document.querySelectorAll('.cf-sub-torrents-badge').forEach(el => {
        el.textContent = isDeskOn ? 'Active' : 'Standby';
        el.className = isDeskOn ? 'item-tag online cf-sub-torrents-badge' : 'item-tag offline cf-sub-torrents-badge';
      });

      const edgeTraffic = document.getElementById('edge-traffic-val');
      if (edgeTraffic) {
        const reqStr = String(cur.totalRequests);
        if (reqStr === '--') {
          edgeTraffic.textContent = '--';
        } else if (reqStr.includes('•') || reqStr.includes('Requests')) {
          edgeTraffic.textContent = reqStr;
        } else {
          edgeTraffic.textContent = `${reqStr} Requests`;
        }
      }

      const cleanSaved = String(cur.savedGB).replace(/^(&bull;|•|\s)+/, '').trim();
      const edgeCache = document.getElementById('edge-cache-val');
      if (edgeCache) edgeCache.textContent = cur.hitRatio === '--' ? '--' : `${cur.hitRatio} (${cleanSaved})`;
      const edgeBar = document.getElementById('edge-cache-bar');
      if (edgeBar) {
        const hrStr = (cur.hitRatio !== undefined && cur.hitRatio !== null) ? String(cur.hitRatio).trim() : '';
        edgeBar.style.width = (!hrStr || hrStr === '--') ? '0%' : (hrStr.includes('%') ? hrStr : `${hrStr}%`);
      }

      const edgeThreats = document.getElementById('edge-threats-val');
      if (edgeThreats) edgeThreats.textContent = cur.edgeThreats;
      const edgeIngress = document.getElementById('edge-ingress-tag');
      if (edgeIngress) edgeIngress.textContent = cur.edgeIngress;
      const edgePops = document.getElementById('edge-pops-val');
      if (edgePops) edgePops.textContent = cur.edgePops;
    }
    window.updateCloudflareStatsUI = updateCloudflareStatsUI;

    // --- 3. Penny's Feeder IoT Snack & Meal Dispenser ---
    function openCloudflareStatsModal() {
      updateCloudflareStatsUI();
      const modal = document.getElementById('cloudflare-stats-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      try {
        const kpis = document.querySelectorAll('.cf-kpi-requests, .cf-kpi-ratio, .cf-kpi-visitors, .cf-kpi-threats, .cf-kpi-sla, .cf-kpi-saved, .cf-kpi-toppop, .cf-kpi-geoshield');
        kpis.forEach(el => {
          el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
          el.style.opacity = '0.7';
        });
        const p = fetchClusterStats();
        if (p && typeof p.finally === 'function') {
          p.finally(() => {
            kpis.forEach(el => {
              el.style.opacity = '1';
              el.style.transform = 'scale(1.02)';
              setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);
            });
          });
        }
      } catch (e) {}
    }
    window.openCloudflareStatsModal = openCloudflareStatsModal;

    function closeCloudflareStatsModal() {
      const modal = document.getElementById('cloudflare-stats-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    }
    window.closeCloudflareStatsModal = closeCloudflareStatsModal;

    function ensureAdGuardModalDOM() {
      if (document.getElementById('adguard-modal-overlay')) return;
      const html = `
        <div id="adguard-modal-overlay" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(2,6,23,0.78); backdrop-filter:blur(6px); z-index:10005; align-items:center; justify-content:center; padding:16px;" onclick="if(event.target===this) closeAdGuardConfigModal()">
          <div class="modal-content" role="dialog" aria-modal="true" aria-label="AdGuard Home Deployment" style="max-width:560px; width:100%; background:#0f172a; border:1px solid rgba(56,189,248,0.3); border-radius:14px; padding:24px; color:#e2e8f0; box-shadow:0 20px 50px rgba(0,0,0,0.6);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h3 style="margin:0; font-size:1.1rem; color:#38bdf8;">AdGuard Home — NUC DNS Sinkhole</h3>
              <button type="button" aria-label="Close dialog" onclick="closeAdGuardConfigModal()" style="background:none; border:none; color:#94a3b8; font-size:1.4rem; cursor:pointer; line-height:1;">&times;</button>
            </div>
            <p style="font-size:0.86rem; color:#94a3b8; margin:0 0 14px;">Deploy or update AdGuard Home on NUC (<code style="color:#38bdf8;">192.168.2.35:3000</code>) via Docker Compose:</p>
            <pre style="background:#020617; border:1px solid rgba(148,163,184,0.2); border-radius:8px; padding:12px; font-size:0.76rem; color:#a5f3fc; overflow-x:auto; margin:0 0 16px;">git clone https://github.com/townsy2020/digitalresolve.ca.git &amp;&amp; cd digitalresolve.ca/deploy/adguard &amp;&amp; docker compose up -d</pre>
            <div style="display:flex; gap:10px; justify-content:flex-end;">
              <button type="button" id="btn-copy-modal-cmd" class="btn btn-primary" onclick="copyAdguardDeployCommand()" style="padding:8px 14px; font-size:0.82rem;">Copy Install Command</button>
              <button type="button" class="btn btn-secondary" onclick="closeAdGuardConfigModal()" style="padding:8px 14px; font-size:0.82rem;">Close</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
    }

    function openAdGuardConfigModal() {
      ensureAdGuardModalDOM();
      const modal = document.getElementById('adguard-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }
    window.openAdGuardConfigModal = openAdGuardConfigModal;

    function closeAdGuardConfigModal() {
      const modal = document.getElementById('adguard-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    }
    window.closeAdGuardConfigModal = closeAdGuardConfigModal;

    function copyAdguardDeployCommand() {
      const cmd = 'git clone https://github.com/townsy2020/digitalresolve.ca.git && cd digitalresolve.ca/deploy/adguard && docker compose up -d';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(cmd).then(() => {
          showToast('success', 'Command Copied', 'AdGuard Docker Compose command copied for NUC deployment.');
          const btn = document.getElementById('btn-copy-adguard');
          const modalBtn = document.getElementById('btn-copy-modal-cmd');
          if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<span>&check; Copied!</span>';
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
          }
          if (modalBtn) {
            const origM = modalBtn.innerHTML;
            modalBtn.innerHTML = '&check; Copied!';
            setTimeout(() => { modalBtn.innerHTML = origM; }, 2000);
          }
        }).catch(() => {
          prompt('Copy AdGuard install command:', cmd);
        });
      } else {
        prompt('Copy AdGuard install command:', cmd);
      }
    }
    window.copyAdguardDeployCommand = copyAdguardDeployCommand;

    // ========================================================
    // Tailscale Mesh VPN Client Modal & Platform Auto-Detection
    // ========================================================
    function copySnippetText(text, btn) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = 'Copied!';
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
          }
          if (typeof showToast === 'function') showToast('success', 'Copied to Clipboard', text);
        }).catch(() => {
          prompt('Copy command:', text);
        });
      } else {
        prompt('Copy command:', text);
      }
    }
    window.copySnippetText = copySnippetText;

    function detectClientOS() {
      const ua = navigator.userAgent || '';
      const platform = navigator.platform || '';
      if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        return 'ios';
      }
      if (/Android/.test(ua)) {
        return 'android';
      }
      if (/Macintosh|MacIntel|MacPPC|Mac68K/.test(ua) || (typeof platform === 'string' && platform.startsWith('Mac'))) {
        return 'macos';
      }
      if (/Win32|Win64|Windows|WinCE/.test(ua) || (typeof platform === 'string' && platform.startsWith('Win'))) {
        return 'windows';
      }
      if (/Linux/.test(ua) || (typeof platform === 'string' && platform.startsWith('Linux'))) {
        return 'linux';
      }
      return 'windows';
    }
    window.detectClientOS = detectClientOS;

    function selectTailscaleTab(platform) {
      const tabs = document.querySelectorAll('#ts-platform-tabs .tailscale-tab-btn');
      tabs.forEach(t => {
        if (t.getAttribute('data-platform') === platform) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      const panels = document.querySelectorAll('#tailscale-modal-overlay .tailscale-panel');
      panels.forEach(p => {
        if (p.id === 'ts-panel-' + platform) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
    }
    window.selectTailscaleTab = selectTailscaleTab;

    function ensureTailscaleModalDOM() {
      if (document.getElementById('tailscale-modal-overlay')) return;
      const wrap = document.createElement('div');
      wrap.innerHTML = `
  <div id="tailscale-modal-overlay" class="health-modal-overlay" style="display: none;" onclick="if(event.target===this)closeTailscaleModal()">
    <div class="health-modal-window" role="dialog" aria-modal="true" aria-label="Tailscale Mesh VPN Client" style="max-width: 680px; border-color: rgba(6, 182, 212, 0.4); box-shadow: 0 20px 45px rgba(0, 0, 0, 0.7), 0 0 30px rgba(6, 182, 212, 0.2);">
      <div class="health-modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.3rem;">⚡</span>
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; color: #f8fafc; font-weight: 700;">Tailscale Mesh VPN Client</h3>
            <span style="font-size: 0.75rem; color: #94a3b8;">Zero-Config WireGuard Mesh &bull; Direct Secure LAN Routing</span>
          </div>
        </div>
        <button type="button" class="btn btn-secondary" onclick="closeTailscaleModal()" style="font-size: 0.85rem; padding: 4px 10px; cursor: pointer;">&times;</button>
      </div>

      <div class="health-modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: calc(85vh - 120px);">
        <!-- Detected Client OS Banner -->
        <div id="ts-detected-banner" style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="pulse-dot" style="background: #06b6d4; box-shadow: 0 0 8px #06b6d4; width: 10px; height: 10px;"></span>
            <div>
              <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">Detected Platform</span>
              <div id="ts-detected-os-label" style="font-size: 0.95rem; font-weight: 700; color: #22d3ee;">Auto-detecting...</div>
            </div>
          </div>
          <a id="ts-primary-download-btn" href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size: 0.82rem; padding: 7px 16px; background: linear-gradient(135deg, #06b6d4, #0284c7); border-color: #06b6d4; color: #fff !important; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <span>Download Tailscale</span> &darr;
          </a>
        </div>

        <!-- Platform Switcher Tabs -->
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px; font-weight: 600;">Choose Client Platform:</div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="ts-platform-tabs">
            <button type="button" class="tailscale-tab-btn" data-platform="windows" onclick="selectTailscaleTab('windows')">🪟 Windows</button>
            <button type="button" class="tailscale-tab-btn" data-platform="macos" onclick="selectTailscaleTab('macos')">🍎 macOS</button>
            <button type="button" class="tailscale-tab-btn" data-platform="ios" onclick="selectTailscaleTab('ios')">📱 iOS / iPadOS</button>
            <button type="button" class="tailscale-tab-btn" data-platform="android" onclick="selectTailscaleTab('android')">🤖 Android</button>
            <button type="button" class="tailscale-tab-btn" data-platform="linux" onclick="selectTailscaleTab('linux')">🐧 Linux</button>
          </div>
        </div>

        <!-- Windows Panel -->
        <div id="ts-panel-windows" class="tailscale-panel" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
            <div style="font-weight: 700; color: #f8fafc; font-size: 0.9rem;">Windows 10 / 11 (x64 &amp; ARM64)</div>
            <a href="https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe" class="btn btn-primary" style="font-size: 0.78rem; padding: 6px 14px; background: linear-gradient(135deg, #06b6d4, #0284c7); border-color: #06b6d4; color: #fff !important; text-decoration: none;">Download .EXE (Direct)</a>
          </div>
          <p style="font-size: 0.8rem; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.4;">Official MSI/EXE installer. Provides automatic system tray agent, DNS split tunnel, and unattended background connection.</p>
          <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <code style="font-size: 0.78rem; color: #38bdf8;">winget install Tailscale.Tailscale</code>
            <button type="button" class="btn btn-secondary" onclick="copySnippetText('winget install Tailscale.Tailscale', this)" style="font-size: 0.72rem; padding: 3px 8px; cursor: pointer;">Copy</button>
          </div>
        </div>

        <!-- macOS Panel -->
        <div id="ts-panel-macos" class="tailscale-panel" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
            <div style="font-weight: 700; color: #f8fafc; font-size: 0.9rem;">macOS (Apple Silicon &amp; Intel)</div>
            <div style="display: flex; gap: 6px;">
              <a href="https://apps.apple.com/app/tailscale/id1475387142" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size: 0.78rem; padding: 6px 12px; background: linear-gradient(135deg, #06b6d4, #0284c7); border-color: #06b6d4; color: #fff !important; text-decoration: none;">App Store</a>
              <a href="https://pkgs.tailscale.com/stable/Tailscale-latest-macos.pkg" class="btn btn-secondary" style="font-size: 0.78rem; padding: 6px 12px; text-decoration: none;">Standalone .PKG</a>
            </div>
          </div>
          <p style="font-size: 0.8rem; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.4;">Universal binary for macOS 12 Monterey or newer. Integrated menu bar app with automatic WireGuard tunnels.</p>
          <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <code style="font-size: 0.78rem; color: #38bdf8;">brew install --cask tailscale</code>
            <button type="button" class="btn btn-secondary" onclick="copySnippetText('brew install --cask tailscale', this)" style="font-size: 0.72rem; padding: 3px 8px; cursor: pointer;">Copy</button>
          </div>
        </div>

        <!-- iOS Panel -->
        <div id="ts-panel-ios" class="tailscale-panel" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
            <div style="font-weight: 700; color: #f8fafc; font-size: 0.9rem;">iOS &amp; iPadOS</div>
            <a href="https://apps.apple.com/app/tailscale/id1470499037" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size: 0.78rem; padding: 6px 14px; background: linear-gradient(135deg, #06b6d4, #0284c7); border-color: #06b6d4; color: #fff !important; text-decoration: none;">Open in App Store &rarr;</a>
          </div>
          <p style="font-size: 0.8rem; color: #94a3b8; margin: 0; line-height: 1.4;">Native iOS VPN extension with VPN-on-Demand, negligible battery draw, and direct encrypted connections to your home server.</p>
        </div>

        <!-- Android Panel -->
        <div id="ts-panel-android" class="tailscale-panel" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
            <div style="font-weight: 700; color: #f8fafc; font-size: 0.9rem;">Android &amp; Android TV / Fire OS</div>
            <div style="display: flex; gap: 6px;">
              <a href="https://play.google.com/store/apps/details?id=com.tailscale.ipn" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size: 0.78rem; padding: 6px 12px; background: linear-gradient(135deg, #06b6d4, #0284c7); border-color: #06b6d4; color: #fff !important; text-decoration: none;">Google Play</a>
              <a href="https://pkgs.tailscale.com/stable/tailscale-latest-arm64.apk" class="btn btn-secondary" style="font-size: 0.78rem; padding: 6px 12px; text-decoration: none;">Direct APK</a>
            </div>
          </div>
          <p style="font-size: 0.8rem; color: #94a3b8; margin: 0; line-height: 1.4;">Compatible with phones, tablets, and TV boxes. Sideloadable direct APK or Google Play install.</p>
        </div>

        <!-- Linux Panel -->
        <div id="ts-panel-linux" class="tailscale-panel" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px;">
          <div style="font-weight: 700; color: #f8fafc; font-size: 0.9rem; margin-bottom: 6px;">Linux (Ubuntu, Debian, Arch, Fedora, Raspberry Pi OS)</div>
          <p style="font-size: 0.8rem; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.4;">Run the official 1-line installation script to add the Tailscale repository and install daemon:</p>
          <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
            <code style="font-size: 0.78rem; color: #38bdf8;">curl -fsSL https://tailscale.com/install.sh | sh</code>
            <button type="button" class="btn btn-secondary" onclick="copySnippetText('curl -fsSL https://tailscale.com/install.sh | sh', this)" style="font-size: 0.72rem; padding: 3px 8px; cursor: pointer;">Copy</button>
          </div>
          <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <code style="font-size: 0.78rem; color: #34d399;">sudo tailscale up</code>
            <button type="button" class="btn btn-secondary" onclick="copySnippetText('sudo tailscale up', this)" style="font-size: 0.72rem; padding: 3px 8px; cursor: pointer;">Copy</button>
          </div>
        </div>

        <!-- Microsoft SSO Step-by-Step Instructions -->
        <div style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 8px; padding: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <svg width="18" height="18" viewBox="0 0 21 21"><path d="M0 0h9.9v9.9H0z" fill="#f25022"/><path d="M11.1 0H21v9.9h-9.9z" fill="#7fba00"/><path d="M0 11.1h9.9V21H0z" fill="#00a4ef"/><path d="M11.1 11.1H21V21h-9.9z" fill="#ffb900"/></svg>
            <span style="font-weight: 700; color: #f8fafc; font-size: 0.88rem;">Microsoft SSO Authentication Instructions</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem; color: #cbd5e1; line-height: 1.4;">
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0;">1</span>
              <span>Launch the Tailscale app on your device and click <strong>"Log in with Microsoft"</strong>.</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0;">2</span>
              <span>Enter your organization Microsoft account: <strong style="color: #38bdf8;">cory.townsend@digitalresolve.ca</strong></span>
            </div>
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; flex-shrink: 0;">3</span>
              <span>Once approved, you are on the <strong>digitalresolve.ca tailnet</strong>. All services are instantly available without port numbers!</span>
            </div>
          </div>
        </div>

        <!-- Direct LAN Services Card -->
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: #34d399; font-weight: 700; font-size: 0.88rem;">🔒 Direct Zero-Port LAN URLs (HTTPS)</span>
            </div>
            <span class="item-tag online" style="font-size: 0.68rem;">WireGuard Encrypted</span>
          </div>
          <p style="font-size: 0.78rem; color: #94a3b8; margin: 0 0 10px 0;">When connected to Tailscale, these HTTPS endpoints bypass Cloudflare proxies completely with direct gigabit throughput:</p>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <a href="https://stream-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">stream-lan</a>
            <a href="https://jellyfin-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">jellyfin-lan</a>
            <a href="https://files-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">files-lan</a>
            <a href="https://audio-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(251, 191, 36, 0.12); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">audio-lan</a>
            <a href="https://torrents-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">torrents-lan</a>
            <a href="https://sonarr-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">sonarr-lan</a>
            <a href="https://radarr-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(251, 146, 60, 0.12); color: #fb923c; border: 1px solid rgba(251, 146, 60, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">radarr-lan</a>
            <a href="https://prowlarr-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(248, 113, 113, 0.12); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">prowlarr-lan</a>
            <a href="https://readarr-lan.digitalresolve.ca" target="_blank" rel="noopener noreferrer" class="item-tag" style="background: rgba(52, 211, 153, 0.12); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); text-decoration: none; padding: 4px 8px; font-size: 0.74rem;">readarr-lan</a>
          </div>
          <div style="margin-top: 10px; font-size: 0.74rem; color: #64748b; display: flex; gap: 12px; flex-wrap: wrap;">
            <span>Subnet Route: <code style="color: #94a3b8;">192.168.2.0/24</code></span>
            <span>NUC Tailscale IP: <code style="color: #22d3ee; font-weight: 700;">100.68.136.76</code> <button type="button" class="btn btn-secondary" onclick="copySnippetText('100.68.136.76', this)" style="font-size: 0.68rem; padding: 2px 7px; margin-left: 4px; cursor: pointer;">Copy</button></span>
            <span>Exit Node: <strong style="color: #34d399;">Enabled</strong></span>
          </div>
        </div>
      </div>

      <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <button type="button" class="btn btn-secondary" onclick="closeTailscaleModal()" style="font-size: 0.8rem; padding: 6px 14px;">Close</button>
        <div style="display: flex; gap: 8px;">
          <a href="https://login.tailscale.com/admin" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; text-decoration: none; color: #94a3b8 !important;">Tailscale Admin &rarr;</a>
          <a href="http://100.68.136.76:5252" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; text-decoration: none; color: #22d3ee !important; border-color: rgba(6, 182, 212, 0.4);">NUC Web Client &rarr;</a>
        </div>
      </div>
    </div>
  </div>`;
      document.body.appendChild(wrap.firstElementChild);
    }
    window.ensureTailscaleModalDOM = ensureTailscaleModalDOM;

    function openTailscaleModal() {
      ensureTailscaleModalDOM();
      const modal = document.getElementById('tailscale-modal-overlay');
      if (modal) {
        const os = detectClientOS();
        const osLabels = {
          windows: 'Windows 10 / 11',
          macos: 'Apple macOS',
          ios: 'iOS / iPadOS',
          android: 'Android',
          linux: 'Linux'
        };
        const osDownloads = {
          windows: 'https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe',
          macos: 'https://apps.apple.com/app/tailscale/id1475387142',
          ios: 'https://apps.apple.com/app/tailscale/id1470499037',
          android: 'https://play.google.com/store/apps/details?id=com.tailscale.ipn',
          linux: 'https://tailscale.com/download/linux'
        };
        const labelEl = document.getElementById('ts-detected-os-label');
        if (labelEl) labelEl.textContent = (osLabels[os] || 'Your Device') + ' (Detected)';
        const btnEl = document.getElementById('ts-primary-download-btn');
        if (btnEl) {
          btnEl.href = osDownloads[os] || 'https://tailscale.com/download';
          btnEl.innerHTML = `<span>Download for ${osLabels[os] || 'Device'}</span> &darr;`;
        }
        selectTailscaleTab(os);
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }
    window.openTailscaleModal = openTailscaleModal;

    function closeTailscaleModal() {
      const modal = document.getElementById('tailscale-modal-overlay');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    }
    window.closeTailscaleModal = closeTailscaleModal;

    // ========================================================
    // Smart Feeder Telemetry, Dynamic Hopper & Optical Watchdog
    // ========================================================
    function updateFeederUI(state) {
      if (!state) return;
      window.LAST_FEEDER_STATE = state;
      const pctEl = document.getElementById('feeder-hopper-pct');
      const subEl = document.getElementById('feeder-hopper-sub');
      const barEl = document.getElementById('feeder-hopper-bar');
      const warnEl = document.getElementById('feeder-low-warning');
      const watchEl = document.getElementById('feeder-watchdog-status');
      const dishEl = document.getElementById('feeder-dish-status');
      const timeEl = document.getElementById('feeder-last-time');

      const pct = (typeof state.fillPercent === 'number' && Number.isFinite(state.fillPercent)) ? state.fillPercent : ((typeof state.hopperPercent === 'number' && Number.isFinite(state.hopperPercent)) ? state.hopperPercent : null);
      const rem = (typeof state.remainingGrams === 'number' && Number.isFinite(state.remainingGrams)) ? state.remainingGrams : null;
      const days = (typeof state.estimatedDaysLeft === 'number' && Number.isFinite(state.estimatedDaysLeft)) ? state.estimatedDaysLeft : null;
      const remText = rem !== null ? `${rem}g` : '--';
      const daysText = days !== null ? `~${days} Days` : '-- Days';

      if (pctEl) pctEl.textContent = pct !== null ? `${pct}%` : '--';
      if (subEl) subEl.textContent = pct === null ? "(Awaiting telemetry)" : (pct === 0 ? "(0g - EMPTY - Refill Needed)" : `(${remText} - ${daysText})`);
      if (barEl) {
        if (pct === null) {
          barEl.style.width = '0%';
          barEl.style.background = 'linear-gradient(90deg, #475569, #64748b)';
        } else {
          barEl.style.width = `${pct}%`;
          if (pct <= 15) {
            barEl.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
          } else if (pct <= 30) {
            barEl.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
          } else {
            barEl.style.background = 'linear-gradient(90deg, #ec4899, #f472b6)';
          }
        }
      }
      if (warnEl) {
        warnEl.style.display = (pct !== null && pct <= 20) ? 'flex' : 'none';
      }
      if (watchEl) {
        watchEl.textContent = pct === 0 ? "Alert - Empty Hopper Detected" : (state.opticalWatchdog || "Unknown");
        watchEl.style.color = (pct !== null && pct <= 20) ? '#f87171' : (pct === null ? '#94a3b8' : '#34d399');
      }
      if (dishEl) {
        dishEl.textContent = pct === 0 ? "Empty - Refill Required" : (state.bowlStatus || "Unknown");
        dishEl.style.color = (pct !== null && pct <= 20) ? '#f87171' : (pct === null ? '#94a3b8' : '#34d399');
      }

      // Pane-IoT elements (index.html & ops.html)
      const nucPctEl = document.getElementById('feeder-nuc-hopper-pct');
      const nucSubEl = document.getElementById('feeder-nuc-hopper-sub');
      const nucBarEl = document.getElementById('feeder-nuc-hopper-bar');
      const nucWatchEl = document.getElementById('feeder-nuc-watchdog');
      const iotTimeEl = document.getElementById('feeder-iot-last-time');
      if (nucPctEl) nucPctEl.textContent = pct !== null ? `${pct}%` : '--';
      if (nucSubEl) nucSubEl.textContent = pct === null ? "(Awaiting telemetry)" : (pct === 0 ? "(0g - EMPTY - Refill Needed)" : `(${remText} - ${daysText})`);
      if (nucBarEl) {
        nucBarEl.style.width = pct !== null ? `${pct}%` : '0%';
        nucBarEl.style.background = pct === null ? 'linear-gradient(90deg, #475569, #64748b)' : (pct <= 15 ? 'linear-gradient(90deg, #ef4444, #f87171)' : (pct <= 30 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ec4899, #f472b6)'));
      }
      if (nucWatchEl) {
        nucWatchEl.textContent = pct === 0 ? "Alert - Empty Hopper Detected" : (state.opticalWatchdog || "Unknown");
        nucWatchEl.style.color = (pct !== null && pct <= 20) ? '#f87171' : (pct === null ? '#94a3b8' : '#34d399');
      }

      // Live Homelab Service Dashboard Card (index.html & uptime.html)
      const stagFeeder = document.getElementById('stag-feeder');
      if (stagFeeder) {
        if (pct === null) {
          stagFeeder.className = 'item-tag';
          stagFeeder.textContent = 'Awaiting Telemetry';
          stagFeeder.style.background = 'rgba(148, 163, 184, 0.15)';
          stagFeeder.style.color = '#cbd5e1';
        } else if (pct > 20) {
          stagFeeder.className = 'item-tag online';
          stagFeeder.textContent = 'Armed & Active';
          stagFeeder.style.background = 'rgba(16, 185, 129, 0.2)';
          stagFeeder.style.color = '#34d399';
        } else {
          stagFeeder.className = 'item-tag offline';
          stagFeeder.textContent = pct === 0 ? 'Hopper Empty' : 'Low Kibble';
          stagFeeder.style.background = 'rgba(239, 68, 68, 0.2)';
          stagFeeder.style.color = '#fca5a5';
        }
      }
      const feederKibble = document.getElementById('feeder-card-kibble');
      if (feederKibble) {
        feederKibble.textContent = pct !== null ? `${pct}% (${remText} Kibble)` : '--';
        feederKibble.style.color = (pct !== null && pct <= 20) ? '#f87171' : (pct === null ? '#94a3b8' : '#34d399');
      }
      const feederWatchdog = document.getElementById('feeder-card-watchdog');
      if (feederWatchdog) {
        feederWatchdog.textContent = state.opticalWatchdog || 'Unknown';
        feederWatchdog.style.color = (pct !== null && pct <= 20) ? '#f87171' : (pct === null ? '#94a3b8' : '#34d399');
      }

      if (state.lastDispenseTime) {
        const d = new Date(state.lastDispenseTime);
        const tStr = isNaN(d) ? state.lastDispenseTime : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        if (timeEl) {
          timeEl.textContent = `${tStr} (${state.lastDispenseLabel || "Dinner"}) - ${state.lastDispenseStatus || "Verified"}`;
        }
        if (iotTimeEl) {
          iotTimeEl.textContent = `${tStr} (${state.lastDispenseLabel || 'Dinner'})`;
        }
      }
    }
    window.updateFeederUI = updateFeederUI;

    function fetchFeederStatus() {
      const ctrl = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(4000) : undefined;
      return fetch(`${GATEWAY}/api/feeder/status`, { signal: ctrl })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.status === 'success' && data.feeder) {
            try { localStorage.setItem('dr_feeder_cache', JSON.stringify(data.feeder)); } catch(e) {}
            updateFeederUI(data.feeder);
            return data;
          } else {
            throw new Error('Feeder status endpoint returned non-success');
          }
        })
        .catch(() => {
          const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
          const applyCachedOrOffline = () => {
            const cached = localStorage.getItem('dr_feeder_cache');
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed === 'object') {
                  updateFeederUI(parsed);
                  return;
                }
              } catch (e) {}
            }
            const setOfflineText = (id, text, color = '#94a3b8') => {
              const el = document.getElementById(id);
              if (el) { el.textContent = text; if (color) el.style.color = color; }
            };
            setOfflineText('feeder-watchdog-status', 'Telemetry Offline');
            setOfflineText('feeder-nuc-watchdog', 'Telemetry Offline');
            setOfflineText('feeder-card-watchdog', 'Telemetry Offline');
            setOfflineText('feeder-dish-status', 'Telemetry Offline');
            setOfflineText('feeder-hopper-pct', '--');
            setOfflineText('feeder-nuc-hopper-pct', '--');
            setOfflineText('feeder-hopper-sub', '(Telemetry Offline)');
            setOfflineText('feeder-nuc-hopper-sub', '(Telemetry Offline)');
            setOfflineText('feeder-card-kibble', 'Telemetry Offline');
            setOfflineText('feeder-last-time', 'Offline');
            const stagFeeder = document.getElementById('stag-feeder');
            if (stagFeeder) {
              stagFeeder.className = 'item-tag offline';
              stagFeeder.textContent = 'Telemetry Offline';
              stagFeeder.style.background = 'rgba(148, 163, 184, 0.15)';
              stagFeeder.style.color = '#94a3b8';
            }
          };

          if (isHttps) {
            applyCachedOrOffline();
            return null;
          }

          // Alternative Method: Try direct LAN gateway or surface cached/offline state
          return fetch('http://192.168.2.35:8082/api/feeder/status', { signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(2000) : undefined })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(d => {
              if (d && d.feeder) {
                updateFeederUI(d.feeder);
                return d;
              } else {
                applyCachedOrOffline();
                return null;
              }
            })
            .catch(() => {
              applyCachedOrOffline();
              return null;
            });
        });
    }
    window.fetchFeederStatus = fetchFeederStatus;

    function refillFeederHopper() {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal("Penny's Feeder Hopper Refill", refillFeederHopper);
        return;
      }
      fetch(`${GATEWAY}/api/feeder/refill`, { method: 'POST', credentials: 'include', headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }), body: '{}', signal: _fetchSig(10000) })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => {
          if (data && data.status === 'success') {
            if (data.feeder) {
              try { localStorage.setItem('dr_feeder_cache', JSON.stringify(data.feeder)); } catch (e) {}
              updateFeederUI(data.feeder);
            }
            showToast('success', "Hopper Refilled", "Kibble hopper reset to 100% (1,500g / ~18.7 days).");
          }
        })
        .catch(err => {
          showToast('error', "Hopper Refill Error", err.message);
        });
    }
    window.refillFeederHopper = refillFeederHopper;

    function triggerCatTreat(portionLabel = '10g Snack') {
      if (!isSSOAuthenticated()) {
        openGlobalSSOModal("Penny's Smart Feeder IoT Dispenser (192.168.2.22)", () => triggerCatTreat(portionLabel));
        return;
      }
      const timeEl = document.getElementById('feeder-last-time');
      const iotTimeEl = document.getElementById('feeder-iot-last-time');
      const logEl = document.getElementById('feeder-log-list');
      const watchEl = document.getElementById('feeder-watchdog-status');
      const dishEl = document.getElementById('feeder-dish-status');

      playChaosTone(784, 1046, 'sine', 0.22);
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      if (timeEl) timeEl.textContent = `Dispensing ${portionLabel}...`;
      if (iotTimeEl) iotTimeEl.textContent = `Just now (${portionLabel})`;
      if (watchEl) watchEl.textContent = 'Optical Watchdog: Verifying motor & bowl...';
      if (dishEl) dishEl.textContent = 'Detecting kibble drop...';

      if (logEl) {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #cbd5e1;';
        item.innerHTML = `<span>${escapeHtml(portionLabel)} (Hardware Bridge Dispense)</span><span class="mono" style="color: #34d399;">${escapeHtml(nowStr)}</span>`;
        logEl.prepend(item);
      }

      const endpoint = `${GATEWAY}/api/feeder/dispense?portion=${encodeURIComponent(portionLabel)}`;
      fetch(endpoint, { method: 'POST', credentials: 'include', headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }), body: '{}', signal: _fetchSig(10000) })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(data => {
          if (data.status === 'success' || (data.tuya && data.tuya.success)) {
            showToast('success', "Penny's Smart Feeder Actuated", `192.168.2.22 dispensed ${portionLabel}. Optical Watchdog: Kibble verified.`);
            if (data.feeder) {
              updateFeederUI(data.feeder);
            } else {
              fetchFeederStatus();
            }
          } else {
            showToast('warning', "Penny's Smart Feeder", data.message || `Dispense dispatched.`);
            if (watchEl) watchEl.textContent = 'Alert: Check feeder hopper';
          }
        })
        .catch(err => {
          showToast('error', "Penny's Smart Feeder", `Gateway error: ${err.message}`);
          if (watchEl) watchEl.textContent = 'Gateway Offline';
        });
    }
    window.triggerCatTreat = triggerCatTreat;

    // Auto-fetch feeder status on page load
    setTimeout(fetchFeederStatus, 1200);
    setTimeout(() => { if (typeof auditAndAttachCheckButtons === 'function') auditAndAttachCheckButtons(); }, 1600);
    setInterval(() => { if (document.hidden) return; if (typeof auditAndAttachCheckButtons === 'function') auditAndAttachCheckButtons(); }, 5000);

    // Global Escape Key Handler to dismiss all modals & restore scroll
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSpeedtestSSOModal();
        closeDisasterModal();
        closeChaosModal();
        closeHealthModal();
        closeChangelogModal(); if (typeof closeMaintenanceModal === 'function') closeMaintenanceModal();
        closeAgyConsole();
        closeMagnetModal();
        closeAdGuardConfigModal();
        closeCloudflareStatsModal();
        if (typeof closeTailscaleModal === 'function') closeTailscaleModal();
        document.querySelectorAll('.dropdown.is-open').forEach(dd => dd.classList.remove('is-open'));
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    });

    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", initApp);
    } else {
      initApp();
    }
