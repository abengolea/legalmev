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
  ExternalLink,
  CreditCard,
  Loader2,
  Crown,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { safeResJson } from '@/lib/utils';

type UserData = {
  name?: string;
  email?: string;
  tier?: 'free' | 'premium';
  freeDownloadsUsed?: number;
  downloadsThisMonth?: number;
  monthlyResetAt?: string;
  premiumSource?: 'payment' | 'colegio' | 'admin' | null;
  premiumForever?: boolean;
  colegioName?: string | null;
  colegioSuspended?: boolean;
  subscriptionLapsed?: boolean;
};

export default function DashboardPage() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [premiumLimit, setPremiumLimit] = useState(100);
  const [mercadopagoEnabled, setMercadopagoEnabled] = useState(false);
  const [dlocalEnabled, setDlocalEnabled] = useState(false);
  const [dlocalSubscriptionLink, setDlocalSubscriptionLink] = useState('');
  const [premiumPriceAmount, setPremiumPriceAmount] = useState(0);
  const [contactEmail, setContactEmail] = useState('contacto@legalmev.com');
  const [payingWithMp, setPayingWithMp] = useState(false);
  const [payingWithDlocal, setPayingWithDlocal] = useState(false);
  const [colegiosConvenio, setColegiosConvenio] = useState<string[]>([]);
  const [colegiosConvenioLoaded, setColegiosConvenioLoaded] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const h = typeof window !== 'undefined' ? window.location.hostname : '';
    setIsLocal(h === 'localhost' || h === '127.0.0.1');
  }, []);

  const handlePayWithMercadoPago = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setPayingWithMp(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/payments/create-preference', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{ ok?: boolean; initPoint?: string; error?: string }>(res);
      if (json.ok && json.initPoint) {
        window.location.href = json.initPoint;
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo crear el pago.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo iniciar el pago.' });
    } finally {
      setPayingWithMp(false);
    }
  };

  const handlePayWithDLocal = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setPayingWithDlocal(true);
    try {
      // Si hay link de suscripción configurado, redirigir directamente (cobro recurrente mensual)
      if (dlocalSubscriptionLink) {
        const sep = dlocalSubscriptionLink.includes('?') ? '&' : '?';
        window.location.href = `${dlocalSubscriptionLink}${sep}user_reference=${user.uid}`;
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch('/api/payments/create-dlocal-order', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{ ok?: boolean; redirectUrl?: string; error?: string }>(res);
      if (json.ok && json.redirectUrl) {
        window.location.href = json.redirectUrl;
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo crear el pago.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo iniciar el pago.' });
    } finally {
      setPayingWithDlocal(false);
    }
  };

  useEffect(() => {
    const mp = searchParams.get('mp');
    const dlocal = searchParams.get('dlocal');
    if (mp === 'success') {
      toast({ title: '¡Pago exitoso!', description: 'Tu plan premium está activado.' });
      window.history.replaceState({}, '', '/dashboard');
    } else if (mp === 'pending') {
      toast({ title: 'Pago pendiente', description: 'Te notificaremos cuando se acredite.' });
      window.history.replaceState({}, '', '/dashboard');
    } else if (mp === 'failure') {
      toast({ variant: 'destructive', title: 'Pago rechazado', description: 'Intentá de nuevo o contactanos.' });
      window.history.replaceState({}, '', '/dashboard');
    } else if (dlocal === 'success') {
      toast({ title: '¡Pago exitoso!', description: 'Tu plan premium está activado.' });
      window.history.replaceState({}, '', '/dashboard');
    } else if (dlocal === 'pending') {
      toast({ title: 'Pago pendiente', description: 'Te notificaremos cuando se acredite.' });
      window.history.replaceState({}, '', '/dashboard');
    } else if (dlocal === 'failure') {
      toast({ variant: 'destructive', title: 'Pago rechazado', description: 'Intentá de nuevo o contactanos.' });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams, toast]);

  useEffect(() => {
    fetch('/api/payments/config')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setMercadopagoEnabled(!!json.mercadopagoEnabled);
          setDlocalEnabled(!!json.dlocalEnabled);
          setDlocalSubscriptionLink(json.dlocalSubscriptionLink ?? '');
          setPremiumPriceAmount(json.premiumPriceAmount ?? 0);
          if (json.contactEmail) setContactEmail(json.contactEmail);
        }
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
      // Esperar a que el token esté listo antes de suscribirse (evita permission-denied por race)
      user.getIdToken().then(() => {
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
    fetch('/api/settings/quota')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && typeof json.premiumQuotaPerMonth === 'number')
          setPremiumLimit(json.premiumQuotaPerMonth);
      })
      .catch(() => {});
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
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <p className="text-sm text-muted-foreground">Cargando tu panel…</p>
      </div>
    );
  }

  const tier = userData?.tier ?? 'free';
  const subscriptionLapsed = userData?.subscriptionLapsed === true;
  const freeUsed = userData?.freeDownloadsUsed ?? 0;
  const monthUsed = userData?.downloadsThisMonth ?? 0;
  const freeLimit = subscriptionLapsed ? 0 : 5;

  const isColegioUser = userData?.premiumSource === 'colegio' && userData?.colegioName;
  const isColegioSuspended = Boolean(
    userData?.colegioName &&
    userData?.tier === 'free' &&
    (userData?.colegioSuspended === true || userData?.premiumSource !== 'colegio')
  );
  const premiumForever = userData?.premiumForever === true;
  const monthlyResetAt = userData?.monthlyResetAt;
  const colegioName = userData?.colegioName ?? '';

  const formatRenewalDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold font-headline">
          Hola, {userData?.name?.split(' ')[0] ?? 'usuario'}
        </h1>
        <p className="text-muted-foreground">{userData?.email}</p>
      </div>

      {/* Tu plan — Siempre visible; contenido según tipo de usuario */}
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
                  {' '}· Al día con la matrícula
                </span>
              </>
            ) : isColegioSuspended ? (
              <>
                <span className="text-base font-semibold text-muted-foreground">
                  Plan Gratuito
                </span>
                <span className="text-sm">
                  {' '}· Tu colegio ({colegioName}) tiene convenio con LegalMev, pero informó que no estás al día con la matrícula. Perdés el beneficio premium y quedás con plan gratuito.
                </span>
              </>
            ) : subscriptionLapsed ? (
              <>
                <span className="text-base font-semibold text-destructive">
                  Suscripción vencida
                </span>
                <span className="text-sm">
                  {' '}· Tu pago fue rechazado y no renovaste. Renová para seguir exportando expedientes.
                </span>
              </>
            ) : (
              <>
                <span
                  className={`text-base font-semibold ${tier === 'premium' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {tier === 'premium' ? 'Plan Premium' : 'Plan Gratuito'}
                </span>
                {tier === 'premium' && premiumForever && (
                  <span className="text-sm">
                    {' '}· Premium permanente (asignado por administrador)
                  </span>
                )}
                {tier === 'premium' && !premiumForever && monthlyResetAt && (
                  <span className="text-sm">
                    {' '}· Próxima renovación de cuota: {formatRenewalDate(monthlyResetAt)}
                  </span>
                )}
                {tier === 'free' && !subscriptionLapsed && (
                  <span className="text-sm">
                    {' '}· 5 descargas para probar. Pasá a Premium para más expedientes por mes.
                  </span>
                )}
              </>
            )}
          </CardDescription>
        </CardHeader>
        {/* Opción de suscripción mensual con cobro automático — solo si hay link configurado */}
        {tier === 'premium' &&
          (userData?.premiumSource === 'payment' || (userData?.premiumSource !== 'colegio' && !!monthlyResetAt && !premiumForever)) &&
          dlocalSubscriptionLink &&
          (dlocalEnabled || isLocal) && (
          <CardContent className="pt-0">
            <div className="rounded-lg border border-primary/20 bg-background p-4">
              <p className="text-sm text-muted-foreground mb-3">
                ¿Pagás cada mes manualmente? Pasate a <strong>suscripción con cobro automático</strong> y te debitamos la cuota cada mes sin que tengas que acordarte.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-primary text-primary hover:bg-primary/10"
                disabled={payingWithDlocal}
                onClick={handlePayWithDLocal}
              >
                {payingWithDlocal ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Suscribirme con cobro automático
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Contador de descargas — Card principal destacada */}
      <Card className="border-primary/30 bg-primary/5 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileDown className="h-6 w-6 text-primary" />
            Descargas usadas
          </CardTitle>
          <CardDescription>
            {subscriptionLapsed
              ? 'Tu suscripción venció. Renová para seguir exportando.'
              : tier === 'free'
                ? `Tenés 5 descargas gratuitas. Pasá a premium para ${premiumLimit} por mes.`
                : `Plan premium: ${premiumLimit} expedientes por mes.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${subscriptionLapsed ? 'text-destructive' : 'text-primary'}`}>
              {subscriptionLapsed ? 0 : tier === 'free' ? freeUsed : monthUsed}
            </span>
            <span className="text-muted-foreground text-lg">
              / {subscriptionLapsed ? 0 : tier === 'free' ? freeLimit : premiumLimit}
            </span>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${subscriptionLapsed ? 'bg-destructive' : 'bg-primary'}`}
              style={{
                width: `${subscriptionLapsed ? 100 : Math.min(100, ((tier === 'free' ? freeUsed : monthUsed) / (tier === 'free' ? freeLimit : premiumLimit || 1)) * 100)}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>


      {/* Pasar a Premium - en local siempre se muestra aunque no estén configurados los pagos */}
      {tier !== 'premium' && (mercadopagoEnabled || dlocalEnabled || isLocal) && (
        <Card className={subscriptionLapsed ? 'border-destructive/50 bg-destructive/5' : 'border-primary/30 bg-primary/5'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className={`h-5 w-5 ${subscriptionLapsed ? 'text-destructive' : 'text-primary'}`} />
              {subscriptionLapsed ? 'Renová tu suscripción' : 'Pasá a Premium'}
            </CardTitle>
            <CardDescription>
              {subscriptionLapsed
                ? 'Tu acceso está suspendido. Renová para seguir exportando expedientes.'
                : premiumPriceAmount > 0
                  ? `Pago mensual de $${premiumPriceAmount.toLocaleString()} (IVA incluido). Más expedientes, sin límites para uso intensivo. Elegí tu forma de pago:`
                  : 'Más expedientes por mes, sin límites para uso intensivo. Elegí tu forma de pago:'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {(mercadopagoEnabled || isLocal) && (
              <Button
                className="w-full justify-center h-12 text-base bg-primary hover:bg-primary/90"
                disabled={(mercadopagoEnabled && (payingWithMp || payingWithDlocal)) ?? false}
                onClick={mercadopagoEnabled ? handlePayWithMercadoPago : () => toast({ title: 'En desarrollo', description: 'Los pagos no están configurados aún.' })}
              >
                {payingWithMp ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Pagar con Mercado Pago
                {premiumPriceAmount > 0 && (
                  <span className="ml-2 font-semibold">${premiumPriceAmount.toLocaleString()}/mes · IVA incluido</span>
                )}
              </Button>
            )}
            {(dlocalEnabled || isLocal) && (
              <Button
                variant="outline"
                className="w-full justify-center border-primary text-primary hover:bg-primary/10 h-12 text-base"
                disabled={(dlocalEnabled && (payingWithMp || payingWithDlocal)) ?? false}
                onClick={dlocalEnabled ? handlePayWithDLocal : () => toast({ title: 'En desarrollo', description: 'Los pagos no están configurados aún.' })}
              >
                {payingWithDlocal ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Pagar con DLocal (Notificas SRL)
                {premiumPriceAmount > 0 && (
                  <span className="ml-2 font-semibold">${premiumPriceAmount.toLocaleString()}/mes · IVA incluido</span>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Convenio con colegio - sección secundaria */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Colegios de abogados con convenio
          </CardTitle>
          <CardDescription>
            Si sos de alguno de estos colegios, registrate con tu email y tendrás acceso premium automáticamente.
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
            <p className="text-muted-foreground text-sm">Aún no hay colegios con convenio cargados.</p>
          )}
        </CardContent>
      </Card>

      {/* Instalar extensión - sección secundaria */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Usar la extensión</CardTitle>
          <CardDescription>
            Instalá la extensión LegalMev en Chrome, entrá a MEV o PJN, y exportá expedientes a PDF con un clic.
          </CardDescription>
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
