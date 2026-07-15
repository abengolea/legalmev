/**
 * Bootstrap del motor de seguimiento + fachadas de compatibilidad UI/SW.
 */
(function (root) {
  'use strict';

  const repo = root.LegalMevSegRepositorio.create();
  root.__lmSegRepo = repo;

  function pickAdapter() {
    if (root.__lmSegForceMock && root.LegalMevSegAdaptadorMock) {
      return root.LegalMevSegAdaptadorMock.obtenerMovimientos;
    }
    if (root.LegalMevSegAdaptadorBrowser) {
      return root.LegalMevSegAdaptadorBrowser.obtenerMovimientos;
    }
    return async () => {
      throw root.LegalMevSegErrores.SegError(root.LegalMevSegErrores.CODES.NO_SOPORTADO);
    };
  }

  async function notifyChrome(payload) {
    try {
      const n = payload.alertas?.length || 0;
      if (!n) return;
      const title = 'LegalMev — novedades';
      const message = `${payload.ref.nroExpediente || 'Expediente'}: ${n} movimiento(s) nuevo(s)`;
      if (chrome?.notifications?.create) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title,
          message,
        });
      }
      await updateBadge();
    } catch {
      /* ignore */
    }
  }

  async function updateBadge() {
    const dash = await motor.dashboard();
    const text = dash.alertasNuevas > 0 ? String(Math.min(dash.alertasNuevas, 99)) : '';
    if (chrome?.action?.setBadgeText) {
      await chrome.action.setBadgeText({ text });
      await chrome.action.setBadgeBackgroundColor({ color: '#2A6A78' });
    }
  }

  const motor = root.LegalMevSegMotor.create({
    repositorio: repo,
    obtenerMovimientos: (ref, options) => pickAdapter()(ref, options),
    onAlerta: notifyChrome,
  });

  async function ensureAlarm() {
    const ajustes = await repo.getAjustes();
    const hours = ajustes.intervaloHoras || 6;
    try {
      await chrome.alarms.clear(motor.ALARM_NAME);
      chrome.alarms.create(motor.ALARM_NAME, { periodInMinutes: Math.max(60, hours * 60) });
    } catch {
      /* ignore in tests */
    }
  }

  async function activateMonitoring(input) {
    const row = await motor.registrar(input);
    const scan = await motor.escanear(row.id, { reason: 'activate', tabId: input.tabId });
    root.LegalMevSegSync?.pushCase?.(scan.case || row)?.catch?.(() => {});
    await ensureAlarm();
    return {
      case: mapCase(scan.case || row),
      baseline: !!scan.baseline,
    };
  }

  function mapCase(r) {
    if (!r) return null;
    return {
      id: r.id,
      portal: r.portal,
      nroExpediente: r.nroExpediente,
      caratula: r.caratulaCorta,
      juzgado: r.organismo,
      url: r.urlConsulta,
      status: r.estado === 'pausado' ? 'paused' : 'active',
      baselineReady: !!r.baselineLista,
      lastScanAt: r.ultimaEjecucionAt,
      lastError: r.ultimoErrorCodigo,
      createdAt: r.creadoAt,
      updatedAt: r.actualizadoAt,
    };
  }

  // ——— Fachada LegalMevMonitoring (mensajes existentes del SW) ———
  root.LegalMevMonitoring = {
    activateMonitoring,
    ensureAlarm,
    async removeCase(id) {
      await motor.eliminar(id);
      root.LegalMevSegSync?.removeCase?.(id)?.catch?.(() => {});
    },
    async pauseCase(id) {
      const c = await motor.pausar(id);
      root.LegalMevSegSync?.pushCase?.(c)?.catch?.(() => {});
      return c;
    },
    async resumeCase(id) {
      const c = await motor.reanudar(id);
      root.LegalMevSegSync?.pushCase?.(c)?.catch?.(() => {});
      return c;
    },
    scanCase(id, opts) {
      return motor.escanear(id, opts);
    },
    scanDueBatch(opts) {
      return motor.escanearDebidos(opts);
    },
    getDashboard: async () => {
      const d = await motor.dashboard();
      return {
        cases: d.casos.map(mapCase),
        alerts: d.alertas,
        unread: d.alertasNuevas,
        byCase: d.porExpediente,
      };
    },
    updateBadge,
  };

  root.LegalMevMonitoringStore = {
    listCases: async () => (await repo.listReferencias()).map(mapCase),
    markAlertRead: (id) => repo.marcarAlertaVista(id),
    markCaseAlertsRead: (caseId) => repo.marcarAlertasSeguimientoVistas(caseId),
    markAllAlertsRead: () => repo.marcarTodasAlertasVistas(),
    knownFingerprints: (caseId) => repo.clavesConocidas(caseId),
  };

  root.LegalMevCaseMonitor = {
    STORE_KEY: repo.KEYS.referencias,
    listCases: () => root.LegalMevMonitoringStore.listCases(),
    saveCase: async (input) => {
      const r = await activateMonitoring(input);
      return r.case;
    },
    removeCase: (id) => root.LegalMevMonitoring.removeCase(id),
    ensureAlarm,
    scanOnce: () => motor.escanearDebidos({ reason: 'alarm' }),
    notifyNovedad: updateBadge,
  };

  root.LegalMevSeguimiento = {
    motor,
    repo,
    mapCase,
    activateMonitoring,
    ensureAlarm,
    updateBadge,
  };
})(typeof self !== 'undefined' ? self : window);
