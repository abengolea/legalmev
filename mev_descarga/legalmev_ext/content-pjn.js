/**
 * Content script para SCW PJN (scw.pjn.gov.ar) y el portal público (portalpjn.pjn.gov.ar).
 *
 * El manifest inyecta este mismo script en ambos hosts: en la práctica PJN suele servir
 * rutas equivalentes (p. ej. expediente.seam, viewer.seam) bajo /scw/ también desde
 * portalpjn, por lo que la extracción (selectors, enlaces viewer.seam, fetch mismo origen)
 * es la misma. Si una pantalla del portal usara otro DOM o URLs, podría fallar hasta adaptar
 * selectores; el fallback del popup (executeScript world ISOLATED) sigue siendo conservador.
 */
(function () {
  if (globalThis.__MEV_EXPORTER_PJN_LOADED__) return;
  globalThis.__MEV_EXPORTER_PJN_LOADED__ = true;

  const VIEWER_REGEX = /(scw\.pjn\.gov\.ar|\/scw)\/.*(viewer|document)\.seam/i;

  let cancelarExportacion = false;

/** Retarda peticiones seguidas al PJN para reducir HTTP 429 (rate limit). */
function delayEntrePeticionesPjn() {
  const ms = 900 + Math.floor(Math.random() * 1400);
  return new Promise((r) => setTimeout(r, ms));
}

/** Pausa breve entre dos fetch del mismo acto (p. ej. HTML del viewer + iframe/PDF). */
function delayPjnEntreSubrecursos() {
  const ms = 500 + Math.floor(Math.random() * 700);
  return new Promise((r) => setTimeout(r, ms));
}

function buscarValorPorEtiqueta(etiqueta) {
  const all = document.querySelectorAll('td, span, div, label');
  for (const el of all) {
    const txt = (el.textContent || '').trim();
    const norm = etiqueta.toLowerCase().replace(/\s+/g, ' ');
    if (txt.toLowerCase().startsWith(norm + ':') || txt === etiqueta) {
      const next = el.nextElementSibling || el.nextSibling;
      if (next && next.nodeType === Node.ELEMENT_NODE) return (next.textContent || '').trim();
      const parent = el.parentElement;
      if (parent) {
        const children = Array.from(parent.children);
        const idx = children.indexOf(el);
        if (idx >= 0 && children[idx + 1]) return (children[idx + 1].textContent || '').trim();
      }
      const rest = txt.replace(new RegExp('^' + etiqueta + '\\s*:?\\s*', 'i'), '').trim();
      if (rest) return rest;
    }
  }
  return '';
}

function extraerDatosExpediente() {
  let expediente = buscarValorPorEtiqueta('Expediente') || '';
  let caratula = buscarValorPorEtiqueta('Carátula') || buscarValorPorEtiqueta('Caratula') || '';
  let dependencia = buscarValorPorEtiqueta('Dependencia') || '';
  const juzgado = dependencia || buscarValorPorEtiqueta('Jurisdicción');
  if (!expediente) {
    const m = (document.body?.innerText || '').match(/([A-Z]{2,4}\s*\d+\/\d+)/);
    if (m) expediente = m[1].trim();
  }
  if (!caratula && document.title) caratula = document.title.split(/[\-\–\—|]/).map((p) => p.trim()).find((p) => p.length > 10) || document.title;
  return { expediente, caratula, juzgado };
}

function pareceTablaActuaciones(tabla) {
  for (const row of tabla.querySelectorAll('tr')) {
    for (const td of row.querySelectorAll('td')) {
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test((td.textContent || '').trim())) return true;
    }
  }
  return false;
}

function encontrarTablaActuaciones() {
  const t = document.querySelector('table#expediente\\:action-table, table[id*="action-table"]');
  if (t && t.querySelectorAll('tr').length > 0) return t;
  const sel = [
    'table[id*="expediente"]', 'table[id*="actuacion"]',
    'table.ui-datatable-data', '.ui-datatable table', '.ui-tabpanel table', '#content table'
  ];
  for (const s of sel) {
    const t = document.querySelector(s);
    if (t && t.querySelectorAll('tr').length > 0) return t;
  }
  for (const t of document.querySelectorAll('table')) {
    const rows = t.querySelectorAll('tbody tr, tr');
    if (rows.length >= 2 && pareceTablaActuaciones(t)) return t;
  }
  return null;
}

/** Detecta total de páginas en la tabla de actuaciones (RichFaces paginador). */
function detectarTotalPaginas() {
  const els = document.querySelectorAll('[id*="j_idt217"][id*="j_idt229"]');
  let max = 1;
  for (const el of els) {
    const txt = (el.textContent || '').trim();
    const nums = txt.match(/\d+/g);
    if (nums) {
      for (const n of nums) {
        const v = parseInt(n, 10);
        if (v > max) max = v;
      }
    }
  }
  return max;
}

/** Navega a la página n (1-based) del paginador RichFaces. */
async function irAPagina(n) {
  const idx = n - 1;
  const el = document.querySelector(`[id$=":${idx}:j_idt229"]`) || Array.from(document.querySelectorAll('[id*="j_idt217"][id*="j_idt229"]')).find((e) => e.id && e.id.endsWith(':' + idx + ':j_idt229'));
  if (!el) return;
  if (el.tagName === 'SPAN') return;
  if (el.tagName === 'A') {
    el.click();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150));
      const span = Array.from(document.querySelectorAll('span[id*="j_idt217"][id*="j_idt229"]')).find((s) => (s.textContent || '').trim() === String(n));
      if (span) {
        await new Promise((r) => setTimeout(r, 300));
        return;
      }
    }
  }
}

/** Extrae filas de todas las páginas del expediente. */
async function extraerTodasLasFilas(sendProgress) {
  const totalPag = detectarTotalPaginas();
  const todas = [];
  for (let p = 1; p <= totalPag; p++) {
    if (cancelarExportacion) return null;
    await irAPagina(p);
    if (p > 1) await delayPjnEntreSubrecursos();
    const tabla = encontrarTablaActuaciones();
    const filas = extraerFilasConColumnas(tabla);
    for (const f of filas) {
      todas.push({ ...f, rowIndex: todas.length });
    }
    if (sendProgress && totalPag > 1) {
      sendProgress({ subtext: `Página ${p} de ${totalPag}` });
    }
  }
  if (totalPag > 1) await irAPagina(1);
  return todas;
}

function parseFechaPjn(fecha) {
  const m = String(fecha || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return 0;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
}

/**
 * Extrae solo las últimas N filas. Para PJN es crítico extraer el contenido
 * MIENTRAS estamos en la página correcta (JSF tiene estado por página).
 * Esta función recoge filas Y extrae contenido en la misma pasada.
 */
async function extraerUltimasNFilasConContenido(ultimosN, sendProgress, extraerContenidoDeFila) {
  const totalPag = detectarTotalPaginas();
  const candidatas = [];
  for (let p = 1; p <= totalPag; p++) {
    if (cancelarExportacion) return null;
    await irAPagina(p);
    if (p > 1) await delayPjnEntreSubrecursos();
    const tabla = encontrarTablaActuaciones();
    const filas = extraerFilasConColumnas(tabla);
    for (const f of filas) {
      candidatas.push({ ...f, pageNum: p, order: candidatas.length });
    }
    if (sendProgress && totalPag > 1) sendProgress({ subtext: `Página ${p} de ${totalPag} - leyendo movimientos...` });
  }

  const seleccionadas = candidatas
    .slice()
    .sort((a, b) => {
      const diff = parseFechaPjn(b.fecha) - parseFechaPjn(a.fecha);
      return diff || a.order - b.order;
    })
    .slice(0, ultimosN);

  const recogidas = [];
  const fetchOpts = {
    credentials: 'include',
    headers: { Accept: 'text/html,application/xhtml+xml,application/pdf', 'Accept-Language': 'es-AR,es;q=0.9', Referer: location.origin + '/' }
  };
  for (let i = 0; i < seleccionadas.length; i++) {
    if (cancelarExportacion) return null;
    if (i > 0) await delayEntrePeticionesPjn();
    const f = seleccionadas[i];
    if (sendProgress && totalPag > 1) sendProgress({ subtext: `Página ${f.pageNum} de ${totalPag} - extrayendo contenido...` });
    await irAPagina(f.pageNum);
    await delayPjnEntreSubrecursos();
    const { contenido, adjuntos } = await extraerContenidoDeFila(f, fetchOpts);
    recogidas.push({ ...f, contenido, adjuntos: adjuntos || [] });
    if (sendProgress) sendProgress({ current: recogidas.length, total: seleccionadas.length });
  }
  if (totalPag > 1) await irAPagina(1);
  return recogidas;
}

/** Mapea columnas FECHA, TIPO, DESCRIPCION buscando el header. Default: 1, 2, 3. */
function indiceColumnasPorHeader(tabla) {
  const headers = { fecha: 1, tipo: 2, desc: 3 };
  for (const row of tabla.querySelectorAll('tr')) {
    const cells = row.querySelectorAll('th, td');
    for (let i = 0; i < cells.length; i++) {
      const t = (cells[i].textContent || '').trim().toUpperCase();
      if (/^FECHA$/.test(t)) headers.fecha = i;
      if (/^TIPO$/.test(t)) headers.tipo = i;
      if (/^DESCRIPCI[OÓ]N$/.test(t) || /DESCRIPCI[OÓ]N\s*\/\s*DETALLE/.test(t) || /^DETALLE$/.test(t)) headers.desc = i;
    }
    if (headers.tipo >= 0 && headers.tipo < cells.length) break;
  }
  return headers;
}

/**
 * Extrae filas como { fecha, tipo, descripcion, url?, isJsflink?, rowIndex }.
 * Prefiere link "Ver" (sin download=true) sobre "Descargar"; construye URL absoluta si es relativa.
 */
function extraerFilasConColumnas(tabla) {
  const filas = [];
  if (!tabla) return filas;
  const idx = indiceColumnasPorHeader(tabla);
  const allRows = tabla.querySelectorAll('tbody tr, tr.ui-widget-content, tr[role="row"], tr');
  for (let ri = 0; ri < allRows.length; ri++) {
    const row = allRows[ri];
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) continue;
    const texts = Array.from(cells).map((c) => (c.textContent || '').trim());

    const todosLinks = Array.from(row.querySelectorAll('a[href*="viewer.seam"], a[href*="document.seam"]'));
    let linkVer = todosLinks.find((a) => !(a.href || '').includes('download=true')) || todosLinks[0];
    // Si no hay viewer.seam explícito, buscar cualquier link cuya URL resuelta contenga viewer/document (p. ej. Ver abre nueva pestaña)
    if (!linkVer) {
      const cualquierLink = Array.from(row.querySelectorAll('a[href]')).find((a) => {
        const h = (a.getAttribute('href') || a.href || '').trim();
        if (!h || h === '#' || /^javascript:/i.test(h)) return false;
        try {
          const res = (a.href || new URL(h, location.origin).href).toLowerCase();
          return res.includes('viewer.seam') || res.includes('document.seam');
        } catch (_) { return false; }
      });
      if (cualquierLink) linkVer = cualquierLink;
    }
    const linkJsfEl = row.querySelector('a[onclick], a[href="#"], a[href="javascript:void(0)"], a[href="javascript:;"]');
    // Si linkJsf tiene href resuelto con viewer/document (target=_blank que abre nueva pestaña), usarlo
    if (!linkVer && linkJsfEl && (linkJsfEl.href || '').toLowerCase().match(/viewer\.seam|document\.seam/) && !linkJsfEl.href.includes('download=true')) {
      linkVer = linkJsfEl;
    }
    const linkJsf = !linkVer && (linkJsfEl instanceof Element) ? linkJsfEl : null;

    let url = '';
    if (linkVer) {
      const href = (linkVer.getAttribute('href') || linkVer.href || '').trim();
      try {
        url = href.startsWith('http') ? href : new URL(href, location.href).href;
      } catch (_) {
        url = href.startsWith('http') ? href : (location.origin + (href.startsWith('/') ? '' : '/scw/') + href);
      }
      if (url.includes('download=true')) url = '';
    }

    const isJsflink = !url && !!linkJsf;
    const componentId = linkJsf ? (linkJsf.id || linkJsf.getAttribute('name') || '') : '';
    const fecha = (texts[idx.fecha] || '').match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] || texts.find((t) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) || texts[idx.fecha] || '';
    const tipo = (texts[idx.tipo] || '').trim();
    const desc = (texts[idx.desc] || texts[idx.tipo] || '').trim();
    if (/^(OFICINA|FECHA|TIPO|DESCRIPCION|DETALLE|A\.F\.S\.)$/i.test(tipo) || /^(OFICINA|FECHA|TIPO)$/i.test(fecha)) continue;
    if (!fecha && !tipo && !desc && !url && !isJsflink) continue;
    if (/^\d{10,}$/.test(tipo) && !desc) continue;
    filas.push({
      fecha: fecha.trim(),
      tipo: tipo || desc,
      descripcion: desc || tipo,
      url,
      isJsflink,
      componentId,
      rowIndex: ri
    });
  }
  return filas;
}

/** Detecta error DECODER/OpenSSL por metadata/firma digital en PDFs de tribunales */
function esErrorDecoderMetadata(e) {
  const msg = (e && (e.message || String(e))) || '';
  return /DECODER routines::unsupported/i.test(msg) ||
    /1E08010C/i.test(msg) ||
    /Getting metadata from plugin/i.test(msg);
}

/** Extrae texto de un ArrayBuffer PDF usando pdf.js.
 * pdf.min.js se carga como content script en manifest — mismo isolated world que este código.
 * PDFs con firmas digitales (MEV/PJN) pueden fallar con DECODER::unsupported — se devuelve fallback.
 */
async function extraerTextoPDF(buffer) {
  if (!window.pdfjsLib) {
    return '(Error: pdf.js no disponible)';
  }

  // Setear worker solo la primera vez
  if (!window.__pdjsWorkerSet__) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      chrome.runtime.getURL('lib/pdf.worker.min.js');
    window.__pdjsWorkerSet__ = true;
  }

  const MAX_PAGES = 80;
  const MAX_MS = 120000;
  const LOAD_MS = 60000;

  try {
    const loadPdf = window.pdfjsLib
      .getDocument({
        data: buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer,
        isEvalSupported: false
      })
      .promise;
    const pdf = await Promise.race([
      loadPdf,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`Timeout al cargar PDF (${LOAD_MS / 1000}s)`)), LOAD_MS)
      )
    ]);
    const paginas = [];
    const t0 = Date.now();
    const maxPage = Math.min(pdf.numPages, MAX_PAGES);

    for (let i = 1; i <= maxPage; i++) {
      if (Date.now() - t0 > MAX_MS) {
        paginas.push(`(Extracción truncada: límite de tiempo ${MAX_MS / 1000}s)`);
        break;
      }
      const pagina = await pdf.getPage(i);
      const contenido = await pagina.getTextContent();
      let ultimaY = null;
      const lineas = [];
      let lineaActual = [];

      for (const item of contenido.items) {
        const y = Math.round(item.transform[5]);
        if (ultimaY !== null && Math.abs(y - ultimaY) > 3) {
          lineas.push(lineaActual.join(' ').trim());
          lineaActual = [];
        }
        if (item.str && item.str.trim()) lineaActual.push(item.str);
        ultimaY = y;
      }
      if (lineaActual.length) lineas.push(lineaActual.join(' ').trim());
      const lineasLimpias = lineas.filter((l) => {
        if (l.length === 0) return false;
        // Filtrar líneas de metadata de firma digital (caracteres binarios/PostScript)
        if (/^[%qQGgcmfBMlhre\s\d\.\-]+$/.test(l) && l.length > 20) return false;
        // Filtrar líneas con mayoría de caracteres no alfanuméricos
        const alfanumericos = (l.match(/[a-záéíóúñA-Z0-9]/g) || []).length;
        if (alfanumericos / l.length < 0.3 && l.length > 15) return false;
        return true;
      });
      paginas.push(lineasLimpias.join('\n'));
    }

    if (pdf.numPages > MAX_PAGES) {
      paginas.push(`(… ${pdf.numPages - MAX_PAGES} página(s) omitidas: límite ${MAX_PAGES})`);
    }

    return paginas.join('\n\n--- Página siguiente ---\n\n').trim();

  } catch (e) {
    if (esErrorDecoderMetadata(e)) {
      return '(Documento con firma digital — contenido no extraíble automáticamente)';
    }
    return `(Error al procesar PDF: ${e && e.message ? e.message : String(e)})`;
  }
}

/** Busca iframe con document.seam/viewer.seam para hacer fetch posterior. */
function obtenerUrlIframeDocumento(doc, baseUrl) {
  const iframe = doc.querySelector('iframe[src*="document.seam"], iframe[src*="viewer.seam"], object[data*="document.seam"], object[data*="viewer.seam"]');
  if (!iframe) return null;
  const src = iframe.getAttribute('src') || iframe.getAttribute('data') || '';
  if (!src) return null;
  try {
    return new URL(src, baseUrl).href;
  } catch (_) {
    return src.startsWith('http') ? src : null;
  }
}

function extraerContenidoViewer(doc) {
  const body = doc.body || doc;
  let main = doc.querySelector('#content, .content, main, [role="main"], .viewer-content, .document-viewer, .ui-panel-content, .documento-contenido, [id*="documento"], [id*="viewer"]');
  if (main && main.tagName === 'IFRAME') {
    try {
      const iframeDoc = main.contentDocument || main.contentWindow?.document;
      main = iframeDoc ? (iframeDoc.body || iframeDoc) : body;
    } catch (_) { main = body; }
  }
  if (!main) main = body;
  let text = (main?.innerText || main?.textContent || body?.innerText || '').trim();
  const ruido = [/Volver\s*$/im, /Cerrar\s*$/im, /Sistema de Consulta Web/im, /Poder Judicial/im, /100%/, /^\s*\d+\s*$/];
  for (const r of ruido) text = text.replace(r, '');
  return text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 2).join('\n\n');
}

/** Extrae texto de un nodo DOM (p. ej. modal/dialog PrimeFaces). */
function extraerContenidoDeNodo(node) {
  if (!node) return '';
  let text = (node.innerText || node.textContent || '').trim();
  const ruido = [/Volver\s*$/im, /Cerrar\s*$/im, /Sistema de Consulta Web/im, /Poder Judicial/im, /100%/, /^\s*\d+\s*$/];
  for (const r of ruido) text = text.replace(r, '');
  return text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 2).join('\n\n');
}

/**
 * POST del formulario JSF a un iframe oculto y extrae el contenido.
 * Útil cuando el link abre en nueva pestaña o el modal no se detecta.
 */
async function extraerViaIframePost(componentId) {
  if (!componentId) return '';
  const form = document.querySelector('form[id*="form"], form');
  if (!form || !form.action) return '';
  const iframe = document.createElement('iframe');
  iframe.name = 'mev_exporter_iframe_' + Date.now();
  iframe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;border:0;';
  document.body.appendChild(iframe);
  const postForm = document.createElement('form');
  postForm.method = 'post';
  postForm.action = form.action || location.href;
  postForm.target = iframe.name;
  for (const input of form.querySelectorAll('input[type="hidden"]')) {
    const clone = document.createElement('input');
    clone.type = 'hidden';
    clone.name = input.name;
    clone.value = input.value || '';
    postForm.appendChild(clone);
  }
  const compInput = document.createElement('input');
  compInput.type = 'hidden';
  compInput.name = componentId;
  compInput.value = componentId;
  postForm.appendChild(compInput);
  document.body.appendChild(postForm);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve('');
    }, 15000);
    iframe.onload = () => {
      clearTimeout(timeout);
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        const text = doc ? extraerContenidoViewer(doc) : '';
        cleanup();
        resolve(text || '');
      } catch (_) {
        cleanup();
        resolve('');
      }
    };
    postForm.submit();
    function cleanup() {
      try { postForm.remove(); iframe.remove(); } catch (_) {}
    }
  });
}

/** Extrae el contenido real del documento desde un dialog que tiene iframe/embed. */
async function extraerContenidoDeDialog(dialog) {
  const contenedor = dialog.closest('.ui-dialog') || dialog;
  let iframe = contenedor.querySelector('iframe[src], embed[src], object[data]');
  if (!iframe) {
    iframe = Array.from(contenedor.querySelectorAll('iframe, embed, object')).find((el) => {
      const s = (el.getAttribute('src') || el.getAttribute('data') || '').trim();
      return s && !s.startsWith('blob:') && !s.startsWith('data:');
    }) || contenedor.querySelector('iframe, embed, object');
  }
  if (!iframe) return extraerContenidoDeNodo(dialog);
  const fetchOpts = { credentials: 'include', headers: { Accept: 'text/html,application/xhtml+xml,application/pdf,*/*' } };

  // 1) Intentar leer contentDocument (mismo origen, contenido ya cargado)
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc && iframeDoc.body) {
      const txt = extraerContenidoViewer(iframeDoc);
      if (txt && txt.trim().length > 10) return txt;
    }
  } catch (_) {}

  const src = iframe.getAttribute('src') || iframe.getAttribute('data') || '';
  if (!src || src.startsWith('blob:') || src.startsWith('data:')) {
    return extraerContenidoDeNodo(dialog);
  }
  let iframeUrl;
  try {
    iframeUrl = src.startsWith('http') ? src : new URL(src, location.origin).href;
  } catch (_) {
    return extraerContenidoDeNodo(dialog);
  }

  try {
    const resp = await fetch(iframeUrl, { ...fetchOpts, headers: { ...fetchOpts.headers, Referer: location.origin + '/' } });
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/pdf')) {
      const buffer = await resp.arrayBuffer();
      return await extraerTextoPDF(buffer) || extraerContenidoDeNodo(dialog);
    }
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nestedUrl = obtenerUrlIframeDocumento(doc, iframeUrl);
    if (nestedUrl) {
      await delayPjnEntreSubrecursos();
      const resp2 = await fetch(nestedUrl, fetchOpts);
      const ct2 = (resp2.headers.get('content-type') || '').toLowerCase();
      if (ct2.includes('application/pdf')) {
        const buffer2 = await resp2.arrayBuffer();
        return await extraerTextoPDF(buffer2) || extraerContenidoViewer(doc) || extraerContenidoDeNodo(dialog);
      }
    }
    return extraerContenidoViewer(doc) || extraerContenidoDeNodo(dialog);
  } catch (_) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) return extraerContenidoViewer(iframeDoc) || extraerContenidoDeNodo(dialog);
    } catch (_) {}
  }
  return extraerContenidoDeNodo(dialog);
}

/** Simula clic en link JSF, espera modal/dialog, extrae contenido y cierra. */
async function extraerPorClic(fila, sendProgress) {
  if (fila.pageNum != null && fila.pageNum >= 1) {
    await irAPagina(fila.pageNum);
    await new Promise((r) => setTimeout(r, 300));
  }
  const tabla = encontrarTablaActuaciones();
  if (!tabla) return '';
  const allRows = tabla.querySelectorAll('tbody tr, tr.ui-widget-content, tr[role="row"], tr');
  const row = allRows[fila.rowIndex];
  if (!row) return '';
  const link = row.querySelector('a[onclick], a[href="#"], a[href="javascript:void(0)"], a[href="javascript:;"]');
  if (!link || !(link instanceof Element)) return '';
  link.click();
  for (let w = 0; w < 40; w++) {
    await new Promise((r) => setTimeout(r, 250));
    const dialog = document.querySelector('.ui-dialog .ui-dialog-content, .ui-dialog [role="dialog"], [role="dialog"]');
    if (dialog) {
      await new Promise((r) => setTimeout(r, 1800));
      const texto = await extraerContenidoDeDialog(dialog);
      const closeBtn = document.querySelector('.ui-dialog-titlebar-close, .ui-dialog [aria-label="Close"], .ui-dialog button[type="button"]');
      if (closeBtn) closeBtn.click();
      else {
        const volver = Array.from(document.querySelectorAll('a, button')).find((e) => /cerrar|volver|close/i.test((e.textContent || '').trim()));
        if (volver) volver.click();
      }
      await new Promise((r) => setTimeout(r, 300));
      return texto;
    }
  }
  return '';
}

/** Extrae contenido de una fila (usado al procesar "últimos N" en la misma pasada que recogemos). */
async function extraerContenidoDeFila(f, fetchOpts) {
  let contenido = f.descripcion || '';
  let adjuntos = [];
  if (f.isJsflink) {
    if (f.componentId) contenido = await extraerViaIframePost(f.componentId);
    if (!contenido || contenido.length < 30) contenido = await extraerPorClic(f) || contenido;
    // Fallback: buscar link Ver/viewer en la tabla actual y hacer fetch (a veces el href se resuelve en runtime)
    if ((!contenido || contenido.length < 30) && f.pageNum != null) {
      await irAPagina(f.pageNum);
      await new Promise((r) => setTimeout(r, 200));
      const tabla = encontrarTablaActuaciones();
      const allRows = tabla?.querySelectorAll('tbody tr, tr.ui-widget-content, tr[role="row"], tr') || [];
      const row = allRows[f.rowIndex];
      const verLink = row?.querySelector('a[href*="viewer.seam"], a[href*="document.seam"]');
      const href = verLink?.getAttribute('href') || verLink?.href || '';
      if (href && !href.includes('download=true')) {
        const urlVer = href.startsWith('http') ? href : new URL(href, location.href).href;
        try {
          const r = await fetch(urlVer, { ...fetchOpts, headers: { ...fetchOpts.headers, Accept: 'text/html,application/xhtml+xml,application/pdf,*/*' } });
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('application/pdf')) {
            const buf = await r.arrayBuffer();
            contenido = await extraerTextoPDF(buf) || contenido;
          } else {
            const html = await r.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const iframeUrl = obtenerUrlIframeDocumento(doc, urlVer);
            if (iframeUrl) {
              await delayPjnEntreSubrecursos();
              const r2 = await fetch(iframeUrl, fetchOpts);
              if ((r2.headers.get('content-type') || '').toLowerCase().includes('application/pdf')) {
                contenido = await extraerTextoPDF(await r2.arrayBuffer()) || contenido;
              } else {
                const doc2 = new DOMParser().parseFromString(await r2.text(), 'text/html');
                contenido = extraerContenidoViewer(doc2) || contenido;
              }
            } else {
              contenido = extraerContenidoViewer(doc) || contenido;
            }
          }
        } catch (_) {}
      }
    }
    contenido = contenido || f.descripcion || '(Sin contenido extraído)';
  } else if (f.url && VIEWER_REGEX.test(f.url)) {
    try {
      const resp = await fetch(f.url, { ...fetchOpts, headers: { ...fetchOpts.headers, Accept: 'text/html,application/xhtml+xml,application/pdf,*/*' } });
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/pdf')) {
        const buffer = await resp.arrayBuffer();
        contenido = await extraerTextoPDF(buffer) || '(PDF sin texto extraíble)';
        adjuntos = [{ nombre: 'documento.pdf', url: f.url }];
      } else {
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const embedEl = doc.querySelector('iframe[src], embed[src], object[data]');
        const srcAttr = embedEl?.getAttribute('src') || embedEl?.getAttribute('data') || '';
        const iframeUrl = srcAttr ? (srcAttr.startsWith('http') ? srcAttr : new URL(srcAttr, f.url).href) : obtenerUrlIframeDocumento(doc, f.url);
        if (iframeUrl) {
          await delayPjnEntreSubrecursos();
          const resp2 = await fetch(iframeUrl, fetchOpts);
          const ct2 = (resp2.headers.get('content-type') || '').toLowerCase();
          if (ct2.includes('application/pdf')) {
            const buffer2 = await resp2.arrayBuffer();
            contenido = await extraerTextoPDF(buffer2) || '(PDF sin texto extraíble)';
            adjuntos = [{ nombre: 'documento.pdf', url: iframeUrl }];
          } else {
            const html2 = await resp2.text();
            const doc2 = new DOMParser().parseFromString(html2, 'text/html');
            contenido = extraerContenidoViewer(doc2) || f.descripcion || '(Sin texto)';
          }
        } else {
          contenido = extraerContenidoViewer(doc) || f.descripcion || '(Sin texto)';
        }
      }
    } catch (e) {
      contenido = `(Error al cargar: ${e.message})\n${f.descripcion || ''}`;
    }
  }
  return { contenido, adjuntos };
}

function getExpedienteInfo() {
  const datos = extraerDatosExpediente();
  const tabla = encontrarTablaActuaciones();
  const filas = extraerFilasConColumnas(tabla);
  return {
    pageTitle: document.title || '',
    pageUrl: location.href,
    count: filas.length,
    filas,
    caratula: datos.caratula,
    nroExpediente: datos.expediente,
    juzgado: datos.juzgado
  };
}

/**
 * Procesa filas: para cada una con url hace fetch; sino usa descripcion.
 * Mantiene fecha/tipo de la tabla y une con contenido del viewer.
 */
async function collectActuaciones(filas, sendProgress, ultimosN) {
  const datos = extraerDatosExpediente();
  let filasConContenido = false;
  if (ultimosN && ultimosN > 0) {
    filas = await extraerUltimasNFilasConContenido(ultimosN, sendProgress, extraerContenidoDeFila);
    filasConContenido = true;
  } else {
    filas = await extraerTodasLasFilas(sendProgress);
  }
  if (filas === null) return null;
  if (!filas.length) return { actuaciones: [], datosExpediente: datos };

  const actuaciones = [];
  const fetchOpts = {
    credentials: 'include',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/pdf',
      'Accept-Language': 'es-AR,es;q=0.9',
      Referer: location.origin + '/'
    }
  };
  for (let i = 0; i < filas.length; i++) {
    if (cancelarExportacion) return null;
    const f = filas[i];
    let contenido = f.contenido ?? f.descripcion ?? '';
    let adjuntos = f.adjuntos ?? [];

    if (!filasConContenido && i > 0) await delayEntrePeticionesPjn();

    if (!filasConContenido) {
      // Solo extraer si no venimos de "últimos N" (ya traen contenido)
      if (f.isJsflink) {
        if (f.componentId) contenido = await extraerViaIframePost(f.componentId);
        if (!contenido || contenido.length < 30) contenido = await extraerPorClic(f) || contenido;
        contenido = contenido || f.descripcion || '(Sin contenido extraído)';
      } else if (f.url && VIEWER_REGEX.test(f.url)) {
      try {
        const resp = await fetch(f.url, { ...fetchOpts, headers: { ...fetchOpts.headers, Accept: 'text/html,application/xhtml+xml,application/pdf,*/*' } });
        const ct = (resp.headers.get('content-type') || '').toLowerCase();

        if (ct.includes('application/pdf')) {
          const buffer = await resp.arrayBuffer();
          contenido = await extraerTextoPDF(buffer) || '(PDF sin texto extraíble)';
          adjuntos = [{ nombre: 'documento.pdf', url: f.url }];
        } else {
          const html = await resp.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const embedEl = doc.querySelector('iframe[src], embed[src], object[data]');
          const srcAttr = embedEl?.getAttribute('src') || embedEl?.getAttribute('data') || '';
          const iframeUrl = srcAttr ? (srcAttr.startsWith('http') ? srcAttr : new URL(srcAttr, f.url).href) : obtenerUrlIframeDocumento(doc, f.url);

          if (iframeUrl) {
            await delayPjnEntreSubrecursos();
            const resp2 = await fetch(iframeUrl, fetchOpts);
            const ct2 = (resp2.headers.get('content-type') || '').toLowerCase();
            if (ct2.includes('application/pdf')) {
              const buffer2 = await resp2.arrayBuffer();
              contenido = await extraerTextoPDF(buffer2) || '(PDF sin texto extraíble)';
              adjuntos = [{ nombre: 'documento.pdf', url: iframeUrl }];
            } else {
              const html2 = await resp2.text();
              const doc2 = new DOMParser().parseFromString(html2, 'text/html');
              contenido = extraerContenidoViewer(doc2) || f.descripcion || '(Sin texto)';
            }
          } else {
            contenido = extraerContenidoViewer(doc) || f.descripcion || '(Sin texto)';
          }
        }
      } catch (e) {
        contenido = `(Error al cargar: ${e.message})\n${f.descripcion || ''}`;
      }
    }
    }

    actuaciones.push({
      numero: i + 1,
      fecha: f.fecha,
      hora: '',
      tipo: f.tipo,
      titulo: '',
      firmante: '',
      contenido,
      adjuntos,
      url: f.url || location.href
    });
    if (sendProgress) sendProgress({ current: i + 1, total: filas.length });
  }
  return { actuaciones, datosExpediente: datos };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'getExpedienteInfo') {
    try {
      const info = getExpedienteInfo();
      sendResponse({ ok: true, ...info, portal: 'pjn' });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }
  if (msg.action === 'cancelExport') {
    cancelarExportacion = true;
    sendResponse({ ok: true });
    return true;
  }
  if (msg.action === 'collectActuaciones') {
    cancelarExportacion = false;
    const ultimosN = msg.ultimosN ? parseInt(msg.ultimosN, 10) : null;
    const info = getExpedienteInfo();
    const sendProgress = (d) => chrome.runtime.sendMessage({ type: 'exportProgress', ...d }).catch(() => {});
    collectActuaciones(info.filas || [], sendProgress, ultimosN).then((result) => {
      if (result && !result.actuaciones?.length) {
        sendResponse({ ok: false, error: 'No se encontraron actuaciones' });
        return;
      }
      if (result === null) sendResponse({ ok: false, error: 'Cancelado por el usuario' });
      else sendResponse({
        ok: true,
        actuaciones: result.actuaciones,
        anexos: [],
        pageTitle: info.pageTitle,
        pageUrl: info.pageUrl,
        count: result.actuaciones.length,
        caratula: result.datosExpediente?.caratula || info.caratula,
        nroExpediente: info.nroExpediente,
        juzgado: info.juzgado
      });
    });
    return true;
  }
});
})();
