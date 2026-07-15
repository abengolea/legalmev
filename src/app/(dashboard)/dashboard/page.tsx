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
  Building2,
  CheckCircle,
  ExternalLink,
  Crown,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { fetchCheckColegio } from '@/lib/check-colegio-client';
import { SUPPORTED_PORTALS_DASHBOARD } from '@/lib/supported-portals';
import { PDF_DOWNLOADS_UNLIMITED } from '@/lib/pdf-downloads-policy';

type UserData = {
  name?: string;
  email?: string;
  tier?: 'free' | 'premium';
  premiumSource?: 'payment' | 'colegio' | 'admin' | 'lifetime' | null;
  premiumForever?: boolean;
  colegioName?: string | null;
  colegioSuspended?: boolean;
};

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactEmail, setContactEmail] = useState('contacto@legalmev.com');
  const [colegiosConvenio, setColegiosConvenio] = useState<string[]>([]);
  const [colegiosConvenioLoaded, setColegiosConvenioLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/payments/config')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.contactEmail) setContactEmail(json.contactEmail);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      user.getIdToken().then((token) => {
        fetchCheckColegio(token).catch(() => {});
        unsubDoc = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            setUserData((snap.data() as UserData) ?? null);
            setLoading(false);
          },
          (err) => {
            console.warn('[Dashboard] Firestore snapshot error:', err.message);
            setLoading(false);
          }
        );
      });
    });

    return () => {
      unsubAuth();
      unsubDoc?.();
    };
  }, []);

  useEffect(() => {
    fetch('/api/colegios-convenio')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && Array.isArray(json.colegios)) setColegiosConvenio(json.colegios);
      })
      .catch(() => {})
      .finally(() => setColegiosConvenioLoaded(true));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
        <p className="text-sm text-muted-foreground">Cargando tu panel…</p>
      </div>
    );
  }

  const isColegioUser = userData?.premiumSource === 'colegio' && userData?.colegioName;
  const colegioName = userData?.colegioName ?? '';
  const showUnlimited = PDF_DOWNLOADS_UNLIMITED || userData?.premiumForever === true;

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold font-headline">
          Hola, {userData?.name?.split(' ')[0] ?? 'usuario'}
        </h1>
        <p className="text-muted-foreground">{userData?.email}</p>
      </div>

      <Card className="border-primary/30 bg-primary/5 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-primary" />
            Tu plan
          </CardTitle>
          <CardDescription>
            {isColegioUser ? (
              <>
                <span className="text-base font-semibold text-primary">
                  Plan Colegio de Abogados {colegioName}
                </span>
                <span className="text-sm">
                  {' '}· Al día con la matrícula · PDFs ilimitados
                </span>
              </>
            ) : (
              <>
                <span className="text-base font-semibold text-primary">
                  Plan Premium de por vida
                </span>
                <span className="text-sm">
                  {' '}· Gratis · Descarga de expedientes a PDF sin límites
                </span>
              </>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-primary/30 bg-primary/5 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileDown className="h-6 w-6 text-primary" />
            Descargas de PDF
          </CardTitle>
          <CardDescription>
            {showUnlimited
              ? 'Exportá todos los expedientes que necesites. No hay cupo mensual ni costo.'
              : 'Consultá tu cuota disponible.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showUnlimited ? (
            <div className="flex items-center gap-3">
              <InfinityIcon className="h-10 w-10 text-primary" />
              <div>
                <p className="text-2xl font-bold text-primary">Ilimitadas</p>
                <p className="text-sm text-muted-foreground">Premium de por vida para todos los usuarios</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Colegios de abogados con convenio
          </CardTitle>
          <CardDescription>
            La exportación a PDF es gratuita para todos. Si pertenecés a un colegio con convenio,
            tu cuenta puede quedar vinculada automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!colegiosConvenioLoaded ? (
            <p className="text-muted-foreground text-sm">Cargando listado…</p>
          ) : colegiosConvenio.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {colegiosConvenio.map((nombre) => (
                <li key={nombre} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  {nombre}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aún no hay colegios con convenio cargados. Consultas:{' '}
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Usar la extensión</CardTitle>
          <CardDescription>{SUPPORTED_PORTALS_DASHBOARD}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/landing/instrucciones">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver instrucciones
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
