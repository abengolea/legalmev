/**
 * Inyectado en world MAIN (mv.mpba.gov.ar) desde background.js para DataTables/jQuery de la página.
 */
(function () {
  'use strict';
  globalThis.__LEGALMEV_MPBA_DT__ = function (subAction, page) {
    const $ = window.$ || window.jQuery;
    if (!$ || !$('#lista-tramites').length) return { error: 'DataTable no disponible' };
    const dt = $('#lista-tramites').DataTable();
    if (subAction === 'getTotal') {
      const scripts = document.querySelectorAll('script:not([src])');
      for (let i = 0; i < scripts.length; i++) {
        const m = (scripts[i].textContent || '').match(/var\s+length\s*=\s*parseInt\s*\(\s*['"]?(\d+)['"]?\s*\)/);
        if (m) return parseInt(m[1], 10);
      }
      return dt.page.info().recordsTotal || 0;
    }
    if (subAction === 'getPageLen') return dt.page.len();
    if (subAction === 'goToPage' && page !== undefined) {
      dt.page(page).draw('page');
      return true;
    }
    return null;
  };
})();
