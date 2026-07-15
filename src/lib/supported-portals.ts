/** Portales judiciales compatibles con la extensión LegalMev. */

export const SUPPORTED_PORTALS_SHORT = 'MEV SCBA, PJN, MPBA, Salta, Entre Ríos y Tucumán';

export const SUPPORTED_PORTALS_HERO =
  'Instalá la extensión, navegá por MEV, PJN, MPBA, Salta, Entre Ríos o Tucumán, y descargá expedientes completos en PDF con un solo clic. Simple, rápido y pensado para abogados.';

export const SUPPORTED_PORTALS_LOGIN_EXTENSION =
  'Para descargar expedientes desde la extensión en MEV, PJN, MPBA, Salta, Entre Ríos o Tucumán, iniciá sesión primero en la web.';

export const SUPPORTED_PORTALS_REGISTER =
  'Creá tu cuenta para solicitar acceso a la exportación de expedientes (MEV, PJN, MPBA, Salta, Entre Ríos y Tucumán) a PDF.';

export const SUPPORTED_PORTALS_DASHBOARD =
  'Instalá la extensión LegalMev en Chrome, entrá a MEV, PJN, MPBA, Salta, Entre Ríos o Tucumán, y exportá expedientes a PDF con un clic.';

export const SUPPORTED_PORTALS_EMAIL_TAGLINE =
  'Exportá expedientes a PDF desde MEV, PJN, MPBA, Salta, Entre Ríos y Tucumán';

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
  {
    id: 'entrerios',
    name: 'Entre Ríos',
    detail: 'Mesa Virtual — Poder Judicial de Entre Ríos',
    requiresJudicialLogin: true,
  },
  {
    id: 'tucuman',
    name: 'Tucumán',
    detail: 'Portal SAE — Poder Judicial de Tucumán',
    requiresJudicialLogin: true,
  },
] as const;
