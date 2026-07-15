/**
 * Extracción de texto PDF + OCR local (Tesseract) en la extensión.
 * Sin CDN: todo desde chrome.runtime.getURL (Chrome Web Store).
 *
 * Flujo: capa de texto pdf.js → si no es legible / escaneado → OCR página a página.
 */
(function () {
  'use strict';

  const MAX_TEXT_PAGES = 80;
  const MAX_OCR_PAGES = 40;
  const MIN_LETTERS_OK = 40;
  const MIN_RATIO_OK = 0.55;

  let _worker = null;
  let _workerPromise = null;

  function ensurePdfJsWorker() {
    const pdfjs = globalThis.pdfjsLib;
    if (!pdfjs) throw new Error('pdf.js no disponible');
    if (!globalThis.__pdjsWorkerSet__) {
      pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
      globalThis.__pdjsWorkerSet__ = true;
    }
    return pdfjs;
  }

  function esErrorDecoderMetadata(e) {
    const msg = e && e.message ? String(e.message) : String(e || '');
    return (
      /DECODER routines::unsupported/i.test(msg) ||
      /1E08010C/i.test(msg) ||
      /Getting metadata from plugin/i.test(msg)
    );
  }

  function contarLetras(texto) {
    return (String(texto || '').match(/[A-Za-zÁÉÍÓÚÜáéíóúüÑñ0-9]/g) || []).length;
  }

  function ratioTextoUtil(texto) {
    const t = String(texto || '');
    const buenos = (t.match(/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s.,;:°º\-/()]/gi) || []).length;
    const total = t.replace(/\s/g, '').length;
    return total > 0 ? buenos / total : 0;
  }

  function textoEsUtilizable(texto) {
    const t = String(texto || '').trim();
    if (!t) return false;
    if (/PDF sin texto|sin texto extraíble|Error al|no disponible/i.test(t) && contarLetras(t) < 80) {
      return false;
    }
    return contarLetras(t) >= MIN_LETTERS_OK && ratioTextoUtil(t) >= MIN_RATIO_OK;
  }

  async function getTesseractWorker(onProgress) {
    if (_worker) return _worker;
    if (_workerPromise) return _workerPromise;
    if (typeof Tesseract === 'undefined' || !Tesseract.createWorker) {
      throw new Error('Tesseract no está cargado en la extensión');
    }
    _workerPromise = Tesseract.createWorker('spa', 1, {
      workerPath: chrome.runtime.getURL('lib/worker.min.js'),
      corePath: chrome.runtime.getURL('lib/tesseract-core/'),
      langPath: chrome.runtime.getURL('lib/tesseract-lang/'),
      logger: (m) => {
        if (m?.status === 'recognizing text' && typeof onProgress === 'function') {
          onProgress({
            status: 'ocr',
            mensaje: `OCR ${Math.round((m.progress || 0) * 100)}%`,
            progress: m.progress,
          });
        }
      },
    }).then((w) => {
      _worker = w;
      return w;
    });
    return _workerPromise;
  }

  async function loadPdf(buffer) {
    const pdfjs = ensurePdfJsWorker();
    const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    return pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  }

  async function extractEmbeddedText(pdf, opts = {}) {
    const maxPages = Math.min(pdf.numPages, opts.maxTextPages ?? MAX_TEXT_PAGES);
    const parts = [];
    let tieneImagen = false;
    const OPS = globalThis.pdfjsLib?.OPS || {};

    for (let i = 1; i <= maxPages; i++) {
      opts.onProgress?.({
        status: 'texto',
        mensaje: `Leyendo texto PDF p. ${i}/${maxPages}`,
        page: i,
        pages: maxPages,
      });
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let ultimaY = null;
      const lineas = [];
      let lineaActual = [];
      for (const item of content.items) {
        const y = Math.round(item.transform?.[5] ?? 0);
        if (ultimaY !== null && Math.abs(y - ultimaY) > 3) {
          if (lineaActual.length) lineas.push(lineaActual.join(' ').trim());
          lineaActual = [];
        }
        if (item.str && item.str.trim()) lineaActual.push(item.str);
        ultimaY = y;
      }
      if (lineaActual.length) lineas.push(lineaActual.join(' ').trim());
      const limpias = lineas.filter((l) => {
        if (!l) return false;
        if (/^[%qQGgcmfBMlhre\s\d.\-]+$/.test(l) && l.length > 20) return false;
        const alnum = (l.match(/[a-záéíóúñA-Z0-9]/gi) || []).length;
        if (l.length > 15 && alnum / l.length < 0.3) return false;
        return true;
      });
      parts.push(limpias.join('\n') || content.items.map((it) => it.str).join(' '));

      try {
        const ops = await page.getOperatorList();
        for (const fn of ops.fnArray || []) {
          if (
            fn === OPS.paintImageXObject ||
            fn === OPS.paintImageXObjectRepeat ||
            fn === OPS.paintInlineImageXObject ||
            fn === OPS.paintInlineImageXObjectGroup ||
            fn === OPS.paintImageMaskXObject
          ) {
            tieneImagen = true;
            break;
          }
        }
      } catch (_) {}
    }

    const texto = parts.join('\n\n--- Página siguiente ---\n\n').trim();
    const esEscaneado = tieneImagen && contarLetras(texto) < MIN_LETTERS_OK;
    return { texto, esEscaneado, paginas: pdf.numPages };
  }

  async function ocrizarPagina(pdfPage, scale = 2.0, onProgress) {
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    const worker = await getTesseractWorker(onProgress);
    const {
      data: { text },
    } = await worker.recognize(canvas);
    try {
      canvas.width = 0;
      canvas.height = 0;
    } catch (_) {}
    return String(text || '').trim();
  }

  async function ocrizarPdf(pdf, opts = {}) {
    const maxPages = Math.min(pdf.numPages, opts.maxOcrPages ?? MAX_OCR_PAGES);
    const textos = [];
    for (let i = 1; i <= maxPages; i++) {
      opts.onProgress?.({
        status: 'ocr',
        mensaje: `OCR (extensión) p. ${i}/${maxPages}`,
        page: i,
        pages: maxPages,
      });
      const page = await pdf.getPage(i);
      textos.push(await ocrizarPagina(page, 2.0, opts.onProgress));
    }
    if (pdf.numPages > maxPages) {
      textos.push(`(… ${pdf.numPages - maxPages} página(s) sin OCR: límite ${maxPages})`);
    }
    return textos.join('\n\n--- página ---\n\n').trim();
  }

  /**
   * @param {ArrayBuffer|Uint8Array} buffer
   * @param {{ onProgress?: Function, maxTextPages?: number, maxOcrPages?: number, forceOcr?: boolean }} [opts]
   * @returns {Promise<{ texto: string, usedOcr: boolean, esEscaneado: boolean, paginas: number, error?: string }>}
   */
  async function extractText(buffer, opts = {}) {
    if (!buffer) {
      return { texto: '', usedOcr: false, esEscaneado: false, paginas: 0, error: 'Sin buffer' };
    }
    try {
      const pdf = await loadPdf(buffer);
      const embedded = await extractEmbeddedText(pdf, opts);
      const usable = textoEsUtilizable(embedded.texto) && !opts.forceOcr;

      if (usable && !embedded.esEscaneado) {
        return {
          texto: embedded.texto,
          usedOcr: false,
          esEscaneado: false,
          paginas: embedded.paginas,
        };
      }

      // Sin texto usable → OCR local en la extensión
      try {
        const ocrText = await ocrizarPdf(pdf, opts);
        if (textoEsUtilizable(ocrText) || contarLetras(ocrText) > contarLetras(embedded.texto)) {
          return {
            texto: ocrText || embedded.texto || '',
            usedOcr: true,
            esEscaneado: embedded.esEscaneado || !textoEsUtilizable(embedded.texto),
            paginas: embedded.paginas,
          };
        }
        return {
          texto: embedded.texto || ocrText || '',
          usedOcr: !!ocrText,
          esEscaneado: embedded.esEscaneado,
          paginas: embedded.paginas,
        };
      } catch (ocrErr) {
        if (esErrorDecoderMetadata(ocrErr)) {
          return {
            texto: '(Documento con firma digital — contenido no extraíble automáticamente)',
            usedOcr: false,
            esEscaneado: embedded.esEscaneado,
            paginas: embedded.paginas,
            error: ocrErr.message,
          };
        }
        return {
          texto: embedded.texto || `(OCR falló: ${ocrErr.message || ocrErr})`,
          usedOcr: false,
          esEscaneado: embedded.esEscaneado,
          paginas: embedded.paginas,
          error: ocrErr.message || String(ocrErr),
        };
      }
    } catch (e) {
      if (esErrorDecoderMetadata(e)) {
        return {
          texto: '(Documento con firma digital — contenido no extraíble automáticamente)',
          usedOcr: false,
          esEscaneado: false,
          paginas: 0,
          error: e.message,
        };
      }
      return {
        texto: `(Error al procesar PDF: ${e.message || e})`,
        usedOcr: false,
        esEscaneado: false,
        paginas: 0,
        error: e.message || String(e),
      };
    }
  }

  /** Atajo: solo string de texto (compatibilidad con extraerTextoPDF). */
  async function extractTextString(buffer, opts) {
    const r = await extractText(buffer, opts);
    return r.texto || '';
  }

  async function terminate() {
    if (_worker) {
      try {
        await _worker.terminate();
      } catch (_) {}
      _worker = null;
      _workerPromise = null;
    }
  }

  const api = {
    extractText,
    extractTextString,
    textoEsUtilizable,
    terminate,
    esErrorDecoderMetadata,
  };
  if (typeof window !== 'undefined') window.LegalMevPdfOcr = api;
  if (typeof self !== 'undefined') self.LegalMevPdfOcr = api;
  if (typeof globalThis !== 'undefined') globalThis.LegalMevPdfOcr = api;
})();
