'use client';

import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  formatControlPruebaQuotaCopy,
  type ControlPruebaQuotaView,
} from '@/lib/control-prueba-import-ux';

type Props = {
  quota: ControlPruebaQuotaView | null;
};

export function ControlPruebaTrialBanner({ quota }: Props) {
  const copy = quota ? formatControlPruebaQuotaCopy(quota) : null;

  return (
    <Alert className="border-primary/20 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertTitle className="text-sm font-medium">Control de Prueba — Versión de prueba</AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        <p>
          Esta funcionalidad se encuentra en etapa de evaluación y mejora. Tus observaciones nos
          ayudan a perfeccionarla.
        </p>
        {copy ? (
          <p className={copy.exhausted ? 'text-amber-900' : 'text-muted-foreground'}>
            {copy.usedLine}
            {copy.renewalLine ? ` ${copy.renewalLine}` : ''}
            {copy.exhausted ? ' Podés seguir editando los expedientes existentes.' : ''}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
