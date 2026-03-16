'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDown, Check, Zap, Mail } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.15),transparent)]" />
        <div className="container relative grid lg:grid-cols-2 place-items-center py-20 md:py-32 gap-12">
          <div className="text-center lg:text-start space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              <FileDown className="h-4 w-4" />
              Exportación de expedientes MEV y PJN
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 text-transparent bg-clip-text">
                LegalMev
              </span>
              <br />
              <span className="text-slate-100">Exportá expedientes judiciales a PDF</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto lg:mx-0">
              Instalá la extensión, navegá por MEV o PJN, y descargá expedientes completos en PDF con un solo clic. Simple, rápido y pensado para abogados.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white" asChild>
                <Link href="/register">Registrarse Gratis</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800" asChild>
                <Link href="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
          </div>
          <div className="relative z-10">
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-2 shadow-2xl shadow-emerald-500/5">
              <Image
                src="https://picsum.photos/800/500?random=1"
                width={800}
                height={500}
                alt="Interfaz de exportación de expedientes"
                className="rounded-lg object-cover"
              />
              <div className="absolute -bottom-4 -right-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
                ✓ PDF listo en segundos
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section className="container py-24 sm:py-32">
        <h2 className="text-3xl md:text-4xl font-bold text-center font-headline text-foreground">
          Planes y cuotas de descarga
        </h2>
        <p className="md:w-2/3 mx-auto text-muted-foreground text-center mt-4 mb-16">
          Registrate con tu email, verificá tu correo y tendrás acceso a las primeras descargas. Para uso intensivo, consultá por planes premium o convenios con colegios de abogados.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="border-slate-700/50 bg-slate-900/30">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <FileDown className="h-6 w-6 text-emerald-400" />
              </div>
              <CardTitle className="text-xl font-headline">Plan Gratuito</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Para probar el servicio</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <span className="text-4xl font-bold text-emerald-400">5</span>
                <span className="text-muted-foreground ml-1">descargas en total</span>
              </div>
              <ul className="space-y-3">
                {[
                  'Ideal para evaluar el servicio',
                  'Extensión incluida',
                  '5 PDFs de expedientes (MEV/PJN)',
                  'Verificación de email al registrarte',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/register">Registrarse</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="relative border-emerald-500/50 bg-emerald-950/20">
            <div className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
              Recomendado
            </div>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/30">
                <Zap className="h-6 w-6 text-emerald-300" />
              </div>
              <CardTitle className="text-xl font-headline">Plan Premium</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Pago o convenio con colegio</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <span className="text-4xl font-bold text-emerald-400">100</span>
                <span className="text-muted-foreground ml-1">expedientes por mes</span>
              </div>
              <ul className="space-y-3">
                {[
                  'Soporte prioritario',
                  'Convenios con colegios de abogados',
                  'Renovación cada mes',
                  'Hasta 100 descargas mensuales',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-500" asChild>
                <a href="mailto:contacto@legalmev.com?subject=Solicitud%20Plan%20Premium">
                  <Mail className="h-4 w-4 mr-2" />
                  Contactar para Premium
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-8">
          ¿Sos de un colegio de abogados?{' '}
          <a
            href="mailto:convenios@legalmev.com?subject=Consulta%20convenio%20colegio"
            className="text-emerald-500 hover:text-emerald-400 hover:underline"
          >
            Escríbenos para convenios especiales
          </a>
          .
        </p>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-800 bg-slate-900 py-24">
        <div className="container">
          <h2 className="text-3xl font-bold text-center font-headline mb-12 text-slate-100">
            Cómo funciona
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-400 font-bold text-xl ring-2 ring-emerald-500/30">
                1
              </div>
              <h3 className="font-semibold text-slate-100 text-lg">Registrate</h3>
              <p className="text-base text-slate-300 leading-relaxed max-w-xs mx-auto">
                Creá tu cuenta con tu email. Te enviamos un link para verificar que el correo existe.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-400 font-bold text-xl ring-2 ring-emerald-500/30">
                2
              </div>
              <h3 className="font-semibold text-slate-100 text-lg">Verificá tu email</h3>
              <p className="text-base text-slate-300 leading-relaxed max-w-xs mx-auto">
                Hacé clic en el enlace que te enviamos y tendrás acceso a 5 descargas gratuitas.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-400 font-bold text-xl ring-2 ring-emerald-500/30">
                3
              </div>
              <h3 className="font-semibold text-slate-100 text-lg">Descargá expedientes</h3>
              <p className="text-base text-slate-300 leading-relaxed max-w-xs mx-auto">
                Instalá la extensión, entrá a MEV o PJN y exportá a PDF con un clic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 to-teal-950/50 p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Empezá a exportar expedientes hoy
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Registrate gratis, verificá tu email y recibí tus primeras 5 descargas.
          </p>
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500" asChild>
            <Link href="/register">Crear cuenta gratis</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
