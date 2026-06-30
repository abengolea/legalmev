'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaItem, TipoTramitePericial } from '@/types/control-prueba';
import {
  movimientosPericialesDePadre,
  PERICIAL_MOVIMIENTO_LABELS,
  ROLES_MOVIMIENTO_MANUAL,
  estadosParaMovimientoPericial,
} from '@/lib/control-prueba-pericial-movimientos';
import { getEstadoConfig } from '@/lib/control-prueba';
import { evaluarAlertaItem, ALERTA_NIVEL_CONFIG } from '@/lib/control-prueba-alertas';
import { diasHabilesHasta, etiquetaDiasHabiles } from '@/lib/control-prueba-plazos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FlaskConical, Plus, Trash2 } from 'lucide-react';

const BOTON_AGREGAR_LABEL: Record<TipoTramitePericial, string> = {
  impugnacion_informe: 'Impugnación',
  aclaracion_perito: 'Aclaración perito',
  dictamen_complementario: 'Dict. complementario',
  dictamen_pericial: 'Dictamen pericial',
  traslado_puntos: 'Traslado puntos',
};

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  onAddMovimiento?: (rol: TipoTramitePericial) => void;
  onUpdateMovimiento?: (movimientoId: string, patch: Partial<ControlPruebaItem>) => void;
  onRemoveMovimiento?: (movimientoId: string) => void;
  compact?: boolean;
};

export function ControlPruebaPericialMovimientosBlock({
  item,
  allItems,
  onAddMovimiento,
  onUpdateMovimiento,
  onRemoveMovimiento,
  compact,
}: Props) {
  const movimientos = useMemo(() => movimientosPericialesDePadre(item.id, allItems), [allItems, item.id]);
  const faseCfg = getEstadoConfig('prueba', String(item.estado), item);
  const impugnaciones = movimientos.filter((m) => m.tipo === 'impugnacion_informe').length;

  return (
    <div className={cn('rounded-lg border border-teal-200 bg-teal-50/40 p-3 space-y-3', compact && 'p-2')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-teal-900">
          <FlaskConical className="h-3.5 w-3.5" />
          Trámite pericial
        </Label>
        <Badge variant="outline" className={cn('text-[10px] border', faseCfg.badgeClass)}>
          {faseCfg.label}
        </Badge>
        {movimientos.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {movimientos.length} movimiento(s)
          </Badge>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Fases: designación → traslado de puntos → dictamen → impugnaciones / aclaraciones / dictamen complementario.
        Marque <strong>Producida</strong> o <strong>Desistida</strong> cuando la prueba pericial esté cerrada.
      </p>

      {item.pericial?.peritoDesignado && (
        <p className="text-[10px] text-teal-800">
          Perito: <strong>{item.pericial.peritoDesignado}</strong>
        </p>
      )}

      <div className="border-t border-teal-200/80 pt-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs font-medium">Movimientos vinculados</Label>
          {onAddMovimiento && (
            <div className="flex flex-wrap gap-1">
              {ROLES_MOVIMIENTO_MANUAL.map((rol) => (
                <Button
                  key={rol}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => onAddMovimiento(rol)}
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  {BOTON_AGREGAR_LABEL[rol]}
                </Button>
              ))}
            </div>
          )}
        </div>

        {movimientos.length === 0 ? (
          <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Sin movimientos. Agregue impugnaciones, aclaraciones del perito o dictámenes complementarios según el
            expediente.
          </p>
        ) : (
          <ul className="space-y-2">
            {movimientos.map((mov) => {
              const cfg = getEstadoConfig('tramite', String(mov.estado), mov);
              const alerta = evaluarAlertaItem(mov);
              const dias = mov.fechaLimite ? diasHabilesHasta(mov.fechaLimite) : null;
              const estados = estadosParaMovimientoPericial(mov);

              return (
                <li
                  key={mov.id}
                  className={cn(
                    'rounded border bg-background p-2 space-y-2 text-xs',
                    alerta?.nivel === 'rojo' && 'border-red-300 bg-red-50/40',
                    alerta?.nivel === 'amarillo' && 'border-amber-300 bg-amber-50/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[11px]">
                        {mov.vinculo?.vinculoLabel ?? PERICIAL_MOVIMIENTO_LABELS[mov.tipo as TipoTramitePericial]}
                      </p>
                      {onUpdateMovimiento ? (
                        <Input
                          value={mov.descripcion}
                          onChange={(e) => onUpdateMovimiento(mov.id, { descripcion: e.target.value })}
                          className="h-7 text-[10px] mt-1"
                        />
                      ) : (
                        <p className="text-[10px] text-muted-foreground truncate">{mov.descripcion}</p>
                      )}
                    </div>
                    {onRemoveMovimiento && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveMovimiento(mov.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {onUpdateMovimiento ? (
                      <div>
                        <Label className="text-[10px]">Estado</Label>
                        <Select
                          value={String(mov.estado)}
                          onValueChange={(v) => onUpdateMovimiento(mov.id, { estado: v })}
                        >
                          <SelectTrigger className="h-8 text-xs mt-0.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {estados.map((e) => {
                              const ec = getEstadoConfig('tramite', e, mov);
                              return (
                                <SelectItem key={e} value={e} className="text-xs">
                                  {ec.label}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]',
                          cfg.badgeClass,
                        )}
                      >
                        {cfg.label}
                      </span>
                    )}
                    {onUpdateMovimiento && (
                      <div>
                        <Label className="text-[10px]">Plazo / fecha límite</Label>
                        <Input
                          type="date"
                          value={mov.fechaLimite ?? ''}
                          onChange={(e) =>
                            onUpdateMovimiento(mov.id, { fechaLimite: e.target.value || null })
                          }
                          className="h-8 text-xs mt-0.5"
                        />
                      </div>
                    )}
                  </div>

                  {dias !== null && alerta && (
                    <p className={cn('text-[10px]', ALERTA_NIVEL_CONFIG[alerta.nivel].textClass)}>
                      {etiquetaDiasHabiles(dias)}
                    </p>
                  )}

                  {onUpdateMovimiento && (
                    <Textarea
                      value={mov.observaciones ?? ''}
                      onChange={(e) => onUpdateMovimiento(mov.id, { observaciones: e.target.value || null })}
                      rows={2}
                      className="text-[10px] min-h-[40px]"
                      placeholder="Observaciones del movimiento..."
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {impugnaciones > 0 && String(item.estado) !== 'en_discusion' && String(item.estado) !== 'producida' && (
          <p className="text-[10px] text-fuchsia-800">
            Hay {impugnaciones} impugnación(es). Considere cambiar la fase a <strong>En discusión</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
