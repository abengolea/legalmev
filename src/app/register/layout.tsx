import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Crear cuenta gratis',
  description:
    'Registrate en LegalMev y exportá expedientes judiciales a PDF sin límites. Extensión Chrome para MEV, PJN, MPBA, Salta, Entre Ríos y Tucumán.',
  path: '/register',
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
