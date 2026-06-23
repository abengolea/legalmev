'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, FileText, Loader2, Receipt } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ColegioSuscripcionCard } from '@/components/ColegioSuscripcionCard';

export type PagoRow = {
  id: string;
  createdAt: string;
  descripcion?: string;
  monto: number;
  moneda: string;
  estado: string;
  metodo: string;
  periodo?: string;
  referenciaExterna?: string;
  billingHub?: {
    status?: string;
    facturaId?: string | null;
    voucherNumber?: number | null;
    ptoVta?: number | null;
  } | null;
};

export type PaymentHistoryVariant = 'usuario' | 'colegio';

const CONFIG: Record<
  PaymentHistoryVariant,
  {
    listUrl: string;
    invoicePath: (id: string) => string;
    title: string;
    description: string;
    emptyText: string;
    emptyCta: { href: string; label: string } | null;
    showPeriodo: boolean;
  }
> = {
  usuario: {
    listUrl: '/api/user/pagos',
    invoicePath: (id) => `/api/user/invoices/${id}`,
    title: 'Pagos y facturas',
    description:
      'Historial de cobros de tu plan premium. Las facturas se emiten a nombre de Notificas S.R.L. (misma sociedad que opera LegalMev).',
    emptyText: 'Todavía no hay pagos registrados en tu cuenta.',
    emptyCta: { href: '/dashboard', label: 'Ir al panel para contratar Premium' },
    showPeriodo: false,
  },
  colegio: {
    listUrl: '/api/colegio/pagos',
    invoicePath: (id) => `/api/colegio/invoices/${id}`,
    title: 'Cuotas y facturas del colegio',
    description:
      'Historial de cuotas del convenio pagadas por Mercado Pago. Factura fiscal a nombre del colegio (Notificas S.R.L.).',
    emptyText: 'Todavía no hay cuotas registradas para este colegio.',
    emptyCta: null,
    showPeriodo: true,
  },
};

function formatMoney(monto: number, moneda: string) {
  if (moneda === 'USD') {
    return `US$ ${monto.toLocaleString('es-AR')}`;
  }
  return `$ ${monto.toLocaleString('es-AR')}`;
}

function formatFecha(iso: string) {
  try {
    return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: es });
  } catch {
    return iso;
  }
}

function invoiceBadge(billingHub?: PagoRow['billingHub']) {
  const status = billingHub?.status;
  if (status === 'issued') {
    return <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Factura emitida</Badge>;
  }
  if (status === 'pending') {
    return <Badge variant="secondary">Factura pendiente</Badge>;
  }
  if (status === 'failed') {
    return <Badge variant="destructive">Factura pendiente de emisión</Badge>;
  }
  return <Badge variant="outline">Sin factura</Badge>;
}

export function PaymentHistoryClient({
  variant,
  colegioId,
}: {
  variant: PaymentHistoryVariant;
  /** Opcional: superadmin elige colegio; responsable usa su colegio automáticamente. */
  colegioId?: string;
}) {
  const cfg = CONFIG[variant];
  const searchParams = useSearchParams();
  const listUrl =
    variant === 'colegio' && colegioId
      ? `/api/colegio/pagos?colegioId=${encodeURIComponent(colegioId)}`
      : cfg.listUrl;
  const { toast } = useToast();
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [colegioName, setColegioName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);

  const loadPagos = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.pagos)) {
        setPagos(json.pagos);
        if (variant === 'colegio' && typeof json.colegioName === 'string') {
          setColegioName(json.colegioName);
        }
      } else {
        setPagos([]);
        if (!json.ok && json.error) {
          toast({
            variant: 'destructive',
            title: 'Sin acceso',
            description: String(json.error),
          });
        }
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar el historial de pagos.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, listUrl, variant, colegioId]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) void loadPagos();
      else setLoading(false);
    });
    return () => unsub();
  }, [loadPagos]);

  useEffect(() => {
    if (variant !== 'colegio') return;
    const mp = searchParams.get('mp');
    if (mp === 'success') {
      toast({
        title: '¡Pago exitoso!',
        description: 'La cuota del colegio fue registrada. La factura aparecerá en el historial cuando se emita.',
      });
      window.history.replaceState({}, '', '/dashboard/pagos');
      void loadPagos();
    } else if (mp === 'pending') {
      toast({
        title: 'Pago pendiente',
        description: 'Te notificaremos cuando Mercado Pago acredite el pago.',
      });
      window.history.replaceState({}, '', '/dashboard/pagos');
    } else if (mp === 'failure') {
      toast({
        variant: 'destructive',
        title: 'Pago rechazado',
        description: 'Intentá de nuevo o contactá al administrador de LegalMev.',
      });
      window.history.replaceState({}, '', '/dashboard/pagos');
    }
  }, [searchParams, toast, variant, loadPagos]);

  const handleDownloadInvoice = async (pago: PagoRow) => {
    const user = auth.currentUser;
    if (!user) return;
    if (pago.metodo !== 'mercadopago' || !pago.referenciaExterna) {
      toast({
        variant: 'destructive',
        title: 'Factura no disponible',
        description: 'Solo los pagos por Mercado Pago tienen factura electrónica.',
      });
      return;
    }

    setInvoiceLoadingId(pago.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(cfg.invoicePath(encodeURIComponent(pago.id)), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === 'string' ? data.error : 'No se pudo descargar la factura.',
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const pv = String(pago.billingHub?.ptoVta ?? 0).padStart(5, '0');
      const nro = String(pago.billingHub?.voucherNumber ?? 0).padStart(8, '0');
      a.href = url;
      a.download = `factura-legalmev-${pv}-${nro}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      void loadPagos();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo bajar la factura',
        description: error instanceof Error ? error.message : 'Probá de nuevo en un momento.',
      });
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-7 w-7 text-primary" />
          {cfg.title}
        </h1>
        <p className="text-muted-foreground mt-1">
          {colegioName ? (
            <>
              <span className="font-medium text-foreground">{colegioName}</span>
              {' — '}
              {cfg.description}
            </>
          ) : (
            cfg.description
          )}
        </p>
      </div>

      {variant === 'colegio' && !colegioId ? <ColegioSuscripcionCard /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {variant === 'colegio' ? 'Historial de cuotas' : 'Historial de pagos'}
          </CardTitle>
          <CardDescription>
            Descargá el comprobante fiscal en PDF cuando el estado indique factura emitida. Si está
            pendiente, el botón intentará generarla automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando pagos…
            </div>
          ) : pagos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground px-4">
              <FileText className="h-10 w-10 opacity-40" />
              <p>{cfg.emptyText}</p>
              {cfg.emptyCta ? (
                <Button variant="outline" asChild>
                  <a href={cfg.emptyCta.href}>{cfg.emptyCta.label}</a>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-auto rounded-md border sm:border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    {cfg.showPeriodo ? <TableHead>Período</TableHead> : null}
                    <TableHead>Estado pago</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.map((pago) => {
                    const canInvoice =
                      pago.metodo === 'mercadopago' &&
                      !!pago.referenciaExterna &&
                      pago.estado === 'completado';
                    const isLoading = invoiceLoadingId === pago.id;

                    return (
                      <TableRow key={pago.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatFecha(pago.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="font-medium">
                            {pago.descripcion || (variant === 'colegio' ? 'Cuota convenio' : 'Pago LegalMev')}
                          </span>
                          <p className="text-xs text-muted-foreground capitalize">{pago.metodo}</p>
                        </TableCell>
                        {cfg.showPeriodo ? (
                          <TableCell className="text-sm whitespace-nowrap">
                            {pago.periodo || '—'}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <Badge variant={pago.estado === 'completado' ? 'default' : 'secondary'}>
                            {pago.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>{invoiceBadge(pago.billingHub)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(pago.monto, pago.moneda)}
                        </TableCell>
                        <TableCell>
                          {canInvoice ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={isLoading}
                              onClick={() => void handleDownloadInvoice(pago)}
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              <span className="ml-2">{isLoading ? 'Preparando…' : 'Factura PDF'}</span>
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
