/**
 * Descarga robusta de archivos desde portales judiciales.
 *
 * - Reintentos con backoff exponencial
 * - Detecta HTML de error servido como "archivo"
 * - Valida tamaño mínimo y firmas básicas (PDF/%PDF, ZIP/PK)
 */
(function () {
  'use strict';

  const DEFAULTS = {
    minBytes: 64,
    timeoutMs: 60_000,
    maxAttemptsDocs: 7,
    maxAttemptsMev: 3,
    baseDelayMs: 800,
  };

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function hostMaxAttempts(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes('docs.scba.gov.ar')) return DEFAULTS.maxAttemptsDocs;
      if (host.includes('mev.scba.gov.ar')) return DEFAULTS.maxAttemptsMev;
    } catch (_) {}
    return 4;
  }

  function looksLikeHtml(bytes, contentType) {
    if (contentType && /text\/html|application\/xhtml/i.test(contentType)) return true;
    if (!bytes || bytes.length < 15) return false;
    const head = new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.slice(0, 200))
      .trimStart()
      .toLowerCase();
    return (
      head.startsWith('<!doctype html') ||
      head.startsWith('<html') ||
      head.includes('<head>') ||
      head.includes('error') && head.includes('<body')
    );
  }

  function inferKind(bytes, contentType, fileName) {
    const name = (fileName || '').toLowerCase();
    if (bytes && bytes.length >= 4) {
      // %PDF
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return 'pdf';
      }
      // PK (zip/docx/xlsx)
      if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
    }
    if (contentType) {
      if (/pdf/i.test(contentType)) return 'pdf';
      if (/zip|octet-stream/i.test(contentType) && /\.zip$/i.test(name)) return 'zip';
    }
    if (/\.pdf$/i.test(name)) return 'pdf';
    return 'bin';
  }

  /**
   * @param {string} url
   * @param {{ fileName?: string, minBytes?: number, timeoutMs?: number, signal?: AbortSignal }} [opts]
   * @returns {Promise<{ ok: true, bytes: Uint8Array, contentType: string, kind: string, attempts: number } | { ok: false, error: string, attempts: number }>}
   */
  async function fetchBinary(url, opts = {}) {
    const minBytes = opts.minBytes ?? DEFAULTS.minBytes;
    const timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
    const maxAttempts = hostMaxAttempts(url);
    let lastError = 'Error desconocido';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (opts.signal?.aborted) {
        return { ok: false, error: 'Cancelado', attempts: attempt };
      }

      const ctrl = new AbortController();
      const onAbort = () => ctrl.abort();
      opts.signal?.addEventListener?.('abort', onAbort, { once: true });
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);

      try {
        const resp = await fetch(url, {
          credentials: 'include',
          signal: ctrl.signal,
          headers: {
            Accept: 'application/pdf,application/octet-stream,*/*',
            'Accept-Language': 'es-AR,es;q=0.9',
          },
        });

        if (!resp.ok) {
          lastError = `HTTP ${resp.status}`;
          throw new Error(lastError);
        }

        const contentType = resp.headers.get('content-type') || '';
        const buf = new Uint8Array(await resp.arrayBuffer());

        if (buf.length < minBytes) {
          lastError = `Archivo vacío o demasiado chico (${buf.length} bytes)`;
          throw new Error(lastError);
        }

        if (looksLikeHtml(buf, contentType)) {
          lastError = 'El portal devolvió HTML de error en lugar del archivo';
          throw new Error(lastError);
        }

        const kind = inferKind(buf, contentType, opts.fileName);
        return { ok: true, bytes: buf, contentType, kind, attempts: attempt };
      } catch (e) {
        lastError = e?.name === 'AbortError'
          ? `Timeout (${timeoutMs / 1000}s)`
          : (e?.message || String(e));

        if (attempt < maxAttempts) {
          const delay = DEFAULTS.baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 400);
          await sleep(delay);
        }
      } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener?.('abort', onAbort);
      }
    }

    return { ok: false, error: lastError, attempts: maxAttempts };
  }

  const api = { fetchBinary, looksLikeHtml, hostMaxAttempts };
  if (typeof window !== 'undefined') window.LegalMevRobustFetch = api;
  if (typeof self !== 'undefined') self.LegalMevRobustFetch = api;
})();
