'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

const EXTENSION_STORE_URL =
  process.env.NEXT_PUBLIC_EXTENSION_STORE_URL ||
  'https://chrome.google.com/webstore/search/legalmev';

export default function InstruccionesPage() {
  const steps = [
    {
      num: 1,
      title: 'Instalá la extensión en Chrome',
      desc: 'Abrí el enlace de Chrome Web Store y hacé clic en "Agregar a Chrome" para instalar LegalMev.',
      cta: (
        <Button asChild className="mt-4">
          <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">
            Ir a Chrome Web Store
          </a>
        </Button>
      ),
    },
    {
      num: 2,
      title: 'Conectá la extensión a tu cuenta',
      desc: 'Hacé clic en el ícono de LegalMev en la barra de Chrome. Si no tenés cuenta, registrate primero en el sitio. Luego hacé clic en "Abrir legalmev.com.ar e iniciar sesión" para vincular la extensión con tu usuario.',
      cta: (
        <Button asChild variant="outline" className="mt-4">
          <Link href="/extension-connect">Conectar extensión</Link>
        </Button>
      ),
    },
    {
      num: 3,
      title: 'Entrá a MEV o PJN',
      desc: 'Iniciá sesión en el portal judicial donde tengas el expediente: MEV SCBA (Buenos Aires), Portal PJN (Nación) o MPBA (Ministerio Público). La extensión solo funciona cuando ya estás autenticado en esos portales.',
    },
    {
      num: 4,
      title: 'Exportá el expediente a PDF',
      desc: 'Con el expediente abierto en MEV o PJN, hacé clic en el ícono de LegalMev en la barra de Chrome y elegí la opción de exportar. El PDF se descargará automáticamente.',
    },
  ];

  return (
    <article className="container px-5 sm:px-6 lg:px-10 xl:px-12 max-w-3xl py-16 md:py-24">
      <div className="mb-8">
        <Button variant="ghost" asChild>
          <Link href="/landing" className="text-muted-foreground hover:text-foreground">
            ← Volver al inicio
          </Link>
        </Button>
      </div>

      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Instrucciones paso a paso
        </h1>
        <p className="mt-2 text-muted-foreground">
          Cómo instalar y usar la extensión LegalMev para exportar expedientes a PDF
        </p>
      </header>

      <div className="space-y-8">
        {steps.map((step) => (
            <Card key={step.num} className="border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary font-bold">
                    {step.num}
                  </div>
                  <CardTitle className="text-lg font-headline">{step.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                {step.cta}
              </CardContent>
            </Card>
        ))}
      </div>

      <section className="mt-12 p-6 rounded-lg bg-muted/50 border border-border">
        <h2 className="font-semibold text-foreground mb-2">Portales compatibles</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
            MEV SCBA (Provincia de Buenos Aires)
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
            Portal del Poder Judicial de la Nación (PJN)
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
            Ministerio Público de la Provincia de Buenos Aires (MPBA)
          </li>
        </ul>
      </section>

      <div className="mt-12 flex flex-col sm:flex-row gap-4">
        <Button asChild>
          <Link href="/register">Crear cuenta gratis</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/landing">Ver planes y cuotas</Link>
        </Button>
      </div>
    </article>
  );
}
