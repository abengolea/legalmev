'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileDown,
  Zap,
  Building2,
  CheckCircle,
  AlertCircle,
  Mail,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

type UserData = {
  name?: string;
  email?: string;
  tier?: 'free' | 'premium';
  freeDownloadsUsed?: number;
  downloadsThisMonth?: number;
  monthlyResetAt?: string;
};

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setEmailVerified(user.emailVerified ?? false);

      const unsubDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        setUserData((snap.data() as UserData) ?? null);
        setLoading(false);
      });

      return () => unsubDoc();
    });

    return () => unsubAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  const tier = userData?.tier ?? 'free';
  const freeUsed = userData?.freeDownloadsUsed ?? 0;
  const monthUsed = userData?.downloadsThisMonth ?? 0;
  const freeLimit = 5;
  const premiumLimit = 100;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-headline">
          Hola, {userData?.name?.split(' ')[0] ?? 'usuario'}
        </h1>
        <p className="text-muted-foreground">{userData?.email}</p>
      </div>

      {/* Contador de descargas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Descargas usadas
          </CardTitle>
          <CardDescription>
            {tier === 'free'
              ? 'Tenés 5 descargas gratuitas. Pasá a premium para 100 por mes.'
              : 'Plan premium: 100 expedientes por mes.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-emerald-600">
              {tier === 'free' ? freeUsed : monthUsed}
            </span>
            <span className="text-muted-foreground text-lg">
              / {tier === 'free' ? freeLimit : premiumLimit}
            </span>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{
                width: `${Math.min(100, ((tier === 'free' ? freeUsed : monthUsed) / (tier === 'free' ? freeLimit : premiumLimit)) * 100)}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Estado de verificación de email */}
      <Card className={emailVerified ? 'border-emerald-500/30' : 'border-amber-500/30'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {emailVerified ? (
              <>
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Email verificado
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Verificá tu email
              </>
            )}
          </CardTitle>
          <CardDescription>
            {emailVerified
              ? 'Podés descargar expedientes desde la extensión en MEV y PJN.'
              : 'Para habilitar descargas, revisá tu bandeja de entrada y hacé clic en el enlace que te enviamos.'}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Pasar a Premium */}
      {tier !== 'premium' && (
        <Card className="border-emerald-500/30 bg-emerald-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-500" />
              Pasá a Premium
            </CardTitle>
            <CardDescription>
              100 expedientes por mes. Ideal para estudio juridico o uso intensivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
              <a href="mailto:contacto@legalmev.com?subject=Solicitud%20Plan%20Premium">
                <Mail className="h-4 w-4 mr-2" />
                Contactar para Premium
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Convenio con colegio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            ¿Tu colegio tiene convenio?
          </CardTitle>
          <CardDescription>
            Si sos de un colegio de abogados con convenio, contactanos para habilitar tu acceso premium.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="mailto:convenios@legalmev.com?subject=Consulta%20convenio%20colegio">
              Consultar convenios
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Instalar extensión */}
      <Card>
        <CardHeader>
          <CardTitle>Usar la extensión</CardTitle>
          <CardDescription>
            Instalá la extensión LegalMev en Chrome, entrá a MEV o PJN, y exportá expedientes a PDF con un clic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/landing">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver instrucciones
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Link al panel anterior */}
      <p className="text-sm text-muted-foreground">
        <Link href="/dashboard1" className="hover:underline">
          Acceder al panel anterior (Secretaria Jurídica AI)
        </Link>
      </p>
    </div>
  );
}
