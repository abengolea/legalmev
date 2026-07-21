import type { Metadata } from 'next';
import { EXTENSION_NAME } from '@/lib/publisher-info';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: `Soporte — ${EXTENSION_NAME} (extensión Chrome)`,
  description:
    'Página oficial de soporte de la extensión LegalMev para Chrome. Contacto del desarrollador, guías de uso, reporte de problemas y política de privacidad. Exportá expedientes MEV, PJN, MPBA, Salta, Entre Ríos y Tucumán a PDF.',
  path: '/soporte',
});

export default function SoporteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
