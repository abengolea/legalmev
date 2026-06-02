'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { PaymentHistoryClient } from '@/components/PaymentHistoryClient';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export function ColegioPagosAdminClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const colegioId = searchParams.get('colegioId') ?? '';
  const [colegios, setColegios] = useState<{ id: string; name: string }[]>([]);
  const [loadingColegios, setLoadingColegios] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoadingColegios(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/colegios', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.ok && Array.isArray(json.colegios)) {
          setColegios(
            json.colegios.map((c: { id: string; name?: string }) => ({
              id: c.id,
              name: c.name ?? c.id,
            })),
          );
        }
      } finally {
        setLoadingColegios(false);
      }
    };
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) void load();
      else setLoadingColegios(false);
    });
    return () => unsub();
  }, []);

  const onColegioChange = (id: string) => {
    router.replace(`/dashboard/colegio/pagos?colegioId=${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 max-w-md">
        <Label htmlFor="colegio-pagos-select">Colegio</Label>
        {loadingColegios ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando colegios…
          </div>
        ) : (
          <Select value={colegioId || undefined} onValueChange={onColegioChange}>
            <SelectTrigger id="colegio-pagos-select">
              <SelectValue placeholder="Elegí un colegio" />
            </SelectTrigger>
            <SelectContent>
              {colegios.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {colegioId ? (
        <PaymentHistoryClient variant="colegio" colegioId={colegioId} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Seleccioná un colegio para ver el historial de cuotas abonadas y descargar facturas.
        </p>
      )}
    </div>
  );
}
