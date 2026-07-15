/**
 * Content script para Mesa Virtual MPBA (mv.mpba.gov.ar).
 * Extrae trámites de la tabla #lista-tramites. El texto viene de HTML (VerTexto), no de PDF.
 * Usa chrome.scripting via background para DataTables — sin inyección de script (CSP-safe).
 */
(function () {
  if (globalThis.__MEV_EXPORTER_MPBA_LOADED__) return;
  globalThis.__MEV_EXPORTER_MPBA_LOADED__ = true;

  const PREFIX = '[MPBA]';
  let cancelarExportacion = false;

  /**
   * Progreso 0–100: ~10% para recorrer páginas DataTables, ~90% para trámites.
   * Así no aparece ~83% (“página 6/6”) mientras el trabajo real es descargar/OCR de trámites.
   */
  function progresoMPBA_Paginas(p, totalPag) {
    const cap = 10;
    if (totalPag <= 0) return 0;
    return Math.min(cap, Math.round((cap * p) / totalPag));
  }
  function progresoMPBA_Tramite(completados, totalTramites, totalPag) {
    const base = progresoMPBA_Paginas(totalPag, totalPag);
    if (totalTramites <= 0) return 100;
    const span = 100 - base;
    return Math.min(99, Math.round(base + (span * completados) / totalTramites));
  }

  const MPBA_VER_TEXTO_FETCH_MS = 180000;
  const MPBA_VER_TEXTO_READ_MS = 180000;

  /**
   * Descarga VerTexto mismo origen sin LegalMevScheduler (evita cola, humanDelay 1,5–3,5 s y backoff antes del primer byte).
   */
  async function fetchVerTextoRespuesta(urlRel, sendProgress, tramiteIdx, tramiteTotal, totalPag) {
    const ctrl = new AbortController();
    const tFetch = setTimeout(() => ctrl.abort(), MPBA_VER_TEXTO_FETCH_MS);
    sendProgress?.({
      status: 'texto',
      mensaje: `Trámite ${tramiteIdx} de ${tramiteTotal} — descargando documento…`,
      progreso: progresoMPBA_Tramite(tramiteIdx - 1, tramiteTotal, totalPag)
    });
    let resp;
    try {
      resp = await fetch(urlRel, {
        credentials: 'include',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          Accept: 'application/pdf,text/html,application/xhtml+xml,application/octet-stream,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9',
          Referer: `${location.origin}/`
        }
      });
    } catch (e) {
      clearTimeout(tFetch);
      if (e && e.name === 'AbortError') {
        throw new Error(`Tiempo de espera (${MPBA_VER_TEXTO_FETCH_MS / 1000}s) al pedir el documento`);
      }
      throw e;
    }
    clearTimeout(tFetch);

    const finalUrl = resp.url;
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const esBinario = ct.includes('pdf') || ct.includes('octet-stream');
    let readTimer;
    const body = await new Promise((resolve, reject) => {
      readTimer = setTimeout(() => {
        try {
          resp.body?.cancel?.();
        } catch (_) {}
        reject(
          new Error(`Tiempo agotado (${MPBA_VER_TEXTO_READ_MS / 1000}s) leyendo el cuerpo del documento`)
        );
      }, MPBA_VER_TEXTO_READ_MS);
      const p = esBinario ? resp.arrayBuffer() : resp.text();
      p.then(
        (b) => {
          clearTimeout(readTimer);
          resolve(b);
        },
        (err) => {
          clearTimeout(readTimer);
          reject(err);
        }
      );
    });

    return { body, finalUrl };
  }

  /** Detecta error DECODER/OpenSSL por metadata/firma digital en PDFs de tribunales */
  function esErrorDecoderMetadata(e) {
    const msg = (e && (e.message || String(e))) || '';
    return /DECODER routines::unsupported/i.test(msg) ||
      /1E08010C/i.test(msg) ||
      /Getting metadata from plugin/i.test(msg);
  }

  const FALLBACK_DECODER = '[Documento con firma digital — contenido no extraíble automáticamente]';

  /** Llama a DataTables en contexto de página via background executeScript (sender.tab.id). */
  async function callDataTablesInPage(subAction, params = {}) {
    const result = await chrome.runtime.sendMessage({
      action: 'mpbaExec',
      subAction,
      ...params
    });
    if (result?.error) throw new Error(result.error);
    return result?.result ?? result;
  }

  function detectarTotalMPBA() {
    const scripts = document.querySelectorAll('script:not([src])');
    for (const s of scripts) {
      const m = (s.textContent || '').match(/var\s+length\s*=\s*parseInt\s*\(\s*['"]?(\d+)['"]?\s*\)/);
      if (m) return parseInt(m[1], 10);
    }
    return 0;
  }

  async function calcularTotalPaginas() {
    let total = detectarTotalMPBA();
    if (total === 0) {
      try {
        total = await callDataTablesInPage('getTotal') || 0;
      } catch (_) {}
    }
    let pageLen = 10;
    try {
      pageLen = await callDataTablesInPage('getPageLen') || 10;
    } catch (_) {}
    return Math.max(1, Math.ceil(total / pageLen));
  }

  /** Paginar — DataTables.draw('page') es sincrónico. Sin waitFor, sin timeout. */
  async function irAPaginaMPBA(numeroPagina1based) {
    const n = numeroPagina1based - 1;
    if (n < 0) return;
    await callDataTablesInPage('goToPage', { page: n });
    await new Promise((r) => setTimeout(r, 0));
  }

  function extraerFilasMPBA() {
    return [...document.querySelectorAll('#lista-tramites tbody tr')]
      .filter((fila) => !fila.querySelector('td[colspan]') && fila.querySelectorAll('td').length >= 8)
      .map((fila) => {
        const td = (i) => fila.querySelectorAll('td')[i]?.textContent?.trim() || '';
        let encTramite = null, encPDF = null, encAdjuntos = null;
        fila.querySelectorAll('a[onclick]').forEach((a) => {
          const oc = a.getAttribute('onclick') || '';
          const mT = oc.match(/verTramite\(['"]([^'"]+)['"]\)/);
          const mP = oc.match(/verPDF\(['"]([^'"]+)['"]\)/);
          const mA = oc.match(/verAdjuntos\(['"]([^'"]+)['"]\)/);
          if (mT) encTramite = mT[1];
          if (mP) encPDF = mP[1];
          if (mA) encAdjuntos = mA[1];
        });
        return {
          ccs: td(0),
          fecha: td(1),
          grupo: td(2),
          tramite: td(3),
          personas: td(4),
          genero: td(5),
          organismo: td(6),
          incidente: td(7),
          encTramite,
          encPDF,
          encAdjuntos
        };
      });
  }

  // ── Inicializar Tesseract worker (una sola vez, reutilizar) ──
  let _tesseractWorker = null;

  async function getTesseractWorker() {
    if (_tesseractWorker) return _tesseractWorker;

    _tesseractWorker = await Tesseract.createWorker('spa', 1, {
      workerPath: chrome.runtime.getURL('lib/worker.min.js'),
      /** Toda la stack OCR debe ser local (Chrome Web Store: sin descarga de código/datos desde CDN). */
      corePath: chrome.runtime.getURL('lib/tesseract-core/'),
      langPath: chrome.runtime.getURL('lib/tesseract-lang/'),
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`${PREFIX} OCR ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    return _tesseractWorker;
  }

  // ── Renderizar página de PDF a canvas y hacer OCR ──
  async function ocrizarPagina(pdfPage, scale = 2.0) {
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await pdfPage.render({ canvasContext: ctx, viewport }).promise;

    const worker = await getTesseractWorker();
    const { data: { text } } = await worker.recognize(canvas);
    return text.trim();
  }

  // ── Extracción normal de texto (sin OCR) ──
  async function extraerTextoPDFNormal(buffer, progCtx) {
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false
    }).promise;
    const paginas = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      if (progCtx?.sendProgress && progCtx.tramiteIdx != null && pdf.numPages > 1) {
        const lo = progresoMPBA_Tramite(progCtx.tramiteIdx - 1, progCtx.tramiteTotal, progCtx.totalPag);
        const hi = progresoMPBA_Tramite(progCtx.tramiteIdx, progCtx.tramiteTotal, progCtx.totalPag);
        const pr = Math.min(99, Math.round(lo + ((hi - lo) * (i - 1)) / pdf.numPages));
        progCtx.sendProgress({
          status: 'texto',
          mensaje: `Trámite ${progCtx.tramiteIdx} — leyendo PDF p. ${i}/${pdf.numPages}`,
          progreso: pr
        });
      }
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      paginas.push(content.items.map((item) => item.str).join(' '));
    }
    return paginas.join('\n\n').trim();
  }

  // ── OCR del PDF completo ──
  async function ocrizarPDF(buffer, sendProgress, tramiteIdx, tramiteTotal, totalPag) {
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false
    }).promise;
    const textos = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      if (sendProgress) {
        const msg = tramiteIdx != null && tramiteTotal != null
          ? `OCR trámite ${tramiteIdx}/${tramiteTotal} — página ${i}/${pdf.numPages}`
          : `OCR página ${i}/${pdf.numPages}`;
        let pr = null;
        if (tramiteIdx != null && tramiteTotal != null && totalPag > 0) {
          const lo = progresoMPBA_Tramite(tramiteIdx - 1, tramiteTotal, totalPag);
          const hi = progresoMPBA_Tramite(tramiteIdx, tramiteTotal, totalPag);
          pr = Math.min(99, Math.round(lo + ((hi - lo) * i) / pdf.numPages));
        }
        sendProgress(pr != null ? { status: 'ocr', mensaje: msg, progreso: pr } : { status: 'ocr', mensaje: msg });
      }
      const page = await pdf.getPage(i);
      const texto = await ocrizarPagina(page);
      textos.push(texto);
    }

    return textos.join('\n\n--- página ---\n\n').trim();
  }

  // ── Fetch del PDF y OCR completo ──
  async function fetchTextoTramite(enc, sendProgress, tramiteIdx, tramiteTotal, totalPag = 1) {
    const url = `/Web/Proceso/VerTexto?enc=${encodeURIComponent(enc)}`;
    console.log(PREFIX, 'fetchTextoTramite url:', url);

    let body;
    let finalUrl = url;
    try {
      const r = await fetchVerTextoRespuesta(url, sendProgress, tramiteIdx, tramiteTotal, totalPag);
      body = r.body;
      finalUrl = r.finalUrl;
    } catch (e) {
      return `[Error de red: ${e.message}]`;
    }

    // Tipo B — redirigió a documentos externos (CORS)
    if (finalUrl.includes('documentos.mpba.gov.ar')) {
      return `[Documento en visor externo]\n${finalUrl}`;
    }

    const isPdf = body instanceof ArrayBuffer;

    // Tipo A — PDF directo
    if (isPdf) {
      const buffer = body;

      if (!window.pdfjsLib) {
        return '[Error: pdf.js no disponible]';
      }
      if (!window.__pdjsWorkerSet__) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          chrome.runtime.getURL('lib/pdf.worker.min.js');
        window.__pdjsWorkerSet__ = true;
      }

      // Intentar extracción de texto normal primero (más rápido)
      try {
        const textoNormal = await extraerTextoPDFNormal(buffer, {
          sendProgress,
          tramiteIdx,
          tramiteTotal,
          totalPag
        });
        const caracteresBuenos = (textoNormal.match(/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s.,;:]/g) || []).length;
        const total = textoNormal.replace(/\s/g, '').length;
        const ratio = total > 0 ? caracteresBuenos / total : 0;

        if (ratio > 0.6) {
          console.log(`${PREFIX} Texto extraído normalmente (ratio: ${ratio.toFixed(2)})`);
          return textoNormal;
        }
      } catch (e) {
        if (esErrorDecoderMetadata(e)) {
          return '[Documento con firma digital — contenido no extraíble automáticamente]';
        }
      }

      // Fuentes rotas — usar OCR (evitar si ya falló por DECODER)
      try {
        console.log(`${PREFIX} Fuentes rotas detectadas, usando OCR...`);
        return await ocrizarPDF(buffer, sendProgress, tramiteIdx, tramiteTotal, totalPag);
      } catch (e) {
        if (esErrorDecoderMetadata(e)) {
          return '[Documento con firma digital — contenido no extraíble automáticamente]';
        }
        throw e;
      }
    }

    // Respuesta HTML (VerTramite sin PDF)
    const html = typeof body === 'string' ? body : '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body?.innerText || doc.documentElement?.innerText || '').trim() || '[Sin texto]';
  }

  function isCancelado(cancelFlag) {
    return cancelarExportacion || !!(cancelFlag && cancelFlag.cancelled);
  }

  /** Recorre todas las páginas de DataTables y devuelve filas (sin descargar textos). */
  async function listAllFilasMPBA(sendProgress, cancelFlag) {
    const totalPag = await calcularTotalPaginas();
    const todas = [];
    for (let p = 1; p <= totalPag; p++) {
      if (isCancelado(cancelFlag)) return null;
      console.log(PREFIX, `Listando página ${p} de ${totalPag}`);
      await irAPaginaMPBA(p);
      const filas = extraerFilasMPBA();
      for (const f of filas) todas.push(f);
      sendProgress?.({
        status: 'pagina',
        mensaje: `Listando página ${p} de ${totalPag}`,
        progreso: progresoMPBA_Paginas(p, totalPag),
      });
    }
    return { filas: todas, totalPag };
  }

  /**
   * @param {Function} sendProgress
   * @param {number|null|{ ultimosN?: number|null, selectedCcs?: string[], cancelFlag?: { cancelled: boolean } }} [opts]
   */
  async function collectActuacionesMPBA(sendProgress, opts = null) {
    let ultimosN = null;
    let selectedCcs = null;
    let cancelFlag = null;
    if (typeof opts === 'number') {
      ultimosN = opts;
    } else if (opts && typeof opts === 'object') {
      ultimosN = opts.ultimosN != null ? opts.ultimosN : null;
      selectedCcs = Array.isArray(opts.selectedCcs)
        ? new Set(opts.selectedCcs.map(String))
        : null;
      cancelFlag = opts.cancelFlag || null;
    }

    const listed = await listAllFilasMPBA(sendProgress, cancelFlag);
    if (listed === null) return null;
    const { filas: todas, totalPag } = listed;

    let filasAProcesar = todas;
    if (selectedCcs && selectedCcs.size > 0) {
      filasAProcesar = todas.filter((f) => selectedCcs.has(String(f.ccs)));
    } else if (ultimosN && ultimosN > 0) {
      filasAProcesar = todas.slice(0, ultimosN);
    }
    const total = filasAProcesar.length;
    const actuaciones = [];
    sendProgress?.({
      status: 'texto',
      mensaje: `Listo. Descargando textos de ${total} trámite(s)…`,
      progreso: progresoMPBA_Tramite(0, total, totalPag),
    });
    for (let i = 0; i < total; i++) {
      if (isCancelado(cancelFlag)) return null;
      sendProgress?.({
        status: 'texto',
        mensaje: `Trámite ${i + 1} de ${total}`,
        progreso: progresoMPBA_Tramite(i, total, totalPag),
      });
      if (i > 0)
        await (globalThis.LegalMevHumanDelay?.humanDelay?.('BETWEEN_PAGES') ??
          new Promise((r) => setTimeout(r, 1200)));
      const f = filasAProcesar[i];
      let texto = '';
      if (f.encPDF) {
        try {
          texto = await fetchTextoTramite(f.encPDF, sendProgress, i + 1, total, totalPag);
        } catch (e) {
          texto = `(Error al obtener texto: ${e.message})`;
        }
      } else {
        texto = '(Sin texto asociado)';
      }
      actuaciones.push({
        id: f.ccs,
        numero: i + 1,
        ccs: f.ccs,
        fecha: f.fecha,
        grupo: f.grupo,
        tramite: f.tramite,
        personas: f.personas,
        genero: f.genero,
        organismo: f.organismo,
        incidente: f.incidente,
        tipo: f.tramite,
        titulo: f.tramite,
        descripcion: f.tramite,
        contenido: texto,
        hasDoc: !!f.encPDF,
        adjuntos: [],
      });
      console.log(PREFIX, `Procesando ${i + 1} de ${total}`);
      sendProgress?.({
        status: 'texto',
        mensaje: `Trámite ${i + 1} de ${total} — listo`,
        progreso: progresoMPBA_Tramite(i + 1, total, totalPag),
      });
    }

    // Liberar worker de Tesseract al terminar
    if (_tesseractWorker) {
      await _tesseractWorker.terminate();
      _tesseractWorker = null;
    }
    return actuaciones;
  }

  function valorPorEtiquetaVisible(patLabel) {
    const body = document.body?.innerText || '';
    const re = new RegExp(`${patLabel}\\s*:?\\s*([^\\n]+)`, 'i');
    const m = body.match(re);
    if (!m) return '';
    return m[1].replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  function extractDatosExpedienteMPBA() {
    const body = document.body?.innerText || '';
    let nroExpediente = '';
    const nroM =
      body.match(/N[º°]\s*de\s*Proceso\s*:?\s*([A-Z0-9\-]+)/i) ||
      body.match(/Nro\.?\s*de\s*Proceso\s*:?\s*([A-Z0-9\-]+)/i) ||
      body.match(/\b(PP-\d{2}-\d{2}-\d+-\d{2}-\d{2})\b/);
    if (nroM) nroExpediente = nroM[1];

    const departamento = valorPorEtiquetaVisible('Departamento');
    const ufi = valorPorEtiquetaVisible('UFI(?:\\s*/\\s*UFD)?');
    const juzgado = valorPorEtiquetaVisible('Juzgado\\s+de\\s+Garant[ií]as') || valorPorEtiquetaVisible('Juzgado');
    const estado = valorPorEtiquetaVisible('Estado');
    const etapa = valorPorEtiquetaVisible('Etapa');
    const delitos = valorPorEtiquetaVisible('Delitos');
    const imputados = valorPorEtiquetaVisible('Imputados');
    const caratula =
      [delitos, imputados].filter(Boolean).join(' — ') ||
      document.title ||
      nroExpediente ||
      'Proceso MPBA';
    const dependencia = [ufi, juzgado].filter(Boolean).join(' · ') || departamento;
    return {
      nroExpediente,
      caratula,
      juzgado: juzgado || dependencia,
      dependencia,
      jurisdiccion: departamento
        ? `Ministerio Público — ${departamento}`
        : 'Ministerio Público de Buenos Aires (MPBA)',
      situacion: [estado, etapa].filter(Boolean).join(' / '),
      delitos,
      imputados,
      portal: 'MPBA',
    };
  }

  /** Misma tipografía LegalMev que Salta/MEV/PJN (LegalMevPdfText). */
  function descargarReportePDF(actuaciones, filename) {
    const Pdf = window.LegalMevPdfText;
    if (!Pdf?.buildMergedPdf) {
      throw new Error('LegalMevPdfText no cargado. Recargá la extensión y la página.');
    }
    const datos = extractDatosExpedienteMPBA();
    const mapped = (actuaciones || []).map((a) => ({
      tipo: a.tramite || a.grupo || 'Trámite',
      fecha: a.fecha || '',
      titulo: a.ccs || '',
      descripcion: [a.grupo, a.organismo].filter(Boolean).join(' · '),
      contenido: a.contenido || '',
      adjuntos: a.adjuntos || [],
    }));
    const bytes = Pdf.buildMergedPdf({
      ...datos,
      portal: 'MPBA',
      actuaciones: mapped,
    });
    const blob = new Blob([bytes], { type: 'application/pdf' });
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

  async function hydrateFromPickerItems(items, sendProgress, cancelFlag) {
    const list = Array.isArray(items) ? items : [];
    const total = list.length;
    const actuaciones = [];
    const totalPag = 1;
    sendProgress?.({
      status: 'texto',
      mensaje: `Descargando textos de ${total} trámite(s)…`,
      progreso: 5,
    });
    for (let i = 0; i < total; i++) {
      if (isCancelado(cancelFlag)) return null;
      sendProgress?.({
        status: 'texto',
        mensaje: `Trámite ${i + 1} de ${total}`,
        progreso: Math.min(85, Math.round(5 + (80 * i) / Math.max(1, total))),
      });
      if (i > 0)
        await (globalThis.LegalMevHumanDelay?.humanDelay?.('BETWEEN_PAGES') ??
          new Promise((r) => setTimeout(r, 1200)));
      const f = list[i];
      let texto = '';
      if (f.encPDF) {
        try {
          texto = await fetchTextoTramite(f.encPDF, sendProgress, i + 1, total, totalPag);
        } catch (e) {
          texto = `(Error al obtener texto: ${e.message})`;
        }
      } else {
        texto = '(Sin texto asociado)';
      }
      actuaciones.push({
        id: f.ccs || f.id,
        numero: i + 1,
        ccs: f.ccs || f.id,
        fecha: f.fecha,
        grupo: f.grupo,
        tramite: f.tramite || f.descripcion || f.tipo,
        tipo: f.tipo || f.tramite || f.descripcion,
        titulo: f.titulo || f.tramite || f.descripcion,
        descripcion: f.descripcion || f.tramite || f.tipo,
        personas: f.personas,
        organismo: f.organismo,
        contenido: texto,
        hasDoc: !!f.encPDF,
        adjuntos: [],
      });
      sendProgress?.({
        status: 'texto',
        mensaje: `Trámite ${i + 1} de ${total} — listo`,
        progreso: Math.min(88, Math.round(5 + (80 * (i + 1)) / Math.max(1, total))),
      });
    }
    if (_tesseractWorker) {
      await _tesseractWorker.terminate();
      _tesseractWorker = null;
    }
    return actuaciones;
  }

  function getExpedienteInfoMPBA() {
    const total = detectarTotalMPBA();
    const tabla = document.querySelector('#lista-tramites');
    const filas = tabla ? extraerFilasMPBA() : [];
    const count = total > 0 ? total : filas.length;
    const datos = extractDatosExpedienteMPBA();
    return {
      pageTitle: datos.nroExpediente
        ? `Proceso ${datos.nroExpediente}`
        : document.title || 'Ver Proceso — MPBA',
      pageUrl: location.href,
      count,
      caratula: datos.caratula,
      nroExpediente: datos.nroExpediente,
      portal: 'mpba',
      pickerReady: true,
    };
  }

  function filasToPickerItems(filas) {
    return (filas || []).map((f, i) => ({
      id: f.ccs || String(i),
      ccs: f.ccs,
      fecha: f.fecha,
      tipo: f.tramite,
      titulo: f.tramite,
      descripcion: f.tramite,
      grupo: f.grupo,
      organismo: f.organismo,
      hasDoc: !!f.encPDF,
      encPDF: f.encPDF,
      encTramite: f.encTramite,
      selected: true,
    }));
  }

  async function listTramitesForPicker(sendProgress, cancelFlag) {
    const listed = await listAllFilasMPBA(sendProgress, cancelFlag);
    if (listed === null) return null;
    return filasToPickerItems(listed.filas);
  }

  globalThis.LegalMevMpbaCore = {
    extractDatos: extractDatosExpedienteMPBA,
    listTramites: listTramitesForPicker,
    collect: collectActuacionesMPBA,
    hydrateFromItems: hydrateFromPickerItems,
    setCancel(v) {
      cancelarExportacion = !!v;
    },
    detectarTotal: detectarTotalMPBA,
    extraerFilas: extraerFilasMPBA,
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getExpedienteInfo') {
      try {
        const info = getExpedienteInfoMPBA();
        sendResponse({ ok: true, ...info });
      } catch (e) {
        console.error(PREFIX, e);
        sendResponse({ ok: false, error: e.message });
      }
      return true;
    }
    if (message.action === 'cancelExport') {
      cancelarExportacion = true;
      sendResponse({ ok: true });
      return true;
    }
    if (message.action === 'exportMPBA') {
      cancelarExportacion = false;
      const ultimosN = message.ultimosN ? parseInt(message.ultimosN, 10) : null;
      const selectedCcs = Array.isArray(message.selectedCcs) ? message.selectedCcs : null;
      const sendProgress = (d) =>
        chrome.runtime.sendMessage({ action: 'progressMPBA', ...d }).catch(() => {});
      collectActuacionesMPBA(sendProgress, { ultimosN, selectedCcs }).then((actuaciones) => {
        if (actuaciones === null) {
          sendResponse({ ok: false, error: 'Cancelado por el usuario' });
          return;
        }
        if (!actuaciones.length) {
          sendResponse({ ok: false, error: 'No se encontraron trámites' });
          return;
        }
        const tituloSanitizado = (document.title || 'Expediente')
          .replace(/[<>:"/\\|?*]/g, '_')
          .slice(0, 80);
        const fecha = new Date().toISOString().slice(0, 10);
        const filename = `MPBA_${tituloSanitizado}_${fecha}.pdf`;
        descargarReportePDF(actuaciones, filename);
        sendResponse({ ok: true, filename, total: actuaciones.length });
      }).catch((e) => {
        console.error(PREFIX, e);
        sendResponse({ ok: false, error: e.message });
      });
      return true;
    }
  });
})();
