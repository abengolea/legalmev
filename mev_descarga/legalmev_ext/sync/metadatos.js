/**
 * Sanitize de metadatos de seguimiento para sync con cuenta LegalMev (SPEC-05).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LegalMevSegMetadatos = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX = {
    id: 500,
    portal: 32,
    nro: 80,
    caratula: 300,
    juzgado: 160,
    url: 500,
  };
  const LIMITE_USUARIO = 100;

  function sanitizar(input) {
    if (!input || typeof input !== 'object') return null;
    const raw = input;
    const id = String(raw.id || '').trim();
    const portal = String(raw.portal || '')
      .trim()
      .toUpperCase()
      .slice(0, MAX.portal);
    if (!id || !portal) return null;

    const statusRaw = String(raw.status || raw.estado || 'active').toLowerCase();
    const status = statusRaw === 'paused' || statusRaw === 'pausado' ? 'paused' : 'active';

    return {
      id: id.slice(0, MAX.id),
      portal,
      nroExpediente: String(raw.nroExpediente || '').trim().slice(0, MAX.nro),
      caratula: String(raw.caratula || raw.caratulaCorta || '').trim().slice(0, MAX.caratula),
      juzgado: String(raw.juzgado || raw.organismo || '').trim().slice(0, MAX.juzgado),
      url: String(raw.url || raw.urlConsulta || '').trim().slice(0, MAX.url),
      status,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    };
  }

  /** Rechaza campos prohibidos en cloud (movimientos, pdfs, etc.). */
  function soloCamposPermitidos(obj) {
    const s = sanitizar(obj);
    if (!s) return null;
    return s;
  }

  return { MAX, LIMITE_USUARIO, sanitizar, soloCamposPermitidos };
});
