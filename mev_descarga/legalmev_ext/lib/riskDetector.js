/**
 * RiskDetector — Monitorea respuestas y detecta señales de posible bloqueo de sesión.
 * Emite RISK_DETECTED con nivel LOW | MEDIUM | HIGH. No frena por sí solo.
 */
(function () {
  'use strict';

  const LEVEL = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' };
  const CONSECUTIVE_ERROR_THRESHOLD = 5;
  const SLOW_RESPONSE_MS = 10000;

  const LOGIN_INDICATORS = [
    /iniciar\s*sesi[oó]n/i,
    /ingresar\s*usuario/i,
    /contraseña|password/i,
    /loguearse|log in|login/i,
    /acceso\s*restringido/i,
    /sesi[oó]n\s*expirada/i,
    /sesi[oó]n\s*cerrada/i,
    /debe\s*autenticarse/i,
    /form.*action.*login/i,
    /id=["']?password["']?/i,
    /name=["']?password["']?/i,
    /type=["']?password["']?/i
  ];

  let _consecutiveErrors = 0;
  const _listeners = [];

  function on(event, handler) {
    if (event === 'RISK_DETECTED') _listeners.push(handler);
  }

  function off(handler) {
    const idx = _listeners.indexOf(handler);
    if (idx >= 0) _listeners.splice(idx, 1);
  }

  function _emit(level, reason) {
    const payload = { level, reason };
    _listeners.forEach((h) => {
      try {
        h(payload);
      } catch (_) {}
    });
  }

  function recordSuccess() {
    _consecutiveErrors = 0;
  }

  function recordError() {
    _consecutiveErrors++;
    if (_consecutiveErrors >= CONSECUTIVE_ERROR_THRESHOLD) {
      _emit(LEVEL.HIGH, `Más de ${CONSECUTIVE_ERROR_THRESHOLD} errores consecutivos`);
    }
  }

  function isLoginPage(html) {
    if (!html || typeof html !== 'string') return false;
    const sample = html.slice(0, 15000);
    return LOGIN_INDICATORS.some((re) => re.test(sample));
  }

  function isRedirectOrEmpty(response, context = {}) {
    if (!response) return true;
    if (response.redirected && response.url && context.expectedOrigin) {
      try {
        const expected = new URL(context.expectedOrigin);
        const actual = new URL(response.url);
        if (actual.origin !== expected.origin) return true;
      } catch (_) {}
    }
    return false;
  }

  function analyze(response, context = {}) {
    const { responseTimeMs, body, url, contentType } = context;

    if (responseTimeMs != null && responseTimeMs > SLOW_RESPONSE_MS) {
      _emit(LEVEL.LOW, `Respuesta anómalamente lenta (${Math.round(responseTimeMs / 1000)}s)`);
    }

    if (response && !response.ok) {
      recordError();
      if (response.status === 403 || response.status === 401) {
        _emit(LEVEL.HIGH, `HTTP ${response.status} — posible bloqueo de sesión`);
      } else if (response.status >= 500) {
        _emit(LEVEL.MEDIUM, `Error del servidor HTTP ${response.status}`);
      }
      return;
    }

    recordSuccess();

    if (body != null) {
      const str = typeof body === 'string' ? body : (body.slice ? String.fromCharCode.apply(null, new Uint8Array(body.slice(0, 5000))) : '');
      if (!str || str.trim().length < 50) {
        _emit(LEVEL.MEDIUM, 'Respuesta HTML vacía o muy corta');
      } else if (isLoginPage(str)) {
        _emit(LEVEL.HIGH, 'Respuesta contiene página de login — sesión posiblemente cerrada');
      }
    }

    if (isRedirectOrEmpty(response, context)) {
      _emit(LEVEL.MEDIUM, 'Respuesta redirigida a otro origen');
    }
  }

  function reset() {
    _consecutiveErrors = 0;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.LegalMevRiskDetector = {
      analyze,
      on,
      off,
      recordSuccess,
      recordError,
      reset,
      LEVEL
    };
  }
})();
