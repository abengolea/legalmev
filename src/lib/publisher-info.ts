/** Datos del publicador para páginas legales y soporte (Chrome Web Store). */
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site-contact';

export const PUBLISHER_LEGAL_NAME = 'NOTIFICAS SRL';

export const PUBLISHER_ADDRESS_LINES = [
  'Colón 12, Primer Piso',
  'San Nicolás de los Arroyos, Provincia de Buenos Aires, Argentina',
] as const;

export const PUBLISHER_CONTACT_EMAIL = CONTACT_EMAIL;
export const PUBLISHER_CONTACT_MAILTO = CONTACT_MAILTO;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://www.legalmev.com.ar';

export const EXTENSION_NAME = 'LegalMev';

export const EXTENSION_SHORT_DESCRIPTION =
  'Extensión para Google Chrome que exporta expedientes judiciales a PDF desde portales oficiales (MEV SCBA, PJN, MPBA y Salta).';
