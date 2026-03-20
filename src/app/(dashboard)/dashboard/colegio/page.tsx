'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Upload, FileSpreadsheet, Users, AlertCircle, CreditCard, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Colegio = {
  id: string;
  name: string;
  convenioActivo: boolean;
  membersCount: number;
  members: { email: string; name: string }[];
  montoConvenio?: number | null;
  moneda?: string;
};

export default function ColegioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [colegio, setColegio] = useState<Colegio | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [payingWith, setPayingWith] = useState<'mercadopago' | 'dlocal' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchColegio = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/colegio/me', { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.ok && json.colegio) {
      setColegio(json.colegio);
    } else {
      setColegio(null);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      setLoading(true);
      fetchColegio().finally(() => setLoading(false));
    });
    return () => unsub();
  }, [router]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !colegio) return;

    const ext = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast({
        variant: 'destructive',
        title: 'Formato no válido',
        description: 'Subí un archivo Excel (.xlsx, .xls) o CSV (.csv).',
      });
      return;
    }

    setUploading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();

      const form = new FormData();
      form.append('file', file);
      form.append('colegioId', colegio.id);

      const res = await fetch('/api/colegio/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();

      if (json.ok) {
        toast({
          title: 'Lista actualizada',
          description: json.message,
        });
        await fetchColegio();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: json.error || 'No se pudo procesar el archivo.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al subir.',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePay = async (metodo: 'mercadopago' | 'dlocal') => {
    if (!colegio) return;
    setPayingWith(metodo);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No autenticado');
      const token = await user.getIdToken();
      const res = await fetch('/api/colegio/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ metodo }),
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
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al crear el pago.',
      });
      setPayingWith(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!colegio) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Administración de colegio
            </CardTitle>
            <CardDescription>
              No administrás ningún colegio. Si tu colegio tiene convenio con LegalMev, el administrador debe asignarte como administrador del colegio (agregando tu email a la lista de admins).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contactá a <a href="mailto:convenios@legalmev.com" className="text-primary underline">convenios@legalmev.com</a> para más información.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {colegio.name}
          </CardTitle>
          <CardDescription>
            Administrá la lista de colegiados autorizados a usar LegalMev con acceso premium.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!colegio.convenioActivo && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">El convenio está suspendido. Contactá al administrador de LegalMev.</p>
            </div>
          )}

          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <Users className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{colegio.membersCount} colegiados autorizados</p>
              <p className="text-sm text-muted-foreground">
                Los que ya tienen cuenta reciben premium automático. Los que no, al registrarse.
              </p>
            </div>
          </div>

          {(colegio.montoConvenio ?? 0) > 0 && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Pagar suscripción mensual
              </h4>
              <p className="text-sm text-muted-foreground">
                Cuota convenio: <strong>{colegio.moneda === 'USD' ? 'US$ ' : '$ '}{Number(colegio.montoConvenio).toLocaleString()}</strong>
                {colegio.moneda === 'USD' ? ' USD' : ' ARS'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handlePay('mercadopago')}
                  disabled={!!payingWith}
                >
                  {payingWith === 'mercadopago' ? (
                    'Generando...'
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Pagar con Mercado Pago
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handlePay('dlocal')}
                  disabled={!!payingWith}
                >
                  {payingWith === 'dlocal' ? (
                    'Generando...'
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Pagar con DLocal
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {(!colegio.montoConvenio || colegio.montoConvenio <= 0) && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4 shrink-0" />
              El monto de la suscripción lo define el administrador de LegalMev. Cuando lo configure, aparecerá el botón para abonar.
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Subir lista de autorizados
            </h4>
            <p className="text-sm text-muted-foreground">
              Subí un archivo Excel (.xlsx, .xls) o CSV con columnas <strong>email</strong> y <strong>nombre</strong> (o mail/correo, nombre/name). Reemplaza la lista actual.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading || !colegio.convenioActivo}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !colegio.convenioActivo}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Procesando...' : 'Seleccionar archivo'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
