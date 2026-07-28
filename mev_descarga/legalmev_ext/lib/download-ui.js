/**
 * UI de exportación LegalMev (identidad propia).
 * Panel compacto + panel de armado de exportación (selección → PDF único).
 * Tipografía: Inter + Poppins · paleta LegalMev #2A6A78 / #54A6A8
 */
(function () {
  'use strict';

  const CSS_ID = 'lm-legalmev-dl-css';
  const FONTS_ID = 'lm-legalmev-fonts';
  const BAR_ID = 'lm-export-dock';
  const MODAL_ID = 'lm-export-panel';
  const INVITE_ID = 'lm-export-invite';
  const SITE_DEFAULT = 'https://www.legalmev.com.ar';

  const FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const FONT_HEAD = "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function resolveSiteBase() {
    try {
      const { apiBase } = await chrome.storage.local.get('apiBase');
      if (apiBase && typeof apiBase === 'string' && /^https?:\/\//i.test(apiBase)) {
        return apiBase.replace(/\/$/, '');
      }
    } catch (_) {}
    return SITE_DEFAULT;
  }

  function openTool(path) {
    resolveSiteBase().then((base) => {
      const url = `${base}${path}`;
      try {
        chrome.runtime.sendMessage({ type: 'OPEN_URL', url }, () => {
          void chrome.runtime.lastError;
        });
      } catch (_) {}
    });
  }

  function ensureFonts() {
    if (document.getElementById(FONTS_ID)) return;
    const link = document.createElement('link');
    link.id = FONTS_ID;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap';
    (document.head || document.documentElement).appendChild(link);
  }

  function injectCss() {
    ensureFonts();
    document.getElementById(CSS_ID)?.remove();
    document.getElementById('lm-mon-dl-css')?.remove();
    document.getElementById('lm-legalmev-dl-css')?.remove();
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
      #${BAR_ID}, #${MODAL_ID}, #${MODAL_ID} button, #${MODAL_ID} input, #${MODAL_ID} label, #${MODAL_ID} select {
        font-family: ${FONT_BODY};
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
      }

      /* Dock horizontal LegalMev (no stack vertical de 3 CTAs) */
      #${BAR_ID} {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
        display: flex; align-items: stretch;
        max-width: min(420px, calc(100vw - 32px));
        background: #fff;
        border: 1px solid #c5dce0;
        border-radius: 4px 12px 12px 4px;
        box-shadow: 0 8px 28px rgba(26, 58, 66, .16);
        overflow: hidden;
      }
      #${BAR_ID} .lm-brand-strip {
        width: 6px; flex-shrink: 0; background: linear-gradient(180deg, #2A6A78, #54A6A8);
      }
      #${BAR_ID} .lm-dock-body {
        flex: 1; padding: 12px 14px 10px; min-width: 0;
      }
      #${BAR_ID} .lm-dock-brand {
        font-family: ${FONT_HEAD}; font-size: 11px; font-weight: 700;
        letter-spacing: 0.06em; text-transform: uppercase; color: #54A6A8; margin: 0 0 4px;
      }
      #${BAR_ID} .lm-dock-title {
        font-family: ${FONT_HEAD}; font-size: 14px; font-weight: 700;
        color: #2A6A78; margin: 0 0 2px; line-height: 1.25;
      }
      #${BAR_ID} .lm-dock-meta {
        font-size: 12px; color: #5a7a82; margin: 0 0 10px; line-height: 1.35;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #${BAR_ID} .lm-dock-actions {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      }
      #${BAR_ID} .lm-btn-export {
        border: none; border-radius: 8px; padding: 9px 14px; cursor: pointer;
        background: #2A6A78; color: #fff; font-weight: 600; font-size: 13px;
      }
      #${BAR_ID} .lm-btn-export:hover { background: #54A6A8; }
      #${BAR_ID} .lm-linkish {
        border: none; background: transparent; color: #2A6A78; cursor: pointer;
        font-size: 12px; font-weight: 600; padding: 6px 4px; text-decoration: underline;
        text-underline-offset: 2px;
      }
      #${BAR_ID} .lm-linkish:hover { color: #54A6A8; }
      #${BAR_ID} .lm-dock-close {
        align-self: flex-start; border: none; background: transparent;
        color: #8aa0a6; font-size: 18px; line-height: 1; padding: 8px 10px 0 0; cursor: pointer;
      }
      #${BAR_ID} .lm-dock-close:hover { color: #2A6A78; }

      /* Panel de exportación */
      #${MODAL_ID} {
        position: fixed; inset: 0; z-index: 2147483646;
        background: rgba(18, 36, 42, .55);
        display: flex; align-items: stretch; justify-content: flex-end;
        padding: 0;
      }
      #${MODAL_ID} .lm-panel {
        width: min(480px, 100vw); height: 100%;
        background: #f4f8f9; overflow: hidden;
        display: flex; flex-direction: column;
        box-shadow: -12px 0 40px rgba(18, 36, 42, .22);
        color: #1a3a42; font-size: 13px; line-height: 1.4;
      }
      #${MODAL_ID} .lm-head {
        padding: 20px 20px 14px; position: relative;
        background: #2A6A78; color: #fff;
      }
      #${MODAL_ID} .lm-head .lm-brand-mini {
        font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
        text-transform: uppercase; opacity: .85; margin: 0 0 6px;
      }
      #${MODAL_ID} .lm-head h2 {
        margin: 0 36px 0 0; font-family: ${FONT_HEAD}; font-size: 18px; font-weight: 700;
        color: #fff; letter-spacing: -0.02em;
      }
      #${MODAL_ID} .lm-head p {
        margin: 8px 36px 0 0; color: rgba(255,255,255,.82); font-size: 12.5px; font-weight: 400;
      }
      #${MODAL_ID} .lm-x {
        position: absolute; top: 14px; right: 12px; width: 34px; height: 34px;
        border: none; border-radius: 8px; background: rgba(255,255,255,.12); color: #fff;
        font-size: 20px; cursor: pointer; line-height: 1;
      }
      #${MODAL_ID} .lm-x:hover { background: rgba(255,255,255,.22); }
      #${MODAL_ID} .lm-body { padding: 14px 16px; overflow: auto; flex: 1; background: #f4f8f9; }
      #${MODAL_ID} .lm-warn {
        background: #fff8e6; border-left: 3px solid #d4a017; color: #7a5b00;
        border-radius: 0 6px 6px 0; padding: 8px 10px; margin-bottom: 12px; font-size: 12.5px;
      }
      #${MODAL_ID} .lm-filter-row {
        display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-bottom: 10px; align-items: end;
      }
      #${MODAL_ID} .lm-filter-row label {
        display: block; font-size: 11px; font-weight: 600; color: #5a7a82;
        text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px;
      }
      #${MODAL_ID} .lm-filter-row select {
        width: 100%; border: 1px solid #c5dce0; border-radius: 8px; padding: 8px 10px;
        background: #fff; color: #1a3a42; font-size: 13px; font-weight: 500;
      }
      #${MODAL_ID} .lm-filter-row select:disabled {
        opacity: 1; color: #1a3a42; background: #eef7f8; cursor: default;
        -webkit-appearance: none; appearance: none;
      }
      #${MODAL_ID} .lm-tools { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      #${MODAL_ID} .lm-tools button {
        border: 1px solid #c5dce0; background: #fff; color: #2A6A78;
        border-radius: 6px; padding: 6px 10px; font-weight: 600; cursor: pointer; font-size: 12px;
      }
      #${MODAL_ID} .lm-tools button:hover { background: #eef7f8; border-color: #2A6A78; }
      #${MODAL_ID} .lm-list {
        border: 1px solid #d4e4e7; border-radius: 8px; overflow: auto; max-height: none;
        background: #fff; flex: 1; min-height: 200px;
      }
      #${MODAL_ID} .lm-row {
        display: grid; grid-template-columns: 28px 82px minmax(0, 1fr) auto;
        gap: 8px; align-items: start; padding: 11px 12px;
        border-bottom: 1px solid #eef3f4; cursor: pointer;
      }
      #${MODAL_ID} .lm-row:nth-child(even) { background: #fafcfc; }
      #${MODAL_ID} .lm-row:last-child { border-bottom: none; }
      #${MODAL_ID} .lm-row:hover { background: #eef7f8; }
      #${MODAL_ID} .lm-row .lm-fecha { font-weight: 600; color: #2A6A78; font-size: 12px; font-variant-numeric: tabular-nums; }
      #${MODAL_ID} .lm-row .lm-desc { font-weight: 500; color: #1a3a42; font-size: 12.5px; word-break: break-word; }
      #${MODAL_ID} .lm-doc-yes {
        font-size: 10px; font-weight: 700; color: #2A6A78; background: #e3f2f3;
        border-radius: 4px; padding: 2px 6px; white-space: nowrap; letter-spacing: 0.02em;
      }
      #${MODAL_ID} .lm-doc-no {
        font-size: 10px; font-weight: 600; color: #8a9aa0;
      }
      #${MODAL_ID} .lm-foot {
        border-top: 1px solid #d7e6e8; padding: 12px 16px; display: flex;
        gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap;
        background: #fff;
      }
      #${MODAL_ID} .lm-foot button {
        border: 1px solid #c5dce0; background: #fff; color: #2A6A78;
        border-radius: 8px; padding: 10px 14px; font-weight: 600; cursor: pointer; font-size: 13px;
      }
      #${MODAL_ID} .lm-foot button.primary {
        background: #2A6A78; color: #fff; border-color: #2A6A78;
      }
      #${MODAL_ID} .lm-foot button.primary:hover { background: #54A6A8; border-color: #54A6A8; }
      #${MODAL_ID} .lm-foot button:disabled { opacity: .45; cursor: wait; }
      #${MODAL_ID} .lm-progress {
        display: none; margin-top: 10px; background: #e8f1f2; border-radius: 4px; height: 6px; overflow: hidden;
      }
      #${MODAL_ID} .lm-progress > i { display: block; height: 100%; width: 0; background: #54A6A8; transition: width .2s; }
      #${MODAL_ID} .lm-loading {
        display: flex; gap: 10px; align-items: center; color: #4a6a72; padding: 40px 12px;
        font-size: 13px; font-weight: 500; justify-content: center;
      }
      #${MODAL_ID} .lm-spin {
        width: 18px; height: 18px; border: 2px solid #c9dde0; border-top-color: #2A6A78;
        border-radius: 50%; animation: lmspin .8s linear infinite;
      }
      #${MODAL_ID} .lm-status-inline {
        flex: 1; min-width: 120px; color: #5a7a82; font-size: 12px; font-weight: 500; text-align: left;
      }
      @keyframes lmspin { to { transform: rotate(360deg); } }
      @media (max-width: 560px) {
        #${MODAL_ID} { justify-content: center; }
        #${MODAL_ID} .lm-panel { width: 100%; border-radius: 0; }
        #${BAR_ID} { right: 12px; left: 12px; max-width: none; }
      }

      /* Cartel post-descarga */
      #${INVITE_ID} {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        background: rgba(26, 58, 66, 0.5); padding: 16px;
        font-family: ${FONT_BODY};
      }
      #${INVITE_ID} .lm-invite-card {
        width: min(420px, 100%); background: #fff; border: 1px solid #c5dce0;
        border-radius: 12px; box-shadow: 0 16px 48px rgba(26,58,66,.22);
        overflow: hidden;
      }
      #${INVITE_ID} .lm-invite-head {
        padding: 18px 18px 12px;
        background: linear-gradient(180deg, #f4fafb, #fff);
        border-bottom: 1px solid #d7e6e9;
      }
      #${INVITE_ID} .lm-invite-brand {
        font-family: ${FONT_HEAD}; font-size: 11px; font-weight: 700;
        letter-spacing: .06em; text-transform: uppercase; color: #54A6A8; margin: 0 0 6px;
      }
      #${INVITE_ID} .lm-invite-title {
        font-family: ${FONT_HEAD}; font-size: 17px; font-weight: 700; color: #2A6A78; margin: 0 0 6px;
      }
      #${INVITE_ID} .lm-invite-body {
        padding: 14px 18px 18px; font-size: 13px; color: #29464e; line-height: 1.45;
      }
      #${INVITE_ID} .lm-invite-actions {
        display: flex; flex-direction: column; gap: 8px; margin-top: 14px;
      }
      #${INVITE_ID} .lm-invite-actions button {
        border: none; border-radius: 8px; padding: 11px 14px; cursor: pointer;
        font-weight: 600; font-size: 13px; font-family: ${FONT_BODY};
      }
      #${INVITE_ID} .lm-invite-primary { background: #2A6A78; color: #fff; }
      #${INVITE_ID} .lm-invite-primary:hover { background: #54A6A8; }
      #${INVITE_ID} .lm-invite-secondary {
        background: #fff; color: #2A6A78; border: 1px solid #2A6A78 !important;
      }
      #${INVITE_ID} .lm-invite-secondary:hover { background: #eef7f8; }
      #${INVITE_ID} .lm-invite-dismiss {
        background: transparent; color: #5a7a82; font-weight: 500; font-size: 12px;
        padding: 8px; text-decoration: underline; text-underline-offset: 2px;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function closeInvite() {
    document.getElementById(INVITE_ID)?.remove();
  }

  /**
   * Tras bajar PDF: invitar a cargar el archivo en Control de prueba o Copiloto.
   */
  function showPostDownloadInvite() {
    injectCss();
    closeInvite();
    const modal = document.createElement('div');
    modal.id = INVITE_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'lm-invite-title');
    modal.innerHTML = `
      <div class="lm-invite-card">
        <div class="lm-invite-head">
          <p class="lm-invite-brand">LegalMev</p>
          <h2 class="lm-invite-title" id="lm-invite-title">PDF listo</h2>
        </div>
        <div class="lm-invite-body">
          <p style="margin:0">
            Cargá el archivo que acabás de bajar en <strong>Control de prueba</strong>
            o en el <strong>Copiloto de Audiencias</strong> para probar las herramientas.
          </p>
          <div class="lm-invite-actions">
            <button type="button" class="lm-invite-primary" data-act="cp">Abrir Control de prueba</button>
            <button type="button" class="lm-invite-secondary" data-act="copilot">Abrir Copiloto de Audiencias</button>
            <button type="button" class="lm-invite-dismiss" data-act="close">Cerrar</button>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(modal);
    modal.querySelector('[data-act="cp"]')?.addEventListener('click', () => {
      openTool('/dashboard/control-prueba');
      closeInvite();
    });
    modal.querySelector('[data-act="copilot"]')?.addEventListener('click', () => {
      openTool('/dashboard/copiloto-audiencias');
      closeInvite();
    });
    modal.querySelector('[data-act="close"]')?.addEventListener('click', closeInvite);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeInvite();
    });
  }

  /**
   * Al detectar expediente: solo avisa al SW para iluminar el ícono (badge !).
   * Las acciones viven en el popup («Bajar en PDF» / «Seguir causa»).
   * Se deja la API para no romper callers.
   */
  function mountFloatingBar(opts) {
    document.getElementById(BAR_ID)?.remove();
    document.getElementById('lm-mon-dl-bar')?.remove();

    const portal = String(opts?.portal || 'LegalMev');
    const meta = String(opts?.detectLabel || 'Expediente detectado');

    try {
      chrome.runtime.sendMessage(
        {
          type: 'EXPEDIENTE_PAGE_DETECTED',
          portal,
          detectLabel: meta,
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch (_) {}

    return null;
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
    document.getElementById('lm-mon-dl-modal')?.remove();
  }

  /**
   * Panel lateral: elegir actuaciones e integrar un PDF único.
   * Sin filtros heurísticos por tipo (poco fiables). Vista fija: todos los movimientos.
   */
  function openPicker(opts) {
    injectCss();
    closeModal();

    let items = Array.isArray(opts.items)
      ? opts.items.map((it, i) => ({
          ...it,
          id: it.id ?? String(i),
          selected: it.selected !== false,
        }))
      : [];

    let busy = false;
    const cancelFlag = { cancelled: false };

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <div class="lm-panel" role="dialog" aria-modal="true" aria-labelledby="lm-dl-title">
        <div class="lm-head">
          <button type="button" class="lm-x" title="Cerrar" aria-label="Cerrar">×</button>
          <p class="lm-brand-mini">LegalMev</p>
          <h2 id="lm-dl-title">${escapeHtml(opts.title || 'Armar exportación')}</h2>
          <p>${escapeHtml(opts.subtitle || 'Elegí qué incluir y descargá un PDF único.')}</p>
        </div>
        <div class="lm-body">
          <div class="lm-warn" style="display:none"></div>
          <div class="lm-loading" id="lm-loading"><div class="lm-spin"></div><span>Leyendo el listado del expediente…</span></div>
          <div id="lm-ready" style="display:none">
            <div class="lm-filter-row">
              <div>
                <label for="lm-cat-filter">Mostrar</label>
                <select id="lm-cat-filter"></select>
              </div>
            </div>
            <div class="lm-tools">
              <button type="button" data-tool="all">Marcar todos</button>
              <button type="button" data-tool="none">Quitar marcas</button>
              <button type="button" data-tool="condoc">Solo con documento</button>
            </div>
            <div class="lm-list" id="lm-list"></div>
            <div class="lm-progress"><i></i></div>
          </div>
        </div>
        <div class="lm-foot">
          <div class="lm-status-inline" id="lm-status">Preparando…</div>
          <button type="button" data-act="cancel">Cerrar</button>
          <button type="button" class="primary" data-act="pdf" disabled>Descargar PDF</button>
        </div>
      </div>`;
    document.documentElement.appendChild(modal);

    const warnEl = modal.querySelector('.lm-warn');
    if (opts.warning) {
      warnEl.style.display = 'block';
      warnEl.textContent = opts.warning;
    }

    modal.querySelector('.lm-x').addEventListener('click', () => {
      cancelFlag.cancelled = true;
      closeModal();
    });
    modal.querySelector('[data-act="cancel"]').addEventListener('click', () => {
      if (busy) {
        cancelFlag.cancelled = true;
        setStatus('Cancelando…');
        return;
      }
      closeModal();
    });
    modal.querySelector('[data-tool="all"]').addEventListener('click', () => {
      for (const it of items) it.selected = true;
      renderList();
      updateActions();
    });
    modal.querySelector('[data-tool="none"]').addEventListener('click', () => {
      for (const it of items) it.selected = false;
      renderList();
      updateActions();
    });
    modal.querySelector('[data-tool="condoc"]')?.addEventListener('click', () => {
      for (const it of items) {
        it.selected = hasDoc(it);
      }
      renderList();
      updateActions();
    });
    modal.querySelector('[data-act="pdf"]').addEventListener('click', () => startExport('pdf'));

    function selectedItems() {
      return items.filter((it) => it.selected);
    }

    let lastIconPctSent = null;
    let lastIconPctAt = 0;

    function notifyIconProgress(pct) {
      if (pct == null) return;
      const n = Math.max(0, Math.min(100, Math.round(pct)));
      const now = Date.now();
      // Evitar inundar el SW; siempre mandar 0/100 o cambios ≥1 %.
      if (n !== 100 && n !== 0 && n === lastIconPctSent && now - lastIconPctAt < 200) return;
      lastIconPctSent = n;
      lastIconPctAt = now;
      try {
        chrome.runtime.sendMessage({ type: 'PICKER_EXPORT_PROGRESS', progreso: n }, () => {
          void chrome.runtime.lastError;
        });
      } catch (_) {}
    }

    function notifyIconProgressEnd() {
      lastIconPctSent = null;
      lastIconPctAt = 0;
      try {
        chrome.runtime.sendMessage({ type: 'PICKER_EXPORT_DONE' }, () => {
          void chrome.runtime.lastError;
        });
      } catch (_) {}
    }

    function setStatus(text) {
      const el = modal.querySelector('#lm-status');
      if (el) el.textContent = text;
    }

    function updateActions() {
      const n = selectedItems().length;
      const pdfBtn = modal.querySelector('[data-act="pdf"]');
      if (!busy) {
        pdfBtn.textContent = n ? `Descargar PDF (${n})` : 'Descargar PDF';
        pdfBtn.disabled = n === 0;
      }
      setStatus(
        n
          ? `${n} incluidos · ${items.length} movimientos`
          : `Ninguno incluido · ${items.length} movimientos`
      );
    }

    function renderFilter() {
      const sel = modal.querySelector('#lm-cat-filter');
      sel.innerHTML = `<option value="all" selected>TODOS LOS MOVIMIENTOS (${items.length})</option>`;
      sel.disabled = true;
      sel.title = 'Se muestran todos los movimientos del expediente';
    }

    function hasDoc(it) {
      return !!(it.hasDoc || it.url || (it.docCount && it.docCount > 0) || /firm/i.test(it.tipo || ''));
    }

    function titleCaseDesc(s) {
      const t = String(s || '').trim();
      if (!t) return 'Actuación';
      if (t === t.toUpperCase() && t.length > 3) {
        return t
          .toLowerCase()
          .replace(/(^|\s|\/|-)\S/g, (c) => c.toUpperCase());
      }
      return t;
    }

    function renderList() {
      const list = modal.querySelector('#lm-list');
      list.innerHTML = items
        .map((it) => {
          const desc = titleCaseDesc(it.descripcion || it.titulo || it.tipo || 'Actuación');
          const adjN = Array.isArray(it.adjuntosMeta)
            ? it.adjuntosMeta.length
            : /adjunto/i.test(it.tipo || '') || it.poseeAdjunto
              ? Math.max(1, (it.docCount || 1) - 1)
              : 0;
          const badge = adjN > 0
            ? `<span class="lm-doc-yes">${adjN} adj.</span>`
            : hasDoc(it)
              ? '<span class="lm-doc-yes">Con doc.</span>'
              : '<span class="lm-doc-no">Sin doc.</span>';
          return `<label class="lm-row" data-id="${escapeHtml(it.id)}">
            <input type="checkbox" data-sel ${it.selected ? 'checked' : ''}/>
            <span class="lm-fecha">${escapeHtml(it.fecha || '')}</span>
            <span class="lm-desc">${escapeHtml(desc)}</span>
            ${badge}
          </label>`;
        })
        .join('');
      list.querySelectorAll('.lm-row').forEach((row) => {
        const id = row.getAttribute('data-id');
        const item = items.find((x) => String(x.id) === String(id));
        const cb = row.querySelector('input[data-sel]');
        cb?.addEventListener('change', () => {
          if (item) item.selected = !!cb.checked;
          updateActions();
        });
      });
    }

    function setBusy(v, label) {
      busy = v;
      const pdfBtn = modal.querySelector('[data-act="pdf"]');
      const cancelBtn = modal.querySelector('[data-act="cancel"]');
      if (v) {
        pdfBtn.textContent = 'Generando PDF…';
        cancelBtn.textContent = 'Cancelar';
        pdfBtn.disabled = true;
      } else {
        cancelBtn.textContent = 'Cerrar';
        updateActions();
      }
    }

    function setProgress(pct, msg) {
      const bar = modal.querySelector('.lm-progress');
      const fill = modal.querySelector('.lm-progress > i');
      if (bar) bar.style.display = 'block';
      if (fill && pct != null) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      if (pct != null) notifyIconProgress(pct);
      if (msg) setStatus(msg);
    }

    async function startExport(mode) {
      const selected = selectedItems();
      if (!selected.length || busy) return;
      cancelFlag.cancelled = false;
      setBusy(true, mode);
      setProgress(2, 'Generando PDF…');
      try {
        await opts.onExport?.({
          mode: 'pdf',
          selectedItems: selected,
          allItems: items,
          setProgress,
          cancelFlag,
        });
        if (!cancelFlag.cancelled) {
          setProgress(100, 'PDF listo.');
          setTimeout(() => {
            closeModal();
            showPostDownloadInvite();
          }, 500);
        }
      } catch (e) {
        setStatus(e?.message || String(e));
        alert(e?.message || String(e));
      } finally {
        notifyIconProgressEnd();
        setBusy(false);
      }
    }

    function showReady() {
      modal.querySelector('#lm-loading').style.display = 'none';
      modal.querySelector('#lm-ready').style.display = 'block';
      renderFilter();
      renderList();
      updateActions();
    }

    if (items.length) showReady();

    return {
      setItems(next, meta = {}) {
        items = (next || []).map((it, i) => ({
          ...it,
          id: it.id ?? String(i),
          selected: it.selected !== false,
        }));
        if (meta.warning) {
          warnEl.style.display = 'block';
          warnEl.textContent = meta.warning;
        }
        if (meta.originLabel) opts.originLabel = meta.originLabel;
        showReady();
      },
      setLoadingMessage(msg) {
        const span = modal.querySelector('#lm-loading span');
        if (span) span.textContent = msg;
      },
      setError(msg) {
        modal.querySelector('#lm-loading').innerHTML =
          `<span style="color:#b42318;font-weight:600">${escapeHtml(msg)}</span>`;
        setStatus(msg);
      },
      close: closeModal,
      getCancelFlag: () => cancelFlag,
    };
  }

  function followResultMessage(resp, fallbackLabel) {
    const label = resp?.case?.nroExpediente || fallbackLabel || '';
    if (resp?.alreadyFollowed) {
      return label
        ? `Esta causa ya está en tu lista: ${label}.`
        : 'Esta causa ya está en tu lista de seguimiento.';
    }
    if (resp?.case?.baselineReady || resp?.baselineReady) {
      return label
        ? `Causa guardada: ${label}. Línea de base OK.`
        : 'Causa guardada para seguimiento. Línea de base OK.';
    }
    return label ? `Causa guardada: ${label}.` : 'Causa guardada para seguimiento.';
  }

  const api = { mountFloatingBar, openPicker, closeModal, closeInvite, showPostDownloadInvite, followResultMessage };
  if (typeof window !== 'undefined') window.LegalMevDownloadUi = api;
  if (typeof self !== 'undefined') self.LegalMevDownloadUi = api;
})();
