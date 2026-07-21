import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  SEO_FAQS,
  breadcrumbJsonLd,
  buildPageMetadata,
  faqPageJsonLd,
} from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Guía de uso y preguntas frecuentes',
  description:
    'Instrucciones paso a paso para usar LegalMev: registro, extensión Chrome, conexión con tu cuenta y exportación de expedientes MEV, PJN, MPBA, Salta, Entre Ríos y Tucumán a PDF. Preguntas frecuentes.',
  path: '/landing/instrucciones',
});

export default function InstruccionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={[
          faqPageJsonLd(SEO_FAQS),
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/landing' },
            { name: 'Guía y FAQ', path: '/landing/instrucciones' },
          ]),
        ]}
      />
      {children}
    </>
  );
}
