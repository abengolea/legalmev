/**
 * Claves de idempotencia para movimientos de seguimiento (LegalMev).
 * SPEC-01 / FASE 3 D2: ID de portal si existe; si no, fecha+tipo+resumen normalizados.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LegalMevSegIdempotencia = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizarTexto(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizarFecha(f) {
    return normalizarTexto(f).replace(/[^\d./-]/g, '');
  }

  /**
   * @param {{ portalId?: string, id?: string, fecha?: string, tipo?: string, descripcion?: string, resumen?: string, titulo?: string }} mov
   * @returns {string}
   */
  function claveIdempotencia(mov) {
    const estable = String(mov.portalId || mov.id || '').trim();
    if (estable && estable !== 'undefined') {
      return `portal:${normalizarTexto(estable)}`;
    }
    const fecha = normalizarFecha(mov.fecha);
    const tipo = normalizarTexto(mov.tipo).slice(0, 80);
    const resumen = normalizarTexto(mov.descripcion || mov.resumen || mov.titulo).slice(0, 120);
    if (!fecha && !tipo && !resumen) return '';
    return `compuesto:${fecha}|${tipo}|${resumen}`;
  }

  function normalizarMovimiento(raw, portal) {
    const fecha = String(raw.fecha || raw.date || '').trim();
    const tipo = String(raw.tipo || raw.tramite || raw.category || '').trim();
    const descripcion = String(
      raw.descripcion || raw.titulo || raw.description || raw.tipo || ''
    ).trim();
    const portalId = String(raw.portalId || raw.ccs || raw.id || raw.codigo || '').trim();
    const mov = {
      portalId: portalId || undefined,
      fecha,
      tipo,
      descripcion: descripcion.slice(0, 240),
      portal: String(portal || raw.portal || '').toUpperCase(),
    };
    mov.claveIdempotencia = claveIdempotencia(mov);
    return mov;
  }

  return { normalizarTexto, normalizarFecha, claveIdempotencia, normalizarMovimiento };
});
