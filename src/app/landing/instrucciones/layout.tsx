import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guía de uso y preguntas frecuentes – LegalMev',
  description:
    'Instrucciones paso a paso para usar LegalMev: registro, extensión Chrome, conexión con tu cuenta y exportación de expedientes MEV, PJN, MPBA y Salta a PDF. Preguntas frecuentes.',
};

export default function InstruccionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
