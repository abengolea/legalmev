'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaItem } from '@/types/control-prueba';
import {
  KANBAN_COLUMNAS,
  columnaDeEstado,
  estadoDefaultDeColumna,
  type KanbanColumnaId,
} from '@/lib/control-prueba-kanban';
import { PARTE_LABELS, TIPO_LABELS } from '@/lib/control-prueba';
import { evaluarAlertaItem, ALERTA_NIVEL_CONFIG } from '@/lib/control-prueba-alertas';
import { tipoIcono } from '@/lib/control-prueba-subtareas';
import { labelTipoPrueba } from '@/lib/control-prueba-pericial';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type Props = {
  items: ControlPruebaItem[];
  onUpdateEstado: (itemId: string, estado: string) => void;
  onFocusItem?: (itemId: string) => void;
};

export function ControlPruebaKanban({ items, onUpdateEstado, onFocusItem }: Props) {
  const [dragItemId, setDragItemId] = useState<string | null>(null);

  const porColumna = useMemo(() => {
    const map: Record<KanbanColumnaId, ControlPruebaItem[]> = Object.fromEntries(
      KANBAN_COLUMNAS.map((c) => [c.id, [] as ControlPruebaItem[]]),
    ) as Record<KanbanColumnaId, ControlPruebaItem[]>;
    for (const item of items) {
      const col = columnaDeEstado(String(item.estado));
      map[col].push(item);
    }
    return map;
  }, [items]);

  const handleDrop = (columnaId: KanbanColumnaId) => {
    if (!dragItemId) return;
    const nuevoEstado = estadoDefaultDeColumna(columnaId);
    onUpdateEstado(dragItemId, nuevoEstado);
    setDragItemId(null);
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-3 pb-4 min-w-max">
        {KANBAN_COLUMNAS.map((col) => (
          <div
            key={col.id}
            className={cn(
              'w-[220px] shrink-0 rounded-lg border bg-muted/30 border-t-4',
              col.colorClass,
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.id)}
          >
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-xs font-semibold">{col.titulo}</span>
              <Badge variant="secondary" className="text-[10px] h-5">
                {porColumna[col.id].length}
              </Badge>
            </div>
            <div className="p-2 space-y-2 min-h-[120px] max-h-[420px] overflow-y-auto">
              {porColumna[col.id].map((item) => {
                const alerta = evaluarAlertaItem(item);
                const parte = PARTE_LABELS[item.ofrecidaPor ?? ''] ?? '';
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragItemId(item.id)}
                    onDragEnd={() => setDragItemId(null)}
                    onClick={() => onFocusItem?.(item.id)}
                    className={cn(
                      'rounded-md border bg-background p-2 text-xs cursor-grab active:cursor-grabbing shadow-sm hover:ring-1 hover:ring-primary/30 transition-shadow',
                      alerta && ALERTA_NIVEL_CONFIG[alerta.nivel].borderClass,
                      dragItemId === item.id && 'opacity-50',
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span>{tipoIcono(item.tipo)}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        #{item.orden}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {labelTipoPrueba(item)}
                      </span>
                    </div>
                    <p className="line-clamp-2 leading-snug">{item.descripcion || 'Sin descripción'}</p>
                    {item.observaciones?.trim() && (
                      <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 italic leading-snug">
                        Obs: {item.observaciones.trim()}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {parte && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[9px]',
                            item.ofrecidaPor === 'actor' && 'bg-[#2A6A78]/10 text-[#2A6A78]',
                            item.ofrecidaPor === 'demandado' && 'bg-[#54A6A8]/15 text-[#2A6A78]',
                          )}
                        >
                          {parte}
                        </Badge>
                      )}
                      {alerta && alerta.nivel !== 'verde' && alerta.nivel !== 'gris' && (
                        <span className={cn('text-[9px] font-medium', ALERTA_NIVEL_CONFIG[alerta.nivel].textClass)}>
                          {alerta.mensaje.replace(/^Prueba #\d+: /, '')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
