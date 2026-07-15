/**
 * Empaquetado ZIP/PDF bajo demanda — LegalMev (SPEC-04).
 *
 * PDF único:
 *  - Si hay PDFs nativos del portal (Salta/PJN), une portada LegalMev + esos PDFs.
 *  - Si no, arma el PDF de texto (MEV / sin adjuntos).
 * ZIP:
 *  - Si el movimiento es un PDF nativo, ese PDF es la pieza principal.
 *  - Si no, genera pieza de texto LegalMev y agrega adjuntos aparte.
 */
(function () {
  'use strict';

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 4000);
  }

  async function resolveNativeFiles(act, opts, idx) {
    const Merge = window.LegalMevMergePdfs;
    if (typeof opts.resolveAdjuntos === 'function') {
      try {
        const files = (await opts.resolveAdjuntos(act, {
          index: idx,
          cancelFlag: opts.cancelFlag,
          setProgress: opts.setProgress,
        })) || [];
        return files.filter((f) => f?.bytes && (!Merge || Merge.looksLikePdf(f.bytes)));
      } catch (_) {
        /* fallthrough */
      }
    }
    if (Merge) {
      return Merge.nativeBytesFromAct(act).map((bytes, j) => ({
        nombre: `documento_${j + 1}.pdf`,
        bytes,
      }));
    }
    if (Array.isArray(act.adjuntoBytes)) {
      return act.adjuntoBytes.filter((f) => f?.bytes);
    }
    return [];
  }

  async function buildPdfUnico(opts) {
    const FN = window.LegalMevFilename || window.LegalMevExportNombres;
    const Pdf = window.LegalMevPdfText;
    const Merge = window.LegalMevMergePdfs;
    const { datos, actuaciones, setProgress, cancelFlag } = opts;

    const nativeParts = [];
    let anyNativeFromPortal = false;
    for (let i = 0; i < actuaciones.length; i++) {
      if (cancelFlag.cancelled) throw new Error('Cancelado por el usuario');
      setProgress(
        20 + Math.round((55 * i) / actuaciones.length),
        `Preparando PDF ${i + 1}/${actuaciones.length}…`
      );
      const files = await resolveNativeFiles(actuaciones[i], opts, i + 1);
      if (files.length) {
        anyNativeFromPortal = true;
        for (const f of files) nativeParts.push(f.bytes);
      } else if (Merge && Pdf?.buildActuacionPdf) {
        // Mixto (ej. Tucumán): nota actuarial en texto + escritos en ADJUNTOS PDF
        try {
          nativeParts.push(Pdf.buildActuacionPdf(actuaciones[i], i + 1, datos));
        } catch (_) {}
      }
    }

    // Con PDFs del portal (Salta/PJN/Tucumán adjuntos): portada índice + documentos
    // (los movimientos sin adjunto se insertan como pieza de texto LegalMev).
    if (Merge && anyNativeFromPortal && nativeParts.length > 0) {
      setProgress(78, 'Uniendo documentos originales…');
      let coverBytes = null;
      try {
        coverBytes = Pdf.buildResumenPdf({ ...datos, actuaciones });
      } catch (_) {}
      const bytes = await Merge.mergePdfParts({
        coverBytes,
        parts: nativeParts,
        onProgress: (i, n) => setProgress(78 + Math.round((18 * i) / n), `Uniendo ${i}/${n}…`),
      });
      const name = `${FN.sanitizeSegment(datos.nroExpediente || 'expediente', 'expediente')}.pdf`;
      triggerDownload(new Blob([bytes], { type: 'application/pdf' }), name);
      setProgress(100, 'PDF listo (documentos originales).');
      return { ok: true, errors: [], mode: 'native-merge' };
    }

    // Fallback: PDF de texto LegalMev (MEV / sin binarios)
    setProgress(40, 'Armando PDF único…');
    const bytes = Pdf.buildMergedPdf({ ...datos, actuaciones });
    const name = `${FN.sanitizeSegment(datos.nroExpediente || 'expediente', 'expediente')}.pdf`;
    triggerDownload(new Blob([bytes], { type: 'application/pdf' }), name);
    setProgress(100, 'PDF listo.');
    return { ok: true, errors: [], mode: 'text' };
  }

  async function runExport(opts) {
    const FN = window.LegalMevFilename || window.LegalMevExportNombres;
    const Pdf = window.LegalMevPdfText;
    if (!FN || !Pdf) throw new Error('Módulos de exportación LegalMev no cargados');

    const { mode, datos, actuaciones } = opts;
    const setProgress = opts.setProgress || (() => {});
    const cancelFlag = opts.cancelFlag || { cancelled: false };
    const packed = { ...opts, setProgress, cancelFlag };

    if (!actuaciones?.length) throw new Error('No hay actuaciones seleccionadas');

    if (mode === 'pdf') {
      if (cancelFlag.cancelled) throw new Error('Cancelado por el usuario');
      return buildPdfUnico(packed);
    }

    if (typeof JSZip === 'undefined') throw new Error('JSZip no está disponible');

    const zip = new JSZip();
    const folderName = FN.folderFromExpediente(
      datos.nroExpediente || 'expediente',
      datos.portal || 'portal'
    );
    const root = zip.folder(folderName);
    const usedNames = new Set();
    const errors = [];
    const indiceName = FN.nombreIndicePdf ? FN.nombreIndicePdf() : 'indice.pdf';

    setProgress(10, `Armando ${indiceName}…`);
    root.file(indiceName, Pdf.buildResumenPdf({ ...datos, actuaciones }));

    for (let i = 0; i < actuaciones.length; i++) {
      if (cancelFlag.cancelled) throw new Error('Cancelado por el usuario');
      const act = actuaciones[i];
      const idx = i + 1;
      const fechaSlug = FN.sanitizeSegment((act.fecha || '').replace(/\//g, '-'), 'sfecha');
      const tipoSlug = FN.sanitizeSegment(act.tipo || act.titulo || 'actuacion', 'actuacion');
      const base = `${FN.pad3(idx)}_${fechaSlug}_${tipoSlug}`;

      setProgress(
        15 + Math.round((70 * i) / actuaciones.length),
        `PDF pieza ${idx}/${actuaciones.length}…`
      );

      let natives = [];
      try {
        natives = await resolveNativeFiles(act, packed, idx);
      } catch (e) {
        errors.push(`Pieza ${idx}: adjuntos — ${e.message}`);
      }

      // Movimiento = PDF nativo (Salta / PJN): ese PDF es la pieza principal
      if (natives.length > 0) {
        const main = natives[0];
        const safeMain = FN.sanitizeSegment(main.nombre || `${base}.pdf`, `${base}.pdf`);
        const mainName = safeMain.toLowerCase().endsWith('.pdf') ? `${base}.pdf` : `${base}_${safeMain}`;
        root.file(FN.uniqueName(usedNames, mainName.endsWith('.pdf') ? mainName : `${base}.pdf`), main.bytes);
        for (let j = 1; j < natives.length; j++) {
          const f = natives[j];
          const safe = FN.sanitizeSegment(f.nombre || `adjunto_${j}.pdf`, `adjunto_${j}.pdf`);
          root.file(FN.uniqueName(usedNames, `${base}_adj_${j}_${safe}`), f.bytes);
        }
        continue;
      }

      try {
        const pdfBytes = Pdf.buildActuacionPdf(act, idx, datos);
        root.file(FN.uniqueName(usedNames, `${base}.pdf`), pdfBytes);
      } catch (e) {
        errors.push(`Pieza ${idx}: no se pudo generar PDF — ${e.message}`);
      }
    }

    if (errors.length) {
      const informe = FN.nombreInformeFallos ? FN.nombreInformeFallos() : 'informe_descarga.txt';
      root.file(
        informe,
        [
          'Informe de descarga — LegalMev',
          `Fecha: ${new Date().toLocaleString('es-AR')}`,
          `Expediente: ${datos.nroExpediente || '—'}`,
          `Portal: ${datos.portal || '—'}`,
          `Observaciones: ${errors.length}`,
          '',
          ...errors.map((e, n) => `${n + 1}. ${e}`),
        ].join('\n')
      );
    }

    setProgress(92, 'Comprimiendo ZIP…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const zipName = `${FN.sanitizeSegment(datos.nroExpediente || 'expediente', 'expediente')}.zip`;
    triggerDownload(blob, zipName);
    setProgress(100, errors.length ? `ZIP listo con ${errors.length} observación(es).` : 'ZIP listo.');
    return { ok: true, errors };
  }

  const api = { runExport, triggerDownload };
  if (typeof window !== 'undefined') window.LegalMevExportRunner = api;
  if (typeof self !== 'undefined') self.LegalMevExportRunner = api;
})();
