'use client';

import { useMemo } from 'react';
import type { ControlPruebaItem } from '@/types/control-prueba';
import { esEventoAudienciaPrueba } from '@/lib/control-prueba-audiencia-evento';
import { cedulasAudienciaDeEvento, cedulasAudienciaDePrueba } from '@/lib/control-prueba-subprocesos';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onAddCedula?: (destinatario?: string) => void;
  onFocusSubproceso?: (itemId: string) => void;
};

/** Enlaces de cédulas bajo un evento de audiencia fijada (bloque Audiencias fijadas). */
export function ControlPruebaCedulasAudienciaEnlaces({
  item,
  allItems,
  onAddCedula,
  onFocusSubproceso,
}: Props) {
  const cedulasVinculadas = useMemo(() => {
    if (esEventoAudienciaPrueba(item)) {
      return cedulasAudienciaDeEvento(allItems, item.id);
    }
    return cedulasAudienciaDePrueba(allItems, item.id);
  }, [allItems, item]);

  if (!esEventoAudienciaPrueba(item)) return null;

  const labelCedula = (cedula: ControlPruebaItem) => {
    const dest = cedula.diligencia?.destinatario?.trim();
    if (dest) return `Cédula vinculada · ${dest}`;
    return 'Cédula vinculada';
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
      {cedulasVinculadas.map((cedula) =>
        onFocusSubproceso ? (
          <Button
            key={cedula.id}
            type="button"
            variant="link"
            className="h-auto p-0 text-[10px] text-teal-800 font-normal"
            onClick={() => onFocusSubproceso(cedula.id)}
          >
            {labelCedula(cedula)} →
          </Button>
        ) : null,
      )}
      {onAddCedula && (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-[10px] text-teal-800 font-normal"
          onClick={() => onAddCedula()}
        >
          <Plus className="h-3 w-3 inline mr-0.5 -mt-px" />
          {cedulasVinculadas.length > 0 ? 'Crear otra cédula' : 'Crear cédula'}
        </Button>
      )}
    </div>
  );
}
