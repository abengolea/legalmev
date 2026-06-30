'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaItem } from '@/types/control-prueba';
import {
  ALERTA_NIVEL_CONFIG,
  listarAlertasItems,
  parteLabel,
  resumirAlertas,
  type AlertaNivel,
} from '@/lib/control-prueba-alertas';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleAlert } from 'lucide-react';

type Props = {
  items: ControlPruebaItem[];
  onFocusItem?: (itemId: string) => void;
  compact?: boolean;
};

export function ControlPruebaAlertasPanel({ items, onFocusItem, compact = false }: Props) {
  const alertas = useMemo(() => listarAlertasItems(items), [items]);
  const resumen = useMemo(() => resumirAlertas(alertas), [alertas]);

  const semaforo: { nivel: AlertaNivel; count: number; icon: typeof AlertTriangle }[] = [
    { nivel: 'rojo', count: resumen.rojo, icon: CircleAlert },
    { nivel: 'amarillo', count: resumen.amarillo, icon: AlertTriangle },
    { nivel: 'verde', count: resumen.verde, icon: CheckCircle2 },
    { nivel: 'gris', count: resumen.gris, icon: CalendarClock },
  ];

  const criticas = alertas.filter((a) => a.nivel === 'rojo' || a.nivel === 'amarillo').slice(0, compact ? 5 : 12);

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Alertas y vencimientos
            </CardTitle>
            <CardDescription>
              Plazos en días hábiles (feriados nacionales y feria judicial excluidos)
            </CardDescription>
          </div>
          {resumen.totalRiesgo > 0 && (
            <Badge variant="destructive" className="shrink-0">
              {resumen.totalRiesgo} en riesgo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {semaforo.map(({ nivel, count, icon: Icon }) => {
            const cfg = ALERTA_NIVEL_CONFIG[nivel];
            return (
              <div
                key={nivel}
                className={cn('rounded-lg border p-3', cfg.borderClass, cfg.bgClass)}
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className={cn('h-2 w-2 rounded-full', cfg.dotClass)} />
                  {cfg.label}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={cn('text-2xl font-semibold', cfg.textClass)}>{count}</span>
                  <Icon className={cn('h-4 w-4 opacity-60', cfg.textClass)} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground leading-tight">
                  {nivel === 'rojo' && '≤ 3 días hábiles o vencida'}
                  {nivel === 'amarillo' && '≤ 10 días hábiles'}
                  {nivel === 'verde' && '> 10 días hábiles'}
                  {nivel === 'gris' && 'Sin fecha o pericial/informativa sin plazo'}
                </p>
              </div>
            );
          })}
        </div>

        {criticas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay vencimientos críticos en este expediente.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Requieren atención
            </p>
            <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {criticas.map((a) => {
                const cfg = ALERTA_NIVEL_CONFIG[a.nivel];
                return (
                  <li key={a.itemId}>
                    <button
                      type="button"
                      onClick={() => onFocusItem?.(a.itemId)}
                      className={cn(
                        'w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors hover:ring-1 hover:ring-primary/30',
                        cfg.borderClass,
                        cfg.bgClass,
                        onFocusItem && 'cursor-pointer',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {a.tipoLabel}
                        </Badge>
                        {a.ofrecidaPor && (
                          <Badge variant="secondary" className="text-[10px]">
                            {parteLabel(a.ofrecidaPor)}
                          </Badge>
                        )}
                        <span className={cn('text-xs font-medium ml-auto', cfg.textClass)}>
                          {a.mensaje}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                        {a.descripcion}
                      </p>
                      {a.fechaLimite && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Fecha: {new Date(`${a.fechaLimite}T12:00:00`).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
