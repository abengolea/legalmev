'use client';

import { useMemo } from 'react';
import type { ControlPruebaItem } from '@/types/control-prueba';
import { requiereAudienciaPrueba } from '@/lib/control-prueba-audiencia-prueba';
import {
  eventoAudienciaActivoDePrueba,
  eventosAudienciaDePrueba,
} from '@/lib/control-prueba-audiencia-evento';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onFocusSubproceso?: (itemId: string) => void;
  onNuevaAudiencia?: () => void;
};

/** Enlaces bajo confesional/testimonial en prueba ofrecida → audiencia(s) fijada(s). */
export function ControlPruebaAudienciaEventoEnlaces({
  item,
  allItems,
  onFocusSubproceso,
  onNuevaAudiencia,
}: Props) {
  const eventos = useMemo(
    () => eventosAudienciaDePrueba(allItems, item.id),
    [allItems, item.id],
  );

  if (!requiereAudienciaPrueba(item.tipo)) return null;

  const activo = eventoAudienciaActivoDePrueba(allItems, item.id);
  const mostrarNueva =
    onNuevaAudiencia &&
    (item.estado === 'postpuesta_juez' ||
      (item.estado === 'audiencia_fijada' && !activo) ||
      (activo && ['suspendida', 'cancelada'].includes(String(activo.estado))));

  if (eventos.length === 0 && item.estado !== 'audiencia_fijada') {
    return (
      <p className="text-[10px] text-muted-foreground mt-0.5">
        Pendiente fijación de audiencia
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
      {eventos.map((evento) =>
        onFocusSubproceso ? (
          <Button
            key={evento.id}
            type="button"
            variant="link"
            className="h-auto p-0 text-[10px] text-teal-800 font-normal"
            onClick={() => onFocusSubproceso(evento.id)}
          >
            Audiencia vinculada
            {evento.fechaLimite ? ` · ${evento.fechaLimite}` : ''} →
          </Button>
        ) : null,
      )}
      {mostrarNueva && (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-[10px] text-muted-foreground font-normal"
          onClick={onNuevaAudiencia}
        >
          <Plus className="h-3 w-3 inline mr-0.5 -mt-px" />
          Nueva audiencia
        </Button>
      )}
    </div>
  );
}
