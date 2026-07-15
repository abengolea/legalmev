/**
 * PJN — detecta expediente.seam, barra flotante, modal de categorías → ZIP / PDF.
 * Recolecta filas de todas las páginas del listado cuando hay paginador.
 */
(function () {
  'use strict';
  if (window.__LEGALMEV_PJN_PICKER__) return;
  window.__LEGALMEV_PJN_PICKER__ = true;

  function isExpedientePage() {
    return /expediente\.seam/i.test(location.href);
  }

  function buscarValorPorEtiqueta(etiqueta) {
    const all = document.querySelectorAll('td, span, div, label');
    for (const el of all) {
      const txt = (el.textContent || '').trim();
      if (txt.toLowerCase().startsWith(etiqueta.toLowerCase() + ':') || txt === etiqueta) {
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
    let jurisdiccion = buscarValorPorEtiqueta('Jurisdicción') || buscarValorPorEtiqueta('Jurisdiccion') || '';
    let situacion =
      buscarValorPorEtiqueta('Sit. Actual') ||
      buscarValorPorEtiqueta('Situación') ||
      buscarValorPorEtiqueta('Situacion') ||
      '';
    const juzgado = dependencia || jurisdiccion;
    if (!expediente) {
      const m = (document.body?.innerText || '').match(/([A-Z]{2,4}\s*\d+\/\d+)/);
      if (m) expediente = m[1].trim();
    }
    if (!caratula && document.title) {
      caratula =
        document.title
          .split(/[\-\–\—|]/)
          .map((p) => p.trim())
          .find((p) => p.length > 10) || document.title;
    }
    return {
      nroExpediente: expediente,
      caratula,
      juzgado,
      dependencia,
      jurisdiccion,
      situacion,
      portal: 'PJN',
    };
  }

  function encontrarTablaActuaciones() {
    const t = document.querySelector('table#expediente\\:action-table, table[id*="action-table"]');
    if (t && t.querySelectorAll('tr').length > 0) return t;
    for (const s of [
      'table[id*="expediente"]',
      'table.ui-datatable-data',
      '.ui-datatable table',
      '.ui-tabpanel table',
    ]) {
      const el = document.querySelector(s);
      if (el && el.querySelectorAll('tr').length > 1) return el;
    }
    return null;
  }

  function indiceColumnasPorHeader(tabla) {
    const headers = { fecha: 1, tipo: 2, desc: 3, fojas: -1 };
    for (const row of tabla.querySelectorAll('tr')) {
      const cells = row.querySelectorAll('th, td');
      for (let i = 0; i < cells.length; i++) {
        const t = (cells[i].textContent || '').trim().toUpperCase();
        if (/^FECHA$/.test(t)) headers.fecha = i;
        if (/^TIPO$/.test(t)) headers.tipo = i;
        if (/DESCRIPCI[OÓ]N|DETALLE/.test(t)) headers.desc = i;
        if (/A\s*FS|FOJA/.test(t)) headers.fojas = i;
      }
      if (headers.tipo >= 0) break;
    }
    return headers;
  }

  function extraerFilasDeTabla(tabla) {
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
      let linkDl = todosLinks.find((a) => (a.href || '').includes('download=true'));
      if (!linkVer) {
        linkVer = Array.from(row.querySelectorAll('a[href]')).find((a) => {
          try {
            const res = (a.href || '').toLowerCase();
            return res.includes('viewer.seam') || res.includes('document.seam');
          } catch (_) {
            return false;
          }
        });
      }

      let url = '';
      const hrefSrc = linkDl || linkVer;
      if (hrefSrc) {
        try {
          url = hrefSrc.href || new URL(hrefSrc.getAttribute('href'), location.href).href;
        } catch (_) {}
      }

      const hasIconDoc = !!(
        row.querySelector(
          'a[title*="Descargar"], a[title*="descargar"], a[title*="Ver"], a[title*="ver"], img[alt*="Descargar"], img[alt*="descargar"]'
        ) || row.querySelector('svg, .ui-icon-arrowthickstop-1-s')
      );
      const paperclip = (row.textContent || '').match(/📎\s*(\d+)/);
      const docCount = paperclip ? parseInt(paperclip[1], 10) : url || hasIconDoc ? 1 : 0;

      const fecha =
        (texts[idx.fecha] || '').match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] ||
        texts.find((t) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) ||
        '';
      const tipo = (texts[idx.tipo] || '').trim();
      const desc = (texts[idx.desc] || '').trim();
      const fojas = idx.fojas >= 0 ? texts[idx.fojas] || '' : texts.find((t) => /^\d+(\s*\/\s*\d+)?$/.test(t) && t.length < 20) || '';

      if (/^(OFICINA|FECHA|TIPO|DESCRIPCION)$/i.test(tipo)) continue;
      if (!fecha && !tipo && !desc) continue;

      filas.push({
        id: `pjn-${filas.length}-${fecha}-${tipo}`.slice(0, 80),
        fecha,
        tipo: tipo || desc,
        descripcion: desc || tipo,
        titulo: desc || tipo,
        fojas,
        url,
        hasDoc: !!(url || docCount),
        docCount,
        contenido: [tipo, desc].filter(Boolean).join('\n'),
      });
    }
    return filas;
  }

  function detectarTotalPaginas() {
    let max = 1;
    const pagers = document.querySelectorAll('.ui-paginator a, .ui-paginator span, [id*="paginator"] a, [id*="paginator"] span');
    for (const el of pagers) {
      const n = parseInt((el.textContent || '').trim(), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    // RichFaces ids variables (fallback legalmev_ext)
    for (const el of document.querySelectorAll('[id*="j_idt"][id*="j_idt"]')) {
      const nums = (el.textContent || '').match(/\d+/g);
      if (nums) for (const n of nums) max = Math.max(max, parseInt(n, 10) || 1);
    }
    return Math.min(max, 200);
  }

  async function irAPagina(n) {
    const candidates = [
      ...document.querySelectorAll(`.ui-paginator a, [id*="paginator"] a`),
    ];
    const el =
      candidates.find((a) => (a.textContent || '').trim() === String(n)) ||
      document.querySelector(`[id$=":${n - 1}:j_idt229"]`);
    if (!el || el.tagName === 'SPAN') return;
    el.click();
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 180));
      const active = document.querySelector('.ui-paginator-page.ui-state-active, span.ui-state-active');
      if (active && (active.textContent || '').trim() === String(n)) {
        await new Promise((r) => setTimeout(r, 250));
        return;
      }
    }
  }

  async function recolectarTodasLasFilas(onPage) {
    const totalPag = detectarTotalPaginas();
    const todas = [];
    const vistos = new Set();
    for (let p = 1; p <= totalPag; p++) {
      if (p > 1) await irAPagina(p);
      onPage?.(p, totalPag);
      const tabla = encontrarTablaActuaciones();
      const filas = extraerFilasDeTabla(tabla);
      for (const f of filas) {
        const key = `${f.fecha}|${f.tipo}|${f.descripcion}|${f.fojas}`;
        if (vistos.has(key)) continue;
        vistos.add(key);
        f.id = `pjn-${todas.length}`;
        todas.push(f);
      }
    }
    if (totalPag > 1) await irAPagina(1);
    return { items: todas, pages: totalPag };
  }

  async function openDownloadFlow() {
    const Ui = window.LegalMevDownloadUi;
    if (!Ui) {
      alert('UI de descarga no cargada. Recargá la extensión.');
      return;
    }

    const datos = extraerDatosExpediente();
    const picker = Ui.openPicker({
      portal: 'PJN',
      title: 'Armar exportación PJN',
      subtitle: 'Elegí actuaciones e integrá carpeta ZIP o un PDF único',
      items: [],
      warning:
        'Si el expediente tiene actuaciones históricas fuera de esta vista, incluilas desde «Ver históricas» en el portal antes de descargar.',
      originLabel: 'PJN · expediente',
      async onExport({ mode, selectedItems, setProgress, cancelFlag }) {
        const actuaciones = selectedItems.map((it) => ({
          ...it,
          contenido: it.contenido || `${it.tipo || ''}\n${it.descripcion || ''}`.trim(),
          adjuntos: it.url ? [{ nombre: 'documento.pdf', url: it.url }] : [],
        }));

        await window.LegalMevExportRunner.runExport({
          mode,
          datos,
          actuaciones,
          cancelFlag,
          setProgress,
          async resolveAdjuntos(act, ctx) {
            if (!act.url) return [];
            if (cancelFlag.cancelled) return [];
            ctx?.setProgress?.(null, `Bajando documento act. ${ctx.index}…`);
            const result = await window.LegalMevRobustFetch.fetchBinary(act.url, {
              fileName: 'documento.pdf',
            });
            if (!result.ok) throw new Error(result.error);
            return [{ nombre: 'documento.pdf', bytes: result.bytes }];
          },
        });
      },
    });

    try {
      picker.setLoadingMessage('Recolectando actuaciones del expediente…');
      const { items, pages } = await recolectarTodasLasFilas((p, total) => {
        picker.setLoadingMessage(`Recolectando actuaciones… página ${p} de ${total}`);
      });
      if (!items.length) {
        picker.setError('No se encontraron actuaciones en la tabla del expediente.');
        return;
      }
      picker.setItems(items, {
        originLabel: `PJN · ${pages} página(s)`,
      });
    } catch (e) {
      picker.setError(e.message || String(e));
    }
  }

  function boot() {
    if (!isExpedientePage()) return;
    const tryMount = () => {
      const tabla = encontrarTablaActuaciones();
      if (!tabla) return false;
      const filas = extraerFilasDeTabla(tabla);
      window.LegalMevDownloadUi?.mountFloatingBar({
        portal: 'PJN',
        detectCount: filas.length,
        detectLabel: filas.length
          ? `${filas.length}+ movimientos en esta página (al descargar se leen todas)`
          : 'PJN · listo para descargar',
        onDownload: () => openDownloadFlow(),
        onSave: () => {
          const datos = extraerDatosExpediente();
          chrome.runtime.sendMessage(
            {
              type: 'MONITOR_ACTIVATE',
              payload: {
                portal: 'PJN',
                nroExpediente: datos.nroExpediente,
                caratula: datos.caratula,
                juzgado: datos.juzgado || datos.dependencia || '',
                url: location.href,
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
                alert(resp?.error || 'No se pudo activar el monitoreo');
              }
            }
          );
        },
      });
      return true;
    };
    if (tryMount()) return;
    // PJN carga lento (JSF): reintentar
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (tryMount() || n > 20) clearInterval(t);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === 'MONITOR_LIST_MOVEMENTS') {
      try {
        const tabla = encontrarTablaActuaciones();
        const filas = extraerFilasDeTabla(tabla);
        const movements = filas.map((f, i) => ({
          id: f.url || `pjn-${i}-${f.fecha}-${f.tipo}`,
          portalId: f.url || `${f.fecha}|${f.tipo}|${f.descripcion || f.desc || ''}`.slice(0, 160),
          fecha: f.fecha || '',
          tipo: f.tipo || '',
          descripcion: f.descripcion || f.desc || f.tipo || '',
        }));
        sendResponse({ ok: true, portal: 'PJN', movements });
      } catch (e) {
        sendResponse({ ok: false, error: e.message, code: 'PARSE_ERROR' });
      }
      return true;
    }
    if (msg?.type === 'START_DOWNLOAD_PICKER' || msg?.type === 'PJN_START_ZIP_EXPORT') {
      openDownloadFlow()
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });
})();
