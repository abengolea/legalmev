/**
 * Content script — Portal SAE Tucumán
 * https://consultaexpedientes.justucuman.gov.ar/{fuero}/expediente/{nro}/historia
 *
 * API: https://conexpbe.justucuman.gov.ar/api[/user]/...
 * Auth: cookie saeToken → Bearer (opcional para historia pública).
 */
(function () {
  'use strict';
  if (globalThis.__LEGALMEV_TUCUMAN_LOADED__) return;
  globalThis.__LEGALMEV_TUCUMAN_LOADED__ = true;

  const API_BASE = 'https://conexpbe.justucuman.gov.ar/api';
  const STATE_KEY = '__legalmev_tucuman_history';
  const TOKEN_KEY = '__legalmev_tucuman_token';

  let cancelarExportacion = false;
  const state = {
    proceeding: null,
    stories: null,
    jurisdictionId: null,
    procid: null
  };

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function delayEntrePeticiones() {
    return delay(350 + Math.floor(Math.random() * 450));
  }

  function getSaeToken() {
    try {
      const fromSs = sessionStorage.getItem(TOKEN_KEY);
      if (fromSs) return fromSs;
    } catch (_) {}
    try {
      if (globalThis.__LEGALMEV_TUCUMAN_TOKEN__) return globalThis.__LEGALMEV_TUCUMAN_TOKEN__;
    } catch (_) {}
    try {
      const m = document.cookie.match(/(?:^|;\s*)saeToken=([^;]+)/);
      if (m?.[1]) return decodeURIComponent(m[1]);
    } catch (_) {}
    return '';
  }

  async function apiFetch(path, init = {}) {
    const clean = path.startsWith('/') ? path : `/${path}`;
    const token = getSaeToken();
    const prefixes = token ? ['/user', ''] : ['', '/user'];
    let lastErr = null;
    for (const prefix of prefixes) {
      const url = `${API_BASE}${prefix}${clean}`;
      const headers = {
        Accept: 'application/json',
        ...(init.headers || {})
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      try {
        const resp = await fetch(url, { ...init, credentials: 'omit', headers });
        if (resp.status === 401 || resp.status === 403) {
          lastErr = new Error(`API SAE ${resp.status}`);
          continue;
        }
        if (!resp.ok) throw new Error(`API SAE ${resp.status}`);
        const json = await resp.json();
        if (json && typeof json === 'object' && 'success' in json) {
          if (!json.success) throw new Error(json.message || 'Respuesta SAE success=false');
          return json.data;
        }
        return json;
      } catch (e) {
        lastErr = e;
        if (/API SAE 401|API SAE 403/.test(e.message || '')) continue;
        // Si falló el parse/otro, probar el otro prefijo solo si aún hay
        if (prefixes.length > 1 && prefix === prefixes[0]) continue;
        throw e;
      }
    }
    throw lastErr || new Error('API SAE sin respuesta');
  }

  async function apiGet(path) {
    return apiFetch(path, { method: 'GET' });
  }

  async function apiPost(path, body) {
    return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  }

  function parseUrlParts() {
    try {
      const parts = location.pathname.split('/').filter(Boolean);
      const expIdx = parts.indexOf('expediente');
      if (expIdx < 1 || !parts[expIdx + 1]) return null;
      const slug = parts[expIdx - 1];
      const nro = decodeURIComponent(parts[expIdx + 1]);
      const isHistoria = (parts[expIdx + 2] || '').toLowerCase() === 'historia';
      return { slug, nro, isHistoria };
    } catch (_) {
      return null;
    }
  }

  function isHistoriaUrl() {
    return !!parseUrlParts()?.isHistoria;
  }

  function isLoginPage() {
    return /login\.justucuman\.gov\.ar/i.test(location.hostname || '');
  }

  function isHomeOrSelector() {
    const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    if (path === '/' || path === '') return true;
    if (/\/buscador\/?$/i.test(path)) return true;
    return false;
  }

  function loadCachedHistory() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.proceeding || (Array.isArray(data?.stories) && data.stories.length)) {
          applyHistoryPayload(data);
          return data;
        }
      }
    } catch (_) {}
    try {
      if (globalThis.__LEGALMEV_TUCUMAN_HISTORY__) {
        applyHistoryPayload(globalThis.__LEGALMEV_TUCUMAN_HISTORY__);
        return globalThis.__LEGALMEV_TUCUMAN_HISTORY__;
      }
    } catch (_) {}
    return null;
  }

  function applyHistoryPayload(data) {
    if (!data) return;
    if (data.proceeding) {
      state.proceeding = data.proceeding;
      state.procid = data.proceeding.procid != null ? String(data.proceeding.procid) : state.procid;
      state.jurisdictionId =
        data.proceeding.jurisdiction_id != null
          ? String(data.proceeding.jurisdiction_id)
          : state.jurisdictionId;
    }
    if (Array.isArray(data.stories)) state.stories = data.stories;
  }

  async function resolveJurisdictionId(slug) {
    if (state.jurisdictionId) return state.jurisdictionId;
    if (!slug) return null;
    try {
      const data = await apiGet(`/jurisdictions/slug?slug=${encodeURIComponent(slug)}`);
      if (data?.id != null) {
        state.jurisdictionId = String(data.id);
        return state.jurisdictionId;
      }
    } catch (_) {}
    return null;
  }

  async function fetchHistory(procid, jurisdictionId) {
    const data = await apiGet(
      `/proceedings/history?jurisdiction=${encodeURIComponent(jurisdictionId)}&proceeding=${encodeURIComponent(procid)}`
    );
    const payload = {
      proceeding: data?.proceeding || state.proceeding,
      stories: Array.isArray(data?.stories) ? data.stories : Array.isArray(data) ? data : [],
      capturedAt: Date.now(),
      url: location.href
    };
    applyHistoryPayload(payload);
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(payload));
    } catch (_) {}
    return payload;
  }

  function htmlToPlainText(html) {
    if (!html) return '';
    const s = String(html)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return s;
  }

  /**
   * El portal SAE mete el mismo membrete en cada movimiento (PJ + centro + oficina +
   * nro. actuaciones + código de barras + juzgado). Lo sacamos para no repetirlo N veces en el PDF.
   * Los datos del expediente ya van en la carátula LegalMev.
   */
  function stripTucumanMembrete(text) {
    if (!text) return '';
    let t = String(text).replace(/^\uFEFF/, '').replace(/^\?+\s*/, '');

    // Variante multilínea (HTML del modal). \s entre partes (no solo \n+) para no romper el match.
    const blockNl =
      /(?:^|\n)\s*\??\s*PODER\s+JUDICIAL\s+DE\s+TUCUM[AÁ]N\b\s*(?:CENTRO\s+JUDICIAL[^\n]*)?\s*(?:Oficina[^\n]*)?\s*(?:ACTUACIONES?\s*N[°ºo.\s:]*[^\n]*)?\s*(?:\*?H\d+\*?)?\s*(?:H\d+)?\s*(?:Juzgado[^\n]*)?\s*(?:Secretar[ií]a[^\n]*)?\s*/gi;

    // Variante en una sola línea / PDF (texto concatenado con espacios)
    const blockSp =
      /PODER\s+JUDICIAL\s+DE\s+TUCUM[AÁ]N\s+CENTRO\s+JUDICIAL\s+\S+(?:\s+\S+){0,8}?\s+Oficina\s+[^\n]{0,100}?ACTUACIONES?\s*N[°ºo.\s:]*\S+\s+\*?H\d+\*?\s+H\d+\s+Juzgado[^\n]{0,120}?(?=\s{2,}|\n|$)/gi;

    let stripped = t.replace(blockNl, '\n\n').replace(blockSp, '\n\n');
    stripped = stripped.replace(/\n{3,}/g, '\n\n').trim();
    return stripped || t.trim();
  }

  async function extraerTextoPDF(buffer) {
    try {
      if (!globalThis.pdfjsLib) return '';
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const parts = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map((it) => it.str).join(' '));
      }
      return parts.join('\n\n').trim();
    } catch (_) {
      return '';
    }
  }

  function isEmptyPortalTexto(plain) {
    const t = String(plain || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) return true;
    // Mensaje típico del modal SAE cuando el escrito está solo en ADJUNTOS
    if (/escrito seleccionado no contiene texto/i.test(t)) return true;
    if (/^no contiene texto\.?$/i.test(t)) return true;
    return false;
  }

  function normalizeArchivosList(...sources) {
    const out = [];
    const seen = new Set();
    for (const src of sources) {
      if (!Array.isArray(src)) continue;
      for (const ar of src) {
        if (!ar || typeof ar !== 'object') continue;
        const nombre = String(ar.nombre || ar.name || ar.filename || ar.file || '').trim();
        const extension = String(ar.extension || ar.ext || '')
          .replace(/^\./, '')
          .trim();
        if (!nombre && !extension) continue;
        const key = `${nombre.toLowerCase()}|${extension.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ nombre: nombre || 'adjunto', extension });
      }
    }
    return out;
  }

  function displayArchivoName(ar) {
    const nombre = String(ar?.nombre || '').trim();
    const ext = String(ar?.extension || '')
      .replace(/^\./, '')
      .trim();
    if (!nombre) return ext ? `adjunto.${ext}` : 'adjunto';
    if (ext && !nombre.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
      return `${nombre}.${ext}`;
    }
    return nombre;
  }

  function archivoFilenameCandidates(ar) {
    const nombre = String(ar?.nombre || '').trim();
    const ext = String(ar?.extension || '')
      .replace(/^\./, '')
      .trim();
    const candidates = [];
    const push = (v) => {
      if (v && !candidates.includes(v)) candidates.push(v);
    };
    // El portal SAE hace btoa(archivo.nombre) tal cual (suele traer ya el .pdf)
    push(nombre);
    if (nombre && ext && !nombre.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
      push(`${nombre}.${ext}`);
    }
    // Si nombre ya trae .pdf, también probar sin extensión (por las dudas)
    if (/\.pdf$/i.test(nombre)) {
      push(nombre.replace(/\.pdf$/i, ''));
    }
    return candidates;
  }

  function looksLikePdfArchivo(ar, filename) {
    const ext = String(ar?.extension || '').toLowerCase();
    if (ext === 'pdf') return true;
    if (/\.pdf$/i.test(filename || '')) return true;
    if (/\.pdf$/i.test(ar?.nombre || '')) return true;
    if (!ext) return true;
    return false;
  }

  /** El SPA usa btoa(nombre) plain (ASCII). Fallback UTF-8 si hace falta. */
  function toBase64FileField(str) {
    const s = String(str);
    try {
      return btoa(s);
    } catch (_) {
      return btoa(unescape(encodeURIComponent(s)));
    }
  }

  function formatCertificado(cert) {
    if (!cert) return '';
    if (typeof cert === 'string') return cert.trim();
    if (typeof cert === 'object') {
      const cn =
        cert.cn ||
        cert.CN ||
        cert.commonName ||
        cert.nombre ||
        cert.name ||
        cert.subject ||
        cert.dscr ||
        '';
      if (cn) return String(cn).trim();
      try {
        return JSON.stringify(cert);
      } catch (_) {
        return '';
      }
    }
    return String(cert);
  }

  /** La SPA guarda el cuerpo en selectedHistory.history.texto (HTML). */
  function extractTextoFromApiPayload(data) {
    if (data == null) return { plain: '', meta: {}, archivos: [] };
    if (typeof data === 'string') {
      const plain = stripTucumanMembrete(htmlToPlainText(data));
      return { plain: isEmptyPortalTexto(plain) ? '' : plain, meta: {}, archivos: [] };
    }
    const hist = data.history && typeof data.history === 'object' ? data.history : data;
    const rawHtml =
      hist.texto ||
      hist.text ||
      hist.html ||
      hist.content ||
      data.texto ||
      data.text ||
      data.html ||
      data.content ||
      '';
    const meta = {
      fecha: hist.fecha || hist.fechaFirma || data.fecha || '',
      certificado: formatCertificado(hist.certificado || data.certificado || ''),
      dscr: hist.dscr || data.dscr || '',
    };
    let plain = stripTucumanMembrete(htmlToPlainText(rawHtml));
    if (isEmptyPortalTexto(plain)) plain = '';
    const archivos = normalizeArchivosList(
      hist.archivos,
      hist.files,
      hist.adjuntos,
      data.archivos,
      data.files,
      data.adjuntos
    );
    return { plain, meta, archivos };
  }

  function extractDownloadUrl(fileData) {
    if (!fileData) return '';
    if (typeof fileData === 'string') return fileData.trim();
    if (typeof fileData === 'object') {
      if (typeof fileData.url === 'string') return fileData.url.trim();
      if (typeof fileData.data === 'string') return fileData.data.trim();
      if (fileData.data && typeof fileData.data === 'object') {
        if (typeof fileData.data.url === 'string') return fileData.data.url.trim();
        if (typeof fileData.data.data === 'string') return fileData.data.data.trim();
      }
    }
    return '';
  }

  function resolveAbsoluteUrl(url) {
    if (!url) return '';
    try {
      return new URL(url, 'https://conexpbe.justucuman.gov.ar').href;
    } catch (_) {
      return url;
    }
  }

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  /** Bajar binarios vía service worker (evita CORS de la página del SAE). */
  async function downloadUrlAsBinary(url) {
    const absolute = resolveAbsoluteUrl(url);
    if (!absolute) return { buffer: null, isPdf: false };

    // 1) Preferir background (host_permissions, sin CORS de la SPA)
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'DOWNLOAD_BINARY',
        url: absolute,
      });
      if (resp?.ok && resp.base64) {
        const buffer = base64ToArrayBuffer(resp.base64);
        const head = new Uint8Array(buffer.slice(0, 4));
        const ct = String(resp.contentType || '').toLowerCase();
        const isPdf =
          ct.includes('pdf') ||
          (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46);
        return { buffer, isPdf, contentType: ct };
      }
    } catch (_) {}

    // 2) Fallback fetch en la página
    const resp = await fetch(absolute, {
      credentials: 'omit',
      headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
    });
    if (!resp.ok) throw new Error(`Download HTTP ${resp.status}`);
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const buffer = await resp.arrayBuffer();
    const head = new Uint8Array(buffer.slice(0, 4));
    const isPdf =
      ct.includes('pdf') ||
      (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46);
    return { buffer, isPdf, contentType: ct };
  }

  async function downloadUrlAsText(url) {
    const { buffer, isPdf } = await downloadUrlAsBinary(url);
    if (!buffer) return '';
    if (isPdf) return (await extraerTextoPDF(buffer)) || '';
    return htmlToPlainText(new TextDecoder('utf-8').decode(buffer));
  }

  function cachedFileUrl(histid, filename) {
    try {
      const map = JSON.parse(sessionStorage.getItem(STATE_KEY + '_files') || '{}');
      return map[`${histid}::${filename}`] || map[filename] || '';
    } catch (_) {
      return '';
    }
  }

  async function downloadArchivoAdjunto(histid, ar) {
    const procid = state.procid;
    const jid = state.jurisdictionId;
    if (!procid || !jid || histid == null || histid === '') return null;

    const asNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && String(n) === String(v).trim() ? n : v;
    };

    for (const filename of archivoFilenameCandidates(ar)) {
      if (!looksLikePdfArchivo(ar, filename)) continue;
      try {
        let url = cachedFileUrl(histid, filename);

        if (!url) {
          // Igual que la SPA: btoa(nombre) + /user/proceedings/history/file
          const fileData = await apiPost('/proceedings/history/file', {
            proceeding: asNum(procid),
            jurisdiction: asNum(jid),
            history: asNum(histid),
            file: toBase64FileField(filename),
          });
          url = extractDownloadUrl(fileData);
        }
        url = resolveAbsoluteUrl(url);
        if (!url) continue;

        const { buffer, isPdf } = await downloadUrlAsBinary(url);
        if (!buffer || !isPdf) continue;
        const bytes = new Uint8Array(buffer);
        let text = '';
        try {
          text = stripTucumanMembrete((await extraerTextoPDF(buffer)) || '');
        } catch (_) {}
        const nombre = displayArchivoName({
          nombre: filename,
          extension: /\.pdf$/i.test(filename) ? '' : 'pdf',
        });
        return { nombre, url, bytes, text };
      } catch (_) {
        // probar siguiente variante de nombre
      }
    }
    return null;
  }

  /**
   * Baja texto del movimiento + PDFs de ADJUNTOS (escritos de partes/abogados/peritos).
   * En SAE, muchos cargos muestran “no contiene texto” y el escrito está solo en adjuntos.
   */
  async function fetchHistoriaTexto(histid, story) {
    const procid = state.procid;
    const jid = state.jurisdictionId;
    if (!procid || !jid || histid == null || histid === '') {
      return { texto: '', adjuntoBytes: [], archivos: [] };
    }

    const partes = [];
    const adjuntoBytes = [];
    let metaFecha = '';
    let metaCert = '';
    let archivosFromApi = [];

    // Cache del page-hook si el usuario abrió el movimiento con la lupa
    try {
      const map = JSON.parse(sessionStorage.getItem(STATE_KEY + '_texts') || '{}');
      const cached = map[String(histid)];
      if (cached) {
        const { plain, meta, archivos } = extractTextoFromApiPayload(cached);
        if (meta.fecha) metaFecha = meta.fecha;
        if (meta.certificado) metaCert = formatCertificado(meta.certificado);
        if (plain) partes.push(plain);
        archivosFromApi = normalizeArchivosList(archivosFromApi, archivos);
      }
    } catch (_) {}

    // 1) HTML del modal (Nota actuarial / proveído) — campo history.texto
    try {
      const data = await apiGet(
        `/proceedings/history/text?jurisdiction=${encodeURIComponent(jid)}&proceeding=${encodeURIComponent(procid)}&history=${encodeURIComponent(histid)}`
      );
      const { plain, meta, archivos } = extractTextoFromApiPayload(data);
      if (meta.fecha) metaFecha = meta.fecha;
      if (meta.certificado) metaCert = formatCertificado(meta.certificado);
      if (plain && !partes.some((p) => p.includes(plain.slice(0, 60)))) partes.push(plain);
      archivosFromApi = normalizeArchivosList(archivosFromApi, archivos);
    } catch (_) {}

    // 2) PDF "descargar texto" si el movimiento tiene link (proveído digital)
    const hasLink = !!(story && (story.link === true || story.link === 1 || typeof story.link === 'string'));
    if (hasLink || !partes.length) {
      try {
        const dl = await apiPost('/proceedings/history/text/download', {
          proceeding: String(procid),
          jurisdiction: String(jid),
          history: String(histid),
        });
        const url = typeof dl === 'string' ? dl : dl?.url || dl?.data;
        const { buffer, isPdf } = await downloadUrlAsBinary(url);
        if (buffer && isPdf) {
          const pdfText = stripTucumanMembrete((await extraerTextoPDF(buffer)) || '');
          if (pdfText && !isEmptyPortalTexto(pdfText) && !partes.some((p) => p.includes(pdfText.slice(0, 80)))) {
            partes.push(pdfText);
          }
          // Si no hay adjuntos listados, el proveído PDF también cuenta como pieza
          if (!normalizeArchivosList(story?.archivos, archivosFromApi).length) {
            adjuntoBytes.push({
              nombre: `proveido_${histid}.pdf`,
              bytes: new Uint8Array(buffer),
              url,
            });
          }
        } else if (buffer && !isPdf) {
          const htmlText = stripTucumanMembrete(
            htmlToPlainText(new TextDecoder('utf-8').decode(buffer))
          );
          if (htmlText && !isEmptyPortalTexto(htmlText)) partes.push(htmlText);
        }
      } catch (_) {}
    }

    // 3) Adjuntos del movimiento (escritos en el botón ADJUNTOS)
    const archivos = normalizeArchivosList(story?.archivos, archivosFromApi);
    for (const ar of archivos) {
      const fetched = await downloadArchivoAdjunto(histid, ar);
      if (!fetched) {
        partes.push(`(Adjunto no descargable: ${displayArchivoName(ar)})`);
        continue;
      }
      adjuntoBytes.push({ nombre: fetched.nombre, bytes: fetched.bytes, url: fetched.url });
      if (fetched.text && !isEmptyPortalTexto(fetched.text)) {
        partes.push(`--- Adjunto: ${fetched.nombre} ---\n${fetched.text}`);
      } else {
        partes.push(
          `--- Adjunto: ${fetched.nombre} ---\n(PDF adjunto incluido en la exportación; sin texto digital extraíble.)`
        );
      }
      await delayEntrePeticiones();
    }

    let out = stripTucumanMembrete(partes.filter(Boolean).join('\n\n').trim());
    if (isEmptyPortalTexto(out)) out = '';
    if (out) {
      const foot = [];
      if (metaFecha) foot.push(`Actuación firmada en fecha: ${metaFecha}`);
      if (metaCert) foot.push(`Certificado digital: ${metaCert}`);
      if (foot.length) out = `${out}\n\n${foot.join('\n')}`;
    }
    return { texto: out, adjuntoBytes, archivos };
  }

  function caratulaFromProceeding(p) {
    if (!p) return '';
    if (p.caratula) return String(p.caratula).trim();
    const acto = p.acto || p.actor || '';
    const dema = p.dema || p.demandado || '';
    const tipo = p.tipo_proceso || '';
    if (acto || dema) {
      return `${acto}${dema ? ` C/ ${dema}` : ''}${tipo ? ` S/ ${tipo}` : ''}`.trim();
    }
    return '';
  }

  function juzgadoFromProceeding(p) {
    if (!p) return '';
    if (typeof p.juzgado === 'string') return p.juzgado;
    if (p.juzgado?.dscr) return p.juzgado.dscr;
    if (p.juzgado?.coju) return p.juzgado.coju;
    return '';
  }

  function nroFromProceeding(p) {
    if (!p) return '';
    return String(p.nro_expediente || p.number || '').trim();
  }

  function countFromDom() {
    let n = 0;
    for (const row of document.querySelectorAll('table tbody tr, table tr')) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 2) continue;
      const txt = cells.map((c) => (c.textContent || '').trim());
      if (txt.some((s) => /^(fecha|descripci[oó]n)$/i.test(s))) continue;
      if (txt.some((s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s))) n++;
    }
    return n;
  }

  function parseCaratulaFromDom() {
    const h1 = document.querySelector('h1, h2, .expediente-title');
    const body = document.body?.innerText || '';
    const m = body.match(/([A-ZÁÉÍÓÚÑ][^\n]{15,180}?S\/\s*[^\n]{5,80})/);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
    const title = (document.title || '').trim();
    if (title.length > 15 && !/PORTAL|SAE|Consulta/i.test(title)) return title;
    return (h1?.textContent || '').trim();
  }

  async function ensureHistoryLoaded() {
    loadCachedHistory();
    if (state.stories?.length && state.procid && state.jurisdictionId) {
      return { ok: true, stories: state.stories };
    }

    const urlParts = parseUrlParts();
    if (state.procid) {
      const jid = state.jurisdictionId || (await resolveJurisdictionId(urlParts?.slug));
      if (jid) {
        try {
          const payload = await fetchHistory(state.procid, jid);
          if (payload.stories?.length) return { ok: true, stories: payload.stories };
        } catch (_) {}
      }
    }

    return {
      ok: false,
      stories: state.stories || [],
      reason: state.procid ? 'sin_movimientos' : 'sin_cache'
    };
  }

  async function getExpedienteInfo() {
    if (isLoginPage()) {
      return {
        pageTitle: document.title || '',
        pageUrl: location.href,
        count: 0,
        caratula: '',
        nroExpediente: '',
        juzgado: '',
        tucumanEstado: 'login'
      };
    }

    const urlParts = parseUrlParts();
    loadCachedHistory();

    if (!urlParts?.isHistoria) {
      return {
        pageTitle: document.title || '',
        pageUrl: location.href,
        count: 0,
        caratula: '',
        nroExpediente: urlParts?.nro || '',
        juzgado: '',
        tucumanEstado: isHomeOrSelector() ? 'inicio' : 'lista'
      };
    }

    const resolved = await ensureHistoryLoaded();
    const p = state.proceeding;
    const stories = resolved.stories || state.stories || [];
    const count = stories.length || countFromDom();
    const nro = nroFromProceeding(p) || urlParts.nro || '';
    const caratula = caratulaFromProceeding(p) || parseCaratulaFromDom();
    const juzgado = juzgadoFromProceeding(p);

    let tucumanEstado = 'listo';
    if (!state.procid && count === 0) tucumanEstado = 'sin_cache';
    else if (count === 0) tucumanEstado = 'abierto_sin_datos';
    else if (!state.procid) tucumanEstado = 'sin_cache';

    return {
      pageTitle: document.title || '',
      pageUrl: location.href,
      count,
      caratula,
      nroExpediente: nro,
      juzgado,
      procid: state.procid || '',
      jurisdictionId: state.jurisdictionId || '',
      tucumanEstado
    };
  }

  function inferTipoTucuman(titulo) {
    const t = String(titulo || '').toUpperCase();
    if (/PLIEGO|ABSOLUC/.test(t)) return 'Pliego de absoluciones';
    if (/NOTA\s+ACTUARIAL/.test(t)) return 'Nota actuarial';
    if (/NOTIFIC/.test(t)) return 'Notificación';
    if (/MEDIACI/.test(t)) return 'Mediación';
    if (/\bCARGO\b/.test(t)) return 'Cargo';
    if (/SENTENCIA/.test(t)) return 'Sentencia';
    if (/RESOLUC/.test(t)) return 'Resolución';
    if (/GEACC|OCURRA|RESERV/.test(t)) return 'Oficio / despacho';
    if (/MOSTRADOR/.test(t)) return 'Mostrador';
    return 'Actuación';
  }

  function buildDatosExpediente() {
    const p = state.proceeding;
    return {
      caratula: caratulaFromProceeding(p) || parseCaratulaFromDom(),
      nroExpediente: nroFromProceeding(p) || parseUrlParts()?.nro || '',
      juzgado: juzgadoFromProceeding(p),
      dependencia: juzgadoFromProceeding(p),
      jurisdiccion: 'Tucumán',
      portal: 'TUCUMAN',
      procid: state.procid || '',
    };
  }

  function storyToPickerItem(st, index) {
    const histid = st.histid ?? st.id;
    const titulo = st.dscr || st.descripcion || st.titulo || `Movimiento ${histid || index + 1}`;
    const tipo = inferTipoTucuman(titulo);
    const archivos = normalizeArchivosList(st.archivos);
    const hasFiles = archivos.length > 0;
    return {
      id: String(histid ?? index),
      histid,
      fecha: st.fecha || st.fechaFirma || '',
      hora: '',
      tipo: hasFiles ? `${tipo} · adjunto` : tipo,
      titulo,
      descripcion: titulo,
      firmante: '',
      selected: true,
      hasDoc: true,
      docCount: hasFiles ? archivos.length : 1,
      story: st,
    };
  }

  async function listActuacionesForPicker(sendProgress, cancelFlag) {
    sendProgress?.({ mensaje: 'Obteniendo movimientos del SAE…' });
    const resolved = await ensureHistoryLoaded();
    if (!state.procid || !state.jurisdictionId) {
      throw new Error(
        'No se pudo leer el expediente SAE. Abrí Historia y recargá (F5) con LegalMev activo.'
      );
    }
    let stories = Array.isArray(resolved.stories) ? [...resolved.stories] : [];
    if (!stories.length) {
      const fresh = await fetchHistory(state.procid, state.jurisdictionId);
      stories = fresh.stories || [];
    }
    if (cancelFlag?.cancelled || cancelarExportacion) return null;
    if (!stories.length) throw new Error('No se encontraron movimientos en este expediente.');
    return stories.map((st, i) => storyToPickerItem(st, i));
  }

  async function hydrateStoryItem(st, index, total, sendProgress) {
    if (sendProgress) {
      sendProgress({
        current: index,
        total,
        progreso: total ? Math.min(85, Math.round((100 * (index + 0.35)) / total)) : 0,
        mensaje: `Descargando movimiento ${index + 1} de ${total}…`,
      });
    }
    const histid = st.histid ?? st.id;
    const titulo = st.dscr || st.descripcion || st.titulo || `Movimiento ${histid || index + 1}`;
    let contenido = '';
    let firmante = '';
    let adjuntoBytes = [];
    let archivos = normalizeArchivosList(st.archivos);

    if (st.texto) {
      const plain = stripTucumanMembrete(htmlToPlainText(st.texto));
      if (!isEmptyPortalTexto(plain)) contenido = plain;
    }

    if (histid != null && histid !== '') {
      try {
        const body = await fetchHistoriaTexto(histid, st);
        if (body?.texto) contenido = stripTucumanMembrete(body.texto);
        if (Array.isArray(body?.adjuntoBytes) && body.adjuntoBytes.length) {
          adjuntoBytes = body.adjuntoBytes;
        }
        if (Array.isArray(body?.archivos) && body.archivos.length) {
          archivos = normalizeArchivosList(archivos, body.archivos);
        }
      } catch (e) {
        if (!contenido && !adjuntoBytes.length) {
          contenido = `(Error al leer texto: ${e.message})`;
        }
      }
    }

    const certM = (contenido || '').match(/Certificado digital:\s*(.+)/i);
    if (certM?.[1]) {
      const cn = certM[1].match(/CN=([^,]+)/i);
      firmante = (cn?.[1] || certM[1]).trim().slice(0, 120);
    }

    const tipoInferido = inferTipoTucuman(titulo);
    if (isEmptyPortalTexto(contenido) && !adjuntoBytes.length) {
      contenido = `(Sin texto del proveído para: ${titulo}. Si el portal muestra ADJUNTOS, el escrito no se pudo descargar.)`;
    } else if (isEmptyPortalTexto(contenido) && adjuntoBytes.length) {
      contenido = stripTucumanMembrete(
        [
          titulo,
          `Incluye ${adjuntoBytes.length} adjunto(s) PDF (escrito en ADJUNTOS del portal).`,
          ...adjuntoBytes.map((f) => `• ${f.nombre}`),
        ].join('\n')
      );
    } else {
      contenido = stripTucumanMembrete(contenido);
    }

    const adjuntos = adjuntoBytes.map((f) => ({
      nombre: f.nombre,
      url: f.url || location.href,
    }));
    if (!adjuntos.length) {
      for (const ar of archivos) {
        const nombre = ar.extension ? `${ar.nombre}.${ar.extension}` : ar.nombre;
        adjuntos.push({ nombre, url: location.href });
      }
    }

    return {
      numero: index + 1,
      fecha: st.fecha || st.fechaFirma || '',
      hora: '',
      tipo: tipoInferido,
      titulo,
      descripcion: titulo,
      firmante,
      contenido,
      adjuntos,
      adjuntoBytes,
      pdfBytes: adjuntoBytes[0]?.bytes || null,
      hasDoc: adjuntoBytes.length > 0 || !!contenido,
      docCount: Math.max(1, adjuntoBytes.length || adjuntos.length || 1),
      url: `${location.href.split('?')[0]}#hist-${histid || index}`,
    };
  }

  async function hydrateFromItems(selectedItems, sendProgress, cancelFlag) {
    const items = Array.isArray(selectedItems) ? selectedItems : [];
    const actuaciones = [];
    for (let i = 0; i < items.length; i++) {
      if (cancelFlag?.cancelled || cancelarExportacion) return null;
      if (i > 0) await delayEntrePeticiones();
      const it = items[i];
      const st = it.story || {
        histid: it.histid ?? it.id,
        dscr: it.descripcion || it.titulo,
        fecha: it.fecha,
        archivos: it.archivos,
        texto: it.texto,
      };
      actuaciones.push(await hydrateStoryItem(st, i, items.length, sendProgress));
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
    return {
      actuaciones,
      anexos: [],
      datosExpediente: buildDatosExpediente(),
    };
  }

  async function resolveAdjuntoBytes(act) {
    if (Array.isArray(act?.adjuntoBytes) && act.adjuntoBytes.length) {
      return act.adjuntoBytes.filter((f) => f?.bytes && f.bytes.length);
    }
    return [];
  }

  globalThis.LegalMevTucumanCore = {
    extractDatos: buildDatosExpediente,
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
          const resolved = await ensureHistoryLoaded();
          if (!state.procid) {
            sendResponse({
              ok: false,
              error: 'Abrí la Historia del expediente y recargá (F5) para monitorear.',
              code: 'MISSING_IDS'
            });
            return;
          }
          const stories = resolved.stories || [];
          const movements = stories.map((st) => ({
            portalId: String(st.histid ?? st.id ?? ''),
            id: String(st.histid ?? st.id ?? ''),
            fecha: st.fecha || '',
            tipo: '',
            descripcion: st.dscr || st.descripcion || ''
          }));
          sendResponse({ ok: true, portal: 'TUCUMAN', movements });
        } catch (e) {
          const code = /sesión|login|unauthorized|401|token/i.test(e.message || '')
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
            portal: 'tucuman',
            tucumanEstado: info.tucumanEstado || (info.count > 0 ? 'listo' : 'lista')
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

  async function mountMonitorDock() {
    const Ui = window.LegalMevDownloadUi;
    if (!Ui || document.getElementById('lm-export-dock')) return;
    try {
      const info = await getExpedienteInfo();
      if (!(info?.count > 0) && info?.tucumanEstado !== 'listo') return;
      Ui.mountFloatingBar({
        portal: 'TUCUMAN',
        mode: 'monitor',
        detectCount: info.count || 0,
        detectLabel: info.nroExpediente
          ? `${info.nroExpediente}${info.count ? ` · ${info.count} movimientos` : ''}`
          : info.count
            ? `${info.count} movimientos`
            : 'Expediente Tucumán',
        onSave: () => {
          chrome.runtime.sendMessage(
            {
              type: 'MONITOR_ACTIVATE',
              payload: {
                portal: 'TUCUMAN',
                nroExpediente: info.nroExpediente || '',
                caratula: info.caratula || '',
                juzgado: info.juzgado || '',
                url: location.href,
              },
            },
            (resp) => {
              if (resp?.ok) {
                alert(
                  resp.case?.baselineReady
                    ? 'Causa guardada para seguimiento. Línea de base OK (sin alertas históricas).'
                    : 'Causa guardada para seguimiento.'
                );
              } else {
                alert(resp?.error || 'No se pudo guardar la causa');
              }
            }
          );
        },
      });
    } catch (_) {}
  }

  loadCachedHistory();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(mountMonitorDock, 1200));
  } else {
    setTimeout(mountMonitorDock, 1200);
  }
})();
