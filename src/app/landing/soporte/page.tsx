import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  EXTENSION_NAME,
  EXTENSION_SHORT_DESCRIPTION,
  PUBLISHER_ADDRESS_LINES,
  PUBLISHER_CONTACT_EMAIL,
  PUBLISHER_CONTACT_MAILTO,
  PUBLISHER_LEGAL_NAME,
  SITE_URL,
} from '@/lib/publisher-info';
import { SUPPORTED_PORTAL_ITEMS } from '@/lib/supported-portals';
import { Check, ExternalLink, Mail, Shield } from 'lucide-react';

const EXTENSION_STORE_URL =
  process.env.NEXT_PUBLIC_EXTENSION_STORE_URL ||
  'https://chrome.google.com/webstore/search/legalmev';

const SALTA_PUBLIC_URL =
  'https://plataforma.justiciasalta.gov.ar/iol-ui/p/expedientes';

/**
 * Página pública de soporte para la extensión LegalMev (Chrome Web Store — Support URL).
 * Requisitos: accesible sin login, contacto del desarrollador, relación clara con el producto,
 * enlace a política de privacidad.
 */
export default function SoportePage() {
  return (
    <article className="container px-5 sm:px-6 lg:px-10 xl:px-12 max-w-3xl py-16 md:py-24">
      <header className="mb-10">
        <p className="text-sm font-medium text-primary mb-2">Extensión para Google Chrome</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Soporte — {EXTENSION_NAME}
        </h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          {EXTENSION_SHORT_DESCRIPTION} Esta es la página oficial de soporte indicada en Chrome Web
          Store.
        </p>
      </header>

      {/* Contacto — requisito principal de Google para Support URL */}
      <section
        className="mb-8 p-6 rounded-lg border border-primary/40 bg-primary/5"
        aria-labelledby="contacto-soporte"
      >
        <div className="flex gap-3">
          <Mail className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <h2 id="contacto-soporte" className="text-lg font-semibold text-foreground">
              Contacto y soporte técnico
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Para consultas sobre la extensión, errores al exportar, cuenta, cuotas o pagos,
              escribinos por email. Respondemos en días hábiles.
            </p>
            <p className="mt-4 text-base">
              <strong className="text-foreground">Email de soporte:</strong>{' '}
              <a
                href={PUBLISHER_CONTACT_MAILTO}
                className="text-primary font-medium hover:underline break-all"
              >
                {PUBLISHER_CONTACT_EMAIL}
              </a>
            </p>
            <Button asChild className="mt-4" size="sm">
              <a href={PUBLISHER_CONTACT_MAILTO}>Enviar email a soporte</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Desarrollador / publicador */}
      <section className="mb-8" aria-labelledby="desarrollador">
        <h2 id="desarrollador" className="text-lg font-semibold text-foreground mb-3">
          Desarrollador
        </h2>
        <address className="not-italic p-4 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground">{PUBLISHER_LEGAL_NAME}</strong>
          <br />
          {PUBLISHER_ADDRESS_LINES.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
          Contacto:{' '}
          <a href={PUBLISHER_CONTACT_MAILTO} className="text-primary hover:underline">
            {PUBLISHER_CONTACT_EMAIL}
          </a>
        </address>
      </section>

      {/* Reportar problema */}
      <section className="mb-10" aria-labelledby="reportar-problema">
        <h2 id="reportar-problema" className="text-lg font-semibold text-foreground mb-3">
          Reportar un problema
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Al contactarnos, incluí la mayor cantidad de detalle posible para ayudarte más rápido:
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1.5 leading-relaxed">
          <li>Versión de la extensión LegalMev (en <code className="text-xs">chrome://extensions</code>)</li>
          <li>Portal judicial (MEV, PJN, MPBA o Salta) y URL del expediente</li>
          <li>Descripción del error o captura de pantalla</li>
          <li>Navegador y sistema operativo (ej. Chrome en Windows 11)</li>
          <li>Email de tu cuenta LegalMev (si aplica)</li>
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-headline">Guía de uso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Instalación, conexión de la extensión, portales compatibles y preguntas frecuentes.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/landing/instrucciones">Ver instrucciones</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-headline">Conectar la extensión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Vinculá la extensión con tu cuenta LegalMev para exportar expedientes.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/extension-connect">Ir a conectar cuenta</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Privacidad — enlace requerido en listing de Chrome Web Store */}
      <section
        className="mb-10 p-5 rounded-lg border border-border flex gap-3"
        aria-labelledby="privacidad"
      >
        <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden />
        <div>
          <h2 id="privacidad" className="font-semibold text-foreground">
            Política de privacidad
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Información sobre qué datos trata la extensión LegalMev y cómo los protegemos.
          </p>
          <Button asChild variant="link" className="px-0 mt-1 h-auto">
            <Link href="/landing/politica-privacidad">Leer política de privacidad</Link>
          </Button>
        </div>
      </section>

      <section className="mb-10" aria-labelledby="portales">
        <h2 id="portales" className="text-xl font-bold font-headline text-foreground mb-4">
          Portales compatibles
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {SUPPORTED_PORTAL_ITEMS.map((portal) => (
            <li key={portal.id} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-foreground">{portal.name}</strong>
                {portal.detail ? ` — ${portal.detail}` : ''}
                {portal.note ? ` (${portal.note})` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Card className="mb-10 border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5">
        <CardHeader>
          <CardTitle className="text-lg font-headline">Salta — consulta pública</CardTitle>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Si ves muchas causas en la lista, abrí un solo expediente antes de exportar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5 leading-relaxed">
            <li>Buscá por nombre o CUIJ en la consulta pública de Salta.</li>
            <li>
              Tocá el ícono{' '}
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded border border-primary text-primary align-middle mx-0.5"
                aria-hidden
              >
                <ExternalLink className="h-3 w-3" />
              </span>{' '}
              (abrir en ventana) junto a <em>EN TRÁMITE</em>.
            </li>
            <li>Abrí la pestaña <strong className="text-foreground">Actuaciones</strong>.</li>
            <li>Exportá desde la extensión LegalMev.</li>
          </ol>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <a href={SALTA_PUBLIC_URL} target="_blank" rel="noopener noreferrer">
                Consulta pública Salta
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/landing/instrucciones#salta">Guía detallada</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <footer className="pt-6 border-t border-border text-xs text-muted-foreground space-y-2">
        <p>
          <strong className="text-foreground">{EXTENSION_NAME}</strong> — {EXTENSION_SHORT_DESCRIPTION}
        </p>
        <p>
          Sitio: <a href={SITE_URL} className="text-primary hover:underline">{SITE_URL}</a>
          {' · '}
          Soporte: <a href={PUBLISHER_CONTACT_MAILTO} className="text-primary hover:underline">{PUBLISHER_CONTACT_EMAIL}</a>
          {' · '}
          <Link href="/landing/politica-privacidad" className="text-primary hover:underline">
            Privacidad
          </Link>
          {' · '}
          <Link href="/landing/bases-y-condiciones" className="text-primary hover:underline">
            Bases y condiciones
          </Link>
        </p>
      </footer>
    </article>
  );
}
