/**
 * Traduce errores técnicos de Chrome/APIs a mensajes en español para el usuario.
 * Usable desde service worker (importScripts) y desde popup.
 */
(function (global) {
  'use strict';

  const MSG_ENLACE =
    'No pudimos enlazar con la página del expediente. Recargá la pestaña con F5, esperá a que cargue por completo y volvé a exportar. Si sigue igual, desactivá y volvé a activar LegalMev en chrome://extensions.';

  const RULES = [
    {
      test: /asynchronous response by returning true|message channel closed before a response/i,
      msg: 'Se cortó la comunicación con la página. Recargá el expediente (F5) y volvé a exportar. Si tarda mucho, dejá la pestaña abierta hasta que termine.'
    },
    {
      test: /Receiving end does not exist|Could not establish connection|message port closed|Extension context invalidated/i,
      msg: MSG_ENLACE
    },
    {
      test: /Invalid filename/i,
      msg: 'El nombre del archivo PDF no es válido. Recargá la extensión y volvé a intentar.'
    },
    {
      test: /NetworkError|Failed to fetch|net::ERR_|Load failed/i,
      msg: 'No se pudo conectar con el servidor. Revisá tu internet y volvé a intentar.'
    },
    {
      test: /The download was canceled|Download canceled|USER_CANCELED/i,
      msg: 'Descarga cancelada.'
    },
    {
      test: /QuotaExceededError|QUOTA_EXCEEDED/i,
      msg: 'No hay espacio suficiente para guardar el archivo.'
    },
    {
      test: /^Forbidden$|HTTP Error: 403|status code 403/i,
      msg: 'Acceso denegado. Verificá tu sesión e intentá de nuevo.'
    },
    {
      test: /^Unauthorized$|status code 401|HTTP Error: 401/i,
      msg: 'Sesión expirada. Volvé a conectar tu cuenta en legalmev.com.ar.'
    },
    {
      test: /The tab was closed|No tab with id/i,
      msg: 'Se cerró la pestaña del expediente. Abrila de nuevo y volvé a exportar.'
    }
  ];

  function humanizeError(err) {
    const m = typeof err === 'string' ? err : err?.message || String(err || '');
    const trimmed = m.trim();
    if (!trimmed) return 'Ocurrió un error inesperado.';
    for (const rule of RULES) {
      if (rule.test.test(trimmed)) return rule.msg;
    }
    // Si parece inglés técnico (pocas tildes / palabras Chrome típicas), mensaje genérico
    if (
      /\b(listener|channel|port|undefined|null|exception|stack|chrome\.)\b/i.test(trimmed) &&
      !/[áéíóúñ¿¡]/i.test(trimmed)
    ) {
      return 'Ocurrió un error técnico. Recargá el expediente (F5) y volvé a intentar. Si sigue, abrí LegalMev para ver el detalle.';
    }
    return trimmed;
  }

  global.LegalMevHumanizeError = humanizeError;
})(typeof self !== 'undefined' ? self : globalThis);
