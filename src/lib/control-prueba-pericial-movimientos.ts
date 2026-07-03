import type {
  ControlPruebaItem,
  SubprocesoRol,
  SubprocesoVinculo,
  TipoTramitePericial,
} from '@/types/control-prueba';
import {
  ACLARACION_DICTAMEN_ESTADOS,
  IMPUGNACION_INFORME_ESTADOS,
  PERICIAL_ESTADOS,
  TIPOS_TRAMITE_PERICIAL,
  TRASLADO_PUNTOS_ESTADOS,
} from '@/types/control-prueba';
import { resolveCategoria, type EstadoStyle } from '@/lib/control-prueba';
import { esCierrePrueba } from '@/lib/control-prueba-cierre';
import { itemCuentaComoAudienciaFijadaEnFiltro } from '@/lib/control-prueba-audiencia-prueba';
import { hijosDePadre } from '@/lib/control-prueba-subprocesos';

export const PERICIAL_MOVIMIENTO_LABELS: Record<TipoTramitePericial, string> = {
  impugnacion_informe: 'Impugnación al informe',
  aclaracion_perito: 'Aclaraciones del perito',
  dictamen_complementario: 'Dictamen complementario',
  dictamen_pericial: 'Dictamen pericial',
  traslado_puntos: 'Traslado de puntos periciales',
};

/** Roles que el usuario puede agregar manualmente en v1 */
export const ROLES_MOVIMIENTO_MANUAL: TipoTramitePericial[] = [
  'impugnacion_informe',
  'aclaracion_perito',
  'dictamen_complementario',
];

export function esPericialPadre(item: Pick<ControlPruebaItem, 'categoria' | 'tipo'>): boolean {
  return resolveCategoria(item as ControlPruebaItem) === 'prueba' && item.tipo === 'pericial';
}

export function esMovimientoPericial(item: Pick<ControlPruebaItem, 'categoria' | 'tipo' | 'vinculo'>): boolean {
  if (resolveCategoria(item as ControlPruebaItem) !== 'tramite') return false;
  if (!(TIPOS_TRAMITE_PERICIAL as readonly string[]).includes(item.tipo)) return false;
  return item.vinculo?.parentTipo === 'pericial';
}

export function movimientosPericialesDePadre(parentId: string, items: ControlPruebaItem[]): ControlPruebaItem[] {
  return hijosDePadre(parentId, items)
    .filter(esMovimientoPericial)
    .sort((a, b) => a.orden - b.orden);
}

export function estadosParaMovimientoPericial(
  item: Pick<ControlPruebaItem, 'tipo' | 'vinculo'>,
): readonly string[] {
  const rol = (item.vinculo?.rol ?? item.tipo) as string;
  switch (rol) {
    case 'impugnacion_informe':
      return IMPUGNACION_INFORME_ESTADOS;
    case 'traslado_puntos':
      return TRASLADO_PUNTOS_ESTADOS;
    case 'aclaracion_perito':
    case 'dictamen_complementario':
    case 'dictamen_pericial':
      return ACLARACION_DICTAMEN_ESTADOS;
    default:
      return ACLARACION_DICTAMEN_ESTADOS;
  }
}

function estadoInicialMovimiento(rol: TipoTramitePericial): string {
  switch (rol) {
    case 'impugnacion_informe':
      return 'presentada';
    case 'traslado_puntos':
      return 'pendiente';
    default:
      return 'pendiente';
  }
}

function descripcionMovimiento(padre: ControlPruebaItem, rol: TipoTramitePericial, n: number): string {
  const base = padre.descripcion.trim() || 'Pericia';
  const label = PERICIAL_MOVIMIENTO_LABELS[rol];
  return n > 1 ? `${label} (${n}) — ${base}`.slice(0, 240) : `${label} — ${base}`.slice(0, 240);
}

function triggerKeyMovimiento(parentId: string, rol: string, n: number): string {
  return `pericial_mov|${parentId}|${rol}|${n}`;
}

export function buildMovimientoPericial(
  padre: ControlPruebaItem,
  rol: TipoTramitePericial,
  opts: { orden: number; indice?: number; autoCreated?: boolean },
): ControlPruebaItem {
  const indice = opts.indice ?? 1;
  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo: 'pericial',
    parentCategoria: 'prueba',
    rol: rol as SubprocesoRol,
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: PERICIAL_MOVIMIENTO_LABELS[rol],
    triggerKey: triggerKeyMovimiento(padre.id, rol, indice),
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'tramite',
    tipo: rol,
    descripcion: descripcionMovimiento(padre, rol, indice),
    ofrecidaPor: padre.ofrecidaPor ?? 'actor',
    estado: estadoInicialMovimiento(rol),
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: null,
    vinculo,
  };
}

const FASES_ANTES_DISCUSION = new Set(['perito_designado', 'puntos_trasladados', 'dictamen_presentado', 'producida']);

function fasePadreTrasImpugnacion(estadoActual: string): string | null {
  if (FASES_ANTES_DISCUSION.has(estadoActual) || estadoActual === 'en_discusion') {
    return estadoActual === 'en_discusion' ? null : 'en_discusion';
  }
  return null;
}

/** Crea movimiento pericial vinculado y actualiza fase del padre si corresponde. */
export function crearMovimientoPericial(
  items: ControlPruebaItem[],
  parentId: string,
  rol: TipoTramitePericial,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre || !esPericialPadre(padre)) return { items, creado: null };

  const hijosPrevios = movimientosPericialesDePadre(parentId, items);
  const creado = buildMovimientoPericial(padre, rol, {
    orden: items.length + 1,
    indice: hijosPrevios.filter((h) => h.tipo === rol).length + 1,
  });

  let itemsActualizados = [...items, creado];

  if (rol === 'impugnacion_informe') {
    const nuevaFase = fasePadreTrasImpugnacion(String(padre.estado));
    if (nuevaFase) {
      itemsActualizados = itemsActualizados.map((i) =>
        i.id === parentId ? { ...i, estado: nuevaFase } : i,
      );
    }
  }

  if (rol === 'dictamen_complementario' || rol === 'aclaracion_perito') {
    const padreActual = itemsActualizados.find((i) => i.id === parentId)!;
    if (String(padreActual.estado) === 'en_discusion') {
      // mantiene en_discusion
    } else if (String(padreActual.estado) === 'dictamen_presentado') {
      itemsActualizados = itemsActualizados.map((i) =>
        i.id === parentId ? { ...i, estado: 'en_discusion' } : i,
      );
    }
  }

  return { items: itemsActualizados, creado };
}

export function estadosPericialPadre(): readonly string[] {
  return PERICIAL_ESTADOS;
}

/** Fases periciales intermedias — se agrupan con «Pend. producción» en filtros y chips. */
export const PERICIAL_FASES_EN_TRAMITE = [
  'perito_designado',
  'puntos_trasladados',
  'dictamen_presentado',
  'en_discusion',
] as const;

/** Mapea estado pericial → chip/filtro de PRUEBA_ESTADOS. */
export function estadoAgregadoPruebaChip(item: Pick<ControlPruebaItem, 'tipo' | 'estado'>): string {
  const estado = String(item.estado);
  if (item.tipo === 'pericial') {
    if (
      estado === 'producida' ||
      estado === 'valoracion_judicial' ||
      estado === 'desistida' ||
      estado === 'no_admitida'
    ) {
      return estado;
    }
    return 'pendiente_produccion';
  }
  return estado;
}

/** Autenticidad impugnada sin cerrar → también visible en filtro Pend. producción. */
function incluyeEnFiltroPendienteProduccion(item: ControlPruebaItem): boolean {
  if (esCierrePrueba(String(item.estado))) return false;
  return String(item.estado) === 'autenticidad_impugnada';
}

export function itemVisibleConFiltroEstado(
  item: ControlPruebaItem,
  filtro: string,
): boolean {
  if (filtro === 'all') return true;
  if (filtro === 'audiencia_fijada' && itemCuentaComoAudienciaFijadaEnFiltro(item)) return true;
  const chip = estadoAgregadoPruebaChip(item);
  if (chip === filtro) return true;
  if (filtro === 'pendiente_produccion' && incluyeEnFiltroPendienteProduccion(item)) return true;
  return false;
}

export const PERICIAL_ESTADO_STYLE: Record<string, EstadoStyle> = {
  pendiente_produccion: {
    label: 'Pend. producción',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    rowClass: 'border-l-amber-500',
    dotClass: 'bg-amber-500',
  },
  perito_designado: {
    label: 'Perito designado',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    rowClass: 'border-l-sky-500',
    dotClass: 'bg-sky-500',
  },
  puntos_trasladados: {
    label: 'Puntos trasladados',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    rowClass: 'border-l-violet-500',
    dotClass: 'bg-violet-500',
  },
  dictamen_presentado: {
    label: 'Dictamen presentado',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
    rowClass: 'border-l-teal-500',
    dotClass: 'bg-teal-500',
  },
  en_discusion: {
    label: 'En discusión',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    rowClass: 'border-l-fuchsia-500 bg-fuchsia-50/40',
    dotClass: 'bg-fuchsia-500',
  },
  valoracion_judicial: {
    label: 'A valoración judicial',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-400',
    rowClass: 'border-l-indigo-500 bg-indigo-50/40',
    dotClass: 'bg-indigo-500',
  },
  producida: {
    label: 'Producida',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rowClass: 'border-l-emerald-500 bg-emerald-50/50',
    dotClass: 'bg-emerald-500',
  },
  desistida: {
    label: 'Desistida',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-300 line-through',
    rowClass: 'border-l-gray-400 opacity-70',
    dotClass: 'bg-gray-400',
  },
  no_admitida: {
    label: 'No admitida',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    rowClass: 'border-l-red-500',
    dotClass: 'bg-red-500',
  },
};

export const TRAMITE_ESTADO_STYLE: Record<string, EstadoStyle> = {
  pendiente: {
    label: 'Pendiente',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    rowClass: 'border-l-amber-500',
    dotClass: 'bg-amber-500',
  },
  presentada: {
    label: 'Presentada',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    rowClass: 'border-l-sky-500',
    dotClass: 'bg-sky-500',
  },
  traslado_concedido: {
    label: 'Traslado concedido',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    rowClass: 'border-l-violet-500',
    dotClass: 'bg-violet-500',
  },
  aclaraciones_ordenadas: {
    label: 'Aclaraciones ordenadas',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    rowClass: 'border-l-fuchsia-500',
    dotClass: 'bg-fuchsia-500',
  },
  resuelta_admitida: {
    label: 'Resuelta (admitida)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rowClass: 'border-l-emerald-500',
    dotClass: 'bg-emerald-500',
  },
  resuelta_rechazada: {
    label: 'Resuelta (rechazada)',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    rowClass: 'border-l-red-500',
    dotClass: 'bg-red-500',
  },
  impugnada: {
    label: 'Impugnada',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    rowClass: 'border-l-fuchsia-500',
    dotClass: 'bg-fuchsia-500',
  },
  cumplida: {
    label: 'Cumplida',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rowClass: 'border-l-emerald-500',
    dotClass: 'bg-emerald-500',
  },
};
