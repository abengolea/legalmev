import type { PruebaEstado } from '@/types/control-prueba';
import { PERICIAL_FASES_EN_TRAMITE } from '@/lib/control-prueba-pericial-movimientos';

export type KanbanColumnaId =
  | 'en_produccion'
  | 'producida'
  | 'desistida'
  | 'no_admitida';

export type KanbanColumna = {
  id: KanbanColumnaId;
  titulo: string;
  estados: readonly PruebaEstado[];
  colorClass: string;
};

export const KANBAN_COLUMNAS: KanbanColumna[] = [
  {
    id: 'en_produccion',
    titulo: 'En producción',
    estados: ['pendiente_produccion', 'postpuesta_juez', 'audiencia_fijada', 'intimacion_ordenada', 'autenticidad_impugnada'],
    colorClass: 'border-t-amber-500',
  },
  {
    id: 'producida',
    titulo: 'Producida',
    estados: ['producida'],
    colorClass: 'border-t-emerald-500',
  },
  {
    id: 'desistida',
    titulo: 'Desistida',
    estados: ['desistida'],
    colorClass: 'border-t-gray-400',
  },
  {
    id: 'no_admitida',
    titulo: 'No admitida',
    estados: ['no_admitida'],
    colorClass: 'border-t-red-500',
  },
];

const ESTADO_A_COLUMNA = new Map<PruebaEstado, KanbanColumnaId>();
for (const col of KANBAN_COLUMNAS) {
  for (const e of col.estados) {
    ESTADO_A_COLUMNA.set(e, col.id);
  }
}

export function columnaDeEstado(estado: string): KanbanColumnaId {
  if ((PERICIAL_FASES_EN_TRAMITE as readonly string[]).includes(estado)) {
    return 'en_produccion';
  }
  return ESTADO_A_COLUMNA.get(estado as PruebaEstado) ?? 'en_produccion';
}

export function estadoDefaultDeColumna(columnaId: KanbanColumnaId): PruebaEstado {
  const col = KANBAN_COLUMNAS.find((c) => c.id === columnaId);
  return col?.estados[0] ?? 'pendiente_produccion';
}

export function columnaConfig(id: KanbanColumnaId): KanbanColumna {
  return KANBAN_COLUMNAS.find((c) => c.id === id) ?? KANBAN_COLUMNAS[0];
}
