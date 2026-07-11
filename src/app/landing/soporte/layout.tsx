import type { Metadata } from 'next';
import { EXTENSION_NAME, SITE_URL } from '@/lib/publisher-info';

export const metadata: Metadata = {
  title: `Soporte — ${EXTENSION_NAME} (extensión Chrome)`,
  description:
    'Página oficial de soporte de la extensión LegalMev para Chrome. Contacto del desarrollador, guías de uso, reporte de problemas y política de privacidad.',
  alternates: {
    canonical: `${SITE_URL}/soporte`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SoporteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
