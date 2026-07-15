/**
 * Motor de seguimiento LegalMev (SPEC-01, SPEC-02, SPEC-09).
 * Baseline en primer escaneo; novedades idempotentes; pause/resume/delete.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LegalMevSegMotor = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const ALARM_NAME = 'legalmev-seg-scan';

  function deps(opts) {
    const Id =
      opts.idempotencia ||
      root.LegalMevSegIdempotencia ||
      (typeof require !== 'undefined' ? require('./idempotencia.js') : null);
    const Cmp =
      opts.comparar ||
      root.LegalMevSegComparar ||
      (typeof require !== 'undefined' ? require('./comparar.js') : null);
    return { Id, Cmp };
  }

  function create(opts) {
    const repo = opts.repositorio;
    const obtenerMovimientos = opts.obtenerMovimientos; // async (ref) => raw[]
    const onAlerta = opts.onAlerta || (async () => {});
    const { Id, Cmp } = deps(opts);
    if (!repo || !Id || !Cmp) throw new Error('Motor: faltan dependencias');

    function newId() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function normalizeNro(n) {
      return String(n || '')
        .replace(/\s+/g, '')
        .toUpperCase();
    }

    /** Misma causa: portal + nro (o expId si no hay nro). */
    function findExisting(list, input) {
      const portal = String(input.portal || '').toUpperCase();
      const nro = normalizeNro(input.nroExpediente);
      const expId = String(input.portalRefs?.expId || input.portalRefs?.idExpediente || '').trim();
      return (list || []).find((r) => {
        if (String(r.portal || '').toUpperCase() !== portal) return false;
        const rNro = normalizeNro(r.nroExpediente);
        if (nro && rNro && nro === rNro) return true;
        const rExp = String(r.portalRefs?.expId || r.portalRefs?.idExpediente || '').trim();
        if (expId && rExp && expId === rExp) return true;
        return false;
      }) || null;
    }

    async function registrar(input) {
      const existing = findExisting(await repo.listReferencias(), input);
      if (existing) return existing;

      const row = {
        id: input.id || newId(),
        portal: String(input.portal || '').toUpperCase(),
        nroExpediente: String(input.nroExpediente || '').trim(),
        caratulaCorta: String(input.caratula || input.caratulaCorta || '').slice(0, 300),
        organismo: String(input.juzgado || input.organismo || '').slice(0, 160),
        urlConsulta: String(input.url || input.urlConsulta || '').slice(0, 500),
        estado: 'activo',
        baselineLista: false,
        ultimaEjecucionAt: null,
        ultimoErrorCodigo: null,
        portalRefs: input.portalRefs || {},
      };
      return repo.upsertReferencia(row);
    }

    async function escanear(seguimientoId, options) {
      const reason = options?.reason || 'manual';
      const ref = await repo.getReferencia(seguimientoId);
      if (!ref) return { ok: false, code: 'NO_ENCONTRADO' };
      if (ref.estado === 'pausado' && !options?.forceWhilePaused) {
        return { ok: false, code: 'PAUSADO', message: 'Seguimiento pausado' };
      }

      const t0 = Date.now();
      try {
        const crudos = await obtenerMovimientos(ref, options);
        const normalizados = (crudos || []).map((m) => Id.normalizarMovimiento(m, ref.portal));

        if (!ref.baselineLista) {
          await repo.reemplazarBaseline(seguimientoId, normalizados);
          const updated = await repo.upsertReferencia({
            ...ref,
            baselineLista: true,
            ultimaEjecucionAt: Date.now(),
            ultimoErrorCodigo: null,
          });
          await repo.registrarEvento({
            tipo: 'baseline_ok',
            seguimientoId,
            codigo: 'OK',
            mensajeSeguro: `Línea de base: ${normalizados.length} movimientos`,
            durationMs: Date.now() - t0,
            reason,
          });
          return { ok: true, baseline: true, novedades: 0, count: normalizados.length, case: updated };
        }

        const known = await repo.clavesConocidas(seguimientoId);
        const { novedades } = Cmp.detectarNovedades(normalizados, known, ref.portal);
        await repo.agregarMovimientosNuevos(seguimientoId, novedades);
        const alertas = await repo.agregarAlertasIdempotentes(seguimientoId, novedades);
        if (alertas.length) await onAlerta({ ref, alertas });

        const updated = await repo.upsertReferencia({
          ...ref,
          ultimaEjecucionAt: Date.now(),
          ultimoErrorCodigo: null,
        });
        await repo.registrarEvento({
          tipo: 'scan_ok',
          seguimientoId,
          codigo: 'OK',
          mensajeSeguro: `Novedades: ${novedades.length}`,
          durationMs: Date.now() - t0,
          reason,
        });
        if (alertas.length) {
          await repo.registrarEvento({
            tipo: 'alerta_creada',
            seguimientoId,
            codigo: 'OK',
            mensajeSeguro: `${alertas.length} alerta(s)`,
          });
        }
        return {
          ok: true,
          baseline: false,
          novedades: novedades.length,
          alertas: alertas.length,
          case: updated,
        };
      } catch (e) {
        const code = e.code || e.codigo || 'ERROR';
        await repo.upsertReferencia({
          ...ref,
          ultimaEjecucionAt: Date.now(),
          ultimoErrorCodigo: String(code).slice(0, 64),
        });
        await repo.registrarEvento({
          tipo: 'scan_error',
          seguimientoId,
          codigo: String(code),
          mensajeSeguro: String(e.message || 'Error de escaneo').slice(0, 200),
        });
        return { ok: false, code, message: e.message };
      }
    }

    async function pausar(id) {
      const ref = await repo.getReferencia(id);
      if (!ref) return null;
      return repo.upsertReferencia({ ...ref, estado: 'pausado' });
    }

    async function reanudar(id) {
      const ref = await repo.getReferencia(id);
      if (!ref) return null;
      return repo.upsertReferencia({ ...ref, estado: 'activo' });
    }

    async function eliminar(id) {
      await repo.removeReferenciaCascade(id);
      await repo.registrarEvento({
        tipo: 'eliminado',
        seguimientoId: id,
        codigo: 'OK',
        mensajeSeguro: 'Seguimiento eliminado',
      });
    }

    async function escanearDebidos(options) {
      const forceAll = !!options?.forceAll;
      const refs = await repo.listReferencias();
      const ajustes = await repo.getAjustes();
      const intervalMs = (ajustes.intervaloHoras || 6) * 3600 * 1000;
      const due = refs.filter((r) => {
        if (r.estado !== 'activo') return false;
        if (forceAll) return true;
        if (!r.ultimaEjecucionAt) return true;
        return Date.now() - r.ultimaEjecucionAt >= intervalMs;
      });

      const results = [];
      for (const r of due) {
        results.push(await escanear(r.id, { reason: options?.reason || 'programado' }));
        const delay = ajustes.delayMsEntreCausas || 0;
        if (delay) await new Promise((res) => setTimeout(res, delay));
      }
      return { scanned: due.length, results };
    }

    async function dashboard() {
      const casos = await repo.listReferencias();
      const alertas = await repo.listAlertas();
      const nuevas = alertas.filter((a) => a.estado === 'nueva');
      const porExpediente = {};
      for (const a of nuevas) {
        if (!porExpediente[a.seguimientoId]) porExpediente[a.seguimientoId] = [];
        porExpediente[a.seguimientoId].push(a);
      }
      return { casos, alertas, alertasNuevas: nuevas.length, porExpediente };
    }

    return {
      ALARM_NAME,
      findExisting,
      registrar,
      escanear,
      pausar,
      reanudar,
      eliminar,
      escanearDebidos,
      dashboard,
    };
  }

  return { create, ALARM_NAME };
});
