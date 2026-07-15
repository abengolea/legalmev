/**
 * Logger — Logs estructurados para debug del scheduler.
 * Activable con DEBUG_MODE = true.
 */
(function () {
  'use strict';

  const PREFIX = '[SCHEDULER]';
  const LEVEL = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };

  let DEBUG_MODE = false;

  function setDebugMode(enabled) {
    DEBUG_MODE = !!enabled;
  }

  function isDebugEnabled() {
    return DEBUG_MODE;
  }

  function _ts() {
    const d = new Date();
    return d.toTimeString().slice(0, 8);
  }

  function _log(level, ...args) {
    if (!DEBUG_MODE) return;
    const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const line = `${PREFIX}[${_ts()}] ${msg}`;
    if (level === LEVEL.ERROR) console.error(line);
    else if (level === LEVEL.WARN) console.warn(line);
    else console.log(line);
  }

  function info(...args) {
    _log(LEVEL.INFO, ...args);
  }

  function warn(...args) {
    _log(LEVEL.WARN, ...args);
  }

  function error(...args) {
    _log(LEVEL.ERROR, ...args);
  }

  function logFetch(typeOrUrl, timeMs, result) {
    if (!DEBUG_MODE) return;
    const status = result === 'OK' ? 'OK' : (result || 'FAIL');
    const label = /^FETCH_|DOM_|BETWEEN_/.test(typeOrUrl) ? typeOrUrl : `FETCH ${String(typeOrUrl).slice(-35)}`;
    info(`${label} ${Math.round(timeMs)}ms → ${status}`);
  }

  function logDelay(type, ms) {
    if (!DEBUG_MODE) return;
    info(`${type} ${ms}ms`);
  }

  function logBackoff(state, detail) {
    if (!DEBUG_MODE) return;
    info(`BACKOFF ${state} → ${detail}`);
  }

  function logRisk(level, reason) {
    if (!DEBUG_MODE) return;
    warn(`RISK ${level} → ${reason}`);
  }

  function logQueue(pending, completed, failed) {
    if (!DEBUG_MODE) return;
    info(`QUEUE pending=${pending} completed=${completed} failed=${failed}`);
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.LegalMevLogger = {
      setDebugMode,
      isDebugEnabled,
      info,
      warn,
      error,
      logFetch,
      logDelay,
      logBackoff,
      logRisk,
      logQueue,
      LEVEL
    };
  }
})();
