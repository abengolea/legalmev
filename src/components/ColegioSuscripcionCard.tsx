'use client';



import { useEffect, useState } from 'react';

import { auth } from '@/lib/firebase';

import { useToast } from '@/hooks/use-toast';

import { safeResJson } from '@/lib/utils';

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

  const [mercadopagoEnabled, setMercadopagoEnabled] = useState(false);

  const [payingWithMp, setPayingWithMp] = useState(false);



  useEffect(() => {

    fetch('/api/payments/config')

      .then((r) => r.json())

      .then((json) => {

        if (json.ok) setMercadopagoEnabled(!!json.mercadopagoEnabled);

      })

      .catch(() => {});

  }, []);



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



  const handlePayWithMercadoPago = async () => {

    if (!mercadopagoEnabled) {

      toast({

        title: 'Pagos no disponibles',

        description: 'Mercado Pago no está configurado. Contactá al administrador de LegalMev.',

      });

      return;

    }

    const user = auth.currentUser;

    if (!user) return;

    setPayingWithMp(true);

    try {

      const token = await user.getIdToken();

      const res = await fetch('/api/colegio/create-payment-link', {

        method: 'POST',

        headers: { Authorization: `Bearer ${token}` },

      });

      const json = await safeResJson<{

        ok?: boolean;

        initPoint?: string;

        link?: string;

        error?: string;

      }>(res);

      const checkoutUrl = json.initPoint ?? json.link;

      if (json.ok && checkoutUrl) {

        window.location.href = checkoutUrl;

        return;

      }

      toast({

        variant: 'destructive',

        title: 'Error',

        description: json.error ?? 'No se pudo crear el pago.',

      });

    } catch {

      toast({

        variant: 'destructive',

        title: 'Error',

        description: 'No se pudo iniciar el pago.',

      });

    } finally {

      setPayingWithMp(false);

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

          <Button

            className="bg-primary hover:bg-primary/90"

            onClick={handlePayWithMercadoPago}

            disabled={payingWithMp || !colegio.convenioActivo || !mercadopagoEnabled}

          >

            {payingWithMp ? (

              <>

                <Loader2 className="h-4 w-4 mr-2 animate-spin" />

                Generando…

              </>

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

        {colegio.convenioActivo && !mercadopagoEnabled && (

          <p className="text-xs text-amber-700 dark:text-amber-400">

            Los pagos con Mercado Pago no están habilitados en este entorno. Contactá al administrador

            de LegalMev.

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


