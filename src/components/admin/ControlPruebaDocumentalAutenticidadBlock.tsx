'use client';

import { useMemo } from 'react';
import type { ControlPruebaItem } from '@/types/control-prueba';
import { Button } from '@/components/ui/button';
import { oficiosAutenticidadDeDocumental } from '@/lib/control-prueba-subprocesos';
import {
  constatacionesJudicialesDeDocumental,
  diligenciasDelegacionConstatacion,
  inferirResolucionAutenticidadDocumental,
} from '@/lib/control-prueba-constatacion-judicial';
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
  const resolucion = useMemo(() => inferirResolucionAutenticidadDocumental(item), [item]);

  const oficiosVinculados = useMemo(
    () => oficiosAutenticidadDeDocumental(allItems, item.id),
    [allItems, item.id],
  );

  const constataciones = useMemo(
    () => constatacionesJudicialesDeDocumental(allItems, item.id),
    [allItems, item.id],
  );

  const mandamientosDelegacion = useMemo(() => {
    const c = constataciones[0];
    if (!c) return [];
    return diligenciasDelegacionConstatacion(allItems, c.id);
  }, [allItems, constataciones]);

  if (item.estado !== 'autenticidad_impugnada') return null;

  const labelOficio = (oficio: ControlPruebaItem) => {
    const dest = oficio.diligencia?.destinatario?.trim();
    if (dest && dest !== 'Oficiado') return `Oficio vinculado · ${dest}`;
    return 'Oficio vinculado';
  };

  const usaConstatacion = resolucion === 'constatacion_judicial';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
      {usaConstatacion &&
        constataciones.map((c) =>
          onFocusSubproceso ? (
            <Button
              key={c.id}
              type="button"
              variant="link"
              className="h-auto p-0 text-[10px] text-teal-800 font-normal"
              onClick={() => onFocusSubproceso(c.id)}
            >
              Constatación judicial vinculada →
            </Button>
          ) : null,
        )}
      {usaConstatacion &&
        mandamientosDelegacion.map((m) =>
          onFocusSubproceso ? (
            <Button
              key={m.id}
              type="button"
              variant="link"
              className="h-auto p-0 text-[10px] text-violet-800 font-normal"
              onClick={() => onFocusSubproceso(m.id)}
            >
              Mandamiento delegación →
            </Button>
          ) : null,
        )}
      {!usaConstatacion &&
        oficiosVinculados.map((oficio) =>
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
      {!usaConstatacion && onAddOficio && (
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
