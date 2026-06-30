'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaItem } from '@/types/control-prueba';
import { hijosDePadre } from '@/lib/control-prueba-subprocesos';
import { getEstadoConfig, resolveCategoria } from '@/lib/control-prueba';
import { evaluarAlertaItem, ALERTA_NIVEL_CONFIG } from '@/lib/control-prueba-alertas';
import { diasHabilesHasta, etiquetaDiasHabiles } from '@/lib/control-prueba-plazos';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronRight, FileText } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  onFocusSubproceso?: (itemId: string) => void;
  compact?: boolean;
};

export function ControlPruebaDocumentalAutenticidadBlock({
  item,
  allItems,
  onUpdate,
  onFocusSubproceso,
  compact,
}: Props) {
  const doc = item.documental ?? {};
  const autenticidadImpugnada = item.estado === 'autenticidad_impugnada';

  const informativaVinculada = useMemo(
    () =>
      hijosDePadre(item.id, allItems).filter(
        (h) => h.vinculo?.rol === 'informativa_autenticidad' && h.tipo === 'informativa',
      ),
    [allItems, item.id],
  );

  const oficiosVinculados = useMemo(
    () =>
      allItems.filter(
        (h) =>
          h.vinculo?.rol === 'oficio_informativa' &&
          h.categoria === 'diligencia' &&
          h.diligencia?.pruebaVinculadaId === item.id,
      ),
    [allItems, item.id],
  );

  return (
    <div className={cn('rounded-lg border border-fuchsia-200 bg-fuchsia-50/30 p-3 space-y-3', compact && 'p-2')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-fuchsia-900">
          <FileText className="h-3.5 w-3.5" />
          Documental acompañada — autenticidad
        </Label>
        {autenticidadImpugnada ? (
          <Badge variant="outline" className="text-[10px] border-fuchsia-400 text-fuchsia-900 bg-fuchsia-50">
            Autenticidad impugnada
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Sin impugnación
          </Badge>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Documental que esta parte ya acompañó (demanda, contestación o ampliaciones). Si la contraparte{' '}
        <strong>impugna la autenticidad</strong>, el estado pasa a Autenticidad impugnada y se tramita con informativa +
        oficio.
      </p>

      <div>
        <Label className="text-[10px]">Destinatario del oficio informativo</Label>
        <Input
          value={doc.destinatarioOficio ?? ''}
          onChange={(e) =>
            onUpdate({ documental: { ...doc, destinatarioOficio: e.target.value || null } })
          }
          className="h-8 text-xs mt-0.5"
          placeholder="Ej: Banco Galicia, escribano, perito calígrafo..."
        />
      </div>

      {!autenticidadImpugnada && (
        <p className="text-[10px] text-muted-foreground">
          Si la contraparte impugna autenticidad, cambie el estado a <strong>Autenticidad impugnada</strong>.
        </p>
      )}

      {autenticidadImpugnada && (
        <div className="border-t border-fuchsia-200/80 pt-3 space-y-2">
          <Label className="text-xs font-medium">Trámite por impugnación de autenticidad</Label>

          {informativaVinculada.length === 0 && oficiosVinculados.length === 0 ? (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Al guardar se generarán la informativa y el oficio vinculados.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...informativaVinculada, ...oficiosVinculados].map((hijo) => {
                const cfg = getEstadoConfig(resolveCategoria(hijo), String(hijo.estado), hijo);
                const alerta = evaluarAlertaItem(hijo);
                const dias = hijo.fechaLimite ? diasHabilesHasta(hijo.fechaLimite) : null;
                return (
                  <li
                    key={hijo.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-xs',
                      alerta?.nivel === 'rojo' && 'border-red-300 bg-red-50/40',
                      alerta?.nivel === 'amarillo' && 'border-amber-300 bg-amber-50/40',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{hijo.vinculo?.vinculoLabel ?? hijo.descripcion}</p>
                      <p className="text-[10px] text-muted-foreground">
                        <span className={cn('inline-flex items-center gap-1 px-1 rounded border', cfg.badgeClass)}>
                          {cfg.label}
                        </span>
                        {dias !== null && (
                          <span className={cn('ml-1', alerta && ALERTA_NIVEL_CONFIG[alerta.nivel].textClass)}>
                            · {etiquetaDiasHabiles(dias)}
                          </span>
                        )}
                      </p>
                    </div>
                    {onFocusSubproceso && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] shrink-0"
                        onClick={() => onFocusSubproceso(hijo.id)}
                      >
                        Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
