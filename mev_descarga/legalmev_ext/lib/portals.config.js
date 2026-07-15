/**
 * Configuración centralizada de portales judiciales.
 *
 * INSTRUCCIÓN: Todos los selectores CSS marcados con [VERIFICAR] deben ser
 * confirmados contra el DOM real del portal antes de activar auto-login.
 * Para verificar: abrir el portal, iniciar sesión y usar DevTools → Elements.
 *
 * Los selectores sin marca fueron extraídos del código real de legalmev_ext
 * (content.js y content-pjn.js) y son conocidos como correctos.
 */

(function () {
  'use strict';

  const PORTALS_CONFIG = {

    MEV: {
      name: 'MEV - Mesa de Entradas Virtual (SCBA)',

      urls: {
        base:       'https://mev.scba.gov.ar',
        // [VERIFICAR] URL exacta de la página de login de MEV SCBA
        login:      'https://mev.scba.gov.ar/',
        // Página que muestra los expedientes del letrado tras el login
        afterLogin: 'https://mev.scba.gov.ar/principal.asp',
      },

      // Patrones de URL para detectar estado
      patterns: {
        // Cualquier página de MEV donde se puede operar → autenticado
        authenticated: [
          /mev\.scba\.gov\.ar\/procesales\.asp/i,
          /mev\.scba\.gov\.ar\/principal\.asp/i,
          /mev\.scba\.gov\.ar\/buscar\.asp/i,
        ],
        // Páginas de login o redirección cuando no hay sesión
        loginRequired: [
          /mev\.scba\.gov\.ar\/?$/i,
          /mev\.scba\.gov\.ar\/index\.asp/i,
        ],
      },

      selectors: {
        // ── Formulario de login ───────────────────────────────────────────
        // [VERIFICAR] con DevTools en https://mev.scba.gov.ar/
        loginForm:      'form',
        usernameField:  'input[name="usuario"], input[name="username"], input[name="user"], #usuario, #username',
        passwordField:  'input[type="password"]',
        submitButton:   'input[type="submit"], button[type="submit"]',

        // Departamento judicial (MEV pide seleccionar depto. después del login)
        // [VERIFICAR] con DevTools luego de ingresar credenciales en MEV
        deptSelect:     'select[name="depj"], select[name="departamento"], select[id*="depj"]',

        // ── Detección de sesión activa ────────────────────────────────────
        // Elementos que aparecen solo cuando el usuario está autenticado.
        // Extraídos de content.js (estructura conocida de procesales.asp)
        authenticated: [
          'a[href*="procesales.asp"]',       // link a expedientes en menú lateral
          'a[href*="proveido.asp"]',          // links a actuaciones (solo en sesión)
          'table.marco',                     // tabla principal de MEV autenticado
        ],

        // Elementos que aparecen cuando NO hay sesión (en la página de login)
        // [VERIFICAR] con DevTools en https://mev.scba.gov.ar/ sin sesión
        loginIndicators: [
          'input[name="usuario"]',
          'input[name="username"]',
          '#frmLogin',
        ],

        // Errores de login
        // [VERIFICAR] con DevTools luego de un login fallido en MEV
        loginError: [
          '.error',
          '.alert',
          '[id*="error"]',
          '[class*="error"]',
        ],

        // Texto de error que indica credenciales incorrectas
        // [VERIFICAR] qué texto muestra MEV al fallar el login
        loginErrorText: /contraseña\s+incorrecta|usuario\s+no\s+encontrado|datos\s+incorrectos/i,
      },
    },

    PJN: {
      name: 'PJN - Poder Judicial de la Nación (SCW)',

      urls: {
        base:       'https://scw.pjn.gov.ar',
        // [VERIFICAR] URL exacta de la página de login de SCW PJN
        login:      'https://scw.pjn.gov.ar/scw/login.seam',
        // Página principal de expedientes tras el login (confirmada en content-pjn.js)
        afterLogin: 'https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam',
      },

      patterns: {
        // Cualquier página de SCW que no sea el login → asumimos autenticado
        authenticated: [
          /scw\.pjn\.gov\.ar\/scw\/(?!login)/i,
          /scw\.pjn\.gov\.ar\/scw\/consultaListaRelacionados/i,
          /scw\.pjn\.gov\.ar\/scw\/expediente\.seam/i,
          /scw\.pjn\.gov\.ar\/scw\/main\.seam/i,
        ],
        loginRequired: [
          /scw\.pjn\.gov\.ar\/scw\/login\.seam/i,
          /scw\.pjn\.gov\.ar\/?$/i,
        ],
      },

      selectors: {
        // ── Formulario de login SCW ───────────────────────────────────────
        // [VERIFICAR] con DevTools en https://scw.pjn.gov.ar/scw/login.seam
        // JSF/RichFaces suele usar IDs de componentes con prefijos como "login:"
        loginForm:     'form[id*="login"], form[action*="login"]',
        cuitField:     [
          'input[name*="cuit"]',
          'input[id*="cuit"]',
          'input[name*="usuario"]',
          'input[id*="usuario"]',
          'input[name="login:nombre"]',    // patrón típico JSF
          'input[id="login:nombre"]',
        ].join(', '),
        passwordField: 'input[type="password"]',
        submitButton:  [
          'input[type="submit"]',
          'button[type="submit"]',
          'a[id*="submit"]',
          '.ui-button[id*="login"]',       // PrimeFaces button
        ].join(', '),

        // ── Detección de sesión activa ────────────────────────────────────
        // El CUIT del usuario aparece en el nav cuando está autenticado.
        // Campo CUIT visible en header del portal (referencia DOM).
        // [VERIFICAR] selector exacto con DevTools en SCW autenticado
        authenticated: [
          '[id*="usuarioLogueado"]',        // elemento con el CUIT en el nav
          '.j-usuario',
          '#form\\:cuitUsuario',
          'span[id*="cuit"]',
          // Menú "Mis Expedientes" — solo aparece autenticado
          'a[href*="consultaListaRelacionados"]',
          '.mis-expedientes',
        ],

        // Elementos de la página de login (no autenticado)
        // [VERIFICAR]
        loginIndicators: [
          'input[name*="cuit"]',
          'input[name="login:nombre"]',
          '#login\\:nombre',
        ],

        // Errores de login JSF
        // [VERIFICAR] qué mensajes JSF muestra SCW al fallar
        loginError: [
          '.ui-messages-error',
          '.ui-messages-fatal',
          '.error',
          '[id*="messages"]',
          '.alert-danger',
        ],

        // Texto de error típico de SCW
        // [VERIFICAR]
        loginErrorText: /cuit\s+o\s+contrase|datos\s+incorrectos|usuario\s+no\s+existe|contrase.a\s+incorrecta/i,

        // Tabla de actuaciones (usada para detectar sesión activa desde content-pjn.js)
        expedientesTable: [
          'table#expediente\\:action-table',
          'table[id*="action-table"]',
          '.ui-datatable table',
        ].join(', '),
      },
    },
  };

  if (typeof window !== 'undefined') window.LegalMevPortalsConfig = PORTALS_CONFIG;
  if (typeof self !== 'undefined') self.LegalMevPortalsConfig = PORTALS_CONFIG;
})();
