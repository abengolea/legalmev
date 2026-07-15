/**
 * Sync de metadatos de seguimiento ↔ cuenta LegalMev (SPEC-05).
 * No sube PDFs ni movimientos.
 */
(function (root) {
  'use strict';

  const Meta = () => root.LegalMevSegMetadatos;
  const Repo = () => root.__lmSegRepo;

  async function getApiContext() {
    const { authToken, apiBase, deviceId } = await chrome.storage.local.get([
      'authToken',
      'apiBase',
      'deviceId',
    ]);
    if (!authToken) return null;
    const base = (apiBase && typeof apiBase === 'string' ? apiBase : 'https://www.legalmev.com.ar').replace(
      /\/$/,
      ''
    );
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };
    if (deviceId) headers['X-Device-Id'] = deviceId;
    return { base, headers };
  }

  function toMeta(c) {
    return Meta().sanitizar({
      id: c.id,
      portal: c.portal,
      nroExpediente: c.nroExpediente,
      caratula: c.caratulaCorta || c.caratula,
      juzgado: c.organismo || c.juzgado,
      url: c.urlConsulta || c.url,
      status: c.estado === 'pausado' ? 'paused' : 'active',
      createdAt:
        typeof c.creadoAt === 'number' ? new Date(c.creadoAt).toISOString() : c.createdAt,
      updatedAt:
        typeof c.actualizadoAt === 'number'
          ? new Date(c.actualizadoAt).toISOString()
          : c.updatedAt,
    });
  }

  async function pushCase(caseRow) {
    try {
      const ctx = await getApiContext();
      const meta = toMeta(caseRow);
      if (!ctx || !meta) return { ok: false, skipped: true };
      const res = await fetch(`${ctx.base}/api/extension/watched-cases`, {
        method: 'PUT',
        headers: ctx.headers,
        body: JSON.stringify({ case: meta }),
      });
      if (!res.ok) return { ok: false, status: res.status };
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  async function removeCase(id) {
    try {
      const ctx = await getApiContext();
      if (!ctx || !id) return { ok: false, skipped: true };
      const res = await fetch(
        `${ctx.base}/api/extension/watched-cases?id=${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: ctx.headers }
      );
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }

  async function syncNow() {
    const repo = Repo();
    if (!repo) return { ok: false };
    const refs = await repo.listReferencias();
    let written = 0;
    for (const r of refs) {
      const out = await pushCase(r);
      if (out.ok) written += 1;
    }
    return { ok: true, written };
  }

  root.LegalMevSegSync = { pushCase, removeCase, syncNow, getApiContext };
  // Compatibilidad con background existente
  root.LegalMevCloudSync = {
    pushCase,
    removeCase,
    syncNow: (opts) => syncNow(opts),
  };
})(typeof self !== 'undefined' ? self : window);
