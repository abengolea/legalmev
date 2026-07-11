/** Portales judiciales compatibles con la extensión LegalMev (v1.4). */

export const SUPPORTED_PORTALS_SHORT = 'MEV SCBA, PJN, MPBA y Salta';

export const SUPPORTED_PORTALS_HERO =
  'Instalá la extensión, navegá por MEV, PJN, MPBA o Salta, y descargá expedientes completos en PDF con un solo clic. Simple, rápido y pensado para abogados.';

export const SUPPORTED_PORTALS_LOGIN_EXTENSION =
  'Para descargar expedientes desde la extensión en MEV, PJN, MPBA o Salta, iniciá sesión primero en la web.';

export const SUPPORTED_PORTALS_REGISTER =
  'Creá tu cuenta para solicitar acceso a la exportación de expedientes (MEV, PJN, MPBA y Salta) a PDF.';

export const SUPPORTED_PORTALS_DASHBOARD =
  'Instalá la extensión LegalMev en Chrome, entrá a MEV, PJN, MPBA o Salta, y exportá expedientes a PDF con un clic.';

export const SUPPORTED_PORTALS_EMAIL_TAGLINE =
  'Exportá expedientes a PDF desde MEV, PJN, MPBA y Salta';

export const SUPPORTED_PORTAL_ITEMS = [
  {
    id: 'scba',
    name: 'MEV SCBA',
    detail: 'Provincia de Buenos Aires',
    requiresJudicialLogin: true,
  },
  {
    id: 'pjn',
    name: 'PJN',
    detail: 'Poder Judicial de la Nación',
    requiresJudicialLogin: true,
  },
  {
    id: 'mpba',
    name: 'MPBA',
    detail: 'Ministerio Público — Pcia. de Buenos Aires',
    requiresJudicialLogin: true,
  },
  {
    id: 'salta',
    name: 'Salta',
    detail: 'Poder Judicial de Salta',
    requiresJudicialLogin: false,
    note: 'Sin login judicial',
  },
] as const;
