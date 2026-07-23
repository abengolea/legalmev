'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CedulaNotifMedio, ControlPruebaItem, PruebaParte } from '@/types/control-prueba';
import { patchDocumentalEnPoder, intimacionDocumentalActiva } from '@/lib/control-prueba-documental-poder';
import {
  cedulasIntimacionDocumentalDePadre,
} from '@/lib/control-prueba-subprocesos';
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
import { ChevronRight, FileStack, Plus } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  onAddCedula?: (destinatario?: string) => void;
  onFocusSubproceso?: (itemId: string) => void;
  compact?: boolean;
};

const PARTES_OBLIGADAS: PruebaParte[] = ['actor', 'demandado', 'tercero'];

type EnlacesProps = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onAddCedula?: (destinatario?: string) => void;
  onFocusSubproceso?: (itemId: string) => void;
};

/** Enlaces compactos bajo documental en poder (intimación / exhibición parcial). */
export function ControlPruebaCedulasIntimacionDocumentalEnlaces({
  item,
  allItems,
  onAddCedula,
  onFocusSubproceso,
}: EnlacesProps) {
  const intimacionActiva = intimacionDocumentalActiva(String(item.estado));
  const cedulasVinculadas = useMemo(
    () => cedulasIntimacionDocumentalDePadre(allItems, item.id),
    [allItems, item.id],
  );

  if (!intimacionActiva && item.estado !== 'apercibimiento_en_contra') return null;

  const labelCedula = (cedula: ControlPruebaItem, idx: number) => {
    const dest = cedula.diligencia?.destinatario?.trim();
    const base =
      cedulasVinculadas.length > 1 ? `Cédula de intimación ${idx + 1}` : 'Cédula de intimación';
    if (dest) return `${base} · ${dest}`;
    return base;
  };

  if (!intimacionActiva && cedulasVinculadas.length === 0) {
    return (
      <p className="text-[10px] mt-0.5 text-rose-800 leading-snug">
        Apercibimiento en contra — no acompañaron la documental
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
      {cedulasVinculadas.map((cedula, idx) =>
        onFocusSubproceso ? (
          <Button
            key={cedula.id}
            type="button"
            variant="link"
            className="h-auto p-0 text-[10px] text-violet-800 font-normal"
            onClick={() => onFocusSubproceso(cedula.id)}
          >
            {labelCedula(cedula, idx)} →
          </Button>
        ) : (
          <span key={cedula.id} className="text-[10px] text-violet-800">
            {labelCedula(cedula, idx)}
          </span>
        ),
      )}
      {onAddCedula && intimacionActiva && (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-[10px] text-violet-800 font-normal"
          onClick={() => onAddCedula()}
        >
          <Plus className="h-3 w-3 inline mr-0.5 -mt-px" />
          {cedulasVinculadas.length > 0
            ? 'Crear otra cédula'
            : 'Crear cédula de intimación'}
        </Button>
      )}
      {intimacionActiva && cedulasVinculadas.length === 0 && !onAddCedula && (
        <span className="text-[10px] text-violet-800">
          Intimación ordenada — se generará la cédula al guardar
        </span>
      )}
    </div>
  );
}

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
  const intimacionActiva = intimacionDocumentalActiva(String(item.estado));
  const exhibicionParcial = item.estado === 'exhibicion_parcial';
  const apercibimiento = item.estado === 'apercibimiento_en_contra';

  const cedulasVinculadas = useMemo(
    () => cedulasIntimacionDocumentalDePadre(allItems, item.id),
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
        ) : apercibimiento ? (
          <Badge variant="outline" className="text-[10px] border-rose-400 text-rose-900 bg-rose-50">
            Apercibimiento en contra
          </Badge>
        ) : exhibicionParcial ? (
          <Badge variant="outline" className="text-[10px] border-fuchsia-400 text-fuchsia-900 bg-fuchsia-50">
            Exhibición parcial
          </Badge>
        ) : intimacionActiva ? (
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
        La contraparte tiene la documentación. Intimarla a presentarla (cédula). Si responde en forma
        incompleta → <strong>Exhibición parcial</strong> (nueva cédula por faltantes). Si no acompaña →{' '}
        <strong>Apercibimiento en contra</strong>.
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

      {exhibicionParcial && (
        <div>
          <Label className="text-[10px]">Documentación faltante (nueva intimación)</Label>
          <Textarea
            value={dep.documentosFaltantes ?? ''}
            onChange={(e) =>
              onUpdate({
                documentalEnPoder: { ...dep, documentosFaltantes: e.target.value || null },
              })
            }
            rows={2}
            className="mt-1 text-xs min-h-[48px]"
            placeholder="Qué falta acompañar tras la respuesta parcial..."
          />
        </div>
      )}

      {intimacionActiva && (
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

      {!intimacionActiva && !postergada && !apercibimiento && (
        <p className="text-[10px] text-muted-foreground">
          Cuando el tribunal ordene la intimación, cambie el estado a <strong>Intimación ordenada</strong>.
        </p>
      )}

      {(intimacionActiva || apercibimiento) && (
        <div className="border-t border-violet-200/80 pt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs font-medium">
              {exhibicionParcial ? 'Cédulas de intimación (incl. faltantes)' : 'Cédula de intimación'}
            </Label>
            {onAddCedula && intimacionActiva && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => onAddCedula()}
              >
                Agregar cédula
              </Button>
            )}
          </div>

          {cedulasVinculadas.length === 0 ? (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              {exhibicionParcial
                ? 'Al pasar a exhibición parcial se genera una cédula por la documental faltante.'
                : 'Al guardar con intimación ordenada se generará la cédula vinculada en Comunicaciones.'}
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
                    className="flex flex-wrap items-center gap-2 rounded border bg-white/80 px-2 py-1.5 text-[10px]"
                  >
                    <Badge variant="outline" className={cn('text-[9px]', cfg.badgeClass)}>
                      {cfg.label}
                    </Badge>
                    <span className="flex-1 min-w-0 truncate">{hijo.descripcion}</span>
                    {dias != null && (
                      <span
                        className={cn(
                          'shrink-0',
                          alerta ? ALERTA_NIVEL_CONFIG[alerta.nivel].textClass : 'text-muted-foreground',
                        )}
                      >
                        {etiquetaDiasHabiles(dias)}
                      </span>
                    )}
                    {onFocusSubproceso && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => onFocusSubproceso(hijo.id)}
                      >
                        Ir
                        <ChevronRight className="h-3 w-3 ml-0.5" />
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
