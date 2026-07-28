/**
 * MEV — detecta procesales.asp, barra flotante, modal de categorías → PDF único.
 */
(function () {
  'use strict';
  if (window.__LEGALMEV_MEV_PICKER__) return;
  window.__LEGALMEV_MEV_PICKER__ = true;

  const PROVEIDO_REGEX = /^https:\/\/mev\.scba\.gov\.ar\/proveido\.asp\?/i;
  const PROVEIDO_FETCH_MS = 120_000;

  function textoLimpio(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function esCaratulaValida(texto) {
    if (!texto || texto.length < 5) return false;
    if (
      /usuario\s*mev|mesa\s+de\s+entradas\s+virtual|autorizaciones\s+de\s+causas|proveido|procesales|legalmev|scba\.gov/i.test(
        texto
      )
    ) {
      return false;
    }
    if (/^nombre\s*$/i.test(texto.trim())) return false;
    if (/^mev$/i.test(texto.trim())) return false;
    return true;
  }

  function esNroExpedienteValido(nro) {
    const s = String(nro || '').replace(/\s+/g, ' ').trim();
    if (s.length < 3) return false;
    if (/mesa\s+de\s+entradas|^mev$|procesales|proveido/i.test(s)) return false;
    return true;
  }

  function buscarValorPorEtiquetaDoc(doc, etiqueta) {
    const etiqNorm = (etiqueta || '').replace(/:+\s*$/, '').trim();
    if (!etiqNorm) return '';
    const allCells = doc.querySelectorAll('td, th, label, span, div');
    for (const td of allCells) {
      const txt = (td.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt || txt.length > 80) continue;
      const txtSinColon = txt.replace(/:+\s*$/, '').trim();
      const low = txt.toLowerCase();
      const etiqLow = etiqNorm.toLowerCase();
      if (
        txtSinColon.toLowerCase() === etiqLow ||
        low === etiqLow + ':' ||
        low.startsWith(etiqLow + ':') ||
        low.startsWith(etiqLow + ' ')
      ) {
        const row = td.closest('tr');
        if (row) {
          const cells = row.querySelectorAll('td, th');
          const idx = Array.from(cells).indexOf(td);
          if (idx >= 0 && cells[idx + 1]) {
            const val = (cells[idx + 1].textContent || '').replace(/\s+/g, ' ').trim();
            if (val && val.toLowerCase() !== etiqLow) return val;
          }
        }
        const next = td.nextElementSibling;
        if (next) {
          const val = (next.textContent || '').replace(/\s+/g, ' ').trim();
          if (val) return val;
        }
        const rest = txt.replace(new RegExp('^' + etiqNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:?\\s*', 'i'), '').trim();
        if (rest && rest.length > 2) return rest;
      }
    }
    return '';
  }

  function extractCaratula() {
    const fromLabel =
      buscarValorPorEtiquetaDoc(document, 'Carátula') ||
      buscarValorPorEtiquetaDoc(document, 'Caratula') ||
      buscarValorPorEtiquetaDoc(document, 'Caratula del expediente');
    if (fromLabel && esCaratulaValida(fromLabel)) return fromLabel.slice(0, 300);

    const selectors = [
      "td[headers*='caratula']",
      "td[headers*='carátula']",
      '.caratula',
      "[id*='caratula']",
      "[id*='carátula']",
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        const txt = el?.textContent?.replace(/\s+/g, ' ').trim();
        if (txt && esCaratulaValida(txt)) return txt.slice(0, 300);
      } catch (_) {}
    }

    // Filas que empiezan con "Carátula"
    for (const tr of document.querySelectorAll('tr')) {
      const t = (tr.textContent || '').replace(/\s+/g, ' ').trim();
      const m = t.match(/Car[áa]tula\s*:?\s*(.+)$/i);
      if (m && esCaratulaValida(m[1])) return m[1].trim().slice(0, 300);
    }

    const title = (document.title || '').trim();
    const parts = title.split(/[\-\–\—|]/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      if (p.length > 10 && /c\/|vs\.|contra/i.test(p) && esCaratulaValida(p)) return p.slice(0, 300);
    }
    return '';
  }

  function extractNroExpediente() {
    const fromLabel =
      buscarValorPorEtiquetaDoc(document, 'Nº de Expediente') ||
      buscarValorPorEtiquetaDoc(document, 'N° de Expediente') ||
      buscarValorPorEtiquetaDoc(document, 'Nro. de Expediente') ||
      buscarValorPorEtiquetaDoc(document, 'Nro de Expediente') ||
      buscarValorPorEtiquetaDoc(document, 'Número de Expediente') ||
      buscarValorPorEtiquetaDoc(document, 'Numero de Expediente');
    if (esNroExpedienteValido(fromLabel)) {
      return fromLabel.replace(/\s+/g, ' ').replace(/\s*[-\|]\s*\/?\s*$/, '').trim().slice(0, 40);
    }

    const body = document.body?.innerText || '';
    const nroM =
      body.match(/N[º°]\s*de\s*Expediente\s*:?\s*([^\n]{3,60})/i) ||
      body.match(/Nro\.?\s*de\s*Expediente\s*:?\s*([^\n]{3,60})/i) ||
      body.match(/Expediente\s*N[º°]?\s*:?\s*([A-Z0-9.\-\/ ]{5,40})/i) ||
      body.match(/\b(\d{1,7}\/\d{2,4})\b/);
    if (nroM && esNroExpedienteValido(nroM[1])) {
      return nroM[1].replace(/\s+/g, ' ').trim().slice(0, 40);
    }

    try {
      const u = new URL(location.href);
      const cand =
        u.searchParams.get('nroExpediente') ||
        u.searchParams.get('numero') ||
        u.searchParams.get('expediente') ||
        '';
      if (esNroExpedienteValido(cand)) return String(cand).trim().slice(0, 40);
      const id = u.searchParams.get('idExpediente') || u.searchParams.get('id') || '';
      if (id && /^\d{4,}$/.test(id)) return id;
    } catch (_) {}
    return '';
  }

  /** Datos visibles en procesales.asp (sin abrir proveídos). */
  function extractDatosDesdePagina() {
    let nroExpediente = extractNroExpediente();
    let caratula = extractCaratula();
    let dependencia =
      buscarValorPorEtiquetaDoc(document, 'Juzgado') ||
      buscarValorPorEtiquetaDoc(document, 'Departamento') ||
      buscarValorPorEtiquetaDoc(document, 'Organismo') ||
      '';
    let situacion =
      buscarValorPorEtiquetaDoc(document, 'Estado') ||
      buscarValorPorEtiquetaDoc(document, 'Situación') ||
      buscarValorPorEtiquetaDoc(document, 'Situacion') ||
      '';

    const body = document.body?.innerText || '';
    if (!dependencia) {
      const depM = body.match(/Departamento\s*:?\s*([^\n]+)/i);
      if (depM) {
        const d = depM[1].replace(/\s+/g, ' ').trim();
        if (d && !/mesa\s+de\s+entradas/i.test(d)) dependencia = d;
      }
    }

    return {
      caratula: esCaratulaValida(caratula) ? caratula : '',
      nroExpediente: esNroExpedienteValido(nroExpediente) ? nroExpediente : '',
      juzgado: dependencia,
      dependencia,
      jurisdiccion: 'Provincia de Buenos Aires — MEV/SCBA',
      situacion,
      portal: 'MEV',
    };
  }

  /**
   * Completa nro/carátula desde el primer proveído si la página no los muestra bien.
   */
  async function resolveDatosParaMonitoreo() {
    let datos = extractDatosDesdePagina();
    if (datos.nroExpediente && esCaratulaValida(datos.caratula)) return datos;

    const movs = listMovimientos();
    if (movs[0]?.url) {
      try {
        const html = await fetchProveidoHtml(movs[0].url);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const fromProv = extraerDatosDesdeProveido(doc);
        if (!datos.nroExpediente && esNroExpedienteValido(fromProv.nroExpediente)) {
          datos.nroExpediente = fromProv.nroExpediente;
        }
        if (!esCaratulaValida(datos.caratula) && esCaratulaValida(fromProv.caratula)) {
          datos.caratula = fromProv.caratula;
        }
        if (!datos.juzgado && fromProv.juzgado) {
          datos.juzgado = fromProv.juzgado;
          datos.dependencia = fromProv.dependencia || fromProv.juzgado;
        }
        if (!datos.situacion && fromProv.situacion) datos.situacion = fromProv.situacion;
      } catch (_) {}
    }

    // Fallback de identidad (no es el nro “público”, pero evita “MEV” vacío)
    if (!datos.nroExpediente) {
      try {
        const u = new URL(location.href);
        const id = u.searchParams.get('idExpediente') || '';
        if (id) datos.nroExpediente = String(id);
      } catch (_) {}
    }
    return datos;
  }
  function extraerDatosDesdeProveido(doc) {
    let caratula =
      buscarValorPorEtiqueta(doc, 'Carátula') ||
      buscarValorPorEtiqueta(doc, 'Caratula') ||
      '';
    let nroExpediente =
      buscarValorPorEtiqueta(doc, 'Nº de Expediente') ||
      buscarValorPorEtiqueta(doc, 'N° de Expediente') ||
      buscarValorPorEtiqueta(doc, 'Nro. de Expediente') ||
      '';
    let juzgado = '';
    let dependencia = '';
    let situacion = '';

    if (!caratula && doc.body) {
      const m = (doc.body.innerText || '').match(/Car[áa]tula\s*:?\s*([^\n]+)/i);
      if (m) caratula = m[1].trim();
    }
    if (!nroExpediente && doc.body) {
      const m = (doc.body.innerText || '').match(/N[º°]\s*de\s*Expediente\s*:?\s*([^\n]+)/i);
      if (m) nroExpediente = m[1].replace(/\s+/g, ' ').trim();
    }

    const tables = doc.querySelectorAll('table.marco, table');
    for (const t of tables) {
      const h = t.querySelector('th, td[class*="header"], .header');
      if (h) {
        const txt = (h.textContent || '').trim();
        if (txt && /Juzgado|Departamento/i.test(txt) && txt.length < 100) {
          juzgado = txt;
          dependencia = txt;
          break;
        }
      }
    }

    dependencia =
      dependencia ||
      buscarValorPorEtiqueta(doc, 'Juzgado') ||
      buscarValorPorEtiqueta(doc, 'Departamento') ||
      buscarValorPorEtiqueta(doc, 'Organismo') ||
      '';
    situacion =
      buscarValorPorEtiqueta(doc, 'Estado') ||
      buscarValorPorEtiqueta(doc, 'Situación') ||
      buscarValorPorEtiqueta(doc, 'Situacion') ||
      '';

    if (!esCaratulaValida(caratula)) caratula = '';
    nroExpediente = String(nroExpediente || '')
      .replace(/\s+/g, ' ')
      .replace(/\s*[-\|]\s*\/?\s*$/, '')
      .trim()
      .slice(0, 40);

    return {
      caratula,
      nroExpediente,
      juzgado: juzgado || dependencia,
      dependencia,
      jurisdiccion: 'Provincia de Buenos Aires — MEV/SCBA',
      situacion,
      portal: 'MEV',
    };
  }

  function listMovimientos() {
    const movimientos = [];
    const vistos = new Set();
    for (const link of document.querySelectorAll('a[href]')) {
      if (!link || vistos.has(link.href)) continue;
      if (!PROVEIDO_REGEX.test(link.href)) continue;
      const row = link.closest('tr');
      if (!row) continue;
      const cells = Array.from(row.children).filter((el) => /^(TD|TH)$/i.test(el.tagName));
      const textos = cells.map(textoLimpio);
      const fechaCell = textos.find((txt) => /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(txt)) || '';
      const fecha = fechaCell.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)?.[0] || '';
      const hora = fechaCell.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] || '';
      const descripcion =
        textoLimpio(link) ||
        [...textos].reverse().find((txt) => txt && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(txt) && !/^\d{1,2}:\d{2}/.test(txt)) ||
        '';
      vistos.add(link.href);
      movimientos.push({
        id: `mev-${movimientos.length}`,
        url: link.href,
        fecha,
        hora,
        tipo: descripcion,
        descripcion,
        titulo: descripcion,
        hasDoc: true,
        docCount: 1,
      });
    }
    return movimientos;
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function fetchProveidoHtml(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROVEIDO_FETCH_MS);
    try {
      const resp = await fetch(url, {
        credentials: 'include',
        signal: ctrl.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9',
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      if (e?.name === 'AbortError') throw new Error(`Timeout (${PROVEIDO_FETCH_MS / 1000}s) al cargar proveído`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function buscarValorPorEtiqueta(doc, etiqueta) {
    const etiqNorm = (etiqueta || '').replace(/:+\s*$/, '').trim();
    for (const td of doc.querySelectorAll('td')) {
      const txt = (td.textContent || '').trim();
      const txtSinColon = txt.replace(/:+\s*$/, '').trim();
      if (
        txt === etiqueta ||
        txtSinColon === etiqNorm ||
        txt.toLowerCase().startsWith(etiqNorm.toLowerCase() + ':') ||
        txt.toLowerCase().startsWith(etiqNorm.toLowerCase() + ' ')
      ) {
        const row = td.closest('tr');
        if (row) {
          const cells = row.querySelectorAll('td');
          const idx = Array.from(cells).indexOf(td);
          if (idx >= 0 && cells[idx + 1]) return (cells[idx + 1].textContent || '').trim();
        }
        const next = td.nextElementSibling;
        if (next) return (next.textContent || '').trim();
      }
    }
    return '';
  }

  function extraerTextoProveido(doc) {
    const SEPARADOR = /-{5,}\s*Para copiar y pegar/i;
    const all = doc.body?.innerText || '';
    const m = all.match(SEPARADOR);
    if (m && m.index != null) return all.slice(m.index + m[0].length).trim();
    return all.slice(0, 50000).trim();
  }

  function extraerAdjuntos(doc, baseUrl) {
    const adjuntos = [];
    for (const a of doc.querySelectorAll('a[href]')) {
      const text = (a.textContent || '').trim();
      if (!/VER ADJUNTO/i.test(text)) continue;
      const href = a.getAttribute('href');
      if (!href) continue;
      try {
        const url = new URL(href, baseUrl).href;
        const nombre = text.replace(/VER ADJUNTO/i, '').trim() || href.split('/').pop() || 'adjunto.pdf';
        adjuntos.push({ nombre: nombre || 'adjunto.pdf', url });
      } catch (_) {}
    }
    return adjuntos;
  }

  async function hydrateSelected(selected, setProgress, cancelFlag) {
    const actuaciones = [];
    let datos = extractDatosDesdePagina();

    for (let i = 0; i < selected.length; i++) {
      if (cancelFlag.cancelled) throw new Error('Cancelado por el usuario');
      const mov = selected[i];
      setProgress(
        Math.round((35 * i) / Math.max(1, selected.length)),
        `Leyendo actuación ${i + 1} de ${selected.length}…`
      );
      if (i > 0) await delay(280 + Math.floor(Math.random() * 420));

      try {
        const html = await fetchProveidoHtml(mov.url);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const act = {
          ...mov,
          titulo: buscarValorPorEtiqueta(doc, 'Observación') || mov.descripcion || '',
          firmante: buscarValorPorEtiqueta(doc, 'Firmado por') || '',
          contenido: extraerTextoProveido(doc),
          adjuntos: extraerAdjuntos(doc, mov.url),
          tipo: mov.tipo || mov.descripcion || '',
        };
        // Completar ficha del expediente con el primer proveído (suele traer carátula/nro/juzgado)
        if (i === 0 || !datos.nroExpediente || !datos.caratula) {
          const fromProv = extraerDatosDesdeProveido(doc);
          if (fromProv.caratula && (!datos.caratula || !esCaratulaValida(datos.caratula))) {
            datos.caratula = fromProv.caratula;
          }
          if (fromProv.nroExpediente && !datos.nroExpediente) {
            datos.nroExpediente = fromProv.nroExpediente;
          }
          if (fromProv.dependencia && !datos.dependencia) {
            datos.dependencia = fromProv.dependencia;
            datos.juzgado = fromProv.juzgado || fromProv.dependencia;
          }
          if (fromProv.situacion && !datos.situacion) datos.situacion = fromProv.situacion;
          if (fromProv.jurisdiccion) datos.jurisdiccion = fromProv.jurisdiccion;
        }
        datos.portal = 'MEV';
        actuaciones.push(act);
      } catch (e) {
        actuaciones.push({
          ...mov,
          contenido: `(Error al leer esta actuación: ${e.message})`,
          adjuntos: [],
        });
      }
    }
    return { actuaciones, datos };
  }

  async function openDownloadFlow() {
    const Ui = window.LegalMevDownloadUi;
    if (!Ui) {
      alert('UI de descarga no cargada. Recargá la extensión.');
      return;
    }

    const picker = Ui.openPicker({
      portal: 'MEV',
      title: 'Armar exportación MEV',
      subtitle: 'Elegí actuaciones e integrá un PDF único',
      items: [],
      originLabel: 'MEV · procesales',
      async onExport({ mode, selectedItems, setProgress, cancelFlag }) {
        const { actuaciones, datos } = await hydrateSelected(selectedItems, setProgress, cancelFlag);
        // PDF único MEV = texto de proveídos (apto para Control de prueba / Copiloto).
        await window.LegalMevExportRunner.runExport({
          mode: 'pdf',
          datos,
          actuaciones,
          cancelFlag,
          setProgress,
          forceTextPdf: true,
          resolveAdjuntos: async () => [],
        });
      },
    });

    picker.setLoadingMessage('Leyendo listado de actuaciones…');
    try {
      const items = listMovimientos();
      if (!items.length) {
        picker.setError('No se encontraron actuaciones (proveido.asp) en esta página.');
        return;
      }
      picker.setItems(items, { originLabel: `MEV · ${items.length} en página` });
    } catch (e) {
      picker.setError(e.message || String(e));
    }
  }

  function boot() {
    if (!/procesales\.asp/i.test(location.pathname) && !listMovimientos().length) return;
    const Ui = window.LegalMevDownloadUi;
    if (!Ui) return;
    const movs = listMovimientos();
    Ui.mountFloatingBar({
      portal: 'MEV',
      detectCount: movs.length,
      detectLabel: movs.length
        ? `${movs.length} movimiento${movs.length === 1 ? '' : 's'} en esta página`
        : 'MEV · listo para descargar',
      onDownload: () => openDownloadFlow(),
      onSave: () => {
        resolveDatosParaMonitoreo().then((datos) => {
          chrome.runtime.sendMessage(
            {
              type: 'MONITOR_ACTIVATE',
              payload: {
                portal: 'MEV',
                nroExpediente: datos.nroExpediente || '',
                caratula: datos.caratula || '',
                juzgado: datos.juzgado || datos.dependencia || '',
                url: location.href,
                portalRefs: {
                  idExpediente: (() => {
                    try {
                      return new URL(location.href).searchParams.get('idExpediente') || '';
                    } catch (_) {
                      return '';
                    }
                  })(),
                },
              },
            },
            (resp) => {
              if (resp?.ok) {
                const label = resp.case?.nroExpediente || datos.nroExpediente || 'causa';
                alert(
                  window.LegalMevDownloadUi?.followResultMessage?.(resp, label) ||
                    (resp.alreadyFollowed
                      ? `Esta causa ya está en tu lista: ${label}.`
                      : `Causa guardada: ${label}.`)
                );
              } else {
                alert(resp?.error || 'No se pudo activar el monitoreo');
              }
            }
          );
        });
      },
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === 'MONITOR_LIST_MOVEMENTS') {
      try {
        const meta = extractDatosDesdePagina();
        const movs = listMovimientos().map((m) => ({
          id: m.url,
          portalId: m.url,
          fecha: m.fecha || '',
          tipo: m.tipo || m.descripcion || '',
          descripcion: m.descripcion || m.titulo || '',
        }));
        sendResponse({ ok: true, portal: 'MEV', movements: movs, meta });
      } catch (e) {
        sendResponse({ ok: false, error: e.message, code: 'PARSE_ERROR' });
      }
      return true;
    }
    if (msg?.type === 'MONITOR_CASE_META') {
      resolveDatosParaMonitoreo()
        .then((meta) => sendResponse({ ok: true, meta }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (msg?.type === 'MEV_START_ZIP_EXPORT' || msg?.type === 'START_DOWNLOAD_PICKER') {
      openDownloadFlow()
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });
})();
