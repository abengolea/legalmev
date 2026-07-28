/**
 * Entre Ríos — modal de selección + PDF único LegalMev (mismo flujo que MEV/PJN/Salta).
 */
(function () {
  'use strict';
  if (window.__LEGALMEV_ENTRERIOS_PICKER__) return;
  window.__LEGALMEV_ENTRERIOS_PICKER__ = true;

  function core() {
    return globalThis.LegalMevEntreRiosCore;
  }

  async function openDownloadFlow() {
    const Ui = window.LegalMevDownloadUi;
    const C = core();
    if (!Ui || !C) {
      alert('LegalMev: componentes Entre Ríos no cargados. Recargá la página (F5).');
      return;
    }
    if (!window.LegalMevExportRunner || !window.LegalMevPdfText) {
      alert('LegalMev: librerías PDF no cargadas. Recargá la extensión y la página.');
      return;
    }

    const picker = Ui.openPicker({
      portal: 'ENTRERIOS',
      title: 'Armar exportación Entre Ríos',
      subtitle:
        'Seleccioná los movimientos. LegalMev arma el PDF con tipografía y colores propios.',
      items: [],
      originLabel: 'Entre Ríos · Mesa Virtual',
      async onExport({ mode, selectedItems, setProgress, cancelFlag }) {
        C.setCancel(false);
        const sendProgress = (d) => {
          if (d?.mensaje) setProgress(d.progreso ?? null, d.mensaje);
        };

        const watchCancel = setInterval(() => {
          if (cancelFlag.cancelled) C.setCancel(true);
        }, 200);

        let actuaciones;
        try {
          actuaciones = await C.hydrateFromItems(selectedItems, sendProgress, cancelFlag);
        } finally {
          clearInterval(watchCancel);
        }

        if (actuaciones === null || cancelFlag.cancelled) {
          throw new Error('Cancelado por el usuario');
        }
        if (!actuaciones.length) throw new Error('No se encontraron movimientos seleccionados');

        let datos = C.extractDatos?.() || {};
        try {
          const info = await C.getExpedienteInfo?.();
          if (info) {
            datos = {
              ...datos,
              caratula: info.caratula || datos.caratula,
              nroExpediente: info.nroExpediente || datos.nroExpediente,
              juzgado: info.juzgado || datos.juzgado,
              dependencia: info.juzgado || datos.dependencia,
            };
          }
        } catch (_) {}
        datos.portal = 'ENTRERIOS';
        datos.jurisdiccion = datos.jurisdiccion || 'Entre Ríos';

        setProgress(88, 'Armando PDF…');
        await window.LegalMevExportRunner.runExport({
          mode,
          datos,
          actuaciones,
          cancelFlag,
          setProgress,
          resolveAdjuntos: (act, ctx) => C.resolveAdjuntos(act, ctx),
        });
      },
    });

    picker.setLoadingMessage('Obteniendo movimientos de Entre Ríos…');
    try {
      const cancelFlag = picker.getCancelFlag();
      const items = await C.listActuaciones((d) => {
        if (d?.mensaje) picker.setLoadingMessage(d.mensaje);
      }, cancelFlag);
      if (items === null || cancelFlag.cancelled) {
        picker.setError('Cancelado.');
        return;
      }
      if (!items.length) {
        picker.setError('No se encontraron movimientos en este expediente.');
        return;
      }
      picker.setItems(items, {
        originLabel: `Entre Ríos · ${items.length} movimiento${items.length === 1 ? '' : 's'}`,
      });
    } catch (e) {
      picker.setError(e.message || String(e));
    }
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === 'START_DOWNLOAD_PICKER' || msg?.type === 'ENTRERIOS_START_ZIP_EXPORT') {
      openDownloadFlow()
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });
})();
