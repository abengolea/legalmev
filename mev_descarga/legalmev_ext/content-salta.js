/**
 * Content script — Consulta pública Salta (IOL/SED)
 * https://plataforma.justiciasalta.gov.ar/iol-ui/p/*
 *
 * Usa la API pública /iol-api/api/public/ (sin login judicial).
 */
(function () {
  'use strict';
  if (globalThis.__LEGALMEV_SALTA_LOADED__) return;
  globalThis.__LEGALMEV_SALTA_LOADED__ = true;

  const API_PUBLIC = 'https://plataforma.justiciasalta.gov.ar/iol-api/api/public/';
  const PAGE_SIZE = 50;

  let cancelarExportacion = false;
  const state = { expId: null, org: null, encabezado: null };

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function delayEntrePeticiones() {
    return delay(400 + Math.floor(Math.random() * 500));
  }

  function observeSaltaUrl(url) {
    if (!url || !String(url).includes('justiciasalta.gov.ar')) return;
    const u = String(url);
    const expM = u.match(/[?&]expId=([^&]+)/i);
    if (expM) state.expId = decodeURIComponent(expM[1]);
    const filtroM = u.match(/[?&]filtro=([^&]+)/i);
    if (filtroM) {
      try {
        const f = JSON.parse(decodeURIComponent(filtroM[1]));
        if (f.expId) state.expId = f.expId;
      } catch (_) {}
    }
  }

  function installNetworkHooks() {
    if (globalThis.__LEGALMEV_SALTA_HOOKED__) return;
    globalThis.__LEGALMEV_SALTA_HOOKED__ = true;

    const origFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async function (...args) {
      try {
        const req = args[0];
        const url = typeof req === 'string' ? req : req?.url;
        observeSaltaUrl(url);
      } catch (_) {}
      return origFetch(...args);
    };

    const XHR = globalThis.XMLHttpRequest;
    if (XHR?.prototype?.open) {
      const origOpen = XHR.prototype.open;
      XHR.prototype.open = function (method, url, ...rest) {
        observeSaltaUrl(url);
        return origOpen.call(this, method, url, ...rest);
      };
    }
  }

  installNetworkHooks();

  async function apiGet(path) {
    const resp = await fetch(API_PUBLIC + path.replace(/^\//, ''), {
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!resp.ok) throw new Error(`API Salta ${resp.status}`);
    return resp.json();
  }

  async function apiPost(path, body) {
    const resp = await fetch(API_PUBLIC + path.replace(/^\//, ''), {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`API Salta ${resp.status}`);
    return resp.json();
  }

  function parseCuijFromDom() {
    const text = document.body?.innerText || '';
    const m = text.match(/\((\d{2}-\d{8}-\d)\)/);
    return m ? m[1] : '';
  }

  function parseNroExpedienteFromDom() {
    const text = document.body?.innerText || '';
    const m = text.match(/\b([A-Z]{2,4}\s*\d+\s*\/\s*\d+)\b/i);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  function parseCaratulaFromDom() {
    const link = document.querySelector('a[href], .caratula, [class*="caratula"]');
    const candidates = [];
    for (const a of document.querySelectorAll('a')) {
      const t = (a.textContent || '').trim();
      if (t.length > 40 && /CONTRA|POR\s+DA/i.test(t)) candidates.push(t);
    }
    if (candidates.length) return candidates[0];
    const title = (document.title || '').trim();
    return title.length > 10 ? title : '';
  }

  function domTieneExpedienteAbierto() {
    const txt = document.body?.innerText || '';
    if (/\bActuaciones\b/.test(txt) && /\bFicha\b/.test(txt) && parseCuijFromDom()) return true;
    return !!document.querySelector('iol-expediente-actuaciones, iol-expediente-ficha');
  }

  /** Página de resultados de búsqueda (varias causas), sin ficha abierta. */
  function isSaltaListaPage() {
    if (domTieneExpedienteAbierto()) return false;
    const path = (location.pathname || '').toLowerCase();
    if (path.includes('/expedientes')) return true;
    if (/identificador=/i.test(location.search || '')) return true;
    const txt = document.body?.innerText || '';
    return /\bCausas\b/.test(txt) && /\bEXP\s*\d+\s*\/\s*\d+/i.test(txt);
  }

  async function resolveExpId() {
    if (state.expId) return state.expId;
    if (!domTieneExpedienteAbierto()) return null;

    const cuij = parseCuijFromDom();
    if (!cuij) return null;

    const data = await apiPost('expedientes/lista', {
      filter: JSON.stringify({ cuij, identificador: cuij }),
      tipoBusqueda: 'CAU',
      page: 0,
      size: 20
    });
    const hit =
      data.content?.find((c) => (c.caratula || '').includes(cuij.replace(/-/g, ''))) ||
      data.content?.[0];
    if (hit?.expId) {
      state.expId = hit.expId;
      if (hit.codigoOrganismoRadActual) state.org = hit.codigoOrganismoRadActual;
    }
    return state.expId || null;
  }

  async function fetchEncabezado(expId) {
    const data = await apiGet(`expedientes/encabezado?expId=${encodeURIComponent(expId)}`);
    state.encabezado = data;
    if (data.codigoOrganismoRadActual) state.org = data.codigoOrganismoRadActual;
    return data;
  }

  function actuacionesFiltro(expId) {
    return {
      cedulas: true,
      escritos: true,
      despachos: true,
      movimientos: true,
      expId
    };
  }

  async function fetchActuacionesPage(expId, pageIndex, pageSize) {
    const filtro = encodeURIComponent(JSON.stringify(actuacionesFiltro(expId)));
    return apiGet(
      `expedientes/actuaciones?filtro=${filtro}&page=${pageIndex}&size=${pageSize}`
    );
  }

  async function fetchAllActuaciones(expId) {
    const all = [];
    let page = 0;
    let totalPages = 1;
    while (page < totalPages) {
      if (cancelarExportacion) return null;
      const data = await fetchActuacionesPage(expId, page, PAGE_SIZE);
      totalPages = data.totalPages ?? 1;
      all.push(...(data.content || []));
      if (data.last || !data.content?.length) break;
      page++;
      if (page < totalPages) await delayEntrePeticiones();
    }
    return all;
  }

  async function countActuaciones(expId) {
    const data = await fetchActuacionesPage(expId, 0, 1);
    return data.totalElements ?? (data.content?.length || 0);
  }

  function orgFromActuacion(act, fallbackOrg) {
    const candidates = [
      act.org,
      act.codigoOrganismo,
      act.codigoOrganismoRadActual,
      (act.organismo || '').split('|')[0]?.trim(),
      fallbackOrg,
      state.org,
    ];
    for (const raw of candidates) {
      const v = String(raw || '').trim();
      if (v && /^[A-Z0-9]{2,12}$/i.test(v)) return v.toUpperCase();
    }
    return fallbackOrg || state.org || '';
  }

  function fmtFecha(ms) {
    if (!ms) return '';
    try {
      return new Date(ms).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  function fmtHora(ms) {
    if (!ms) return '';
    try {
      return new Date(ms).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return '';
    }
  }

  async function extraerTextoPDF(buffer) {
    if (!globalThis.pdfjsLib) return '(Error: pdf.js no disponible)';
    if (!globalThis.__pdjsWorkerSet__) {
      globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc =
        chrome.runtime.getURL('lib/pdf.worker.min.js');
      globalThis.__pdjsWorkerSet__ = true;
    }
    const MAX_PAGES = 80;
    try {
      const pdf = await globalThis.pdfjsLib.getDocument({
        data: buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer,
        isEvalSupported: false
      }).promise;
      const parts = [];
      const n = Math.min(pdf.numPages, MAX_PAGES);
      for (let i = 1; i <= n; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        parts.push(tc.items.map((it) => it.str).join(' '));
      }
      return parts.join('\n\n').trim() || '(PDF sin texto extraíble)';
    } catch (e) {
      return `(Error al leer PDF: ${e.message})`;
    }
  }

  function tipoCandidates(act) {
    const out = [];
    const push = (t) => {
      const v = String(t || '').trim();
      if (v && !out.includes(v)) out.push(v);
    };
    push(act.tipoPdf);
    push(act.tipo);
    push('ACTUACION GENERICA');
    push('DESPACHOS');
    push('DESPACHO');
    push('ESCRITOS');
    push('ESCRITO');
    push('CEDULAS');
    push('CEDULA');
    push('RESOLUCION');
    push('DECRETO');
    return out;
  }

  function buildActuacionPdfUrl(act, expId, org, tipo) {
    const actId = act.actId || act.id;
    const orgCode = org || orgFromActuacion(act, org);
    const tipoEnc = encodeURIComponent(tipo || act.tipoPdf || act.tipo || 'ACTUACION GENERICA');
    return (
      API_PUBLIC +
      `expedientes/actuaciones/pdf?actId=${encodeURIComponent(actId)}` +
      `&org=${encodeURIComponent(orgCode)}` +
      `&expId=${encodeURIComponent(expId)}` +
      `&tipo=${tipoEnc}`
    );
  }

  function isPdfBuffer(buffer) {
    if (!buffer || buffer.byteLength < 5) return false;
    const head = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer.slice(0, 5));
    return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  }

  /** Lista de adjuntos del clip (escritos / documentales del profesional). */
  async function fetchAdjuntosMeta(actId, expId) {
    if (!actId || !expId) return [];
    try {
      const data = await apiGet(
        `expedientes/actuaciones/adjuntos?actId=${encodeURIComponent(actId)}&preExpId=${encodeURIComponent(expId)}`
      );
      const list = Array.isArray(data?.adjuntos)
        ? data.adjuntos
        : Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
            ? data.content
            : [];
      return list
        .map((a) => ({
          adjId: a.adjId ?? a.aacId ?? a.id,
          titulo: a.titulo || a.nombre || a.name || `adjunto_${a.adjId || a.aacId || ''}.pdf`,
          fecha: a.fecha || null,
        }))
        .filter((a) => a.adjId != null && a.adjId !== '');
    } catch (_) {
      return [];
    }
  }

  function buildAdjuntoPdfUrl(adjId, actId, expId, tipo) {
    const tipoEnc = encodeURIComponent(tipo || 'ESCRITOS');
    return (
      API_PUBLIC +
      `expedientes/actuaciones/adjuntoPdf?aacId=${encodeURIComponent(adjId)}` +
      `&actId=${encodeURIComponent(actId)}` +
      `&preExpId=${encodeURIComponent(expId)}` +
      `&tipo=${tipoEnc}`
    );
  }

  async function fetchAdjuntoPdfBuffer(adj, act, expId) {
    const actId = act.actId || act.id;
    const adjId = adj.adjId;
    const tipos = [];
    const push = (t) => {
      const v = String(t || '').trim();
      if (v && !tipos.includes(v)) tipos.push(v);
    };
    push(act.tipoPdf);
    push(act.tipo);
    push('ESCRITOS');
    push('ESCRITO');
    push('ACTUACION GENERICA');
    push('DESPACHOS');
    push('CEDULAS');

    let lastErr = '';
    for (const tipo of tipos) {
      const url = buildAdjuntoPdfUrl(adjId, actId, expId, tipo);
      try {
        const resp = await fetch(url, {
          credentials: 'omit',
          headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
        });
        if (resp.status === 204) {
          lastErr = `${tipo}:204`;
          continue;
        }
        if (!resp.ok) {
          lastErr = `${tipo}:HTTP ${resp.status}`;
          continue;
        }
        const buffer = await resp.arrayBuffer();
        if (!isPdfBuffer(buffer)) {
          lastErr = `${tipo}:sin PDF`;
          continue;
        }
        const rawName = String(adj.titulo || `adjunto_${adjId}.pdf`);
        const nombre = /\.pdf$/i.test(rawName) ? rawName : `${rawName}.pdf`;
        return { url, buffer, isPdf: true, nombre, adjId };
      } catch (e) {
        lastErr = e.message || String(e);
      }
    }
    return { isPdf: false, buffer: null, detail: lastErr, adjId, nombre: adj.titulo || `adjunto_${adjId}` };
  }

  /**
   * Baja los PDFs del clip Adjuntos (escritos / documentales).
   * El portal usa aacId=adjId en /actuaciones/adjuntoPdf.
   */
  async function downloadAdjuntosActuacion(act, expId) {
    const actId = act.actId || act.id;
    const posee = act.poseeAdjunto === 1 || act.poseeAdjunto === true || Number(act.poseeAdjunto) > 0;
    // Si el flag no viene, igual intentamos listar (barato) por si hay adjuntos
    const meta = await fetchAdjuntosMeta(actId, expId);
    if (!meta.length) {
      if (posee) return { files: [], note: 'poseeAdjunto pero sin lista' };
      return { files: [], note: '' };
    }
    const files = [];
    for (let i = 0; i < meta.length; i++) {
      if (i > 0) await delay(200);
      const fetched = await fetchAdjuntoPdfBuffer(meta[i], act, expId);
      if (fetched.isPdf && fetched.buffer) {
        files.push({
          nombre: fetched.nombre,
          url: fetched.url,
          bytes: new Uint8Array(fetched.buffer),
        });
      }
    }
    return { files, note: files.length ? '' : 'adjuntos no descargables' };
  }

  async function fetchActuacionPdfBuffer(act, expId, org) {
    const orgCode = orgFromActuacion(act, org);
    const tipos = tipoCandidates(act);
    const attempts = [];
    let lastUrl = '';

    for (const tipo of tipos) {
      const url = buildActuacionPdfUrl(act, expId, orgCode, tipo);
      lastUrl = url;
      const resp = await fetch(url, {
        credentials: 'omit',
        headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
      });
      // 204 = portal sin documento digital para esa actuación
      if (resp.status === 204) {
        attempts.push(`${tipo}:204`);
        continue;
      }
      if (!resp.ok) {
        attempts.push(`${tipo}:HTTP ${resp.status}`);
        continue;
      }
      const buffer = await resp.arrayBuffer();
      if (!isPdfBuffer(buffer)) {
        attempts.push(`${tipo}:sin PDF (${buffer.byteLength} b)`);
        continue;
      }
      const nombre = `${(act.titulo || act.descripcion || 'actuacion').toString().slice(0, 80)}.pdf`;
      return {
        url,
        buffer,
        isPdf: true,
        nombre,
        org: orgCode,
        tipoUsado: tipo,
      };
    }

    return {
      url: lastUrl || buildActuacionPdfUrl(act, expId, orgCode, act.tipo),
      buffer: null,
      isPdf: false,
      nombre: 'sin-documento.pdf',
      empty: true,
      detail: attempts.slice(0, 6).join(' · ') || 'sin respuesta',
    };
  }

  /**
   * Cada actuación de Salta suele ser un PDF nativo (como PJN).
   * Algunas causas antiguas responden 204 (sin documento digital).
   */
  async function downloadActuacionPdf(act, expId, org, opts = {}) {
    const extractText = opts.extractText === true;
    const fetched = await fetchActuacionPdfBuffer(act, expId, org);
    if (fetched.isPdf && fetched.buffer) {
      const bytes = new Uint8Array(fetched.buffer);
      let contenido = act.titulo || act.descripcion || act.tipo || '';
      if (extractText) {
        try {
          contenido = (await extraerTextoPDF(fetched.buffer)) || contenido;
        } catch (_) {}
      }
      return {
        contenido,
        adjuntos: [{ nombre: fetched.nombre, url: fetched.url }],
        pdfBytes: bytes,
        empty: false,
      };
    }
    const why = fetched.detail ? ` (${fetched.detail})` : '';
    return {
      contenido:
        `(Sin documento digital en el portal de Salta${why}. ` +
        `Si al hacer click en la actuación no se abre un PDF con texto, el portal no lo tiene disponible para descarga.)`,
      adjuntos: [],
      pdfBytes: null,
      empty: true,
    };
  }

  function buildDatosExpediente(enc) {
    const e = enc || state.encabezado || {};
    return {
      caratula: e.caratula || parseCaratulaFromDom(),
      nroExpediente:
        e.numero != null
          ? `${e.tipoExpediente || ''} ${e.numero}/${e.anio}`.trim()
          : parseNroExpedienteFromDom(),
      juzgado: e.organismoRadActual || '',
      dependencia: e.organismoRadActual || '',
      jurisdiccion: 'Salta',
      situacion: e.situacion || e.estado || '',
      portal: 'SALTA',
      expId: state.expId || e.expId || '',
    };
  }

  function actToPickerItem(act, index, org) {
    const fechaMs = act.fechaPublicacion || act.fechaFirma || act.fechaPub;
    const titulo = act.titulo || '';
    const tipo = act.tipo || '';
    const orgCode = orgFromActuacion(act, org);
    const poseeAdj =
      act.poseeAdjunto === 1 || act.poseeAdjunto === true || Number(act.poseeAdjunto) > 0;
    return {
      id: String(act.actId || act.id || index),
      actId: act.actId || act.id,
      fecha: fmtFecha(fechaMs),
      hora: fmtHora(fechaMs),
      tipo: poseeAdj ? `${tipo} · adjunto` : tipo,
      titulo,
      descripcion: titulo || tipo,
      firmante: act.firmantes || '',
      organismo: act.organismo || '',
      poseeAdjunto: poseeAdj ? 1 : 0,
      hasDoc: true,
      docCount: poseeAdj ? 2 : 1,
      org: orgCode,
      tipoPdf: tipo || 'ACTUACION GENERICA',
      selected: true,
    };
  }

  async function listActuacionesForPicker(sendProgress, cancelFlag) {
    const expId = await resolveExpId();
    if (!expId) throw new Error('Abrí un expediente (pestaña Actuaciones) antes de exportar.');

    try {
      await fetchEncabezado(expId);
    } catch (_) {}
    const org = state.org || state.encabezado?.codigoOrganismoRadActual || '';

    sendProgress?.({ mensaje: 'Obteniendo actuaciones de Salta…' });
    const acts = await fetchAllActuaciones(expId);
    if (acts === null || cancelFlag?.cancelled || cancelarExportacion) return null;
    if (!acts.length) throw new Error('No se encontraron actuaciones en este expediente.');

    return acts.map((act, i) => actToPickerItem(act, i, org));
  }

  async function hydrateFromItems(selectedItems, sendProgress, cancelFlag) {
    const expId = await resolveExpId();
    if (!expId) throw new Error('Abrí un expediente (pestaña Actuaciones) antes de exportar.');

    let enc = state.encabezado;
    try {
      enc = await fetchEncabezado(expId);
    } catch (_) {
      enc = enc || {};
    }
    const org = state.org || enc.codigoOrganismoRadActual || '';
    const items = Array.isArray(selectedItems) ? selectedItems : [];
    const actuaciones = [];

    for (let i = 0; i < items.length; i++) {
      if (cancelFlag?.cancelled || cancelarExportacion) return null;
      const it = items[i];
      if (i > 0) await delayEntrePeticiones();

      sendProgress?.({
        current: i,
        total: items.length,
        progreso: items.length ? Math.min(85, Math.round((100 * (i + 0.35)) / items.length)) : 0,
        mensaje: `Descargando actuación ${i + 1} de ${items.length}…`,
      });

      let contenido = it.descripcion || it.titulo || '';
      let adjuntos = [];
      let pdfBytes = null;
      let adjuntoBytes = [];
      let empty = false;
      try {
        const pdf = await downloadActuacionPdf(it, expId, org, { extractText: false });
        contenido = pdf.contenido || contenido;
        adjuntos = pdf.adjuntos || [];
        pdfBytes = pdf.pdfBytes || null;
        empty = !!pdf.empty;
        if (pdfBytes && !empty) {
          adjuntoBytes.push({
            nombre: adjuntos[0]?.nombre || `${(it.titulo || 'actuacion').toString().slice(0, 60)}.pdf`,
            bytes: pdfBytes,
            url: adjuntos[0]?.url,
          });
          try {
            const texto = await extraerTextoPDF(pdfBytes.buffer || pdfBytes);
            if (texto && !/^\(Error/.test(texto)) contenido = texto;
          } catch (_) {}
        }

        // Clip "Adjuntos": escritos / documentales del profesional
        sendProgress?.({
          current: i,
          total: items.length,
          progreso: items.length ? Math.min(85, Math.round((100 * (i + 0.55)) / items.length)) : 0,
          mensaje: `Adjuntos de actuación ${i + 1} de ${items.length}…`,
        });
        const extra = await downloadAdjuntosActuacion(it, expId);
        for (const f of extra.files || []) {
          adjuntoBytes.push(f);
          adjuntos.push({ nombre: f.nombre, url: f.url });
        }
        if (adjuntoBytes.length) empty = false;
      } catch (e) {
        contenido = `${it.descripcion || it.titulo || ''}\n\n(Error al descargar PDF: ${e.message})`;
        empty = !adjuntoBytes.length;
      }

      actuaciones.push({
        ...it,
        numero: i + 1,
        fecha: it.fecha || '',
        hora: it.hora || '',
        tipo: it.tipo || '',
        titulo: it.titulo || it.descripcion || '',
        descripcion: it.descripcion || it.titulo || it.tipo || '',
        firmante: it.firmante || '',
        contenido,
        adjuntos,
        pdfBytes: adjuntoBytes[0]?.bytes || pdfBytes || undefined,
        adjuntoBytes,
        url: adjuntos[0]?.url || buildActuacionPdfUrl(it, expId, org, it.tipo),
        hasDoc: adjuntoBytes.length > 0,
        docCount: Math.max(1, adjuntoBytes.length),
        sinDocumentoDigital: empty,
      });
    }

    return actuaciones;
  }

  async function resolveAdjuntoBytes(act, ctx) {
    if (cancelarExportacion || ctx?.cancelFlag?.cancelled) return [];
    if (Array.isArray(act.adjuntoBytes) && act.adjuntoBytes.length) return act.adjuntoBytes;
    const expId = state.expId || (await resolveExpId());
    if (!expId) return [];
    const org = act.org || state.org || '';
    ctx?.setProgress?.(null, `Bajando documento act. ${ctx.index}…`);
    const out = [];
    const fetched = await fetchActuacionPdfBuffer(act, expId, org);
    if (fetched.isPdf && fetched.buffer) {
      out.push({ nombre: fetched.nombre, bytes: new Uint8Array(fetched.buffer) });
    }
    ctx?.setProgress?.(null, `Bajando adjuntos act. ${ctx.index}…`);
    const extra = await downloadAdjuntosActuacion(act, expId);
    for (const f of extra.files || []) out.push(f);
    return out;
  }

  async function getExpedienteInfo() {
    const abierto = domTieneExpedienteAbierto();
    const expId = await resolveExpId();
    if (!expId) {
      const saltaEstado = isSaltaListaPage()
        ? 'lista'
        : abierto
          ? 'abierto_sin_datos'
          : 'lista';
      return {
        pageTitle: document.title || '',
        pageUrl: location.href,
        count: 0,
        caratula: '',
        nroExpediente: '',
        juzgado: '',
        saltaEstado
      };
    }

    let enc = state.encabezado;
    if (!enc || enc.expId !== expId) {
      try {
        enc = await fetchEncabezado(expId);
      } catch (_) {
        enc = {};
      }
    }

    const count = await countActuaciones(expId);
    const tipo = enc.tipoExpediente || '';
    const nro = enc.numero != null ? `${tipo} ${enc.numero}/${enc.anio}`.trim() : parseNroExpedienteFromDom();

    return {
      pageTitle: document.title || '',
      pageUrl: location.href,
      count,
      caratula: enc.caratula || parseCaratulaFromDom(),
      nroExpediente: nro || parseNroExpedienteFromDom(),
      juzgado: enc.organismoRadActual || '',
      expId,
      saltaEstado: count > 0 ? 'listo' : 'abierto_sin_datos'
    };
  }

  async function collectActuaciones(sendProgress, ultimosN) {
    const expId = await resolveExpId();
    if (!expId) throw new Error('Abrí un expediente (pestaña Actuaciones) antes de exportar.');

    let enc = state.encabezado;
    try {
      enc = await fetchEncabezado(expId);
    } catch (_) {
      enc = enc || {};
    }
    const org = state.org || enc.codigoOrganismoRadActual || '';

    if (sendProgress) {
      sendProgress({ current: 0, total: 1, mensaje: 'Obteniendo actuaciones de Salta...' });
    }

    let acts = await fetchAllActuaciones(expId);
    if (acts === null) return null;
    if (!acts.length) throw new Error('No se encontraron actuaciones en este expediente.');

    if (ultimosN && ultimosN > 0) acts = acts.slice(0, ultimosN);

    const actuaciones = [];
    for (let i = 0; i < acts.length; i++) {
      if (cancelarExportacion) return null;
      const act = acts[i];
      if (i > 0) await delayEntrePeticiones();

      if (sendProgress) {
        sendProgress({
          current: i,
          total: acts.length,
          progreso: acts.length ? Math.min(99, Math.round((100 * (i + 0.35)) / acts.length)) : 0,
          mensaje: `Descargando actuación ${i + 1} de ${acts.length}…`
        });
      }

      let contenido = act.titulo || '';
      let adjuntos = [];
      let adjuntoBytes = [];
      try {
        const pdf = await downloadActuacionPdf(act, expId, org, { extractText: true });
        contenido = pdf.contenido || contenido;
        adjuntos = pdf.adjuntos || [];
        if (pdf.pdfBytes) {
          adjuntoBytes.push({
            nombre: adjuntos[0]?.nombre || `${(act.titulo || 'actuacion').toString().slice(0, 60)}.pdf`,
            bytes: pdf.pdfBytes,
          });
        }
        const extra = await downloadAdjuntosActuacion(act, expId);
        for (const f of extra.files || []) {
          adjuntoBytes.push(f);
          adjuntos.push({ nombre: f.nombre, url: f.url });
        }
      } catch (e) {
        contenido = `${act.titulo || ''}\n\n(Error al descargar PDF: ${e.message})`;
      }

      const fechaMs = act.fechaPublicacion || act.fechaFirma || act.fechaPub;
      actuaciones.push({
        numero: i + 1,
        fecha: fmtFecha(fechaMs),
        hora: fmtHora(fechaMs),
        tipo: act.tipo || '',
        titulo: act.titulo || '',
        descripcion: act.titulo || act.tipo || '',
        firmante: act.firmantes || '',
        contenido,
        adjuntos,
        adjuntoBytes,
        pdfBytes: adjuntoBytes[0]?.bytes,
        url: `${location.href.split('#')[0]}#act-${act.actId}`
      });

      if (sendProgress) {
        sendProgress({ current: i + 1, total: acts.length, mensaje: `Procesando ${i + 1} de ${acts.length}...` });
      }
    }

    return {
      actuaciones: actuaciones.map((a) => ({
        ...a,
        descripcion: a.descripcion || a.titulo || a.tipo || '',
      })),
      anexos: [],
      datosExpediente: buildDatosExpediente(enc),
    };
  }

  globalThis.LegalMevSaltaCore = {
    extractDatos: () => buildDatosExpediente(state.encabezado),
    listActuaciones: listActuacionesForPicker,
    hydrateFromItems,
    resolveAdjuntos: resolveAdjuntoBytes,
    setCancel(v) {
      cancelarExportacion = !!v;
    },
    getExpedienteInfo,
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'MONITOR_LIST_MOVEMENTS') {
      (async () => {
        try {
          const expId = await resolveExpId();
          if (!expId) {
            sendResponse({
              ok: false,
              error: 'Abrí un expediente (pestaña Actuaciones) para monitorear.',
              code: 'MISSING_IDS',
            });
            return;
          }
          const acts = await fetchAllActuaciones(expId);
          if (acts === null) {
            sendResponse({ ok: false, error: 'Cancelado', code: 'UNKNOWN' });
            return;
          }
          const movements = (acts || []).map((act) => {
            const fechaMs = act.fechaPublicacion || act.fechaFirma || act.fechaPub;
            return {
              portalId: String(act.actId || act.id || ''),
              id: String(act.actId || act.id || ''),
              fecha: fmtFecha(fechaMs),
              tipo: act.tipo || '',
              descripcion: act.titulo || act.tipo || '',
            };
          });
          sendResponse({ ok: true, portal: 'SALTA', movements });
        } catch (e) {
          const code = /sesión|login|unauthorized|401/i.test(e.message || '')
            ? 'SESSION_EXPIRED'
            : 'PARSE_ERROR';
          sendResponse({ ok: false, error: e.message, code });
        }
      })();
      return true;
    }
    if (msg.action === 'getExpedienteInfo') {
      getExpedienteInfo()
        .then((info) => {
          sendResponse({
            ok: true,
            ...info,
            portal: 'salta',
            saltaEstado: info.saltaEstado || (info.count > 0 ? 'listo' : 'lista')
          });
        })
        .catch((e) => sendResponse({ ok: false, error: e.message }));
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
      const sendProgress = (d) =>
        chrome.runtime.sendMessage({ type: 'exportProgress', ...d }).catch(() => {});
      collectActuaciones(sendProgress, ultimosN)
        .then((result) => {
          if (result === null) {
            sendResponse({ ok: false, error: 'Cancelado por el usuario' });
            return;
          }
          const info = result.datosExpediente || {};
          sendResponse({
            ok: true,
            actuaciones: result.actuaciones,
            anexos: result.anexos || [],
            pageTitle: document.title,
            pageUrl: location.href,
            count: result.actuaciones.length,
            caratula: info.caratula,
            nroExpediente: info.nroExpediente,
            juzgado: info.juzgado
          });
        })
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });

  /** Dock «Seguir causa» cuando hay expediente abierto. */
  async function mountMonitorDock() {
    const Ui = window.LegalMevDownloadUi;
    if (!Ui || document.getElementById('lm-export-dock')) return;
    try {
      const info = await getExpedienteInfo();
      if (!info?.expId && !(info?.count > 0)) return;
      Ui.mountFloatingBar({
        portal: 'SALTA',
        mode: 'monitor',
        detectCount: info.count || 0,
        detectLabel: info.nroExpediente
          ? `${info.nroExpediente}${info.count ? ` · ${info.count} actuaciones` : ''}`
          : info.count
            ? `${info.count} actuaciones`
            : 'Expediente Salta',
        onSave: () => {
          chrome.runtime.sendMessage(
            {
              type: 'MONITOR_ACTIVATE',
              payload: {
                portal: 'SALTA',
                nroExpediente: info.nroExpediente || '',
                caratula: info.caratula || '',
                juzgado: info.juzgado || '',
                url: location.href,
                portalRefs: { expId: info.expId || '' },
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
                alert(resp?.error || 'No se pudo guardar la causa');
              }
            }
          );
        },
        onConfig: () => chrome.runtime.sendMessage({ type: 'OPEN_MONITOR_PANEL' }),
      });
    } catch (_) {}
  }

  function bootMonitorDock() {
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      mountMonitorDock();
      if (document.getElementById('lm-export-dock') || n > 24) clearInterval(t);
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootMonitorDock);
  } else {
    bootMonitorDock();
  }
})();
