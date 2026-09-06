'use client';

import type { ControlPruebaItem, RogatorioHito } from '@/types/control-prueba';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { esTramiteSedeRogatoria, ROGATORIO_UI_LABEL } from '@/lib/control-prueba-rogatorio';
import { Link2 } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  onUpdateHitos: (hitos: RogatorioHito[]) => void;
  onFocusItem?: (itemId: string) => void;
  compact?: boolean;
};

export function ControlPruebaRogatorioTramiteBlock({
  item,
  allItems,
  onUpdate,
  onUpdateHitos,
  onFocusItem,
  compact,
}: Props) {
  if (!esTramiteSedeRogatoria(item) || !item.rogatorio) return null;

  const oficio = allItems.find((i) => i.id === item.rogatorio!.oficioId);
  const hitos = item.rogatorio.hitos ?? [];

  const toggleHito = (hitoId: string, completada: boolean) => {
    const next = hitos.map((h) =>
      h.id === hitoId
        ? {
            ...h,
            completada,
            fecha: completada
              ? h.fecha || new Date().toISOString().slice(0, 10)
              : null,
          }
        : h,
    );
    onUpdateHitos(next);
  };

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 space-y-3">
      <div className="space-y-1">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Trámite sede oficiada — {ROGATORIO_UI_LABEL}
        </Label>
        <p className="text-[10px] text-muted-foreground">
          Producción en el juzgado oficiado. El oficio se diligencia aparte como cualquier oficio.
        </p>
        {oficio && onFocusItem && (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-[10px] text-teal-800"
            onClick={() => onFocusItem(oficio.id)}
          >
            Ver oficio vinculado →
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-[10px]">Juzgado oficiado</Label>
          <Input
            value={item.rogatorio.juzgadoOficiado ?? ''}
            onChange={(e) =>
              onUpdate({
                rogatorio: {
                  ...item.rogatorio!,
                  juzgadoOficiado: e.target.value || null,
                },
              })
            }
            className={compact ? 'h-7 text-xs mt-0.5' : 'h-8 text-xs mt-0.5'}
            placeholder="Juez Comercial en turno — CABA"
          />
        </div>
        <div>
          <Label className="text-[10px]">Expte. formado (rogatoria)</Label>
          <Input
            value={item.rogatorio.expedienteRogatoria ?? ''}
            onChange={(e) =>
              onUpdate({
                rogatorio: {
                  ...item.rogatorio!,
                  expedienteRogatoria: e.target.value || null,
                },
              })
            }
            className={compact ? 'h-7 text-xs mt-0.5' : 'h-8 text-xs mt-0.5'}
            placeholder="Nº en sede oficiada"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px]">Hitos de producción</Label>
        <ul className="space-y-1.5">
          {hitos.map((h) => (
            <li key={h.id} className="flex items-start gap-2">
              <Checkbox
                checked={h.completada}
                onCheckedChange={(v) => toggleHito(h.id, v === true)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug">{h.titulo}</p>
                {h.completada && (
                  <Input
                    type="date"
                    value={h.fecha ?? ''}
                    onChange={(e) => {
                      const next = hitos.map((x) =>
                        x.id === h.id ? { ...x, fecha: e.target.value || null } : x,
                      );
                      onUpdateHitos(next);
                    }}
                    className="h-6 text-[10px] mt-0.5 max-w-[160px]"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
