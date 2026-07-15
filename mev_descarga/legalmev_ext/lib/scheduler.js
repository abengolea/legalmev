/**
 * Scheduler — Fachada única para content scripts (este archivo es un solo módulo).
 * RiskDetector y BackoffController están en lib/riskDetector.js y lib/backoffController.js;
 * el manifest los carga antes que scheduler.js cuando aplican (p. ej. MPBA).
 */
(function () {
  'use strict';

  const queue = globalThis.LegalMevTaskQueue?.getInstance?.() || null;
  const humanDelay = globalThis.LegalMevHumanDelay;
  const riskDetector = globalThis.LegalMevRiskDetector;
  const backoff = globalThis.LegalMevBackoffController;
  const cache = globalThis.LegalMevLocalCache;
  const logger = globalThis.LegalMevLogger;

  const DEFAULT_FETCH_OPTS = {
    credentials: 'include',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
      'Accept-Language': 'es-AR,es;q=0.9',
      Referer: typeof location !== 'undefined' ? location.origin + '/' : ''
    }
  };

  /** Evita fetch colgado indefinidamente (MEV lento / red colgada / cola bloqueada). */
  const DEFAULT_FETCH_TIMEOUT_MS = 120000;
  const PDF_FETCH_TIMEOUT_MS = 180000;

  /**
   * El AbortController del fetch corta la conexión hasta headers; leer el cuerpo (arrayBuffer/text)
   * puede colgarse sin límite. Promise.race evita que la extensión quede congelada indefinidamente.
   */
  async function readResponseBodyWithTimeout(resp, readPromise, ms, esBinario) {
    let timerId;
    const timeoutPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => {
        try {
          resp.body?.cancel?.();
        } catch (_) {}
        reject(
          new Error(
            esBinario
              ? `Tiempo agotado (${Math.round(ms / 1000)}s) leyendo el documento (PDF u otro archivo)`
              : `Tiempo agotado (${Math.round(ms / 1000)}s) leyendo la respuesta del servidor`
          )
        );
      }, ms);
    });
    try {
      return await Promise.race([
        readPromise.finally(() => {
          clearTimeout(timerId);
        }),
        timeoutPromise
      ]);
    } catch (e) {
      clearTimeout(timerId);
      try {
        resp.body?.cancel?.();
      } catch (_) {}
      throw e;
    }
  }

  async function _doFetch(url, type, fetchOpts, skipHumanDelay, skipRiskAnalyze) {
    await backoff?.waitIfPaused?.();

    if (!skipHumanDelay) {
      const delayBase = humanDelay?.computeDelay?.(type) ?? 800;
      const mult = backoff?.getDelayMultiplier?.() ?? 1;
      const delayMs = Math.round(delayBase * mult);
      logger?.logDelay?.(type, delayMs);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const userSignal = fetchOpts.signal;
    const optTimeoutMs = fetchOpts.timeoutMs;
    const optBodyReadMs = fetchOpts.bodyReadTimeoutMs;
    const { signal: _omitSignal, timeoutMs: _omitTimeout, bodyReadTimeoutMs: _omitBodyRead, ...restFetch } = fetchOpts;
    const timeoutMs =
      typeof optTimeoutMs === 'number' && optTimeoutMs > 0
        ? optTimeoutMs
        : type === 'FETCH_PDF'
          ? PDF_FETCH_TIMEOUT_MS
          : DEFAULT_FETCH_TIMEOUT_MS;
    const bodyReadMs =
      typeof optBodyReadMs === 'number' && optBodyReadMs > 0 ? optBodyReadMs : timeoutMs;

    const abortTimer = new AbortController();
    const timerId = setTimeout(() => abortTimer.abort(), timeoutMs);
    let mergedSignal = abortTimer.signal;
    if (userSignal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      mergedSignal = AbortSignal.any([userSignal, abortTimer.signal]);
    }

    const start = Date.now();
    let resp;
    try {
      resp = await fetch(url, { ...DEFAULT_FETCH_OPTS, ...restFetch, signal: mergedSignal });
    } catch (e) {
      if (e?.name === 'AbortError') {
        throw new Error(
          timeoutMs > 0 && abortTimer.signal.aborted
            ? `Tiempo de espera agotado (${Math.round(timeoutMs / 1000)}s) al cargar la página`
            : 'Petición cancelada'
        );
      }
      throw e;
    } finally {
      clearTimeout(timerId);
    }
    const responseTimeMs = Date.now() - start;

    let body;
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const esBinario = type === 'FETCH_PDF' || ct.includes('pdf') || ct.includes('octet-stream');
    if (esBinario) {
      body = await readResponseBodyWithTimeout(resp, resp.arrayBuffer(), bodyReadMs, true);
    } else {
      body = await readResponseBodyWithTimeout(resp, resp.text(), bodyReadMs, false);
    }

    if (!skipRiskAnalyze) {
      riskDetector?.analyze?.(resp, {
        responseTimeMs,
        body: typeof body === 'string' ? body : null,
        url,
        contentType: ct
      });
    }

    if (!resp.ok) riskDetector?.recordError?.();
    else riskDetector?.recordSuccess?.();

    logger?.logFetch?.(type, responseTimeMs, resp.ok ? 'OK' : resp.status);

    return { resp, body, responseTimeMs };
  }

  async function fetch(url, opts = {}) {
    const type = opts.type || 'FETCH_HTML';
    const priority = opts.priority === 'HIGH' ? 'HIGH' : 'NORMAL';
    const fetchOpts = opts.fetchOpts || {};

    const cacheable = type === 'FETCH_HTML' && !opts.skipCache;
    if (cacheable && cache) {
      const cached = await cache.get(url);
      if (cached !== null) {
        logger?.logFetch?.(type, 0, 'CACHE');
        return cached;
      }
    }

    const task = async () => {
      const { resp, body } = await _doFetch(
        url,
        type,
        fetchOpts,
        opts.skipHumanDelay === true,
        opts.skipRiskAnalyze === true
      );
      if (cacheable && resp.ok && cache && typeof body === 'string') {
        await cache.set(url, body, { ttl: opts.cacheTtl ?? 600 });
      }
      if (opts.returnResponseInfo) {
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        return { body, url: resp.url, ok: resp.ok, contentType: ct };
      }
      return body;
    };

    // bypassQueue: ejecuta el fetch sin encolar (PJN/MEV pueden anidar awaits; con cola global de 1 tarea,
    // un segundo fetch encolado mientras la “tarea” aún no cerró provoca deadlock aparente = UI congelada).
    if (queue && !opts.bypassQueue) {
      const result = await queue.run(task, { priority, label: `fetch-${type}-${url.slice(-20)}` });
      const state = queue.getState();
      logger?.logQueue?.(state.pending, state.completed, state.failed);
      return result;
    }
    return task();
  }

  function setDebugMode(enabled) {
    logger?.setDebugMode?.(enabled);
  }

  function setup() {
    if (riskDetector && backoff) {
      riskDetector.on('RISK_DETECTED', (payload) => {
        logger?.logRisk?.(payload.level, payload.reason);
        backoff.handleRisk(payload);
      });
    }
    if (backoff && queue) {
      backoff.setTaskQueue(queue);
    }
  }

  setup();

  if (typeof globalThis !== 'undefined') {
    globalThis.LegalMevScheduler = {
      fetch,
      setDebugMode,
      get queue() {
        return queue;
      },
      get backoff() {
        return backoff;
      },
      get cache() {
        return cache;
      }
    };
  }
})();
