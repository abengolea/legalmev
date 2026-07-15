/**
 * BackoffController — Reacciona a eventos de riesgo y controla la velocidad global.
 * Estados: NORMAL | SLOWED | PAUSED | RECOVERING
 */
(function () {
  'use strict';

  const STATE = { NORMAL: 'NORMAL', SLOWED: 'SLOWED', PAUSED: 'PAUSED', RECOVERING: 'RECOVERING' };

  const CONFIG = {
    LOW: { delayMultiplier: 1.5, durationMs: 2 * 60 * 1000 },
    MEDIUM: { pauseMs: 30 * 1000, thenSlowed: true },
    HIGH: { pauseMs: 2 * 60 * 1000, notifyUser: true }
  };

  const RECOVERY_DURATION_MS = 5 * 60 * 1000;

  let _state = STATE.NORMAL;
  let _delayMultiplier = 1;
  let _pauseUntil = 0;
  let _recoveryStart = 0;
  let _recoveryEnd = 0;
  let _onNotifyUser = null;
  let _taskQueue = null;

  function getState() {
    return _state;
  }

  function getDelayMultiplier() {
    return _delayMultiplier;
  }

  function isPaused() {
    return _state === STATE.PAUSED && Date.now() < _pauseUntil;
  }

  function setTaskQueue(queue) {
    _taskQueue = queue;
  }

  function setOnNotifyUser(fn) {
    _onNotifyUser = fn;
  }

  async function waitIfPaused() {
    if (_state !== STATE.PAUSED) return;
    const remaining = _pauseUntil - Date.now();
    if (remaining <= 0) {
      _state = _delayMultiplier > 1 ? STATE.RECOVERING : STATE.NORMAL;
      _recoveryStart = Date.now();
      _recoveryEnd = _recoveryStart + RECOVERY_DURATION_MS;
      return;
    }
    await new Promise((r) => setTimeout(r, Math.min(remaining, 1000)));
    return waitIfPaused();
  }

  function handleRisk(payload) {
    const { level, reason } = payload || {};
    if (!level) return;

    const cfg = CONFIG[level];
    if (!cfg) return;

    if (level === 'LOW') {
      _state = STATE.SLOWED;
      _delayMultiplier = cfg.delayMultiplier;
      _pauseUntil = Date.now() + cfg.durationMs;
      return;
    }

    if (level === 'MEDIUM') {
      _state = STATE.PAUSED;
      _pauseUntil = Date.now() + cfg.pauseMs;
      _delayMultiplier = cfg.thenSlowed ? 1.5 : 1;
      _recoveryStart = _pauseUntil;
      _recoveryEnd = _recoveryStart + RECOVERY_DURATION_MS;
      return;
    }

    if (level === 'HIGH') {
      _state = STATE.PAUSED;
      _pauseUntil = Date.now() + cfg.pauseMs;
      _delayMultiplier = 1.5;
      _recoveryStart = _pauseUntil;
      _recoveryEnd = _recoveryStart + RECOVERY_DURATION_MS;
      if (cfg.notifyUser && typeof _onNotifyUser === 'function') {
        _onNotifyUser({ level, reason });
      }
      return;
    }
  }

  function tick() {
    const now = Date.now();
    if (_state === STATE.PAUSED && now < _pauseUntil) return;
    if (_state === STATE.PAUSED) {
      _state = STATE.RECOVERING;
      _recoveryStart = now;
      _recoveryEnd = now + RECOVERY_DURATION_MS;
    }
    if (_state === STATE.SLOWED && now > _pauseUntil) {
      _state = STATE.NORMAL;
      _delayMultiplier = 1;
      return;
    }
    if (_state === STATE.RECOVERING && now < _recoveryEnd) {
      const elapsed = now - _recoveryStart;
      const total = _recoveryEnd - _recoveryStart;
      _delayMultiplier = 1 + 0.5 * (1 - elapsed / total);
      return;
    }
    if (_state === STATE.RECOVERING && now >= _recoveryEnd) {
      _state = STATE.NORMAL;
      _delayMultiplier = 1;
    }
  }

  function getEffectiveMultiplier() {
    tick();
    return _delayMultiplier;
  }

  function reset() {
    _state = STATE.NORMAL;
    _delayMultiplier = 1;
    _pauseUntil = 0;
    _recoveryStart = 0;
    _recoveryEnd = 0;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.LegalMevBackoffController = {
      getState,
      getDelayMultiplier: getEffectiveMultiplier,
      isPaused,
      waitIfPaused,
      handleRisk,
      setTaskQueue,
      setOnNotifyUser,
      reset,
      STATE
    };
  }
})();
