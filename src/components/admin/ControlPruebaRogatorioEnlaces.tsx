'use client';

import { useMemo } from 'react';
import type { ControlPruebaItem } from '@/types/control-prueba';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ROGATORIO_UI_LABEL,
  esRogatorioMarcado,
  oficiosLey22172DePadre,
  puedeTenerRogatorio,
  tramitesSedeDePadre,
} from '@/lib/control-prueba-rogatorio';
import { Plus } from 'lucide-react';

type EnlacesProps = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onCrearRogatorio?: () => void;
  onFocusSubproceso?: (itemId: string) => void;
};

/** Enlaces bajo la prueba madre cuando hay rogatorio Ley 22.172. */
export function ControlPruebaRogatorioEnlaces({
  item,
  allItems,
  onCrearRogatorio,
  onFocusSubproceso,
}: EnlacesProps) {
  const oficios = useMemo(() => oficiosLey22172DePadre(allItems, item.id), [allItems, item.id]);
  const tramites = useMemo(() => tramitesSedeDePadre(allItems, item.id), [allItems, item.id]);

  if (!puedeTenerRogatorio(item) || !esRogatorioMarcado(item)) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
      {oficios.map((oficio) => {
        const tramite = tramites.find((t) => t.rogatorio?.oficioId === oficio.id);
        const dest = oficio.diligencia?.destinatario?.trim();
        const label = dest && dest !== 'Juez oficiado (Ley 22.172)'
          ? `Rogatorio · ${dest}`
          : 'Rogatorio Ley 22.172';
        return (
          <span key={oficio.id} className="inline-flex flex-wrap items-center gap-x-1.5">
            {onFocusSubproceso ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-[10px] text-teal-800 font-normal"
                onClick={() => onFocusSubproceso(oficio.id)}
              >
                {label} →
              </Button>
            ) : (
              <span className="text-[10px] text-teal-800">{label}</span>
            )}
            {tramite && onFocusSubproceso && (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-[10px] text-teal-700/80 font-normal"
                onClick={() => onFocusSubproceso(tramite.id)}
              >
                Trámite sede →
              </Button>
            )}
          </span>
        );
      })}
      {onCrearRogatorio && (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-[10px] text-muted-foreground font-normal"
          onClick={onCrearRogatorio}
        >
          <Plus className="h-3 w-3 inline mr-0.5 -mt-px" />
          {oficios.length > 0 ? 'Crear otro rogatorio' : 'Crear Rogatorio — Oficio Ley 22.172'}
        </Button>
      )}
    </div>
  );
}

type DestinatarioProps = {
  value: string;
  onChange: (v: string) => void;
  onCrear: () => void;
  compact?: boolean;
};

/** Campo opcional de destinatario antes de crear (en detalle expandido). */
export function ControlPruebaRogatorioCrearForm({
  value,
  onChange,
  onCrear,
  compact,
}: DestinatarioProps) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 space-y-2">
      <p className="text-[10px] font-medium text-teal-900">{ROGATORIO_UI_LABEL}</p>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Crea un oficio (diligenciar como cualquier oficio) y un trámite de sede oficiada 1:1. Podés
        crear varios si hay más de una jurisdicción.
      </p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Juzgado oficiado (ej. Juez Comercial en turno — CABA)"
        className={compact ? 'h-7 text-xs' : 'h-8 text-xs'}
      />
      <Button type="button" size="sm" className="h-7 text-xs" onClick={onCrear}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Crear rogatorio
      </Button>
    </div>
  );
}
