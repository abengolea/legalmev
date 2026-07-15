/**
 * Panel de gestión de monitoreo LegalMev 1.7 (solo extensión).
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let dash = null;

  function fmtDate(ts) {
    if (!ts) return '—';
    if (typeof ts === 'string' && /^\d{1,2}\//.test(ts)) return ts;
    try {
      return new Date(ts).toLocaleString('es-AR');
    } catch {
      return String(ts);
    }
  }

  function setStatus(t) {
    $('status').textContent = t || '';
  }

  function send(type, extra = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, ...extra }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp || { ok: false, error: 'Sin respuesta' });
      });
    });
  }

  async function load() {
    setStatus('Actualizando…');
    const resp = await send('MONITOR_LIST');
    if (!resp.ok) {
      setStatus(resp.error || 'Error');
      return;
    }
    dash = resp;
    render();
    setStatus(`Actualizado · intervalo ${resp.settings?.intervalHours || 6} h`);
  }

  function render() {
    const cases = dash?.cases || [];
    const alerts = dash?.alerts || [];
    const novelty = dash?.noveltyCaseCount || 0;

    $('summary').innerHTML = `
      <strong>${cases.length}</strong> causa(s) ·
      <strong>${novelty}</strong> con novedades sin leer ·
      <strong>${alerts.filter((a) => !a.read).length}</strong> alertas sin leer
    `;

    const list = $('list');
    if (!cases.length) {
      list.innerHTML = `
        <div class="empty">
          <p>Todavía no monitoreás ninguna causa.</p>
          <p>Abrí un expediente en MEV, PJN o MPBA y usá <strong>Monitorear expediente</strong> en el panel LegalMev.</p>
        </div>`;
      return;
    }

    list.innerHTML = cases
      .map((c) => {
        const caseAlerts = alerts.filter((a) => a.caseId === c.id);
        const badge = c.status === 'paused'
          ? '<span class="badge paused">PAUSADO</span>'
          : c.hasNovelty
            ? '<span class="badge nov">NOVEDAD</span>'
            : '<span class="badge ok">AL DÍA</span>';
        const alertHtml = caseAlerts.length
          ? `<div class="alerts">${caseAlerts
              .slice(0, 12)
              .map(
                (a) => `
              <div class="alert ${a.read ? '' : 'unread'}">
                <div>
                  <div class="desc">${escapeHtml(a.fecha || '')} · ${escapeHtml(a.tipo || a.descripcion || 'Movimiento')}</div>
                  <div class="meta" style="margin:2px 0 0">${escapeHtml(a.descripcion || '')}</div>
                </div>
                ${
                  a.read
                    ? '<span class="meta">Leída</span>'
                    : `<button type="button" data-read-alert="${a.id}">Marcar leída</button>`
                }
              </div>`
              )
              .join('')}</div>`
          : '<div class="meta">Sin alertas todavía.</div>';

        return `
          <article class="case" data-id="${escapeHtml(c.id)}">
            <div class="case-head">
              <h2 class="case-title">${escapeHtml(c.nroExpediente || c.portal)} ${badge}</h2>
              <span class="meta">${escapeHtml(c.portal)}</span>
            </div>
            <p class="meta">${escapeHtml(c.caratula || 'Sin carátula')}</p>
            <p class="meta">
              Estado: ${escapeHtml(c.status)} ·
              Movimientos conocidos: ${c.knownMovementCount ?? '—'} ·
              Último escaneo: ${fmtDate(c.lastScanAt)} (${escapeHtml(c.lastScanResult || '—')})
              ${c.lastScanError ? ` · Error: ${escapeHtml(c.lastScanError)}` : ''}
            </p>
            <div class="actions">
              <button type="button" data-open="${escapeHtml(c.url || '')}">Abrir en portal</button>
              <button type="button" data-scan="${escapeHtml(c.id)}">Escanear ahora</button>
              ${
                c.status === 'paused'
                  ? `<button type="button" data-resume="${escapeHtml(c.id)}">Reanudar</button>`
                  : `<button type="button" data-pause="${escapeHtml(c.id)}">Pausar avisos</button>`
              }
              <button type="button" data-mark-case="${escapeHtml(c.id)}">Marcar alertas leídas</button>
              <button type="button" data-remove="${escapeHtml(c.id)}">Eliminar</button>
            </div>
            ${alertHtml}
          </article>`;
      })
      .join('');

    list.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-open');
        if (url) chrome.tabs.create({ url, active: true });
      });
    });
    list.querySelectorAll('[data-scan]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-scan');
        btn.disabled = true;
        setStatus('Escaneando…');
        const r = await send('MONITOR_SCAN_NOW', { id });
        btn.disabled = false;
        if (!r.ok) setStatus(r.error || 'Error en escaneo');
        else if (r.novedades) setStatus(`${r.novedades} novedad(es)`);
        else setStatus('Sin novedades');
        await load();
      });
    });
    list.querySelectorAll('[data-pause]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await send('MONITOR_PAUSE', { id: btn.getAttribute('data-pause') });
        await load();
      });
    });
    list.querySelectorAll('[data-resume]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await send('MONITOR_RESUME', { id: btn.getAttribute('data-resume') });
        await load();
      });
    });
    list.querySelectorAll('[data-mark-case]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await send('MONITOR_MARK_READ', { payload: { caseId: btn.getAttribute('data-mark-case') } });
        await load();
      });
    });
    list.querySelectorAll('[data-read-alert]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await send('MONITOR_MARK_READ', { payload: { alertId: btn.getAttribute('data-read-alert') } });
        await load();
      });
    });
    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-remove');
        if (!confirm('¿Eliminar el monitoreo de esta causa? También se borran sus alertas (cascade).')) return;
        await send('MONITOR_REMOVE', { id });
        await load();
      });
    });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  $('btnRefresh').addEventListener('click', load);
  $('btnScanAll').addEventListener('click', async () => {
    $('btnScanAll').disabled = true;
    setStatus('Escaneando todas las causas activas…');
    const r = await send('MONITOR_SCAN_ALL');
    $('btnScanAll').disabled = false;
    setStatus(r.ok ? `Listo · ${r.novedades || 0} novedades · ${r.errors || 0} errores` : r.error || r.reason);
    await load();
  });
  $('btnMarkAll').addEventListener('click', async () => {
    await send('MONITOR_MARK_READ', { payload: { all: true } });
    await load();
  });

  load();
})();
