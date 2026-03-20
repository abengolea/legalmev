import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Instrucciones paso a paso – LegalMev',
  description:
    'Cómo instalar la extensión LegalMev en Chrome y exportar expedientes de MEV o PJN a PDF. Guía detallada con todos los pasos.',
};

export default function InstruccionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
