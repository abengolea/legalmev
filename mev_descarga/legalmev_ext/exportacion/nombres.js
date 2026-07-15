/**
 * Nombres de archivo/carpeta para exportación LegalMev (SPEC-04 / FASE 3 D3).
 * Convención propia: LegalMev_{portal}_{nro}_{yyyyMMdd}
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LegalMevExportNombres = api;
  // Compatibilidad con callers que esperan LegalMevFilename
  root.LegalMevFilename = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function sanitizeSegment(raw, fallback) {
    const fb = fallback == null ? 'archivo' : fallback;
    let s = String(raw || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .replace(/\.+$/, '');
    if (!s) s = fb;
    if (s.length > 80) s = s.slice(0, 80).trim();
    return s;
  }

  function pad3(n) {
    return String(n).padStart(3, '0');
  }

  function uniqueName(used, name) {
    if (!used.has(name.toLowerCase())) {
      used.add(name.toLowerCase());
      return name;
    }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 2;
    let candidate;
    do {
      candidate = `${base}_${i}${ext}`;
      i += 1;
    } while (used.has(candidate.toLowerCase()));
    used.add(candidate.toLowerCase());
    return candidate;
  }

  function fechaStamp(d) {
    const x = d instanceof Date ? d : new Date();
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  /**
   * Carpeta raíz del ZIP — marca LegalMev (no reutiliza convenciones externas).
   */
  function folderFromExpediente(nro, portal, fecha) {
    const nroClean = sanitizeSegment(nro || 'expediente', 'expediente');
    const p = sanitizeSegment(portal || 'portal', 'portal').toUpperCase();
    return `LegalMev_${p}_${nroClean}_${fechaStamp(fecha)}`;
  }

  function nombreIndicePdf() {
    return 'indice.pdf';
  }

  function nombreInformeFallos() {
    return 'informe_descarga.txt';
  }

  return {
    sanitizeSegment,
    pad3,
    uniqueName,
    fechaStamp,
    folderFromExpediente,
    nombreIndicePdf,
    nombreInformeFallos,
  };
});
