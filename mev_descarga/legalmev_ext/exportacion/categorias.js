/**
 * Categorías de actuación para filtros de exportación LegalMev (SPEC-04).
 * Taxonomía propia del producto; reglas basadas en terminología procesal habitual AR.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LegalMevExportCategorias = api;
  root.LegalMevCategories = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RULES = [
    {
      id: 'notificaciones',
      label: 'Notificaciones',
      short: 'Notif.',
      test: (t) =>
        /NOTIFIC|C[EÉ]DULA|EDICTO|PUBLICACI[OÓ]N|EMPLAZ|CITACI[OÓ]N|AVISO\b|TELEGRAMA|CARTA\s+DOCUMENTO/i.test(t),
    },
    {
      id: 'resoluciones',
      label: 'Resoluciones y sentencias',
      short: 'Resol.',
      test: (t) =>
        /SENTENCIA|RESOLUC|INTERLOC|AUTO\b|PROVIDENCIA|DECRETO|ACLARATORIA|HOMOLOG|RECHAZ|HACE\s+LUGAR/i.test(t),
    },
    {
      id: 'escritos',
      label: 'Escritos de parte',
      short: 'Escritos',
      test: (t) =>
        /ESCRITO|PRESENTACI[OÓ]N|DEMANDA|CONTESTA|APELACI[OÓ]N|RECURSO|ALEGATO|PEDIDO|SOLICITA|ADJUNTA/i.test(t),
    },
    {
      id: 'despachos',
      label: 'Despachos y oficios',
      short: 'Despachos',
      test: (t) =>
        /DESPACHO|OFICIO|TRASLADO|INTIMACI[OÓ]N|ORDENA|DISPONE|PERICIA|INFORME\b|AUDIENCIA|ACTA\b|DICTAMEN/i.test(t),
    },
    {
      id: 'informacion',
      label: 'Información del sistema',
      short: 'Info',
      test: (t) =>
        /INFORMACI[OÓ]N|EVENTO|PASE|RECEPCI[OÓ]N|HISTORIAL|SISTEMA|CONSULTA|ACUSE|DIGITALIZ/i.test(t),
    },
  ];

  function blobText(item) {
    return [item?.tipo, item?.titulo, item?.descripcion, item?.tramite]
      .filter(Boolean)
      .join(' ');
  }

  function categorize(item) {
    const t = blobText(item);
    for (const rule of RULES) {
      if (rule.test(t)) return rule.id;
    }
    return 'informacion';
  }

  function buildCategoryStats(items) {
    const stats = {};
    for (const rule of RULES) stats[rule.id] = { id: rule.id, label: rule.label, short: rule.short, count: 0 };
    for (const item of items || []) {
      const id = categorize(item);
      if (stats[id]) stats[id].count += 1;
    }
    return Object.values(stats);
  }

  return { RULES, categorize, buildCategoryStats, blobText };
});
