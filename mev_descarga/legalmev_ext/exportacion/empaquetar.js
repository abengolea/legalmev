/**
 * Empaquetado PDF bajo demanda — LegalMev (SPEC-04).
 *
 * PDF único:
 *  - Si hay PDFs nativos del portal (Salta/PJN), une portada LegalMev + esos PDFs.
 *  - Si no, arma el PDF de texto (MEV / sin adjuntos).
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

  function yieldUi() {
    return new Promise((r) => setTimeout(r, 0));
  }

  function downloadPdfBytes(bytes, datos, FN) {
    const name = FN.nombreArchivoExport
      ? FN.nombreArchivoExport(datos, 'pdf')
      : `${FN.sanitizeSegment(datos.nroExpediente || datos.caratula || 'expediente', 'expediente')}.pdf`;
    triggerDownload(new Blob([bytes], { type: 'application/pdf' }), name);
  }

  async function buildPdfUnico(opts) {
    const FN = window.LegalMevFilename || window.LegalMevExportNombres;
    const Pdf = window.LegalMevPdfText;
    const Merge = window.LegalMevMergePdfs;
    const { datos, actuaciones, setProgress, cancelFlag } = opts;
    const portal = String(datos?.portal || '').toUpperCase();
    // MEV: el contenido es texto de proveído. Evitar bajar/unir adjuntos y regenerar N PDFs.
    const textOnly = opts.forceTextPdf === true || portal === 'MEV';

    if (textOnly) {
      setProgress(55, 'Armando PDF único…');
      await yieldUi();
      if (cancelFlag.cancelled) throw new Error('Cancelado por el usuario');
      const bytes = Pdf.buildMergedPdf({ ...datos, actuaciones });
      downloadPdfBytes(bytes, datos, FN);
      setProgress(100, 'PDF listo.');
      return { ok: true, errors: [], mode: 'text' };
    }

    // 1) Solo binarios reales del portal (sin fabricar PDFs de texto todavía)
    const nativesByAct = [];
    let anyNativeFromPortal = false;
    for (let i = 0; i < actuaciones.length; i++) {
      if (cancelFlag.cancelled) throw new Error('Cancelado por el usuario');
      setProgress(
        20 + Math.round((50 * i) / actuaciones.length),
        `Preparando PDF ${i + 1}/${actuaciones.length}…`
      );
      const files = await resolveNativeFiles(actuaciones[i], opts, i + 1);
      nativesByAct[i] = files;
      if (files.length) anyNativeFromPortal = true;
      await yieldUi();
    }

    // Sin PDFs nativos → un solo PDF de texto (no generar N piezas descartables)
    if (!anyNativeFromPortal) {
      setProgress(70, 'Armando PDF único…');
      await yieldUi();
      const bytes = Pdf.buildMergedPdf({ ...datos, actuaciones });
      downloadPdfBytes(bytes, datos, FN);
      setProgress(100, 'PDF listo.');
      return { ok: true, errors: [], mode: 'text' };
    }

    // 2) Mixto: nativos + pieza de texto solo donde falta adjunto
    const nativeParts = [];
    for (let i = 0; i < actuaciones.length; i++) {
      if (cancelFlag.cancelled) throw new Error('Cancelado por el usuario');
      const files = nativesByAct[i] || [];
      if (files.length) {
        for (const f of files) nativeParts.push(f);
      } else if (Merge && Pdf?.buildActuacionPdf) {
        try {
          nativeParts.push({
            nombre: `actuacion_${i + 1}.pdf`,
            bytes: Pdf.buildActuacionPdf(actuaciones[i], i + 1, datos),
          });
        } catch (_) {}
      }
    }

    setProgress(78, 'Uniendo documentos originales…');
    let coverBytes = null;
    try {
      coverBytes = Pdf.buildResumenPdf({ ...datos, actuaciones });
    } catch (_) {}
    const merged = await Merge.mergePdfParts({
      coverBytes,
      parts: nativeParts,
      onProgress: (i, n) => setProgress(78 + Math.round((18 * i) / n), `Uniendo ${i}/${n}…`),
    });
    const bytes = merged?.bytes || merged;
    const failed = merged?.failed || [];
    for (const f of failed) {
      if (f?.bytes && f.nombre) {
        try {
          triggerDownload(new Blob([f.bytes], { type: 'application/pdf' }), f.nombre);
        } catch (_) {}
      }
    }
    downloadPdfBytes(bytes, datos, FN);
    setProgress(
      100,
      failed.length
        ? `PDF listo · ${failed.length} adjunto(s) se descargaron aparte (no se pudieron unir).`
        : 'PDF listo (documentos originales).'
    );
    return { ok: true, errors: [], mode: 'native-merge', failedAdjuntos: failed.length };
  }

  async function runExport(opts) {
    const FN = window.LegalMevFilename || window.LegalMevExportNombres;
    const Pdf = window.LegalMevPdfText;
    if (!FN || !Pdf) throw new Error('Módulos de exportación LegalMev no cargados');

    const { datos, actuaciones } = opts;
    const setProgress = opts.setProgress || (() => {});
    const cancelFlag = opts.cancelFlag || { cancelled: false };
    const packed = { ...opts, mode: 'pdf', setProgress, cancelFlag };

    if (!actuaciones?.length) throw new Error('No hay actuaciones seleccionadas');
    if (opts.mode && opts.mode !== 'pdf') {
      throw new Error('Solo se admite exportación en PDF único');
    }
    if (cancelFlag.cancelled) throw new Error('Cancelado por el usuario');
    return buildPdfUnico(packed);
  }

  const api = { runExport, triggerDownload };
  if (typeof window !== 'undefined') window.LegalMevExportRunner = api;
  if (typeof self !== 'undefined') self.LegalMevExportRunner = api;
})();
