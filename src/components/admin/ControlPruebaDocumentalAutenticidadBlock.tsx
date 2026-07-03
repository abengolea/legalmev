'use client';

import { useMemo } from 'react';
import type { ControlPruebaItem } from '@/types/control-prueba';
import { Button } from '@/components/ui/button';
import { oficiosAutenticidadDeDocumental } from '@/lib/control-prueba-subprocesos';
import { Plus } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onAddOficio?: (destinatario?: string) => void;
  onFocusSubproceso?: (itemId: string) => void;
};

/** Enlaces compactos bajo la prueba documental con autenticidad impugnada. */
export function ControlPruebaOficiosAutenticidadEnlaces({
  item,
  allItems,
  onAddOficio,
  onFocusSubproceso,
}: Props) {
  const oficiosVinculados = useMemo(
    () => oficiosAutenticidadDeDocumental(allItems, item.id),
    [allItems, item.id],
  );

  if (item.estado !== 'autenticidad_impugnada') return null;

  const labelOficio = (oficio: ControlPruebaItem) => {
    const dest = oficio.diligencia?.destinatario?.trim();
    if (dest && dest !== 'Oficiado') return `Oficio vinculado · ${dest}`;
    return 'Oficio vinculado';
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
      {oficiosVinculados.map((oficio) =>
        onFocusSubproceso ? (
          <Button
            key={oficio.id}
            type="button"
            variant="link"
            className="h-auto p-0 text-[10px] text-fuchsia-800 font-normal"
            onClick={() => onFocusSubproceso(oficio.id)}
          >
            {labelOficio(oficio)} →
          </Button>
        ) : null,
      )}
      {onAddOficio && (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-[10px] text-muted-foreground font-normal"
          onClick={() => onAddOficio(item.documental?.destinatarioOficio ?? undefined)}
        >
          <Plus className="h-3 w-3 inline mr-0.5 -mt-px" />
          {oficiosVinculados.length > 0 ? 'Crear otro oficio' : 'Crear oficio'}
        </Button>
      )}
    </div>
  );
}
