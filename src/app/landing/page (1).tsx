
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, MessageSquare, Files } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="container grid lg:grid-cols-2 place-items-center py-20 md:py-32 gap-10">
        <div className="text-center lg:text-start space-y-6">
          <main className="text-5xl md:text-6xl font-bold font-headline">
            <h1 className="inline">
              <span className="inline bg-gradient-to-r from-[#64B5F6] to-[#4CAF50] text-transparent bg-clip-text">
                CaseClarity
              </span>{' '}
              el filtro inteligente
            </h1>{' '}
            para bufetes de abogados modernos
          </main>
          <p className="text-xl text-muted-foreground md:w-10/12 mx-auto lg:mx-0">
            Automatiza la captación de clientes, analiza la viabilidad de casos con IA y gestiona todo desde un único panel.
          </p>
          <div className="space-y-4 md:space-y-0 md:space-x-4">
            <Button className="w-full md:w-1/3" asChild>
              <Link href="/register">Empieza Gratis</Link>
            </Button>
          </div>
        </div>
        <div className="z-10">
          <Image
            src="https://picsum.photos/800/600"
            width={800}
            height={600}
            alt="Abogado usando una tablet"
            data-ai-hint="lawyer using tablet"
            className="rounded-lg shadow-lg"
          />
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-24 sm:py-32">
        <h2 className="text-3xl md:text-4xl font-bold text-center font-headline">
          Funcionalidades Principales
        </h2>
        <p className="md:w-1/2 mx-auto text-muted-foreground text-center mt-4 mb-12">
          Descubre cómo CaseClarity puede transformar la gestión de tu bufete, ahorrándote tiempo y optimizando tus recursos.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader className="flex flex-col items-center text-center">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <BrainCircuit className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="font-headline">Análisis de Casos con IA</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              Nuestra IA evalúa la información del cliente para predecir la viabilidad del caso, identificar fortalezas, debilidades y estimar la probabilidad de éxito.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-col items-center text-center">
               <div className="p-4 bg-primary/10 rounded-full mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="font-headline">Integración con WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              Conversa con clientes potenciales de forma automática, recopila información clave del caso y ofrece respuestas instantáneas a través de WhatsApp Business.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-col items-center text-center">
               <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Files className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="font-headline">Dashboard Centralizado</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground">
              Gestiona todos tus casos potenciales desde un panel intuitivo. Prioriza, asigna y toma decisiones informadas con toda la información al alcance de tu mano.
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
