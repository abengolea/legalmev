/**
 * Comparación de escaneos: novedades = claves no vistas (SPEC-01).
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LegalMevSegComparar = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function idem() {
    return root.LegalMevSegIdempotencia || require('./idempotencia.js');
  }

  /**
   * @param {Array} movimientosActuales — crudos o ya normalizados
   * @param {Set<string>|string[]} clavesConocidas
   * @param {string} [portal]
   */
  function detectarNovedades(movimientosActuales, clavesConocidas, portal) {
    const Id = idem();
    const conocidas = clavesConocidas instanceof Set ? clavesConocidas : new Set(clavesConocidas || []);
    const novel = [];
    const todas = [];

    for (const raw of movimientosActuales || []) {
      const mov = raw.claveIdempotencia
        ? raw
        : Id.normalizarMovimiento(raw, portal);
      const clave = mov.claveIdempotencia || Id.claveIdempotencia(mov);
      if (!clave) continue;
      todas.push(clave);
      if (!conocidas.has(clave)) {
        novel.push({ ...mov, claveIdempotencia: clave });
      }
    }

    return { novedades: novel, clavesVistas: todas };
  }

  return { detectarNovedades };
});
