/**
 * MPBA — Ver Proceso: barra flotante + modal de selección (mismo flujo MEV/PJN).
 */
(function () {
  'use strict';
  if (window.__LEGALMEV_MPBA_PICKER__) return;
  window.__LEGALMEV_MPBA_PICKER__ = true;

  function isProcesoPage() {
    return /\/Web\/Proceso\/VerProceso/i.test(location.href);
  }

  function core() {
    return globalThis.LegalMevMpbaCore;
  }

  function detectCountQuick() {
    const C = core();
    if (!C) return 0;
    try {
      const total = C.detectarTotal?.() || 0;
      if (total > 0) return total;
      return (C.extraerFilas?.() || []).length;
    } catch (_) {
      return 0;
    }
  }

  async function openDownloadFlow() {
    const Ui = window.LegalMevDownloadUi;
    const C = core();
    if (!Ui || !C) {
      alert('LegalMev: componentes MPBA no cargados. Recargá la página (F5).');
      return;
    }

    const picker = Ui.openPicker({
      portal: 'MPBA',
      title: 'Armar exportación MPBA',
      subtitle: 'Elegí trámites e integrá carpeta ZIP o un PDF único',
      items: [],
      originLabel: 'MPBA · Ver Proceso',
      async onExport({ mode, selectedItems, setProgress, cancelFlag }) {
        C.setCancel(false);
        const sendProgress = (d) => {
          if (d?.mensaje) setProgress(d.progreso ?? null, d.mensaje);
        };
        const actuaciones = await C.hydrateFromItems(selectedItems, sendProgress, cancelFlag);
        if (actuaciones === null || cancelFlag.cancelled) {
          throw new Error('Cancelado por el usuario');
        }
        if (!actuaciones.length) throw new Error('No se encontraron trámites seleccionados');

        const datos = C.extractDatos();
        datos.portal = 'MPBA';

        setProgress(88, mode === 'pdf' ? 'Armando PDF…' : 'Armando ZIP…');
        await window.LegalMevExportRunner.runExport({
          mode,
          datos,
          actuaciones,
          cancelFlag,
          setProgress,
        });
      },
    });

    picker.setLoadingMessage('Recorriendo todas las páginas de trámites…');
    try {
      const cancelFlag = picker.getCancelFlag();
      const items = await C.listTramites((d) => {
        if (d?.mensaje) picker.setLoadingMessage(d.mensaje);
      }, cancelFlag);
      if (items === null || cancelFlag.cancelled) {
        picker.setError('Cancelado.');
        return;
      }
      if (!items.length) {
        picker.setError('No se encontraron trámites en este proceso.');
        return;
      }
      picker.setItems(items, {
        originLabel: `MPBA · ${items.length} trámite${items.length === 1 ? '' : 's'}`,
      });
    } catch (e) {
      picker.setError(e.message || String(e));
    }
  }

  function boot() {
    if (!isProcesoPage()) return;
    const Ui = window.LegalMevDownloadUi;
    if (!Ui) return;
    const count = detectCountQuick();
    const datos = core()?.extractDatos?.() || {};
    const label = datos.nroExpediente
      ? `${datos.nroExpediente}${count ? ` · ${count} trámites` : ''}`
      : count
        ? `${count} trámite${count === 1 ? '' : 's'} detectados`
        : 'Proceso MPBA detectado';

    Ui.mountFloatingBar({
      portal: 'MPBA',
      detectCount: count,
      detectLabel: label,
      onDownload: () => openDownloadFlow(),
      onSave: () => {
        const d = core()?.extractDatos?.() || datos;
        chrome.runtime.sendMessage(
          {
            type: 'MONITOR_ACTIVATE',
            payload: {
              portal: 'MPBA',
              nroExpediente: d.nroExpediente || '',
              caratula: d.caratula || '',
              juzgado: d.juzgado || d.dependencia || '',
              url: location.href,
            },
          },
          (resp) => {
            if (resp?.ok) {
              alert(
                window.LegalMevDownloadUi?.followResultMessage?.(resp) ||
                  (resp.alreadyFollowed
                    ? 'Esta causa ya está en tu lista de seguimiento.'
                    : 'Causa guardada para seguimiento.')
              );
            } else {
              alert(resp?.error || 'No se pudo activar el monitoreo');
            }
          }
        );
      },
    });
  }

  function tryBoot(attempt = 0) {
    if (!isProcesoPage()) return;
    if (window.LegalMevDownloadUi && core()) {
      boot();
      return;
    }
    if (attempt < 20) setTimeout(() => tryBoot(attempt + 1), 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => tryBoot(0));
  } else {
    tryBoot(0);
  }

  // DataTables a veces carga tarde: re-montar cuando aparezca la tabla
  const mo = new MutationObserver(() => {
    if (document.getElementById('lm-export-dock') || document.getElementById('lm-mon-dl-bar')) return;
    if (document.querySelector('#lista-tramites')) tryBoot(0);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 15000);

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === 'MONITOR_LIST_MOVEMENTS') {
      const C = core();
      if (!C?.listTramites) {
        sendResponse({ ok: false, error: 'Core MPBA no disponible', code: 'PARSE_ERROR' });
        return true;
      }
      C.listTramites()
        .then((items) => {
          if (items === null) {
            sendResponse({ ok: false, error: 'Cancelado', code: 'UNKNOWN' });
            return;
          }
          const movements = (items || []).map((it) => ({
            id: it.ccs || it.id,
            portalId: it.ccs || it.id,
            fecha: it.fecha || '',
            tipo: it.tipo || it.descripcion || '',
            descripcion: it.descripcion || it.tipo || '',
          }));
          sendResponse({ ok: true, portal: 'MPBA', movements });
        })
        .catch((e) => sendResponse({ ok: false, error: e.message, code: 'PARSE_ERROR' }));
      return true;
    }
    if (msg?.type === 'START_DOWNLOAD_PICKER' || msg?.type === 'MPBA_START_ZIP_EXPORT') {
      openDownloadFlow()
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });
})();
