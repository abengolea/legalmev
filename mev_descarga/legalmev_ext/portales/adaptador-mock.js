/**
 * Adaptador mock — para tests y demos (SPEC-02).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LegalMevSegAdaptadorMock = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let secuencia = [];

  function setSecuencia(listas) {
    secuencia = Array.isArray(listas) ? listas.slice() : [];
  }

  async function obtenerMovimientos(_ref) {
    if (!secuencia.length) return [];
    return secuencia.shift();
  }

  return { setSecuencia, obtenerMovimientos };
});
