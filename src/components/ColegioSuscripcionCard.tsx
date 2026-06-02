'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';

type ColegioCuotaInfo = {
  name: string;
  convenioActivo: boolean;
  montoConvenio?: number | null;
  moneda?: string;
};

/** Cartel para pagar la cuota mensual del convenio (responsables de colegio). */
export function ColegioSuscripcionCard() {
  const { toast } = useToast();
  const [colegio, setColegio] = useState<ColegioCuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingWith, setPayingWith] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/colegio/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.ok && json.colegio) {
          setColegio(json.colegio);
        }
      } finally {
        setLoading(false);
      }
    };
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) void load();
      else {
        setColegio(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handlePay = async () => {
    setPayingWith(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/colegio/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok && json.link) {
        window.location.href = json.link;
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: json.error ?? 'No se pudo crear el link de pago.',
        });
        setPayingWith(false);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al crear el pago.',
      });
      setPayingWith(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando cuota del colegio…
      </div>
    );
  }

  if (!colegio) return null;

  if ((colegio.montoConvenio ?? 0) > 0) {
    return (
      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <h4 className="font-medium flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Pagar suscripción mensual
        </h4>
        <p className="text-sm text-muted-foreground">
          Cuota convenio — <strong>{colegio.name}</strong>:{' '}
          <strong>
            {colegio.moneda === 'USD' ? 'US$ ' : '$ '}
            {Number(colegio.montoConvenio).toLocaleString()}
          </strong>
          {colegio.moneda === 'USD' ? ' USD' : ' ARS'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePay} disabled={payingWith || !colegio.convenioActivo}>
            {payingWith ? (
              'Generando...'
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Pagar con Mercado Pago
              </>
            )}
          </Button>
        </div>
        {!colegio.convenioActivo && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            El convenio está suspendido. Contactá al administrador de LegalMev.
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
      <CreditCard className="h-4 w-4 shrink-0" />
      El monto de la suscripción lo define el administrador de LegalMev.
    </p>
  );
}
