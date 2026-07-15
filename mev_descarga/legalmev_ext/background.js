/**
 * Service worker para LegalMev.
 * Maneja ejecución de DataTables, token de autenticación y job de exportación.
 * Seguimiento + bóveda: módulos propios (FASE 4).
 */
importScripts(
  'lib/sessionManager.js',
  'lib/jobManager.js',
  'lib/humanizeError.js',
  'credenciales/boveda.js',
  'seguimiento/errores.js',
  'seguimiento/idempotencia.js',
  'seguimiento/comparar.js',
  'seguimiento/repositorio.js',
  'seguimiento/motor.js',
  'portales/adaptador-mock.js',
  'portales/adaptador-browser.js',
  'sync/metadatos.js',
  'sync/cuenta.js',
  'seguimiento/bootstrap.js'
);

const PROD_BASES = new Set([
  'https://legalmev.com.ar',
  'https://www.legalmev.com.ar'
]);

/** Staging / dev: apiBase guardado tal cual al conectar desde extension-connect. */
const DEV_API_BASES = new Set([
  'https://legalmev-staging--caseclarity-hij0x.us-east4.hosted.app',
  'https://caseclarity-hij0x.web.app',
  'https://caseclarity-hij0x.firebaseapp.com'
]);

function isAllowedDevApiBase(base) {
  if (!base) return false;
  if (DEV_API_BASES.has(base)) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base);
}

const API_BASE_DEFAULT = 'https://www.legalmev.com.ar';

/** tabIds donde ya se inyectó lib/mpba-datatables-main.js (world MAIN). */
const mpbaMainInjected = new Set();

/** Chrome devuelve mensajes en inglés si el content script no está listo; el usuario ve el popup. */
const MSG_NO_ENLACE_PESTANA =
  'No pudimos enlazar con la página del expediente. Recargá la pestaña con F5, esperá a que cargue por completo y volvé a exportar. Si sigue igual, desactivá y volvé a activar LegalMev en chrome://extensions.';

/** Chrome Downloads rechaza caracteres de path (/ \\ : * ? " < > |). */
function sanitizeDownloadFilename(name) {
  const raw = String(name || 'Expediente.pdf').trim();
  const hasPdf = /\.pdf$/i.test(raw);
  const base = (hasPdf ? raw.replace(/\.pdf$/i, '') : raw)
    .replace(/[\/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^[-.\s]+|[-.\s]+$/g, '')
    .trim()
    .slice(0, 180);
  return `${base || 'Expediente'}.pdf`;
}

function updateExportBadge(job) {
  if (!job || !chrome.action) return;
  const status = job.status;
  if (status === 'running' || status === 'pending') {
    const cur = job.current ?? 0;
    const tot = job.total || 1;
    const progressNum = typeof job.progress === 'number' ? job.progress : null;
    const pctFromCur = Math.round((100 * cur) / tot);
    const pct = progressNum != null ? Math.round(progressNum) : pctFromCur;
    const badge =
      tot <= 99
        ? cur === 0 && progressNum != null && progressNum > 0
          ? `${pct}%`
          : `${cur}/${tot}`
        : `${pct}%`;
    chrome.action.setBadgeText({ text: String(badge) }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ color: '#1a56db' }).catch(() => {});
  } else if (status === 'uploading') {
    chrome.action.setBadgeText({ text: '↑' }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ color: '#057a55' }).catch(() => {});
  } else {
    chrome.action.setBadgeText({ text: '' }).catch(() => {});
  }
}

function clearExportBadge() {
  chrome.action?.setBadgeText?.({ text: '' }).catch(() => {});
}

/** Pestañas donde hay expediente listo (badge por tab). */
const expedienteReadyTabs = new Map();

function isExpedienteReadyUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return false;
  if (/mev\.scba\.gov\.ar\/procesales\.asp/i.test(u)) return true;
  if (/scw\.pjn\.gov\.ar.*expediente\.seam/i.test(u)) return true;
  if (/portalpjn\.pjn\.gov\.ar.*(expediente|seam.*cid=)/i.test(u)) return true;
  if (/m[vi]\.mpba\.gov\.ar\/web\/proceso\/verproceso/i.test(u)) return true;
  if (/plataforma\.justiciasalta\.gov\.ar\/iol-ui\/p\//i.test(u)) return true;
  if (/mesavirtual\.jusentrerios\.gov\.ar\/expedientes\/[a-f0-9]{24}/i.test(u)) return true;
  if (/consultaexpedientes\.justucuman\.gov\.ar\/[^/]+\/expediente\//i.test(u)) return true;
  return false;
}

function portalFromUrl(url) {
  const u = String(url || '').toLowerCase();
  if (/mev\.scba\.gov\.ar/i.test(u)) return 'MEV';
  if (/pjn\.gov\.ar/i.test(u)) return 'PJN';
  if (/mpba\.gov\.ar/i.test(u)) return 'MPBA';
  if (/justiciasalta\.gov\.ar/i.test(u)) return 'SALTA';
  if (/jusentrerios\.gov\.ar/i.test(u)) return 'ENTRE RÍOS';
  if (/justucuman\.gov\.ar/i.test(u)) return 'TUCUMAN';
  return '';
}

function setExpedienteReadyBadge(tabId, meta = {}) {
  if (!chrome.action || tabId == null) return;
  const portal = meta.portal ? String(meta.portal) : '';
  const label = meta.detectLabel ? String(meta.detectLabel) : '';
  expedienteReadyTabs.set(tabId, { portal, label, at: Date.now() });
  // "!" se ve bien en Windows; ↓ a veces no renderiza en el badge de Chrome.
  chrome.action.setBadgeText({ tabId, text: '!' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#D97706' }).catch(() => {});
  const title = portal
    ? `LegalMev · ${portal} listo para bajar`
    : 'LegalMev · expediente listo para bajar';
  chrome.action.setTitle({ tabId, title }).catch(() => {});
}

function clearExpedienteReadyBadge(tabId) {
  if (!chrome.action || tabId == null) return;
  expedienteReadyTabs.delete(tabId);
  chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  chrome.action.setTitle({ tabId, title: 'LegalMev' }).catch(() => {});
}

/** Detección por URL en el SW (no depende del content script). */
function syncExpedienteBadgeFromTab(tabId, url) {
  if (tabId == null) return;
  if (isExpedienteReadyUrl(url)) {
    const prev = expedienteReadyTabs.get(tabId) || {};
    setExpedienteReadyBadge(tabId, {
      portal: prev.portal || portalFromUrl(url),
      detectLabel: prev.detectLabel || 'Expediente detectado',
    });
  } else if (expedienteReadyTabs.has(tabId)) {
    clearExpedienteReadyBadge(tabId);
  }
}

function notifyExportComplete(success, detail) {
  const id = 'legalmev-export-' + Date.now();
  const opts = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    priority: 1
  };
  if (success) {
    opts.title = 'LegalMev: Exportación lista';
    opts.message = detail ? `PDF generado — ${detail}` : 'Tu expediente está listo para descargar.';
  } else {
    opts.title = 'LegalMev: Error en la exportación';
    const human =
      typeof self.LegalMevHumanizeError === 'function'
        ? self.LegalMevHumanizeError(detail)
        : detail;
    opts.message = human || 'Ocurrió un error. Abrí la extensión para más detalles.';
  }
  chrome.notifications.create(id, opts).catch(() => {});
}

async function getApiBase() {
  const { apiBase } = await chrome.storage.local.get('apiBase');
  return (apiBase && typeof apiBase === 'string') ? apiBase : API_BASE_DEFAULT;
}

async function getAuthToken() {
  const { authToken } = await chrome.storage.local.get('authToken');
  return authToken || null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXPEDIENTE_PAGE_DETECTED' && sender.tab?.id != null) {
    setExpedienteReadyBadge(sender.tab.id, {
      portal: message.portal,
      detectLabel: message.detectLabel,
    });
    sendResponse?.({ ok: true });
    return false;
  }

  if (message.type === 'EXPEDIENTE_PAGE_CLEARED' && sender.tab?.id != null) {
    clearExpedienteReadyBadge(sender.tab.id);
    sendResponse?.({ ok: true });
    return false;
  }

  if (message.action === 'AUTH_TOKEN_RECEIVED' && typeof message.token === 'string') {
    const SM = self.LegalMevSessionManager;
    const run = async () => {
      try {
        const prefsBefore = await chrome.storage.local.get(['closeTabAfterConnect']);
        if (SM) {
          await SM.clearExtensionSession();
          SM.invalidateSessionCache();
        }
        const store = { authToken: message.token };
        const normalizedBase =
          typeof message.baseUrl === 'string' ? message.baseUrl.replace(/\/$/, '') : '';
        if (PROD_BASES.has(normalizedBase) || isAllowedDevApiBase(normalizedBase)) {
          store.apiBase = normalizedBase;
        } else {
          store.apiBase = 'https://www.legalmev.com.ar';
        }
        if (message.nombre && typeof message.nombre === 'string') {
          store.userNombre = message.nombre.trim();
        }
        if (message.deviceId && typeof message.deviceId === 'string') {
          store.deviceId = message.deviceId.trim();
        }
        if (prefsBefore.closeTabAfterConnect === true) {
          store.closeTabAfterConnect = true;
        }
        await chrome.storage.local.set(store);
        sendResponse({ ok: true });
        // Respaldo en cuenta: sube locales y restaura las que vivan en la nube
        self.LegalMevCloudSync?.syncNow?.({ force: true }).catch(() => {});
        if (sender.tab?.id) {
          const prefs = await chrome.storage.local.get(['closeTabAfterConnect']);
          if (prefs.closeTabAfterConnect === true) {
            chrome.tabs.remove(sender.tab.id).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[LegalMev] Error en AUTH_TOKEN_RECEIVED:', err);
        sendResponse({ ok: false, error: String(err) });
      }
    };
    run();
    return true;
  }

  if (message.action === 'mpbaExec' && sender.tab?.id) {
    const { subAction, page } = message;
    const tabId = sender.tab.id;
    const execInPage = async () => {
      if (!mpbaMainInjected.has(tabId)) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['lib/mpba-datatables-main.js'],
          world: 'MAIN'
        });
        mpbaMainInjected.add(tabId);
      }
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (sa, pg) => globalThis.__LEGALMEV_MPBA_DT__(sa, pg),
        args: [subAction, page],
        world: 'MAIN'
      });
      const r = results?.[0]?.result;
      if (r && typeof r === 'object' && r.error) throw new Error(r.error);
      return r;
    };
    execInPage()
      .then((r) => sendResponse({ result: r }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (message.action === 'getJobState') {
    self.LegalMevJobManager.getJob().then(sendResponse);
    return true;
  }

  if (message.action === 'cancelJob') {
    self.LegalMevJobManager.getJob().then(async (job) => {
      if (job && job.tabId) {
        try {
          await chrome.tabs.sendMessage(job.tabId, { action: 'cancelExport' });
        } catch (_) {}
        await self.LegalMevJobManager.setCancelled(job.jobId);
      }
      clearExportBadge();
      sendResponse({ ok: true });
    });
    return true;
  }

  // Descarga binaria (PDF firmado SAE/Tucumán, etc.) sin CORS de la página.
  if (message.action === 'DOWNLOAD_BINARY' && typeof message.url === 'string') {
    (async () => {
      try {
        const resp = await fetch(message.url, {
          credentials: 'omit',
          headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buffer = await resp.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        sendResponse({
          ok: true,
          base64: btoa(binary),
          contentType: resp.headers.get('content-type') || '',
          size: bytes.length,
        });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    })();
    return true;
  }

  if (message.action === 'startExport') {
    runExportJob(message.payload).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (message.type === 'exportProgress' || message.action === 'progressMPBA') {
    (async () => {
      const job = await self.LegalMevJobManager.getJob();
      if (job && (job.status === 'running' || job.status === 'pending')) {
        const data = message.type === 'exportProgress' ? message : {
          progreso: message.progreso,
          current: message.progreso != null ? Math.round((message.progreso / 100) * (job.total || 100)) : message.current,
          total: job.total,
          mensaje: message.mensaje,
          subtext: message.mensaje
        };
        await self.LegalMevJobManager.updateProgress(job.jobId, data);
        const updated = await self.LegalMevJobManager.getJob();
        updateExportBadge(updated);
      }
    })();
    return false;
  }

  // ─── v1.6/1.7: vault + monitoreo ─────────────────────────────────────────
  if (message.type === 'VAULT_STATUS') {
    Promise.all([
      self.LegalMevVault.isSetup(),
      self.LegalMevVault.isUnlocked(),
    ]).then(([setup, unlocked]) => sendResponse({ setup, unlocked }));
    return true;
  }
  if (message.type === 'VAULT_UNLOCK') {
    self.LegalMevVault.unlock(message.pin)
      .then(sendResponse)
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (message.type === 'VAULT_LOCK') {
    self.LegalMevVault.lock()
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (message.type === 'OPEN_ONBOARDING') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html'), active: true });
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === 'SAVE_WATCHED_CASE' || message.type === 'MONITOR_ACTIVATE') {
    const payload = { ...(message.payload || {}) };
    if (sender.tab?.id && !payload.tabId) payload.tabId = sender.tab.id;
    if (sender.tab?.url && !payload.url) payload.url = sender.tab.url;
    self.LegalMevMonitoring.activateMonitoring(payload)
      .then((r) =>
        sendResponse({
          ok: true,
          case: r.case,
          baselineReady: !!(r.case?.baselineReady || r.baseline),
          alreadyFollowed: !!r.alreadyFollowed,
        })
      )
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'LIST_WATCHED_CASES' || message.type === 'MONITOR_LIST') {
    const run = async () => {
      try {
        await self.LegalMevCloudSync?.syncNow?.();
      } catch (_) {}
      return self.LegalMevMonitoring.getDashboard();
    };
    run()
      .then((dash) => sendResponse({ ok: true, ...dash }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'MONITOR_CLOUD_SYNC') {
    self.LegalMevCloudSync.syncNow({ force: true })
      .then((r) => sendResponse(r || { ok: false }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'REMOVE_WATCHED_CASE' || message.type === 'MONITOR_REMOVE') {
    self.LegalMevMonitoring.removeCase(message.id)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'MONITOR_PAUSE') {
    self.LegalMevMonitoring.pauseCase(message.id)
      .then((c) => sendResponse({ ok: true, case: c }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'MONITOR_RESUME') {
    self.LegalMevMonitoring.resumeCase(message.id)
      .then((c) => sendResponse({ ok: true, case: c }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'MONITOR_SCAN_NOW') {
    self.LegalMevMonitoring.scanCase(message.id, { reason: 'manual', tabId: message.tabId })
      .then((r) => sendResponse({ ok: !!r.ok, ...r }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'MONITOR_SCAN_ALL') {
    self.LegalMevMonitoring.scanDueBatch({ forceAll: true, reason: 'manual_all' })
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'MONITOR_MARK_READ') {
    const p = message.payload || {};
    const run = p.all
      ? self.LegalMevMonitoringStore.markAllAlertsRead()
      : p.caseId
        ? self.LegalMevMonitoringStore.markCaseAlertsRead(p.caseId)
        : self.LegalMevMonitoringStore.markAlertRead(p.alertId);
    run
      .then(async (r) => {
        await self.LegalMevMonitoring.updateBadge();
        sendResponse({ ok: true, result: r });
      })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'OPEN_MONITOR_PANEL') {
    chrome.tabs.create({ url: chrome.runtime.getURL('monitoring/panel.html'), active: true });
    sendResponse({ ok: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.get('legalmev_onboarding_done', ({ legalmev_onboarding_done }) => {
      if (!legalmev_onboarding_done) {
        chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html'), active: true });
      }
    });
  }
  self.LegalMevCaseMonitor?.ensureAlarm?.();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'legalmev-seg-scan' || alarm.name === 'legalmev-watch-scan') {
    self.LegalMevMonitoring?.scanDueBatch?.({ reason: 'alarm' }).catch(() => {});
  }
});

chrome.notifications.onClicked.addListener((notifId) => {
  if (String(notifId).startsWith('lm-mon-')) {
    chrome.tabs.create({ url: chrome.runtime.getURL('monitoring/panel.html'), active: true });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mpbaMainInjected.delete(tabId);
  clearExpedienteReadyBadge(tabId);
  self.LegalMevJobManager.getJob().then((job) => {
    if (job && job.tabId === tabId && (job.status === 'running' || job.status === 'pending' || job.status === 'uploading')) {
      self.LegalMevJobManager.setInterrupted(job.jobId, 'Pestaña cerrada. El procesamiento se interrumpió.');
      clearExportBadge();
      notifyExportComplete(false, 'Pestaña cerrada');
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab?.url || '';
  if (!url) return;
  // Marca / limpia por URL al navegar o al terminar de cargar.
  if (changeInfo.url || changeInfo.status === 'complete') {
    syncExpedienteBadgeFromTab(tabId, url);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    syncExpedienteBadgeFromTab(tabId, tab?.url || '');
  });
});

async function runExportJob(payload) {
  const { tabId, url, portal, count, ultimosN, expedienteInfo } = payload;
  const JM = self.LegalMevJobManager;
  const apiBase = await getApiBase();
  const token = await getAuthToken();
  if (!token) return { ok: false, error: 'No hay sesión. Iniciá sesión en legalmev.com.ar' };
  const { deviceId } = await chrome.storage.local.get('deviceId');
  const exportHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  if (deviceId) exportHeaders['X-Device-Id'] = deviceId;

  const estimatedSec = JM.estimateSeconds(count, portal);
  const job = JM.createJob({
    tabId,
    url,
    portal,
    total: count,
    estimatedSeconds: estimatedSec
  });
  job.status = JM.STATUS.RUNNING;
  await JM.saveJob(job);
  clearExpedienteReadyBadge(tabId);
  updateExportBadge(job);

  try {
    let data;
    if (portal === 'mpba') {
      data = await chrome.tabs.sendMessage(tabId, { action: 'exportMPBA', ultimosN });
      if (!data?.ok) {
        await JM.setFailed(job.jobId, data?.error || 'No se pudieron exportar los trámites');
        clearExportBadge();
        notifyExportComplete(false, data?.error);
        return { ok: false, error: data?.error };
      }
      await JM.setCompleted(job.jobId, { total: data.total, filename: data.filename });
      clearExportBadge();
      notifyExportComplete(true, `${data.total} trámites — ${data.filename}`);
      return { ok: true, total: data.total, filename: data.filename };
    }

    data = await chrome.tabs.sendMessage(tabId, { action: 'collectActuaciones', ultimosN });
    if (!data?.ok) {
      await JM.setFailed(job.jobId, data?.error || 'No se pudieron leer las actuaciones');
      clearExportBadge();
      notifyExportComplete(false, data?.error);
      return { ok: false, error: data?.error };
    }

    await JM.setUploading(job.jobId);
    updateExportBadge(await JM.getJob());

    const response = await fetch(`${apiBase}/api/export`, {
      method: 'POST',
      headers: exportHeaders,
      body: JSON.stringify({
        expedienteUrl: data.pageUrl,
        pageTitle: data.pageTitle,
        actuaciones: data.actuaciones,
        anexos: data.anexos || [],
        caratula: data.caratula || expedienteInfo?.caratula || data.pageTitle || '',
        nroExpediente: data.nroExpediente || '',
        juzgado: data.juzgado || '',
        portal
      })
    });

    const dataResp = await response.json().catch(() => ({}));
    if (response.status === 401) {
      await JM.setFailed(job.jobId, 'Sesión expirada. Volvé a conectar tu cuenta.');
      return { ok: false, error: 'Sesión expirada' };
    }
    if (!response.ok || !dataResp.ok) {
      await JM.setFailed(job.jobId, dataResp?.error || `Error ${response.status}`);
      return { ok: false, error: dataResp?.error };
    }
    if (dataResp.url) {
      // Chrome Downloads rechaza / \ : * ? " < > | (p.ej. nros Entre Ríos "exp / año")
      const filename = sanitizeDownloadFilename(dataResp.filename || 'Expediente.pdf');
      await new Promise((resolve, reject) => {
        chrome.downloads.download({ url: dataResp.url, filename, saveAs: false }, () => {
          if (chrome.runtime.lastError) {
            const raw = chrome.runtime.lastError.message || 'Error al descargar';
            reject(
              new Error(
                typeof self.LegalMevHumanizeError === 'function'
                  ? self.LegalMevHumanizeError(raw)
                  : raw
              )
            );
          } else resolve();
        });
      });
      await JM.setCompleted(job.jobId, {
        pages: (data.count || 0) + 1,
        total: data.count,
        filename
      });
      clearExportBadge();
      notifyExportComplete(true, `${data.count || 0} trámites — ${filename}`);
      return { ok: true, pages: (data.count || 0) + 1 };
    }
    await JM.setFailed(job.jobId, dataResp.error || 'Error desconocido');
    return { ok: false, error: dataResp.error };
  } catch (e) {
    const raw = e.message || String(e);
    const errMsg =
      typeof self.LegalMevHumanizeError === 'function' ? self.LegalMevHumanizeError(raw) : raw;
    const sinEnlaceContentScript =
      /enlazar con la página|Receiving end does not exist|Could not establish connection|message channel closed|asynchronous response/i.test(
        String(raw) + ' ' + errMsg
      );
    if (sinEnlaceContentScript) {
      await JM.setInterrupted(job.jobId, MSG_NO_ENLACE_PESTANA);
      clearExportBadge();
      notifyExportComplete(false, MSG_NO_ENLACE_PESTANA);
    } else {
      await JM.setFailed(job.jobId, errMsg);
      clearExportBadge();
      notifyExportComplete(false, errMsg);
    }
    return { ok: false, error: sinEnlaceContentScript ? MSG_NO_ENLACE_PESTANA : errMsg };
  }
}
