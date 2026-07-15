/**
 * Content script — Mesa Virtual Entre Ríos
 * https://mesavirtual.jusentrerios.gov.ar/expedientes/*
 *
 * Requiere sesión Keycloak en el portal. Usa GraphQL /api/graphql + PDFs en /api/archivos/.
 */
(function () {
  'use strict';
  if (globalThis.__LEGALMEV_ENTRERIOS_LOADED__) return;
  globalThis.__LEGALMEV_ENTRERIOS_LOADED__ = true;

  const API_BASE = 'https://mesavirtual.jusentrerios.gov.ar/api';
  const GRAPHQL_URL = `${API_BASE}/graphql`;
  const PAGE_SIZE = 50;
  const SSO_AUTHORITY = 'https://ol-sso.jusentrerios.gov.ar/realms/mesavirtual';

  let cancelarExportacion = false;
  let cachedToken = null;
  const MAIN_TOKEN_KEY = '__legalmev_er_bearer';

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function delayEntrePeticiones() {
    return delay(350 + Math.floor(Math.random() * 400));
  }

  function parseExpIdFromUrl(url) {
    const u = String(url || location.href);
    const m = u.match(/\/expedientes\/([a-f0-9]{24})(?:\/|$|\?)/i);
    return m ? m[1] : null;
  }

  function isListaPage() {
    const path = (location.pathname || '').toLowerCase();
    if (/\/expedientes\/[a-f0-9]{24}/i.test(path)) return false;
    return path === '/expedientes' || path.endsWith('/expedientes');
  }

  function tokenFromMainHook() {
    try {
      const t = sessionStorage.getItem(MAIN_TOKEN_KEY);
      if (t && t.length > 40) return t;
    } catch (_) {}
    return null;
  }

  function tokenFromStorage() {
    const fromHook = tokenFromMainHook();
    if (fromHook) return fromHook;

    const stores = [localStorage, sessionStorage];
    for (const store of stores) {
      try {
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i) || '';
          const raw = store.getItem(key);
          if (!raw) continue;
          if (/access[_-]?token|oidc\.user|keycloak|mesa-virtual|__legalmev_er/i.test(key) || raw.includes('access_token')) {
            try {
              const parsed = JSON.parse(raw);
              const t =
                parsed?.access_token ||
                parsed?.accessToken ||
                parsed?.token ||
                parsed?.id_token;
              if (t && typeof t === 'string' && t.length > 40) return t;
            } catch (_) {
              if (raw.startsWith('eyJ') && raw.length > 40) return raw;
            }
          }
        }
      } catch (_) {}
    }
    try {
      const oidcKey = `oidc.user:${SSO_AUTHORITY}:mesa-virtual-ui`;
      for (const store of stores) {
        const raw = store.getItem(oidcKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) return parsed.access_token;
      }
    } catch (_) {}
    return null;
  }

  function getAccessToken() {
    if (cachedToken) return cachedToken;
    const t = tokenFromStorage();
    if (t) cachedToken = t;
    return t;
  }

  async function waitForAccessToken(maxMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const t = getAccessToken();
      if (t) return t;
      await delay(250);
    }
    return getAccessToken();
  }

  /** Fallback: contar filas visibles de movimientos en el DOM si GraphQL falla. */
  function scrapeDomMovimientosCount() {
    try {
      const rows = document.querySelectorAll(
        'table tbody tr, [class*="movimiento"], [class*="Movimiento"]'
      );
      let n = 0;
      for (const row of rows) {
        const txt = (row.textContent || '').trim();
        if (txt.length < 8) continue;
        if (/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(txt)) n += 1;
      }
      return n;
    } catch (_) {
      return 0;
    }
  }

  function scrapeDomCaratula() {
    try {
      const h1 = document.querySelector('h1, h2, [class*="caratula"]');
      const t = (h1?.textContent || '').trim();
      return t.length > 5 ? t.slice(0, 200) : '';
    } catch (_) {
      return '';
    }
  }

  async function gql(query, variables) {
    const token = getAccessToken();
    if (!token) {
      throw new Error(
        'No hay sesión en Mesa Virtual. Iniciá sesión en mesavirtual.jusentrerios.gov.ar y volvé a intentar.'
      );
    }
    const resp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ query, variables })
    });
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('Sesión de Entre Ríos expirada. Volvé a iniciar sesión en Mesa Virtual.');
    }
    if (!resp.ok) throw new Error(`GraphQL Entre Ríos ${resp.status}`);
    const json = await resp.json();
    if (json.errors?.length) {
      const msg = json.errors.map((e) => e.message).join('; ');
      if (/acceso no permitido|unauthorized|forbidden/i.test(msg)) {
        throw new Error('Sin acceso al expediente. Verificá tu sesión en Mesa Virtual.');
      }
      throw new Error(msg || 'Error GraphQL Entre Ríos');
    }
    return json.data;
  }

  const Q_EXPEDIENTE = `
    query expediente($id: String!) {
      expediente(id: $id) {
        id
        caratula
        organismo
        nro { exp0 exp1 exp2 exp3 }
        datos_organismo { nombre_organismo localidad jurisdiccion }
        tipo_proceso { tipo }
      }
    }
  `;

  const Q_MOVIMIENTOS = `
    query expedienteOnlyMovimientos($first: Int!, $skip: Int!, $expId: String!) {
      expedienteMovimientos(first: $first, skip: $skip, expId: $expId) {
        aggregate { count }
        edges {
          node {
            id
            fecha_hora
            fecha_procesal
            descripcion
            publico
            fojas
            tipo
            archivo { id tipo size texto }
            origen { nombre }
          }
        }
      }
    }
  `;

  function fmtFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  function fmtHora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  function nroFromExpediente(exp) {
    const n = exp?.nro;
    if (!n) return '';
    const parts = [n.exp0, n.exp1, n.exp2, n.exp3].filter((x) => x != null && String(x).trim() !== '');
    return parts.join(' - ') || '';
  }

  async function fetchExpediente(expId) {
    const data = await gql(Q_EXPEDIENTE, { id: expId });
    return data?.expediente || null;
  }

  async function fetchAllMovimientos(expId) {
    const all = [];
    let skip = 0;
    let total = Infinity;
    while (skip < total) {
      if (cancelarExportacion) return null;
      const data = await gql(Q_MOVIMIENTOS, { first: PAGE_SIZE, skip, expId });
      const conn = data?.expedienteMovimientos;
      total = conn?.aggregate?.count ?? 0;
      const edges = conn?.edges || [];
      for (const e of edges) {
        if (e?.node) all.push(e.node);
      }
      if (!edges.length) break;
      skip += edges.length;
      if (skip < total) await delayEntrePeticiones();
    }
    return all;
  }

  async function extraerTextoPDF(buffer) {
    try {
      if (!globalThis.pdfjsLib) return { texto: '', esEscaneado: false, paginas: 0 };
      if (!globalThis.__pdjsWorkerSetEr__) {
        globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc =
          chrome.runtime.getURL('lib/pdf.worker.min.js');
        globalThis.__pdjsWorkerSetEr__ = true;
      }
      const pdf = await globalThis.pdfjsLib.getDocument({
        data: buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer,
        isEvalSupported: false
      }).promise;
      const partes = [];
      let tieneImagen = false;
      const maxPages = Math.min(pdf.numPages, 80);
      const OPS = globalThis.pdfjsLib.OPS || {};
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        partes.push(content.items.map((it) => it.str).join(' '));
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
      const texto = partes.join('\n').trim();
      const letras = (texto.match(/[A-Za-zÁÉÍÓÚÜáéíóúüÑñ0-9]/g) || []).length;
      // PDF escaneado / solo imagen: hay imágenes y casi no hay capa de texto
      const esEscaneado = tieneImagen && letras < 40;
      return { texto, esEscaneado, paginas: pdf.numPages };
    } catch (_) {
      return { texto: '', esEscaneado: false, paginas: 0 };
    }
  }

  function esTipoImagenAdjunto(tipoHint) {
    return /^(jpe?g|png|gif|bmp|tiff?|webp|heic|img)$/i.test(
      String(tipoHint || '')
        .replace(/^\./, '')
        .split(/[/?#]/)[0]
        .trim()
    );
  }

  function looksLikeImageBuffer(buffer) {
    const head = new Uint8Array(buffer.slice ? buffer.slice(0, 12) : buffer);
    // JPEG
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true;
    // PNG
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true;
    // GIF
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return true;
    // TIFF
    if ((head[0] === 0x49 && head[1] === 0x49) || (head[0] === 0x4d && head[1] === 0x4d)) return true;
    // BMP
    if (head[0] === 0x42 && head[1] === 0x4d) return true;
    // WEBP
    if (
      head[0] === 0x52 &&
      head[1] === 0x49 &&
      head[2] === 0x46 &&
      head[3] === 0x46 &&
      head[8] === 0x57 &&
      head[9] === 0x45
    ) {
      return true;
    }
    return false;
  }

  function decodeBytesAsText(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const latin1 = new TextDecoder('latin1').decode(bytes);
    if (/^\{\\rtf/i.test(latin1.trim())) return latin1;
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch (_) {
      return latin1;
    }
  }

  /**
   * RTF → texto plano (Mesa Virtual Entre Ríos adjunta muchos movimientos en .rtf).
   */
  function extraerTextoRTF(buffer) {
    try {
      const src = decodeBytesAsText(buffer);
      if (!/^\{\\rtf/i.test(src.trim())) return '';

      let out = '';
      let i = 0;
      let depth = 0;
      let skipDepth = -1;
      const skipWords = new Set([
        'fonttbl',
        'colortbl',
        'stylesheet',
        'info',
        'pict',
        'object',
        'header',
        'footer',
        'datastore',
        'themedata',
        'colorschememapping',
        'latentstyles',
        'xmlnstbl'
      ]);

      while (i < src.length) {
        const ch = src[i];
        if (ch === '{') {
          depth += 1;
          i += 1;
          continue;
        }
        if (ch === '}') {
          if (skipDepth === depth) skipDepth = -1;
          depth -= 1;
          i += 1;
          continue;
        }
        if (ch === '\\') {
          if (src[i + 1] === "'") {
            const hex = src.slice(i + 2, i + 4);
            if (skipDepth < 0 && /^[0-9a-fA-F]{2}$/.test(hex)) {
              out += String.fromCharCode(parseInt(hex, 16));
            }
            i += 4;
            continue;
          }
          i += 1;
          let word = '';
          while (i < src.length && /[a-zA-Z]/.test(src[i])) {
            word += src[i];
            i += 1;
          }
          let num = '';
          if (src[i] === '-') {
            num = '-';
            i += 1;
          }
          while (i < src.length && /\d/.test(src[i])) {
            num += src[i];
            i += 1;
          }
          if (src[i] === ' ') i += 1;

          if (skipWords.has(word.toLowerCase())) {
            skipDepth = depth;
          }
          if (skipDepth >= 0) continue;

          const w = word.toLowerCase();
          if (w === 'par' || w === 'pard' || w === 'line') out += '\n';
          else if (w === 'tab') out += '\t';
          else if (w === 'u' && num !== '') {
            const code = parseInt(num, 10);
            if (code > 0) out += String.fromCharCode(code);
            // char de reemplazo opcional tras \uN
            if (src[i] && src[i] !== '\\' && src[i] !== '{' && src[i] !== '}') i += 1;
          }
          continue;
        }
        if (skipDepth >= 0) {
          i += 1;
          continue;
        }
        if (ch !== '\r') out += ch;
        i += 1;
      }

      return out
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } catch (_) {
      return '';
    }
  }

  function looksLikeRtf(buffer, tipoHint) {
    if (/rtf/i.test(String(tipoHint || ''))) return true;
    const bytes = new Uint8Array(buffer.slice ? buffer.slice(0, 16) : buffer);
    const head = new TextDecoder('latin1').decode(bytes);
    return /^\{\\rtf/i.test(head.trim());
  }

  async function downloadArchivo(expId, moviId, tipoHint) {
    // Adjuntos imagen (jpg/png/…) — no se bajan
    if (esTipoImagenAdjunto(tipoHint)) {
      return {
        contenido: '',
        adjuntos: [],
        omitido: true,
        motivo: 'imagen'
      };
    }

    const token = getAccessToken();
    const url = `${API_BASE}/archivos/${encodeURIComponent(expId)}/${encodeURIComponent(moviId)}?token=${encodeURIComponent(token || '')}`;
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) throw new Error(`Archivo ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    const head = new Uint8Array(buffer.slice(0, 5));
    const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;

    if (looksLikeImageBuffer(buffer)) {
      return { contenido: '', adjuntos: [], omitido: true, motivo: 'imagen' };
    }

    if (isPdf) {
      const analizado = await extraerTextoPDF(buffer);
      // PDF escaneado / solo imagen: no incluir ni “bajar” como contenido
      if (analizado.esEscaneado || (!analizado.texto && analizado.paginas > 0)) {
        return {
          contenido: '',
          adjuntos: [],
          omitido: true,
          motivo: 'pdf_imagen'
        };
      }
      return {
        contenido: analizado.texto,
        adjuntos: [{ nombre: `movimiento-${moviId}.pdf`, url }],
        omitido: false
      };
    }
    if (looksLikeRtf(buffer, tipoHint)) {
      const texto = extraerTextoRTF(buffer);
      return {
        contenido: texto,
        adjuntos: [{ nombre: `movimiento-${moviId}.rtf`, url }],
        omitido: false
      };
    }
    // Otros binarios desconocidos: no bajar como imagen/adjunto útil
    return { contenido: '', adjuntos: [], omitido: true, motivo: 'binario' };
  }

  async function countMovimientos(expId) {
    const data = await gql(Q_MOVIMIENTOS, { first: 1, skip: 0, expId });
    return data?.expedienteMovimientos?.aggregate?.count ?? 0;
  }

  async function getExpedienteInfo() {
    const expId = parseExpIdFromUrl(location.href);
    if (!expId) {
      return {
        pageTitle: document.title || '',
        pageUrl: location.href,
        count: 0,
        caratula: '',
        nroExpediente: '',
        juzgado: '',
        erEstado: isListaPage() ? 'lista' : 'sin_expediente'
      };
    }

    const domCount = scrapeDomMovimientosCount();
    const domCaratula = scrapeDomCaratula();

    try {
      const token = await waitForAccessToken(3000);
      if (!token) {
        return {
          pageTitle: document.title || '',
          pageUrl: location.href,
          count: domCount,
          caratula: domCaratula,
          nroExpediente: '',
          juzgado: '',
          erEstado: 'sin_sesion',
          expId
        };
      }
      const enc = await fetchExpediente(expId);
      const count = await countMovimientos(expId);
      const finalCount = count || domCount;
      return {
        pageTitle: document.title || enc?.caratula || '',
        pageUrl: location.href,
        count: finalCount,
        caratula: enc?.caratula || domCaratula || '',
        nroExpediente: nroFromExpediente(enc),
        juzgado: enc?.datos_organismo?.nombre_organismo || enc?.organismo || '',
        expId,
        erEstado: finalCount > 0 ? 'listo' : 'abierto_sin_datos',
        portal: 'entrerios'
      };
    } catch (e) {
      const sinSesion = /sesión|sesion|acceso|no hay sesión/i.test(e.message || '');
      return {
        pageTitle: document.title || '',
        pageUrl: location.href,
        count: domCount,
        caratula: domCaratula,
        nroExpediente: '',
        juzgado: '',
        expId,
        erEstado: sinSesion ? 'sin_sesion' : 'error',
        error: e.message
      };
    }
  }

  function buildDatosExpediente(enc) {
    const e = enc || {};
    return {
      caratula: e.caratula || '',
      nroExpediente: nroFromExpediente(e),
      juzgado: e.datos_organismo?.nombre_organismo || e.organismo || '',
      dependencia: e.datos_organismo?.nombre_organismo || e.organismo || '',
      jurisdiccion: 'Entre Ríos',
      portal: 'ENTRERIOS',
    };
  }

  // cache ligero para extractDatos tras listar
  let stateEncabezadoCache = null;

  function movToPickerItem(mov, index) {
    const titulo = mov.descripcion || mov.tipo || `Movimiento ${index + 1}`;
    return {
      id: String(mov.id || index),
      movId: mov.id,
      fecha: fmtFecha(mov.fecha_procesal || mov.fecha_hora),
      hora: fmtHora(mov.fecha_hora),
      tipo: mov.tipo || '',
      titulo,
      descripcion: titulo,
      firmante: mov.origen?.nombre || '',
      selected: true,
      hasDoc: true,
      docCount: mov.archivo?.id ? 1 : 1,
      mov,
    };
  }

  async function listActuacionesForPicker(sendProgress, cancelFlag) {
    const expId = parseExpIdFromUrl(location.href);
    if (!expId) throw new Error('Abrí un expediente en Mesa Virtual (/expedientes/…) antes de exportar.');

    sendProgress?.({ mensaje: 'Obteniendo movimientos de Entre Ríos…' });
    const enc = await fetchExpediente(expId);
    if (!enc) throw new Error('No se pudo leer el expediente. Verificá tu sesión en Mesa Virtual.');
    stateEncabezadoCache = enc;

    let movs = await fetchAllMovimientos(expId);
    if (movs === null || cancelFlag?.cancelled || cancelarExportacion) return null;
    if (!movs.length) throw new Error('No se encontraron movimientos en este expediente.');
    return movs.map((m, i) => movToPickerItem(m, i));
  }

  async function hydrateMovItem(mov, index, total, sendProgress, expId) {
    if (sendProgress) {
      sendProgress({
        current: index,
        total,
        progreso: total ? Math.min(85, Math.round((100 * (index + 0.35)) / total)) : 0,
        mensaje: `Procesando movimiento ${index + 1} de ${total}…`,
      });
    }

    const textoGql = (mov.archivo?.texto || '').trim();
    const desc = (mov.descripcion || '').trim();
    let contenido = textoGql;
    let adjuntos = [];
    const tipoArchivo = mov.archivo?.tipo;

    if (mov.archivo?.id && !esTipoImagenAdjunto(tipoArchivo)) {
      try {
        if (sendProgress) {
          sendProgress({
            current: index,
            total,
            mensaje: `Leyendo adjunto ${index + 1} de ${total}…`,
          });
        }
        const file = await downloadArchivo(expId, mov.id, tipoArchivo);
        if (file.omitido) {
          adjuntos = [];
          if (!contenido || contenido === desc || contenido.length < 40) {
            const nota =
              file.motivo === 'pdf_imagen'
                ? '(PDF con imagen/escaneado: no se descarga ni se incluye el archivo)'
                : file.motivo === 'imagen'
                  ? '(Adjunto imagen: no se descarga)'
                  : '';
            contenido = [desc || contenido, nota].filter(Boolean).join('\n\n');
          }
        } else {
          adjuntos = file.adjuntos || [];
          const fileText = (file.contenido || '').trim();
          if (fileText && fileText.length >= Math.max(40, contenido.length)) {
            contenido = fileText;
          } else if (!contenido || contenido.length < 40 || contenido === desc) {
            contenido = fileText || contenido || desc;
          }
        }
      } catch (e) {
        contenido = `${contenido || desc || ''}\n\n(Error al descargar archivo: ${e.message})`.trim();
      }
    } else if (mov.archivo?.id && esTipoImagenAdjunto(tipoArchivo)) {
      if (!contenido || contenido.length < 40) {
        contenido = [desc || contenido, '(Adjunto imagen: no se descarga)'].filter(Boolean).join('\n\n');
      }
    }

    if (!contenido) contenido = desc || '(Sin contenido)';
    const fechaIso = mov.fecha_procesal || mov.fecha_hora;
    const titulo = mov.descripcion || `Movimiento ${index + 1}`;

    return {
      numero: index + 1,
      fecha: fmtFecha(fechaIso),
      hora: fmtHora(mov.fecha_hora),
      tipo: mov.tipo || '',
      titulo,
      descripcion: titulo,
      firmante: mov.origen?.nombre || '',
      contenido: contenido || desc || '(Sin contenido)',
      adjuntos,
      hasDoc: true,
      docCount: Math.max(1, adjuntos.length),
      url: `${location.origin}/expedientes/${expId}/movi/${mov.id}`,
    };
  }

  async function hydrateFromItems(selectedItems, sendProgress, cancelFlag) {
    const expId = parseExpIdFromUrl(location.href);
    if (!expId) throw new Error('Abrí un expediente en Mesa Virtual (/expedientes/…) antes de exportar.');
    const items = Array.isArray(selectedItems) ? selectedItems : [];
    const actuaciones = [];
    for (let i = 0; i < items.length; i++) {
      if (cancelFlag?.cancelled || cancelarExportacion) return null;
      if (i > 0) await delayEntrePeticiones();
      const it = items[i];
      const mov = it.mov || {
        id: it.movId || it.id,
        descripcion: it.descripcion || it.titulo,
        tipo: it.tipo,
        fecha_procesal: it.fecha,
        origen: { nombre: it.firmante },
        archivo: it.archivo,
      };
      actuaciones.push(await hydrateMovItem(mov, i, items.length, sendProgress, expId));
    }
    return actuaciones;
  }

  async function collectActuaciones(sendProgress, ultimosN) {
    const items = await listActuacionesForPicker(sendProgress, null);
    if (items === null) return null;
    let selected = items;
    if (ultimosN && ultimosN > 0) selected = items.slice(0, ultimosN);
    const actuaciones = await hydrateFromItems(selected, sendProgress, null);
    if (actuaciones === null) return null;
    const enc = stateEncabezadoCache || (await fetchExpediente(parseExpIdFromUrl(location.href)));
    return {
      actuaciones,
      anexos: [],
      datosExpediente: buildDatosExpediente(enc),
    };
  }

  globalThis.LegalMevEntreRiosCore = {
    extractDatos: () => buildDatosExpediente(stateEncabezadoCache),
    listActuaciones: listActuacionesForPicker,
    hydrateFromItems,
    resolveAdjuntos: async () => [],
    setCancel(v) {
      cancelarExportacion = !!v;
    },
    getExpedienteInfo,
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'MONITOR_LIST_MOVEMENTS') {
      (async () => {
        try {
          const expId = parseExpIdFromUrl(location.href);
          if (!expId) {
            sendResponse({
              ok: false,
              error: 'Abrí un expediente (/expedientes/…) para monitorear.',
              code: 'MISSING_IDS',
            });
            return;
          }
          const token = await waitForAccessToken(4000);
          if (!token) {
            sendResponse({
              ok: false,
              error: 'Es necesario volver a iniciar sesión en Mesa Virtual Entre Ríos.',
              code: 'SESSION_EXPIRED',
            });
            return;
          }
          const movs = await fetchAllMovimientos(expId);
          if (movs === null) {
            sendResponse({ ok: false, error: 'Cancelado', code: 'UNKNOWN' });
            return;
          }
          const movements = (movs || []).map((mov) => ({
            portalId: String(mov.id || ''),
            id: String(mov.id || ''),
            fecha: fmtFecha(mov.fecha_procesal || mov.fecha_hora),
            tipo: mov.tipo || '',
            descripcion: mov.descripcion || mov.tipo || '',
          }));
          sendResponse({ ok: true, portal: 'ENTRERIOS', movements });
        } catch (e) {
          const code = /sesión|sesion|unauthorized|401|token/i.test(e.message || '')
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
            portal: 'entrerios',
            erEstado:
              info.erEstado ||
              (info.count > 0 ? 'listo' : parseExpIdFromUrl(location.href) ? 'abierto_sin_datos' : 'lista')
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
            juzgado: info.juzgado,
            portal: 'entrerios'
          });
        })
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });

  async function mountMonitorDock() {
    const Ui = window.LegalMevDownloadUi;
    if (!Ui || document.getElementById('lm-export-dock')) return;
    const expId = parseExpIdFromUrl(location.href);
    if (!expId) return;
    try {
      const info = await getExpedienteInfo();
      if (info.erEstado === 'lista' || info.erEstado === 'sin_expediente') return;
      Ui.mountFloatingBar({
        portal: 'ENTRE RÍOS',
        mode: 'monitor',
        detectCount: info.count || 0,
        detectLabel: info.nroExpediente
          ? `${info.nroExpediente}${info.count ? ` · ${info.count} movimientos` : ''}`
          : info.count
            ? `${info.count} movimientos`
            : 'Expediente Entre Ríos',
        onSave: () => {
          chrome.runtime.sendMessage(
            {
              type: 'MONITOR_ACTIVATE',
              payload: {
                portal: 'ENTRERIOS',
                nroExpediente: info.nroExpediente || '',
                caratula: info.caratula || '',
                juzgado: info.juzgado || '',
                url: location.href,
                portalRefs: { expId: info.expId || expId },
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
      if (document.getElementById('lm-export-dock') || n > 30) clearInterval(t);
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootMonitorDock);
  } else {
    bootMonitorDock();
  }
})();
