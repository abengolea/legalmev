'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CedulaNotifMedio, ControlPruebaItem, PruebaParte } from '@/types/control-prueba';
import { patchDocumentalEnPoder } from '@/lib/control-prueba-documental-poder';
import { hijosDePadre } from '@/lib/control-prueba-subprocesos';
import { getEstadoConfig, PARTE_LABELS, resolveCategoria } from '@/lib/control-prueba';
import { evaluarAlertaItem, ALERTA_NIVEL_CONFIG } from '@/lib/control-prueba-alertas';
import { diasHabilesHasta, etiquetaDiasHabiles } from '@/lib/control-prueba-plazos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ControlPruebaDeferredInput } from '@/components/admin/ControlPruebaDeferredInput';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, FileStack } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  onAddCedula?: (destinatario?: string) => void;
  onFocusSubproceso?: (itemId: string) => void;
  compact?: boolean;
};

const PARTES_OBLIGADAS: PruebaParte[] = ['actor', 'demandado', 'tercero'];

export function ControlPruebaDocumentalEnPoderBlock({
  item,
  allItems,
  onUpdate,
  onAddCedula,
  onFocusSubproceso,
  compact,
}: Props) {
  const dep = item.documentalEnPoder ?? {};
  const postergada = item.estado === 'postpuesta_juez';
  const intimacionOrdenada = item.estado === 'intimacion_ordenada';

  const cedulasVinculadas = useMemo(
    () =>
      hijosDePadre(item.id, allItems).filter(
        (h) => h.vinculo?.rol === 'cedula_intimacion_documental',
      ),
    [allItems, item.id],
  );

  return (
    <div className={cn('rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-3', compact && 'p-2')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-violet-900">
          <FileStack className="h-3.5 w-3.5" />
          Documental en poder de contraparte
        </Label>
        {postergada ? (
          <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-800 bg-orange-50">
            Postergada
          </Badge>
        ) : intimacionOrdenada ? (
          <Badge variant="outline" className="text-[10px] border-violet-400 text-violet-900 bg-violet-50">
            Intimación ordenada
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Sin intimación
          </Badge>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        La contraparte tiene la documentación. El trámite es simple: <strong>intimarla a que la presente</strong>{' '}
        (cédula con plazo de exhibición).
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-[10px]">Parte que detenta la documentación</Label>
          <Select
            value={String(dep.parteConDocumentos ?? 'demandado')}
            onValueChange={(v) =>
              onUpdate({
                documentalEnPoder: { ...dep, parteConDocumentos: v as PruebaParte },
              })
            }
          >
            <SelectTrigger className="h-8 text-xs mt-0.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTES_OBLIGADAS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PARTE_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">Medio de intimación</Label>
          <Select
            value={String(dep.medioIntimacion ?? 'papel')}
            onValueChange={(v) =>
              onUpdate({
                documentalEnPoder: { ...dep, medioIntimacion: v as CedulaNotifMedio },
              })
            }
          >
            <SelectTrigger className="h-8 text-xs mt-0.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="papel">Cédula papel</SelectItem>
              <SelectItem value="electronica">Cédula electrónica</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-[10px]">Documentación en poder de la contraparte</Label>
        <Textarea
          value={dep.documentosDetalle ?? item.descripcion ?? ''}
          onChange={(e) =>
            onUpdate({ documentalEnPoder: { ...dep, documentosDetalle: e.target.value || null } })
          }
          rows={2}
          className="mt-1 text-xs min-h-[48px]"
          placeholder="Ej: extractos bancarios 2022-2024, contrato firmado..."
        />
      </div>

      {intimacionOrdenada && (
        <div>
          <Label className="text-[10px]">Plazo de exhibición</Label>
          <ControlPruebaDeferredInput
            type="date"
            value={dep.plazoPresentacion ?? item.fechaLimite ?? ''}
            onCommit={(plazoPresentacion) => onUpdate(patchDocumentalEnPoder(item, { plazoPresentacion }))}
            className="h-8 text-xs mt-0.5"
          />
        </div>
      )}

      {!intimacionOrdenada && !postergada && (
        <p className="text-[10px] text-muted-foreground">
          Cuando el tribunal ordene la intimación, cambie el estado a <strong>Intimación ordenada</strong>.
        </p>
      )}

      {intimacionOrdenada && (
        <div className="border-t border-violet-200/80 pt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs font-medium">Cédula de intimación</Label>
            {onAddCedula && (
              <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onAddCedula()}>
                Agregar cédula
              </Button>
            )}
          </div>

          {cedulasVinculadas.length === 0 ? (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Al guardar con intimación ordenada se generará la cédula vinculada en Comunicaciones.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {cedulasVinculadas.map((hijo) => {
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
