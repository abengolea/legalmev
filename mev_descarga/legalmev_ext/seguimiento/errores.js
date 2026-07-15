/**
 * Errores tipados de seguimiento (mensajes seguros, sin secretos).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LegalMevSegErrores = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CODES = {
    SESION: 'SESION',
    NO_ENCONTRADO: 'NO_ENCONTRADO',
    RED: 'RED',
    PARSEO: 'PARSEO',
    TIMEOUT: 'TIMEOUT',
    PAUSADO: 'PAUSADO',
    NO_SOPORTADO: 'NO_SOPORTADO',
    FALTA_URL: 'FALTA_URL',
  };

  const MESSAGES = {
    SESION: 'La sesión del portal no está disponible. Abrí el expediente e iniciá sesión.',
    NO_ENCONTRADO: 'No se encontró el expediente en el portal.',
    RED: 'Error de red al consultar el portal.',
    PARSEO: 'No se pudieron leer los movimientos de la página.',
    TIMEOUT: 'Tiempo de espera agotado al consultar el portal.',
    PAUSADO: 'El seguimiento está pausado.',
    NO_SOPORTADO: 'Portal no soportado para seguimiento.',
    FALTA_URL: 'Falta la URL de consulta del expediente.',
  };

  function SegError(code, detail) {
    const err = new Error(MESSAGES[code] || detail || 'Error de seguimiento');
    err.code = code;
    err.codigo = code;
    if (detail) err.detail = String(detail).slice(0, 200);
    return err;
  }

  return { CODES, MESSAGES, SegError };
});
