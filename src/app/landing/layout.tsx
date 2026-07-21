import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { JsonLd } from '@/components/seo/JsonLd';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/site-contact';
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  absoluteUrl,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from '@/lib/seo';
import Link from 'next/link';

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} | ${SITE_TAGLINE} — MEV, PJN, MPBA, Salta, Entre Ríos y Tucumán`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: absoluteUrl('/landing'),
  },
  openGraph: {
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/landing'),
    type: 'website',
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="legalmev-rebrand flex flex-col min-h-screen">
      <JsonLd
        data={[organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd()]}
      />
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-5 sm:px-6 lg:px-10 xl:px-12 flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/landing" className="flex items-center space-x-2">
              <Logo productName="LegalMev" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="flex items-center space-x-2" aria-label="Principal">
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/landing/instrucciones">Ayuda</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/login">Iniciar Sesión</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Registrarse Gratis</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="py-6 md:px-8 md:py-0">
        <div className="container px-5 sm:px-6 lg:px-10 xl:px-12 flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © {new Date().getFullYear()} LegalMev. Todos los derechos reservados.
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:justify-end"
            aria-label="Pie de página"
          >
            <a
              href={CONTACT_MAILTO}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
            <Link
              href="/soporte"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Soporte
            </Link>
            <Link
              href="/landing/instrucciones"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Instrucciones
            </Link>
            <Link
              href="/landing/bases-y-condiciones"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Bases y Condiciones
            </Link>
            <Link
              href="/landing/politica-privacidad"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Política de Privacidad
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
