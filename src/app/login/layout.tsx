import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Iniciar sesión',
  description:
    'Iniciá sesión en LegalMev para conectar la extensión Chrome y exportar expedientes judiciales a PDF.',
  path: '/login',
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
