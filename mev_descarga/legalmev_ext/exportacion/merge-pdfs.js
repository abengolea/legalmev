/**
 * Une PDFs nativos (pdf-lib) — portada LegalMev + documentos del portal.
 */
(function () {
  'use strict';

  function getPdfLib() {
    const lib = (typeof PDFLib !== 'undefined' && PDFLib) || (typeof pdfLib !== 'undefined' && pdfLib);
    if (!lib?.PDFDocument) throw new Error('pdf-lib no está cargado');
    return lib;
  }

  function asUint8(bytes) {
    if (!bytes) return null;
    if (bytes instanceof Uint8Array) return bytes;
    if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
    return new Uint8Array(bytes);
  }

  function looksLikePdf(bytes) {
    const b = asUint8(bytes);
    return !!(b && b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46);
  }

  /**
   * @param {{ coverBytes?: Uint8Array, parts: Array<Uint8Array|ArrayBuffer>, onProgress?: (i:number,n:number)=>void }} opts
   * @returns {Promise<Uint8Array>}
   */
  async function mergePdfParts(opts) {
    const { PDFDocument } = getPdfLib();
    const out = await PDFDocument.create();
    const parts = [];
    if (opts.coverBytes && looksLikePdf(opts.coverBytes)) {
      parts.push(asUint8(opts.coverBytes));
    }
    for (const p of opts.parts || []) {
      if (looksLikePdf(p)) parts.push(asUint8(p));
    }
    if (!parts.length) throw new Error('No hay PDFs para unir');

    for (let i = 0; i < parts.length; i++) {
      opts.onProgress?.(i + 1, parts.length);
      try {
        const src = await PDFDocument.load(parts[i], { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        for (const page of pages) out.addPage(page);
      } catch (e) {
        // Si un adjunto falla, seguimos con el resto
        console.warn('[LegalMev] No se pudo unir un PDF:', e?.message || e);
      }
    }
    if (out.getPageCount() === 0) throw new Error('Ningún PDF se pudo unir');
    return asUint8(await out.save());
  }

  /** Extrae bytes PDF nativos ya hidratados en una actuación. */
  function nativeBytesFromAct(act) {
    const out = [];
    if (looksLikePdf(act?.pdfBytes)) out.push(asUint8(act.pdfBytes));
    if (Array.isArray(act?.adjuntoBytes)) {
      for (const f of act.adjuntoBytes) {
        if (looksLikePdf(f?.bytes)) out.push(asUint8(f.bytes));
      }
    }
    return out;
  }

  const api = { mergePdfParts, looksLikePdf, nativeBytesFromAct };
  if (typeof window !== 'undefined') window.LegalMevMergePdfs = api;
  if (typeof self !== 'undefined') self.LegalMevMergePdfs = api;
})();
