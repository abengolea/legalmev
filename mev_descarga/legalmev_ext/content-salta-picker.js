/**
 * Salta — modal de selección + PDF/ZIP con el mismo formato LegalMev que MEV/PJN.
 */
(function () {
  'use strict';
  if (window.__LEGALMEV_SALTA_PICKER__) return;
  window.__LEGALMEV_SALTA_PICKER__ = true;

  function core() {
    return globalThis.LegalMevSaltaCore;
  }

  async function openDownloadFlow() {
    const Ui = window.LegalMevDownloadUi;
    const C = core();
    if (!Ui || !C) {
      alert('LegalMev: componentes Salta no cargados. Recargá la página (F5).');
      return;
    }
    if (!window.LegalMevExportRunner || !window.LegalMevPdfText) {
      alert('LegalMev: librerías PDF no cargadas. Recargá la extensión y la página.');
      return;
    }

    const picker = Ui.openPicker({
      portal: 'SALTA',
      title: 'Armar exportación Salta',
      subtitle:
        'Cada actuación es un PDF del portal. El PDF único une esos documentos; el ZIP guarda uno por movimiento.',
      items: [],
      originLabel: 'Salta · consulta pública',
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
        if (!actuaciones.length) throw new Error('No se encontraron actuaciones seleccionadas');

        const conPdf = actuaciones.filter((a) => a.pdfBytes || (a.adjuntoBytes && a.adjuntoBytes.length)).length;
        if (conPdf === 0) {
          const ok = window.confirm(
            'Ninguna de las actuaciones seleccionadas tiene PDF digital en el portal de Salta ' +
              '(respuesta vacía 204).\n\n' +
              'Esto pasa en causas antiguas o movimientos sin documento escaneado.\n' +
              'Probá con escritos/actuaciones que al click abran un PDF con contenido.\n\n' +
              '¿Generar igual un PDF solo con títulos y el aviso?'
          );
          if (!ok) throw new Error('Exportación cancelada: sin PDFs digitales en la selección');
        }

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
        datos.portal = 'SALTA';
        datos.jurisdiccion = datos.jurisdiccion || 'Salta';

        setProgress(88, mode === 'pdf' ? 'Armando PDF…' : 'Armando ZIP…');
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

    picker.setLoadingMessage('Obteniendo actuaciones de Salta…');
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
        picker.setError('No se encontraron actuaciones en este expediente.');
        return;
      }
      picker.setItems(items, {
        originLabel: `Salta · ${items.length} actuación${items.length === 1 ? '' : 'es'}`,
      });
    } catch (e) {
      picker.setError(e.message || String(e));
    }
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === 'START_DOWNLOAD_PICKER' || msg?.type === 'SALTA_START_ZIP_EXPORT') {
      openDownloadFlow()
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });
})();
