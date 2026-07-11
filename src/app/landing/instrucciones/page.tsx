'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Check, ExternalLink, Mail } from 'lucide-react';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site-contact';

const EXTENSION_STORE_URL =
  process.env.NEXT_PUBLIC_EXTENSION_STORE_URL ||
  'https://chrome.google.com/webstore/search/legalmev';

const SALTA_PUBLIC_URL =
  'https://plataforma.justiciasalta.gov.ar/iol-ui/p/expedientes';

const saltaSteps = [
  'Buscá por nombre, apellido o CUIJ en la consulta pública de Salta.',
  'Se abre la ficha del expediente solo. Entrá a la pestaña Actuaciones.',
  'Abrí LegalMev en Chrome y exportá el PDF.',
];

const steps = [
  {
    num: 1,
    title: 'Creá tu cuenta en LegalMev',
    desc: 'Registrate con tu nombre, apellido y email. Al crear la cuenta recibís 5 descargas gratuitas para probar el servicio.',
    cta: (
      <Button asChild variant="outline" className="mt-4">
        <Link href="/register">Crear cuenta gratis</Link>
      </Button>
    ),
  },
  {
    num: 2,
    title: 'Verificá tu email',
    desc: 'Revisá tu bandeja de entrada (y la carpeta de spam). Abrí el enlace de verificación que te enviamos. Sin este paso la extensión puede pedirte que verifiques antes de exportar.',
    cta: (
      <Button asChild variant="outline" className="mt-4">
        <Link href="/login">Iniciar sesión</Link>
      </Button>
    ),
  },
  {
    num: 3,
    title: 'Instalá la extensión en Chrome',
    desc: 'Abrí Chrome Web Store, buscá LegalMev y hacé clic en «Agregar a Chrome». La extensión solo funciona en Google Chrome o navegadores basados en Chromium.',
    cta: (
      <Button asChild className="mt-4">
        <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">
          Ir a Chrome Web Store
        </a>
      </Button>
    ),
  },
  {
    num: 4,
    title: 'Conectá la extensión a tu cuenta',
    desc: 'Hacé clic en el ícono de LegalMev en la barra de Chrome. Si dice «Conectá tu cuenta», elegí «Abrir legalmev.com.ar e iniciar sesión». Iniciá sesión con el mismo email con el que te registraste. Cuando veas «Cuenta conectada», ya podés usar la extensión.',
    highlight: true,
    cta: (
      <Button asChild className="mt-4">
        <Link href="/extension-connect">Conectar extensión</Link>
      </Button>
    ),
  },
  {
    num: 5,
    title: 'Entrá al portal judicial',
    desc: 'Abrí el expediente en MEV, PJN, MPBA o en la consulta pública de Salta. En MEV, PJN y MPBA tenés que estar logueado en el portal. En Salta no hace falta cuenta judicial: ver la sección específica más abajo.',
  },
  {
    num: 6,
    title: 'Exportá el expediente a PDF',
    desc: 'Con el expediente abierto, hacé clic en el ícono de LegalMev y elegí exportar. El PDF se descargará automáticamente en tu computadora. Cada exportación consume una descarga de tu cuota.',
  },
];

const faqs = [
  {
    q: 'Ya tengo cuenta, validé el email y la extensión está instalada. ¿Qué más tengo que hacer?',
    a: (
      <>
        Te faltan dos pasos: <strong>conectar la extensión a tu cuenta</strong> y{' '}
        <strong>entrar al portal judicial</strong>. Hacé clic en el ícono de LegalMev en Chrome;
        si pide conectar, usá el botón para abrir legalmev.com.ar e iniciá sesión. Luego entrá a
        MEV, PJN, MPBA o Salta, abrí un expediente y exportá desde la extensión.
      </>
    ),
  },
  {
    q: '¿La extensión dice «Conectá tu cuenta» o no me deja exportar?',
    a: (
      <>
        La extensión no está vinculada a tu usuario. Entrá a{' '}
        <Link href="/extension-connect" className="text-primary hover:underline">
          Conectar extensión
        </Link>{' '}
        con tu sesión iniciada, o desde el ícono de la extensión elegí «Abrir legalmev.com.ar e
        iniciar sesión». Debe figurar «Cuenta conectada» antes de exportar.
      </>
    ),
  },
  {
    q: '¿En qué portales funciona LegalMev?',
    a: 'Funciona en MEV SCBA (Provincia de Buenos Aires), Portal del Poder Judicial de la Nación (PJN), Ministerio Público de la Provincia de Buenos Aires (MPBA) y consulta pública del Poder Judicial de Salta. En MEV, PJN y MPBA tenés que estar logueado en el portal y con el expediente abierto. En Salta no hace falta login judicial: seguí los pasos de la sección Salta más abajo.',
  },
  {
    q: '¿Cómo exporto un expediente de Salta si aparecen muchas causas en la lista?',
    a: (
      <>
        La consulta pública de Salta muestra varias causas en una misma pantalla y LegalMev no
        puede saber cuál querés descargar desde ahí. En la fila del expediente, tocá el ícono{' '}
        <strong>↗</strong> (abrir en ventana) al lado de <em>EN TRÁMITE</em>. Eso abre solo ese
        expediente; ahí entrá a <strong>Actuaciones</strong> y exportá con la extensión. Ver el
        apartado <strong>Salta — consulta pública</strong> en esta página.
      </>
    ),
  },
  {
    q: '¿Cuántas descargas tengo con el plan gratuito?',
    a: 'Al registrarte tenés 5 descargas en total para probar el servicio. Podés ver tu cuota restante en el panel de tu cuenta o en el popup de la extensión. Para más descargas, consultá el plan Premium o convenios con colegios de abogados.',
  },
  {
    q: '¿Puedo usar la extensión en más de una computadora?',
    a: 'Por seguridad, cada cuenta se vincula a un solo dispositivo a la vez. Si conectás la extensión en otra PC, la sesión anterior se cierra automáticamente.',
  },
  {
    q: '¿Funciona en Edge, Firefox o Safari?',
    a: 'LegalMev está pensado para Google Chrome. En Edge u otros navegadores basados en Chromium puede funcionar instalando la extensión desde Chrome Web Store, pero recomendamos Chrome para el mejor resultado.',
  },
  {
    q: 'No me llegó el email de verificación',
    a: (
      <>
        Revisá la carpeta de spam o correo no deseado. Si no aparece, iniciá sesión en el sitio y
        pedí reenviar el email de verificación desde tu cuenta. Si el problema continúa, escribinos
        a{' '}
        <a href={CONTACT_MAILTO} className="text-primary hover:underline">
          {CONTACT_EMAIL}
        </a>
        .
      </>
    ),
  },
  {
    q: '¿Necesito pagar para empezar a usar LegalMev?',
    a: 'No. Podés registrarte gratis y usar tus 5 descargas iniciales sin pagar. El plan Premium ($6.000/mes, IVA incluido) es para quienes necesitan hasta 100 expedientes por mes. Algunos colegios de abogados tienen convenio con acceso Premium.',
  },
];

export default function InstruccionesPage() {
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
          Guía de uso y preguntas frecuentes
        </h1>
        <p className="mt-2 text-muted-foreground">
          Todo lo que necesitás para empezar a exportar expedientes judiciales a PDF con LegalMev
        </p>
      </header>

      <section className="mb-12 p-6 rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex gap-3">
          <Mail className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">¿Ya tenés cuenta y la extensión instalada?</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              El paso que suele faltar es <strong className="text-foreground">conectar la extensión</strong>{' '}
              con tu usuario. Después, entrá al portal judicial, abrí un expediente y exportá desde el ícono
              de LegalMev en Chrome.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/extension-connect">Conectar extensión ahora</Link>
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold font-headline text-foreground mb-6">
          Paso a paso
        </h2>
        <div className="space-y-8">
          {steps.map((step) => (
            <Card
              key={step.num}
              className={
                step.highlight
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border'
              }
            >
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
      </section>

      <section className="mb-12">
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5">
          <CardHeader>
            <CardTitle className="text-xl font-headline text-foreground">
              Salta — consulta pública
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              En Salta no necesitás usuario del Poder Judicial: la búsqueda es pública. Pero si
              estás en la <strong className="text-foreground">lista de causas</strong>, la extensión
              no detecta cuál expediente exportar hasta que abras uno en particular.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ol className="space-y-3 text-sm text-muted-foreground leading-relaxed list-decimal pl-5">
              <li>{saltaSteps[0]}</li>
              <li>
                En la fila del expediente que querés descargar, tocá el ícono{' '}
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded border border-primary text-primary text-xs font-bold align-middle mx-0.5"
                  aria-hidden
                >
                  <ExternalLink className="h-3 w-3" />
                </span>{' '}
                (abrir en ventana) junto al cartel <em>EN TRÁMITE</em>.
              </li>
              <li>{saltaSteps[1]}</li>
              <li>{saltaSteps[2]}</li>
            </ol>
            <p className="text-xs text-muted-foreground border-t border-border/60 pt-4">
              El ícono ↗ está a la derecha del cartel amarillo <em>EN TRÁMITE</em>, en cada fila de
              la lista. Si ya abriste el expediente, asegurate de tener visible la pestaña{' '}
              <strong className="text-foreground">Actuaciones</strong> y recargá la página (F5)
              antes de exportar.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={SALTA_PUBLIC_URL} target="_blank" rel="noopener noreferrer">
                Abrir consulta pública de Salta
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

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
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
            Poder Judicial de Salta — consulta pública (sin login judicial)
          </li>
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold font-headline text-foreground mb-2">
          Preguntas frecuentes
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Respuestas a las consultas más habituales de nuestros usuarios.
        </p>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-foreground">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mt-12 p-6 rounded-lg border border-border text-center">
        <h2 className="font-semibold text-foreground mb-2">¿Necesitás más ayuda?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Escribinos y te respondemos a la brevedad.
        </p>
        <Button variant="outline" asChild>
          <a href={CONTACT_MAILTO}>Contactar a {CONTACT_EMAIL}</a>
        </Button>
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
