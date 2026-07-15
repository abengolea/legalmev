/**
 * Repositorio local de seguimiento (chrome.storage.local o memoria inyectable).
 * Keys propias LegalMev — SPEC-01 / FASE 3.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LegalMevSegRepositorio = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const KEYS = {
    referencias: 'lm_seg_referencias_v1',
    movimientos: 'lm_seg_movimientos_v1',
    alertas: 'lm_seg_alertas_v1',
    eventos: 'lm_seg_eventos_v1',
    ajustes: 'lm_seg_ajustes_v1',
  };

  const DEFAULT_AJUSTES = {
    intervaloHoras: 6,
    delayMsEntreCausas: 2500,
  };

  function createMemoryDriver(seed) {
    const bag = Object.assign({}, seed || {});
    return {
      async get(keys) {
        const out = {};
        for (const k of Array.isArray(keys) ? keys : [keys]) out[k] = bag[k];
        return out;
      },
      async set(obj) {
        Object.assign(bag, obj);
      },
      async remove(keys) {
        for (const k of Array.isArray(keys) ? keys : [keys]) delete bag[k];
      },
      _bag: bag,
    };
  }

  function chromeDriver() {
    return {
      get: (keys) => chrome.storage.local.get(keys),
      set: (obj) => chrome.storage.local.set(obj),
      remove: (keys) => chrome.storage.local.remove(keys),
    };
  }

  function create(driver) {
    const storage = driver || (typeof chrome !== 'undefined' && chrome.storage?.local ? chromeDriver() : createMemoryDriver());

    async function getList(key) {
      const row = await storage.get(key);
      return Array.isArray(row[key]) ? row[key] : [];
    }

    async function setList(key, list) {
      await storage.set({ [key]: list });
    }

    async function listReferencias() {
      return getList(KEYS.referencias);
    }

    async function getReferencia(id) {
      return (await listReferencias()).find((r) => r.id === id) || null;
    }

    async function upsertReferencia(ref) {
      const all = await listReferencias();
      const i = all.findIndex((r) => r.id === ref.id);
      const now = Date.now();
      const row = {
        ...ref,
        actualizadoAt: now,
        creadoAt: ref.creadoAt || (i >= 0 ? all[i].creadoAt : now),
      };
      if (i >= 0) all[i] = { ...all[i], ...row };
      else all.push(row);
      await setList(KEYS.referencias, all);
      return row;
    }

    async function removeReferenciaCascade(id) {
      const refs = (await listReferencias()).filter((r) => r.id !== id);
      await setList(KEYS.referencias, refs);
      const movs = (await getList(KEYS.movimientos)).filter((m) => m.seguimientoId !== id);
      await setList(KEYS.movimientos, movs);
      const alerts = (await getList(KEYS.alertas)).filter((a) => a.seguimientoId !== id);
      await setList(KEYS.alertas, alerts);
      const evs = (await getList(KEYS.eventos)).filter((e) => e.seguimientoId !== id);
      await setList(KEYS.eventos, evs);
    }

    async function reemplazarBaseline(seguimientoId, movimientos) {
      const others = (await getList(KEYS.movimientos)).filter((m) => m.seguimientoId !== seguimientoId);
      const now = Date.now();
      const rows = (movimientos || []).map((m) => ({
        seguimientoId,
        claveIdempotencia: m.claveIdempotencia,
        fecha: m.fecha || '',
        tipo: m.tipo || '',
        resumenCorto: (m.descripcion || '').slice(0, 240),
        origenBaseline: true,
        vistoAt: now,
      }));
      await setList(KEYS.movimientos, others.concat(rows));
      return rows.length;
    }

    async function clavesConocidas(seguimientoId) {
      const movs = (await getList(KEYS.movimientos)).filter((m) => m.seguimientoId === seguimientoId);
      return new Set(movs.map((m) => m.claveIdempotencia).filter(Boolean));
    }

    async function agregarMovimientosNuevos(seguimientoId, novedades) {
      const all = await getList(KEYS.movimientos);
      const known = new Set(
        all.filter((m) => m.seguimientoId === seguimientoId).map((m) => m.claveIdempotencia)
      );
      const now = Date.now();
      const added = [];
      for (const m of novedades || []) {
        const clave = m.claveIdempotencia;
        if (!clave || known.has(clave)) continue;
        known.add(clave);
        const row = {
          seguimientoId,
          claveIdempotencia: clave,
          fecha: m.fecha || '',
          tipo: m.tipo || '',
          resumenCorto: (m.descripcion || '').slice(0, 240),
          origenBaseline: false,
          vistoAt: now,
        };
        all.push(row);
        added.push(row);
      }
      await setList(KEYS.movimientos, all);
      return added;
    }

    async function agregarAlertasIdempotentes(seguimientoId, novedades) {
      const all = await getList(KEYS.alertas);
      const existing = new Set(
        all.filter((a) => a.seguimientoId === seguimientoId).map((a) => a.claveIdempotencia)
      );
      const created = [];
      const now = Date.now();
      for (const m of novedades || []) {
        const clave = m.claveIdempotencia;
        if (!clave || existing.has(clave)) continue;
        existing.add(clave);
        const alert = {
          id: `${seguimientoId}::${clave}`,
          seguimientoId,
          claveIdempotencia: clave,
          fecha: m.fecha || '',
          tipo: m.tipo || '',
          resumenCorto: (m.descripcion || '').slice(0, 240),
          estado: 'nueva',
          creadaAt: now,
        };
        all.push(alert);
        created.push(alert);
      }
      await setList(KEYS.alertas, all);
      return created;
    }

    async function listAlertas() {
      return getList(KEYS.alertas);
    }

    async function marcarAlertaVista(alertId) {
      const all = await getList(KEYS.alertas);
      for (const a of all) {
        if (a.id === alertId) a.estado = 'vista';
      }
      await setList(KEYS.alertas, all);
    }

    async function marcarAlertasSeguimientoVistas(seguimientoId) {
      const all = await getList(KEYS.alertas);
      for (const a of all) {
        if (a.seguimientoId === seguimientoId) a.estado = 'vista';
      }
      await setList(KEYS.alertas, all);
    }

    async function marcarTodasAlertasVistas() {
      const all = await getList(KEYS.alertas);
      for (const a of all) a.estado = 'vista';
      await setList(KEYS.alertas, all);
    }

    async function registrarEvento(evt) {
      const all = await getList(KEYS.eventos);
      all.push({
        ...evt,
        at: evt.at || Date.now(),
      });
      // retención acotada
      const trimmed = all.slice(-500);
      await setList(KEYS.eventos, trimmed);
    }

    async function getAjustes() {
      const row = await storage.get(KEYS.ajustes);
      return { ...DEFAULT_AJUSTES, ...(row[KEYS.ajustes] || {}) };
    }

    async function setAjustes(partial) {
      const cur = await getAjustes();
      const next = { ...cur, ...partial };
      await storage.set({ [KEYS.ajustes]: next });
      return next;
    }

    return {
      KEYS,
      DEFAULT_AJUSTES,
      storage,
      listReferencias,
      getReferencia,
      upsertReferencia,
      removeReferenciaCascade,
      reemplazarBaseline,
      clavesConocidas,
      agregarMovimientosNuevos,
      agregarAlertasIdempotentes,
      listAlertas,
      marcarAlertaVista,
      marcarAlertasSeguimientoVistas,
      marcarTodasAlertasVistas,
      registrarEvento,
      getAjustes,
      setAjustes,
    };
  }

  return { KEYS, DEFAULT_AJUSTES, createMemoryDriver, create };
});
