import type {
  PruebaEstado,
  PruebaSistema,
  ControlPruebaItem,
  ItemCategoria,
  ControlItemEstado,
  ItemSubtarea,
  ItemTestigo,
  ItemHistorialEntry,
  ItemAdjunto,
  DiligenciaMeta,
  PericialMeta,
  AudienciaMeta,
  ExpedienteHito,
  AudienciaPruebaMeta,
  DocumentalEnPoderMeta,
  DocumentalPruebaMeta,
  SubprocesoVinculo,
  OficioAutenticidadPendiente,
  ResumenEjecutivoImport,
} from '@/types/control-prueba';
import {
  normalizeOficiosAutenticidad,
  normalizeResumenEjecutivo,
} from '@/lib/control-prueba-import-meta';
import { normalizePartesRepresentadas } from '@/lib/control-prueba-partes-representadas';
import { repairSpanishTextEncoding } from '@/lib/text-encoding-repair';
import { normalizeSharedWith } from '@/lib/resource-sharing';
import {
  PRUEBA_ESTADOS,
  DILIGENCIA_ESTADOS,
  INFORMATIVA_ESTADOS,
  AUDIENCIA_ESTADOS,
  ITEM_CATEGORIAS,
  TIPOS_PRUEBA,
  TIPOS_DILIGENCIA,
  TIPOS_AUDIENCIA,
  TIPOS_TRAMITE_PERICIAL,
  TIPOS_MEJOR_PROVEER,
  MEJOR_PROVEER_ESTADOS,
  PRUEBA_PARTES,
} from '@/types/control-prueba';
import { filtrarItemsImportados, type ImportFilterResult } from '@/lib/control-prueba-import-filter';
import { buildImportMeta } from '@/lib/control-prueba-import-meta';
import { prioritizeTextoForPruebaAnalysis } from '@/lib/control-prueba-text-prioritize';
import { ensureSubtareas } from '@/lib/control-prueba-subtareas';
import { ensurePericialMeta } from '@/lib/control-prueba-pericial';
import {
  estadosParaMovimientoPericial,
  estadosPericialPadre,
  PERICIAL_ESTADO_STYLE,
  TRAMITE_ESTADO_STYLE,
  esMovimientoPericial,
  estadoAgregadoPruebaChip,
  itemVisibleConFiltroEstado,
} from '@/lib/control-prueba-pericial-movimientos';
import {
  coerceEstadoAudienciaItem,
  ensureAudienciaPruebaMeta,
  itemCuentaComoAudienciaFijadaEnFiltro,
  syncFechaLimiteAudiencia,
} from '@/lib/control-prueba-audiencia-prueba';
import {
  ensureDocumentalEnPoderMeta,
  syncFechaLimiteDocumentalEnPoder,
} from '@/lib/control-prueba-documental-poder';
import { ensureDocumentalMeta } from '@/lib/control-prueba-documental-autenticidad';
import { migrateExpedienteInformativaAOficio } from '@/lib/control-prueba-informativa-migrate';
import { migrateModeloAudienciaPrueba } from '@/lib/control-prueba-audiencia-migrate';
import {
  consolidarAutenticidadDocumentalExpediente,
  attachOficiosToDocumentalItems,
  consolidarInformativasAutenticidadImport,
} from '@/lib/control-prueba-documental-autenticidad-consolidate';
import { migrarCedulasEmbebidas } from '@/lib/control-prueba-subprocesos';
import { normalizarNombreTercero } from '@/lib/control-prueba-terceros';
import {
  CEDULA_NOTIF_ESTADO_STYLE,
  OFICIO_ELECTRONICO_ESTADO_STYLE,
  estadosComunicacion,
  estadosTerminalesComunicacion,
  normalizarEstadosComunicacion,
  usaEstadosComunicacionEspeciales,
} from '@/lib/control-prueba-cedula-notif';
import type { ControlPruebaImportOutput } from '@/ai/flows/control-prueba-import-flow';

export {
  PRUEBA_ESTADOS,
  DILIGENCIA_ESTADOS,
  INFORMATIVA_ESTADOS,
  AUDIENCIA_ESTADOS,
  ITEM_CATEGORIAS,
  PRUEBA_PARTES,
  TIPOS_PRUEBA,
  TIPOS_DILIGENCIA,
  TIPOS_AUDIENCIA,
};
/** @deprecated */ export { TIPOS_PRUEBA as PRUEBA_TIPOS };
export { usaEstadosComunicacionEspeciales } from '@/lib/control-prueba-cedula-notif';

export const CONTROL_PRUEBA_COLLECTION = 'controlPrueba';

/** Shape compartido por todos los diccionarios de estilo de estado (badge/fila/punto). */
export type EstadoStyle = { label: string; badgeClass: string; rowClass: string; dotClass: string };

export const ESTADO_CONFIG: Record<PruebaEstado, EstadoStyle> = {
  pendiente_produccion: {
    label: 'Pend. producción',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-900/50 dark:text-amber-200',
    rowClass: 'border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20',
    dotClass: 'bg-amber-500',
  },
  postpuesta_juez: {
    label: 'Postergada (juez)',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-400 dark:bg-orange-900/50 dark:text-orange-200',
    rowClass: 'border-l-orange-500 bg-orange-50/40 dark:bg-orange-950/20',
    dotClass: 'bg-orange-500',
  },
  audiencia_fijada: {
    label: 'Audiencia fijada',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-400 dark:bg-teal-900/50 dark:text-teal-200',
    rowClass: 'border-l-teal-500 bg-teal-50/40 dark:bg-teal-950/20',
    dotClass: 'bg-teal-500',
  },
  intimacion_ordenada: {
    label: 'Intimación ordenada',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-400 dark:bg-violet-900/50 dark:text-violet-200',
    rowClass: 'border-l-violet-500 bg-violet-50/40 dark:bg-violet-950/20',
    dotClass: 'bg-violet-500',
  },
  exhibicion_parcial: {
    label: 'Exhibición parcial',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-400 dark:bg-fuchsia-900/50 dark:text-fuchsia-200',
    rowClass: 'border-l-fuchsia-500 bg-fuchsia-50/40 dark:bg-fuchsia-950/20',
    dotClass: 'bg-fuchsia-500',
  },
  apercibimiento_en_contra: {
    label: 'Apercibimiento en contra',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-400 dark:bg-rose-900/50 dark:text-rose-200',
    rowClass: 'border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20',
    dotClass: 'bg-rose-500',
  },
  autenticidad_impugnada: {
    label: 'Autenticidad impugnada',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-400 dark:bg-fuchsia-900/50 dark:text-fuchsia-200',
    rowClass: 'border-l-fuchsia-500 bg-fuchsia-50/40 dark:bg-fuchsia-950/20',
    dotClass: 'bg-fuchsia-500',
  },
  valoracion_judicial: {
    label: 'A valoración judicial',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-400 dark:bg-indigo-900/50 dark:text-indigo-200',
    rowClass: 'border-l-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20',
    dotClass: 'bg-indigo-500',
  },
  producida: {
    label: 'Producida',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300',
    rowClass: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/15',
    dotClass: 'bg-emerald-500',
  },
  desistida: {
    label: 'Desistida',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-300 line-through dark:bg-gray-900/50 dark:text-gray-400',
    rowClass: 'border-l-gray-400 opacity-70',
    dotClass: 'bg-gray-400',
  },
  no_admitida: {
    label: 'No admitida',
    badgeClass: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300',
    rowClass: 'border-l-red-500',
    dotClass: 'bg-red-500',
  },
};

export const TIPO_LABELS: Record<string, string> = {
  documental: 'Documental',
  documental_en_poder: 'Documental en poder de contraparte',
  testimonial: 'Testimonial',
  pericial: 'Pericial',
  informativa: 'Informativa',
  confesional: 'Confesional',
  inspeccion: 'Inspección',
  otra: 'Otra',
  indagatoria: 'Indagatoria',
  conciliacion: 'Conciliación',
  mediacion: 'Mediación',
  oficio: 'Oficio',
  cedula: 'Cédula',
  mandamiento: 'Mandamiento',
  exhorto: 'Exhorto',
  oficio_electronico: 'Oficio electrónico',
  cedula_electronica: 'Cédula electrónica',
  audiencia: 'Audiencia',
  vista_causa: 'Vista de causa',
  audiencia_testimonial: 'Audiencia testimonial',
  audiencia_inicial: 'Audiencia inicial',
  audiencia_preliminar: 'Audiencia preliminar',
  audiencia_vista: 'Audiencia de vista',
  otra_audiencia: 'Otra audiencia',
  impugnacion_informe: 'Impugnación al informe',
  aclaracion_perito: 'Aclaraciones del perito',
  dictamen_complementario: 'Dictamen complementario',
  dictamen_pericial: 'Dictamen pericial',
  traslado_puntos: 'Traslado de puntos',
  documentacion: 'Aportar documentación',
  informacion: 'Aportar información',
  comparendo: 'Comparendo / audiencia',
  prueba_adicional: 'Producir prueba adicional',
};

export const CATEGORIA_CONFIG: Record<
  ItemCategoria,
  { titulo: string; descripcion: string; accent: string; icon?: string }
> = {
  prueba: {
    titulo: 'Prueba ofrecida',
    descripcion: 'Documental, pericial, informativa… por parte',
    accent: 'border-l-[#2A6A78]',
  },
  diligencia: {
    titulo: 'Diligencias y comunicaciones',
    descripcion: 'Oficios, cédulas, mandamientos y exhortos (papel y electrónicos)',
    accent: 'border-l-violet-500',
  },
  audiencia: {
    titulo: 'Audiencias fijadas',
    descripcion: 'Eventos programados vinculados a prueba ofrecida, y actos del expediente (vista, mediación)',
    accent: 'border-l-amber-500',
  },
  tramite: {
    titulo: 'Trámites vinculados',
    descripcion: 'Movimientos periciales (impugnaciones, aclaraciones, dictámenes)',
    accent: 'border-l-teal-500',
  },
  mejor_proveer: {
    titulo: 'Medidas de mejor proveer',
    descripcion: 'Órdenes del juez en cualquier etapa del proceso',
    accent: 'border-l-orange-500',
  },
};

export const TIPOS_POR_CATEGORIA: Record<ItemCategoria, readonly string[]> = {
  prueba: TIPOS_PRUEBA,
  diligencia: TIPOS_DILIGENCIA,
  audiencia: TIPOS_AUDIENCIA,
  tramite: TIPOS_TRAMITE_PERICIAL,
  mejor_proveer: TIPOS_MEJOR_PROVEER,
};

export const ESTADOS_POR_CATEGORIA: Record<ItemCategoria, readonly string[]> = {
  prueba: PRUEBA_ESTADOS,
  diligencia: DILIGENCIA_ESTADOS,
  audiencia: AUDIENCIA_ESTADOS,
  tramite: ['pendiente', 'presentada'],
  mejor_proveer: MEJOR_PROVEER_ESTADOS,
};

const DILIGENCIA_ESTADO_STYLE: Record<string, EstadoStyle> = {
  pendiente: { label: 'Pendiente', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300', rowClass: 'border-l-amber-500', dotClass: 'bg-amber-500' },
  presentado: {
    label: 'Presentado',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    rowClass: 'border-l-violet-500',
    dotClass: 'bg-violet-500',
  },
  // Legacy: «enviado» → presentado
  enviado: {
    label: 'Presentado',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    rowClass: 'border-l-violet-500',
    dotClass: 'bg-violet-500',
  },
  observado: {
    label: 'Observado',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    rowClass: 'border-l-orange-500',
    dotClass: 'bg-orange-500',
  },
  librado: { label: 'Librado', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300', rowClass: 'border-l-sky-500', dotClass: 'bg-sky-500' },
  diligenciado: { label: 'Diligenciado', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300', rowClass: 'border-l-emerald-500 bg-emerald-50/50', dotClass: 'bg-emerald-500' },
  contestado: { label: 'Contestado', badgeClass: 'bg-violet-100 text-violet-800 border-violet-300', rowClass: 'border-l-violet-500', dotClass: 'bg-violet-500' },
  contestacion_parcial: {
    label: 'Cumpl. parcial',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300',
    rowClass: 'border-l-fuchsia-500 bg-fuchsia-50/50',
    dotClass: 'bg-fuchsia-500',
  },
  cumplido: {
    label: 'Cumplido',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rowClass: 'border-l-emerald-500 bg-emerald-50/50',
    dotClass: 'bg-emerald-500',
  },
  vencido: {
    label: 'Vencido',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    rowClass: 'border-l-red-500 bg-red-50/40',
    dotClass: 'bg-red-500',
  },
};

const AUDIENCIA_ESTADO_STYLE: Record<string, EstadoStyle> = {
  programada: { label: 'Audiencia fijada', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300', rowClass: 'border-l-sky-500 bg-sky-50/30', dotClass: 'bg-sky-500' },
  realizada: { label: 'Realizada', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300', rowClass: 'border-l-emerald-500', dotClass: 'bg-emerald-500' },
  suspendida: { label: 'Postergada', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300', rowClass: 'border-l-amber-500', dotClass: 'bg-amber-500' },
  reprogramada: { label: 'Reprogramada', badgeClass: 'bg-violet-100 text-violet-800 border-violet-300', rowClass: 'border-l-violet-500', dotClass: 'bg-violet-500' },
  cancelada: { label: 'Desistida / cancelada', badgeClass: 'bg-gray-100 text-gray-600 border-gray-300 line-through', rowClass: 'border-l-gray-400 opacity-70', dotClass: 'bg-gray-400' },
};

const MEJOR_PROVEER_ESTADO_STYLE: Record<string, EstadoStyle> = {
  ordenada: {
    label: 'Ordenada',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    rowClass: 'border-l-amber-500 bg-amber-50/30',
    dotClass: 'bg-amber-500',
  },
  en_cumplimiento: {
    label: 'En cumplimiento',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    rowClass: 'border-l-sky-500',
    dotClass: 'bg-sky-500',
  },
  cumplida: {
    label: 'Cumplida',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rowClass: 'border-l-emerald-500 bg-emerald-50/50',
    dotClass: 'bg-emerald-500',
  },
  incumplida: {
    label: 'Incumplida',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    rowClass: 'border-l-red-500 bg-red-50/40',
    dotClass: 'bg-red-500',
  },
  dispensada: {
    label: 'Dispensada',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-300',
    rowClass: 'border-l-gray-400 opacity-80',
    dotClass: 'bg-gray-400',
  },
};

export function getEstadoConfig(categoria: ItemCategoria, estado: string, item?: ControlPruebaItem) {
  if (item?.tipo === 'oficio_electronico' && estado in OFICIO_ELECTRONICO_ESTADO_STYLE) {
    return OFICIO_ELECTRONICO_ESTADO_STYLE[estado];
  }
  if (estado in CEDULA_NOTIF_ESTADO_STYLE) {
    return CEDULA_NOTIF_ESTADO_STYLE[estado];
  }
  if (estado in TRAMITE_ESTADO_STYLE) {
    return TRAMITE_ESTADO_STYLE[estado];
  }
  if (item?.tipo === 'pericial' && estado in PERICIAL_ESTADO_STYLE) {
    return PERICIAL_ESTADO_STYLE[estado];
  }
  if (categoria === 'tramite' && item && esMovimientoPericial(item)) {
    const style = TRAMITE_ESTADO_STYLE[estado];
    if (style) return style;
  }
  if (categoria === 'diligencia' && estado in DILIGENCIA_ESTADO_STYLE) {
    return DILIGENCIA_ESTADO_STYLE[estado];
  }
  if (item?.tipo === 'informativa') {
    if (estado === 'valoracion_judicial') {
      return ESTADO_CONFIG.valoracion_judicial;
    }
    if (estado === 'desistida') {
      return ESTADO_CONFIG.desistida;
    }
    if (estado === 'producida' || estado === 'cumplido') {
      return ESTADO_CONFIG.producida;
    }
    if (estado in DILIGENCIA_ESTADO_STYLE) {
      return DILIGENCIA_ESTADO_STYLE[estado];
    }
  }
  if (categoria === 'audiencia' && estado in AUDIENCIA_ESTADO_STYLE) {
    return AUDIENCIA_ESTADO_STYLE[estado];
  }
  if (categoria === 'mejor_proveer' && estado in MEJOR_PROVEER_ESTADO_STYLE) {
    return MEJOR_PROVEER_ESTADO_STYLE[estado];
  }
  if (estado in ESTADO_CONFIG) {
    return ESTADO_CONFIG[estado as PruebaEstado];
  }
  return {
    label: estado,
    badgeClass: 'bg-muted text-muted-foreground border-border',
    rowClass: 'border-l-muted',
    dotClass: 'bg-muted-foreground',
  };
}

export function inferCategoriaFromTipo(tipo: string): ItemCategoria {
  if ((TIPOS_TRAMITE_PERICIAL as readonly string[]).includes(tipo)) return 'tramite';
  if ((TIPOS_DILIGENCIA as readonly string[]).includes(tipo)) return 'diligencia';
  if ((TIPOS_AUDIENCIA as readonly string[]).includes(tipo)) return 'audiencia';
  if ((TIPOS_MEJOR_PROVEER as readonly string[]).includes(tipo)) return 'mejor_proveer';
  return 'prueba';
}

export function esConfesional(item: Pick<ControlPruebaItem, 'tipo'>): boolean {
  return item.tipo === 'confesional';
}

/** Confesional y testimonial ofrecidas (no el evento hijo de audiencia). */
export function esAudienciaOfrecida(
  item: Pick<ControlPruebaItem, 'tipo'> & Partial<Pick<ControlPruebaItem, 'vinculo'>>,
): boolean {
  if (item.tipo !== 'confesional' && item.tipo !== 'testimonial') return false;
  // Evento / cédula / oficio hijo: instrumentalidad, no la prueba ofrecida
  if (item.vinculo?.rol === 'audiencia_prueba') return false;
  if (item.vinculo?.parentItemId) return false;
  return true;
}

export function esPruebaConFlujoComplejo(item: Pick<ControlPruebaItem, 'tipo'>): boolean {
  return (
    item.tipo === 'confesional' ||
    item.tipo === 'testimonial' ||
    item.tipo === 'documental_en_poder' ||
    item.tipo === 'documental'
  );
}

/**
 * Prueba ofrecida (cuenta en chips / progreso).
 * Cada testimonial o confesional es una prueba; sus hijos (cédulas, oficios, eventos)
 * son instrumentalidad y no cuentan.
 */
export function esPruebaOfrecida(item: ControlPruebaItem): boolean {
  if (item.vinculo?.parentItemId) return false;
  if (item.vinculo?.rol === 'audiencia_prueba') return false;

  const cat = resolveCategoria(item);
  if (cat === 'diligencia' || cat === 'tramite' || cat === 'mejor_proveer') return false;

  if (item.tipo === 'confesional' || item.tipo === 'testimonial') return true;
  if (item.tipo === 'documental_en_poder') return true;
  if (cat === 'prueba') return true;
  return false;
}

/** Confesional/testimonial/documental usan estados de producción (pendiente → producida…). */
export function usaEstadosProduccionPrueba(item: ControlPruebaItem): boolean {
  return esPruebaOfrecida(item);
}

/** Solo pruebas ofrecidas (sin hijos/instrumentalidad). */
export function itemsOfrecidasProduccion(items: ControlPruebaItem[]): ControlPruebaItem[] {
  return items.filter(esPruebaOfrecida);
}

/** Comunicaciones / audiencias / mejor proveer aún abiertas (no cumplidas ni cerradas). */
export function itemPendienteDeControl(item: ControlPruebaItem): boolean {
  const cat = resolveCategoria(item);
  if (cat === 'diligencia') {
    if (usaEstadosComunicacionEspeciales(item)) {
      return !estadosTerminalesComunicacion(item).includes(String(item.estado));
    }
    const terminales = ['cumplido', 'diligenciado', 'notificada', 'librada_notificada', 'resultado_negativo'];
    return !terminales.includes(String(item.estado));
  }
  if (cat === 'audiencia' && !esAudienciaOfrecida(item)) {
    return !['realizada', 'cancelada'].includes(String(item.estado));
  }
  if (cat === 'mejor_proveer') {
    return !['cumplida', 'dispensada', 'incumplida'].includes(String(item.estado));
  }
  return false;
}

/**
 * Estados de prueba aún abiertos que, con filtro «Pend. producción», deben verse
 * junto a sus cédulas/oficios (si no, aparecen comunicaciones huérfanas).
 */
const ESTADOS_PRUEBA_ABIERTOS_EN_PEND_PRODUCCION = new Set([
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'exhibicion_parcial',
  'apercibimiento_en_contra',
  'autenticidad_impugnada',
]);

/** Filtro de estado del header: prueba ofrecida + comunicaciones/audiencias pendientes. */
export function pasaFiltroEstadoProduccion(item: ControlPruebaItem, filtro: string): boolean {
  if (filtro === 'all') return true;
  if (filtro === 'audiencia_fijada') {
    return itemVisibleConFiltroEstado(item, filtro);
  }
  if (usaEstadosProduccionPrueba(item)) {
    if (itemVisibleConFiltroEstado(item, filtro)) return true;
    // Confesional/testimonial fijada o evento programado: siguen pendientes de producirse
    // y suelen tener cédulas visibles bajo Pend. producción.
    if (
      filtro === 'pendiente_produccion' &&
      (ESTADOS_PRUEBA_ABIERTOS_EN_PEND_PRODUCCION.has(String(item.estado)) ||
        itemCuentaComoAudienciaFijadaEnFiltro(item))
    ) {
      return true;
    }
    return false;
  }
  if (filtro === 'pendiente_produccion') {
    return itemPendienteDeControl(item);
  }
  return false;
}

const FILTROS_ESTADO_CON_ARBOL = new Set([
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'exhibicion_parcial',
  'apercibimiento_en_contra',
  'autenticidad_impugnada',
]);

function padreIdDeItem(item: ControlPruebaItem): string | null {
  return item.vinculo?.parentItemId ?? item.diligencia?.pruebaVinculadaId ?? null;
}

/**
 * Completa el árbol del filtro: hijos de pruebas visibles + padres que también
 * pasan el filtro. Nunca arrastra una prueba ya cerrada (producida, etc.) solo
 * porque quedó una cédula/oficio pendiente.
 */
export function completarArbolFiltroEstado(
  list: ControlPruebaItem[],
  allItems: ControlPruebaItem[],
  filtro: string,
): ControlPruebaItem[] {
  if (filtro === 'all' || !FILTROS_ESTADO_CON_ARBOL.has(filtro)) return list;

  const byId = new Map(allItems.map((i) => [i.id, i]));

  /** Prueba ofrecida ancestro (padre o abuelo) que define si el hijo entra en el filtro. */
  function pruebaOfrecidaAncestro(item: ControlPruebaItem): ControlPruebaItem | null {
    const padreId = padreIdDeItem(item);
    if (!padreId) return null;
    const padre = byId.get(padreId);
    if (!padre) return null;
    if (esPruebaOfrecida(padre)) return padre;
    const abueloId = padreIdDeItem(padre);
    if (!abueloId) return null;
    const abuelo = byId.get(abueloId);
    return abuelo && esPruebaOfrecida(abuelo) ? abuelo : null;
  }

  // Sacá hijos cuya prueba ofrecida ya no entra en este filtro (ej. cédula de una Producida).
  let working = list.filter((item) => {
    const prueba = pruebaOfrecidaAncestro(item);
    if (!prueba) return true;
    if (
      ['producida', 'valoracion_judicial', 'cumplido', 'desistida', 'no_admitida'].includes(
        String(prueba.estado),
      )
    ) {
      return false;
    }
    return pasaFiltroEstadoProduccion(prueba, filtro);
  });

  const ids = new Set(working.map((i) => i.id));
  let changed = true;

  while (changed) {
    changed = false;

    // Padres solo si ellos también pasan el filtro (nunca una Producida bajo Pend. producción).
    for (const item of working) {
      const padreId = padreIdDeItem(item);
      if (!padreId || ids.has(padreId)) continue;
      const padre = byId.get(padreId);
      if (!padre) continue;
      if (!pasaFiltroEstadoProduccion(padre, filtro)) continue;
      working.push(padre);
      ids.add(padre.id);
      changed = true;
    }

    // Hijos/nietos de ítems ya visibles (instrumentalidad de esas pruebas).
    for (const item of allItems) {
      if (ids.has(item.id)) continue;
      const padreId = padreIdDeItem(item);
      if (!padreId || !ids.has(padreId)) continue;
      const padre = byId.get(padreId);
      if (
        padre &&
        ['producida', 'valoracion_judicial', 'cumplido', 'desistida', 'no_admitida'].includes(
          String(padre.estado),
        )
      ) {
        continue;
      }
      const prueba = pruebaOfrecidaAncestro(item);
      if (prueba && !pasaFiltroEstadoProduccion(prueba, filtro)) continue;
      if (
        prueba &&
        ['producida', 'valoracion_judicial', 'cumplido', 'desistida', 'no_admitida'].includes(
          String(prueba.estado),
        )
      ) {
        continue;
      }
      working.push(item);
      ids.add(item.id);
      changed = true;
    }
  }

  return working;
}

export function estadosParaItem(item: ControlPruebaItem): readonly string[] {
  if (resolveCategoria(item) === 'audiencia' && item.vinculo?.rol === 'audiencia_prueba') {
    return AUDIENCIA_ESTADOS;
  }
  if (esAudienciaOfrecida(item)) return PRUEBA_ESTADOS;
  if (item.tipo === 'informativa' && resolveCategoria(item) === 'prueba') return INFORMATIVA_ESTADOS;
  if (item.tipo === 'pericial' && resolveCategoria(item) === 'prueba') return estadosPericialPadre();
  if (esMovimientoPericial(item)) return estadosParaMovimientoPericial(item);
  if (usaEstadosComunicacionEspeciales(item)) return estadosComunicacion(item);
  return ESTADOS_POR_CATEGORIA[resolveCategoria(item)];
}

export function resolveCategoria(item: ControlPruebaItem): ItemCategoria {
  if (item.categoria && (ITEM_CATEGORIAS as readonly string[]).includes(item.categoria)) {
    return item.categoria as ItemCategoria;
  }
  return inferCategoriaFromTipo(item.tipo);
}

export function defaultEstadoForCategoria(categoria: ItemCategoria): ControlItemEstado {
  switch (categoria) {
    case 'diligencia':
      return 'pendiente';
    case 'audiencia':
      return 'programada';
    case 'tramite':
      return 'pendiente';
    case 'mejor_proveer':
      return 'ordenada';
    default:
      return 'pendiente_produccion';
  }
}

export function defaultEstadoForItem(categoria: ItemCategoria, tipo?: string): ControlItemEstado {
  if (tipo === 'confesional' || tipo === 'testimonial') return 'pendiente_produccion';
  if (tipo === 'pericial') return 'pendiente_produccion';
  if (tipo === 'documental_en_poder') return 'pendiente_produccion';
  if (tipo === 'informativa') return 'pendiente';
  if (tipo === 'impugnacion_informe') return 'presentada';
  if (tipo && usaEstadosComunicacionEspeciales({ categoria: 'diligencia', tipo })) {
    return 'pendiente_realizacion';
  }
  return defaultEstadoForCategoria(categoria);
}

export function defaultTipoForCategoria(categoria: ItemCategoria): string {
  switch (categoria) {
    case 'diligencia':
      return 'oficio';
    case 'audiencia':
      return 'confesional';
    case 'tramite':
      return 'impugnacion_informe';
    case 'mejor_proveer':
      return 'documentacion';
    default:
      return 'documental';
  }
}

export const PARTE_LABELS: Record<string, string> = {
  actor: 'Actor',
  demandado: 'Demandada',
  tercero: 'Tercero',
  tribunal: 'Tribunal',
};

export const GRUPOS_PRUEBA = [
  { id: 'actor' as const, titulo: 'Prueba del actor', accent: 'border-l-[#2A6A78] bg-[#2A6A78]/5' },
  { id: 'demandado' as const, titulo: 'Prueba de la demandada', accent: 'border-l-[#54A6A8] bg-[#54A6A8]/8' },
] as const;

export type GrupoPruebaId = (typeof GRUPOS_PRUEBA)[number]['id'];

export function grupoDeItem(item: ControlPruebaItem): GrupoPruebaId | 'otros' {
  const parte = item.ofrecidaPor ?? 'actor';
  if (parte === 'actor') return 'actor';
  if (parte === 'demandado') return 'demandado';
  return 'otros';
}

export function detectSistemaFromUrl(url: string): PruebaSistema {
  const u = url.toLowerCase();
  if (u.includes('mev.scba.gov.ar')) return 'mev';
  if (u.includes('pjn.gov.ar') || u.includes('expediente.seam')) return 'pjn';
  return 'otro';
}

export function isValidEstadoForCategoria(categoria: ItemCategoria, value: string): boolean {
  return (ESTADOS_POR_CATEGORIA[categoria] as readonly string[]).includes(value);
}

export function isValidEstadoForItem(
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo' | 'estado' | 'vinculo' | 'diligencia'>,
): boolean {
  if (esAudienciaOfrecida(item)) {
    return (PRUEBA_ESTADOS as readonly string[]).includes(String(item.estado));
  }
  if (item.tipo === 'informativa') {
    return (INFORMATIVA_ESTADOS as readonly string[]).includes(String(item.estado));
  }
  if (item.tipo === 'pericial') {
    return (estadosPericialPadre() as readonly string[]).includes(String(item.estado));
  }
  if (esMovimientoPericial(item as ControlPruebaItem)) {
    return estadosParaMovimientoPericial(item).includes(String(item.estado));
  }
  if (usaEstadosComunicacionEspeciales(item)) {
    return estadosComunicacion(item).includes(String(item.estado));
  }
  const cat = resolveCategoria(item as ControlPruebaItem);
  return isValidEstadoForCategoria(cat, String(item.estado));
}

export function isValidEstado(value: string): value is PruebaEstado {
  return (PRUEBA_ESTADOS as readonly string[]).includes(value);
}

/** Estados viejos → equivalente actual al normalizar expedientes guardados. */
const ESTADOS_PRUEBA_LEGACY: Record<string, PruebaEstado> = {
  pendiente_ofrecimiento: 'pendiente_produccion',
  ofrecida: 'pendiente_produccion',
  en_tramite: 'pendiente_produccion',
  tachada: 'no_admitida',
};

const ESTADOS_CONFESIONAL_LEGACY: Record<string, PruebaEstado> = {
  programada: 'pendiente_produccion',
  reprogramada: 'audiencia_fijada',
  realizada: 'producida',
  suspendida: 'postpuesta_juez',
  cancelada: 'desistida',
};

const ESTADOS_PERICIAL_LEGACY: Record<string, string> = {
  postpuesta_juez: 'pendiente_produccion',
  audiencia_fijada: 'puntos_trasladados',
};

export function migrateEstadoPrueba(estado: string, tipo?: string): string {
  if ((tipo === 'confesional' || tipo === 'testimonial') && estado in ESTADOS_CONFESIONAL_LEGACY) {
    return ESTADOS_CONFESIONAL_LEGACY[estado];
  }
  if (tipo === 'pericial' && estado in ESTADOS_PERICIAL_LEGACY) {
    return ESTADOS_PERICIAL_LEGACY[estado];
  }
  return ESTADOS_PRUEBA_LEGACY[estado] ?? estado;
}

function migrateTipoDiligencia(tipo: string): string {
  const legacy: Record<string, string> = {
    neo: 'cedula_electronica',
    notificacion: 'cedula',
    requerimiento: 'mandamiento',
    telegrama: 'cedula',
    carta_documento: 'cedula',
    otra_diligencia: 'oficio',
  };
  if ((TIPOS_DILIGENCIA as readonly string[]).includes(tipo)) return tipo;
  return legacy[tipo] ?? 'oficio';
}

function migrateConfesionalACategoria(item: ControlPruebaItem): Partial<Pick<ControlPruebaItem, 'categoria' | 'tipo'>> {
  // Modelo B: confesional vive en prueba ofrecida (no mover a audiencias).
  return {};
}

function migrateTestimonialACategoria(item: ControlPruebaItem): Partial<Pick<ControlPruebaItem, 'categoria' | 'tipo'>> {
  if (item.tipo === 'audiencia_testimonial') {
    return { categoria: 'prueba', tipo: 'testimonial' };
  }
  return {};
}

/** Estados genéricos de diligencia (oficio, mandamiento, exhorto) — legacy → vigentes */
const ESTADOS_DILIGENCIA_LEGACY: Record<string, string> = {
  negativo: 'vencido',
  nulo: 'pendiente',
  sin_efecto: 'pendiente',
  enviado: 'presentado',
};

function migrateEstadoDiligenciaGenerica(
  estado: string,
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo'>,
): string {
  if (item.categoria !== 'diligencia' || usaEstadosComunicacionEspeciales(item)) return estado;
  return ESTADOS_DILIGENCIA_LEGACY[estado] ?? estado;
}

function normalizeSubtareas(raw: unknown): ItemSubtarea[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((s) => ({
    id: String((s as ItemSubtarea).id || crypto.randomUUID()),
    titulo: String((s as ItemSubtarea).titulo || ''),
    completada: Boolean((s as ItemSubtarea).completada),
    fechaLimite: (s as ItemSubtarea).fechaLimite || null,
    observaciones: (s as ItemSubtarea).observaciones?.trim() || null,
  }));
}

function normalizeTestigos(raw: unknown): ItemTestigo[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((t) => ({
      id: String((t as ItemTestigo).id || crypto.randomUUID()),
      nombre: String((t as ItemTestigo).nombre || '').trim(),
    }))
    .filter((t) => t.nombre.length > 0);
}

function normalizeHistorial(raw: unknown): ItemHistorialEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.slice(-50).map((h) => ({
    id: String((h as ItemHistorialEntry).id || crypto.randomUUID()),
    timestamp: String((h as ItemHistorialEntry).timestamp || new Date().toISOString()),
    usuario: (h as ItemHistorialEntry).usuario,
    campo: String((h as ItemHistorialEntry).campo || ''),
    valorAnterior: (h as ItemHistorialEntry).valorAnterior,
    valorNuevo: String((h as ItemHistorialEntry).valorNuevo || ''),
  }));
}

function normalizeAdjuntos(raw: unknown): ItemAdjunto[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((a) => ({
    id: String((a as ItemAdjunto).id || crypto.randomUUID()),
    nombre: String((a as ItemAdjunto).nombre || 'Adjunto'),
    url: String((a as ItemAdjunto).url || ''),
    tipo: (a as ItemAdjunto).tipo,
  }));
}

function normalizeDiligencia(raw: unknown): DiligenciaMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as DiligenciaMeta;
  return {
    destinatario: d.destinatario?.trim(),
    objeto: d.objeto?.trim(),
    fechaPresentacion: d.fechaPresentacion || null,
    fechaLibramiento: d.fechaLibramiento || null,
    fechaDiligenciamiento: d.fechaDiligenciamiento || null,
    plazoContestacion: d.plazoContestacion || null,
    resultado: d.resultado?.trim(),
    pruebaVinculadaId: d.pruebaVinculadaId || null,
    plantillaTexto: d.plantillaTexto || null,
    medioNotificacion: d.medioNotificacion === 'electronica' ? 'electronica' : d.medioNotificacion === 'papel' ? 'papel' : undefined,
    oficioOrigenId: d.oficioOrigenId || null,
    oficioSucesorId: d.oficioSucesorId || null,
  };
}

function normalizePericial(raw: unknown): PericialMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as PericialMeta;
  return {
    especialidad: p.especialidad?.trim() || undefined,
    extrañaJurisdiccion: Boolean(p.extrañaJurisdiccion),
    expedienteRogatoria: p.expedienteRogatoria?.trim() || null,
    juzgadoOficiado: p.juzgadoOficiado?.trim(),
    peritoDesignado: p.peritoDesignado?.trim(),
  };
}

function normalizeAudiencia(raw: unknown): AudienciaMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as AudienciaMeta;
  return {
    hora: a.hora?.trim(),
    sala: a.sala?.trim(),
    juzgado: a.juzgado?.trim(),
    abogadoAsistente: a.abogadoAsistente?.trim(),
    resultado: a.resultado?.trim(),
    actaTexto: a.actaTexto?.trim(),
    actaUrl: a.actaUrl || null,
    cedulaVinculadaId: a.cedulaVinculadaId || null,
    cedulaNotificada: Boolean(a.cedulaNotificada),
    checklist: Array.isArray(a.checklist)
      ? a.checklist.map((c) => ({
          id: String(c.id || crypto.randomUUID()),
          titulo: String(c.titulo || ''),
          completada: Boolean(c.completada),
        }))
      : undefined,
  };
}

function normalizeVinculo(raw: unknown): SubprocesoVinculo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as SubprocesoVinculo;
  if (!v.parentItemId || !v.rol) return undefined;
  return {
    parentItemId: String(v.parentItemId),
    parentTipo: v.parentTipo ?? 'confesional',
    parentCategoria: v.parentCategoria,
    rol: v.rol,
    autoCreated: Boolean(v.autoCreated),
    vinculoLabel: String(v.vinculoLabel || '').trim(),
    triggerKey: String(v.triggerKey || '').trim(),
  };
}

function normalizeAudienciaPrueba(raw: unknown): AudienciaPruebaMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as AudienciaPruebaMeta;
  return {
    audienciaFijada: Boolean(a.audienciaFijada),
    fechaAudiencia: a.fechaAudiencia || null,
    horaAudiencia: a.horaAudiencia?.trim() || null,
    sala: a.sala?.trim() || null,
    motivoPostergacion: a.motivoPostergacion?.trim() || null,
  };
}

function normalizeDocumentalEnPoder(raw: unknown): DocumentalEnPoderMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as DocumentalEnPoderMeta & {
    autenticidadImpugnada?: boolean;
    fechaImpugnacion?: string | null;
    destinatarioOficio?: string | null;
  };
  return {
    parteConDocumentos: d.parteConDocumentos || null,
    documentosDetalle: d.documentosDetalle?.trim() || null,
    documentosFaltantes: d.documentosFaltantes?.trim() || null,
    plazoPresentacion: d.plazoPresentacion || null,
    medioIntimacion: d.medioIntimacion ?? 'papel',
    intimacionOrdenada: Boolean(d.intimacionOrdenada),
  };
}

function normalizeDocumental(raw: unknown): DocumentalPruebaMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as DocumentalPruebaMeta;
  const oficios = normalizeOficiosAutenticidad(d.oficiosAutenticidad);
  return {
    autenticidadImpugnada: Boolean(d.autenticidadImpugnada),
    fechaImpugnacion: d.fechaImpugnacion || null,
    destinatarioOficio: d.destinatarioOficio?.trim() || oficios[0]?.destinatarioOficio?.trim() || null,
    oficiosAutenticidad: oficios.length ? oficios : undefined,
  };
}

/** Firestore rechaza valores `undefined`; elimina claves undefined en profundidad. */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForFirestore(entry)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val !== undefined) {
      out[key] = sanitizeForFirestore(val);
    }
  }
  return out as T;
}

export function normalizeItems(items: ControlPruebaItem[] | undefined): ControlPruebaItem[] {
  if (!Array.isArray(items)) return [];
  const mapped = items
    .map((item, index) => {
      const migracionConfesional = migrateConfesionalACategoria(item);
      const migracionTestimonial = migrateTestimonialACategoria({
        ...item,
        ...migracionConfesional,
      });
      const migracionCat = { ...migracionConfesional, ...migracionTestimonial };
      const categoria = (migracionCat.categoria ?? resolveCategoria(item)) as ItemCategoria;
      const tipoRaw = migracionCat.tipo ?? (item.tipo || defaultTipoForCategoria(categoria));
      const tipo =
        categoria === 'diligencia' ? migrateTipoDiligencia(tipoRaw) : tipoRaw;
      const estadoRaw = String(item.estado || '');
      const estadoMigrated =
        categoria === 'prueba' || esAudienciaOfrecida({ tipo })
          ? migrateEstadoPrueba(estadoRaw, tipo)
          : categoria === 'diligencia'
            ? migrateEstadoDiligenciaGenerica(estadoRaw, { categoria, tipo })
            : estadoRaw;
      const estado = isValidEstadoForItem({
        categoria,
        tipo,
        estado: estadoMigrated,
        vinculo: normalizeVinculo(item.vinculo),
        diligencia: normalizeDiligencia(item.diligencia),
      })
        ? estadoMigrated
        : defaultEstadoForItem(categoria, tipo);
      const normalized: ControlPruebaItem = {
        id: item.id || crypto.randomUUID(),
        orden: typeof item.orden === 'number' ? item.orden : index + 1,
        categoria,
        tipo,
        descripcion: String(item.descripcion || '').trim(),
        ofrecidaPor:
          item.ofrecidaPor ||
          (categoria === 'prueba'
            ? 'actor'
            : esAudienciaOfrecida({ tipo })
              ? 'actor'
              : 'tribunal'),
        estado,
        fechaLimite: item.fechaLimite || null,
        fechaLimiteSecundaria: item.fechaLimiteSecundaria || null,
        fechaProduccion: item.fechaProduccion || null,
        actuacionUrl: item.actuacionUrl?.trim() || null,
        observaciones: item.observaciones?.trim() || null,
        terceroNombre: normalizarNombreTercero(item.terceroNombre),
        subtareas: normalizeSubtareas(item.subtareas),
        testigos: normalizeTestigos(item.testigos),
        historial: normalizeHistorial(item.historial),
        adjuntos: normalizeAdjuntos(item.adjuntos),
        diligencia:
          categoria === 'diligencia' || tipo === 'informativa'
            ? normalizeDiligencia(item.diligencia)
            : undefined,
        pericial: normalizePericial(item.pericial),
        audiencia: normalizeAudiencia(item.audiencia),
        audienciaPrueba: normalizeAudienciaPrueba(item.audienciaPrueba),
        documentalEnPoder: normalizeDocumentalEnPoder(item.documentalEnPoder),
        documental: normalizeDocumental(item.documental),
        vinculo: normalizeVinculo(item.vinculo),
      };
      const withSubtareas =
        categoria === 'prueba' || categoria === 'diligencia' || esAudienciaOfrecida({ tipo })
          ? ensureSubtareas(normalized)
          : normalized;
      const withPericial =
        categoria === 'prueba' && withSubtareas.tipo === 'pericial'
          ? ensurePericialMeta(withSubtareas)
          : withSubtareas;
      const withAudiencia = esAudienciaOfrecida(withPericial)
        ? syncFechaLimiteAudiencia(ensureAudienciaPruebaMeta(withPericial))
        : withPericial;
      const withDocumental =
        withAudiencia.tipo === 'documental_en_poder'
          ? syncFechaLimiteDocumentalEnPoder(ensureDocumentalEnPoderMeta(withAudiencia))
          : withAudiencia.tipo === 'documental'
            ? ensureDocumentalMeta(withAudiencia)
            : withAudiencia;
      if (withDocumental.categoria === 'audiencia') {
        return { ...withDocumental, estado: coerceEstadoAudienciaItem(withDocumental) };
      }
      return withDocumental;
    })
    .filter((item) => item.descripcion.length > 0)
    .sort((a, b) => a.orden - b.orden);

  const migrated = migrateModeloAudienciaPrueba(
    migrateExpedienteInformativaAOficio(
      migrarCedulasEmbebidas(mapped)
        .map(normalizarEstadosComunicacion)
        .map((item, index) => ({ ...item, orden: index + 1 })),
    ).map((item) => sanitizeForFirestore(item)),
  );

  return sanitizeForFirestore(consolidarAutenticidadDocumentalExpediente(migrated, []).items);
}

export function countByEstado(items: ControlPruebaItem[]): Record<PruebaEstado, number> {
  const counts = Object.fromEntries(PRUEBA_ESTADOS.map((e) => [e, 0])) as Record<PruebaEstado, number>;
  for (const item of items) {
    if (!esPruebaOfrecida(item)) continue;
    for (const estado of PRUEBA_ESTADOS) {
      if (itemVisibleConFiltroEstado(item, estado)) counts[estado] += 1;
    }
  }
  return counts;
}

export function countProximasAudiencias(items: ControlPruebaItem[]): number {
  const hoy = new Date().toISOString().slice(0, 10);
  return items.filter((i) => {
    if (esAudienciaOfrecida(i)) {
      return i.estado === 'audiencia_fijada' && i.fechaLimite && i.fechaLimite >= hoy;
    }
    return (
      resolveCategoria(i) === 'audiencia' &&
      (i.estado === 'programada' || i.estado === 'reprogramada') &&
      i.fechaLimite &&
      i.fechaLimite >= hoy
    );
  }).length;
}

export function countDiligenciasPendientes(items: ControlPruebaItem[]): number {
  const pendientes = new Set([
    'pendiente',
    'presentado',
    'enviado',
    'observado',
    'pendiente_realizacion',
    'presentada',
    'contestacion_parcial',
    'librada',
    'observada',
    'retirada',
    'pendiente_diligenciamiento',
  ]);
  return items.filter(
    (i) => resolveCategoria(i) === 'diligencia' && pendientes.has(String(i.estado)),
  ).length;
}

export function sistemaLabel(sistema?: PruebaSistema): string {
  switch (sistema) {
    case 'mev':
      return 'MEV SCBA';
    case 'pjn':
      return 'PJN';
    default:
      return 'Otro';
  }
}

export function mergeMetadataLocal(
  fromFile: Partial<ExpedienteMetadataLocal>,
  fromText: Partial<ExpedienteMetadataLocal>,
): ExpedienteMetadataLocal {
  return {
    caratula: (fromFile.caratula || fromText.caratula || '').trim(),
    numeroExpediente: (fromFile.numeroExpediente || fromText.numeroExpediente || '').trim(),
    juzgado: (fromText.juzgado || fromFile.juzgado || '').trim(),
    fuero: (fromText.fuero || fromFile.fuero || '').trim(),
  };
}

export type ExpedienteMetadataLocal = {
  caratula: string;
  numeroExpediente: string;
  juzgado: string;
  fuero: string;
};

/** Metadatos desde nombre de archivo (sin IA). Ej: "VERA c ICBC ... FRO 014018.pdf" */
export function extractMetadataFromFilename(fileName: string): Partial<ExpedienteMetadataLocal> {
  const base = repairSpanishTextEncoding(fileName.replace(/\.pdf$/i, '').trim());
  if (!base) return {};

  const froMatch =
    base.match(/\b(FRO\s*\d[\d./-]*)\s*$/i) ||
    base.match(/\b(FCN\s*\d[\d./-]*)\s*$/i) ||
    base.match(/\b(CCN\s*\d[\d./-]*)\s*$/i) ||
    base.match(/\b(FRO\s*\d[\d./-]*)\b/i);

  let numeroExpediente = froMatch ? froMatch[1].replace(/\s+/g, ' ').trim().toUpperCase() : '';
  let caratula = base;

  if (froMatch && typeof froMatch.index === 'number') {
    caratula = base.slice(0, froMatch.index).replace(/[\s\-_–—]+$/, '').trim();
  }

  caratula = caratula
    .replace(/\s+c\s+/gi, ' c/ ')
    .replace(/\s+s\s+/gi, ' s/ ')
    .replace(/\s+S\/\s+/g, ' s/ ')
    .replace(/\s+C\/\s+/g, ' c/ ');

  const fuero = numeroExpediente.startsWith('FRO')
    ? 'FRO'
    : numeroExpediente.startsWith('FCN')
      ? 'FCN'
      : numeroExpediente.startsWith('CCN')
        ? 'CCN'
        : '';

  return {
    caratula: repairSpanishTextEncoding(caratula || base),
    numeroExpediente,
    fuero,
  };
}

/** Metadatos desde texto del PDF (regex local, sin IA). */
export function extractMetadataFromExpedienteText(texto: string): Partial<ExpedienteMetadataLocal> {
  const head = repairSpanishTextEncoding(texto).slice(0, 25_000);
  const out: Partial<ExpedienteMetadataLocal> = {};

  const caratulaMatch =
    head.match(/car[áa]tula\s*(?:del\s*expediente)?[:\s]+([^\n]{8,160})/i) ||
    head.match(/autos\s*[:\s]+([^\n]{8,160})/i) ||
    head.match(/SUMARIO\s+ACTOR:\s*([^\n-]{8,120})/i) ||
    head.match(/EXPEDIENTE\s+CAR[ÁA]TULA:\s*([^\n]{8,160})/i);
  if (caratulaMatch?.[1]) {
    out.caratula = repairSpanishTextEncoding(caratulaMatch[1].replace(/\s+/g, ' ').trim());
  }

  const expPatterns = [
    /Nº\s*expediente:\s*(\d{5,})/i,
    /nidCausa=(\d{5,})/i,
    /(?:n[°º.]?\s*(?:de\s*)?expediente|expediente|expte\.?)\s*[:\s#]*([A-Z]{2,6}[\s./-]*\d[\d./-]*)/i,
    /\b(FRO\s*\d[\d./-]{2,})\b/i,
    /\b(FCN\s*\d[\d./-]{2,})\b/i,
    /\b(CCN\s*\d[\d./-]{2,})\b/i,
    /\b(CUIJ[:\s]*[\d-]{10,})\b/i,
  ];
  for (const re of expPatterns) {
    const m = head.match(re) || texto.match(re);
    if (m?.[1]) {
      out.numeroExpediente = m[1].replace(/\s+/g, ' ').trim().toUpperCase();
      break;
    }
  }

  const juzgadoMatch = head.match(
    /((?:Juzgado|Secretar[íi]a|Fuero)[^\n]{5,100})/i,
  );
  if (juzgadoMatch?.[1]) {
    out.juzgado = juzgadoMatch[1].replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  const fueroMatch = head.match(/\bFuero\s+(?:Nacional\s+)?(?:en\s+)?([^\n,]{3,40})/i);
  if (fueroMatch?.[1]) {
    out.fuero = fueroMatch[1].replace(/\s+/g, ' ').trim();
  } else if (out.numeroExpediente?.startsWith('FRO')) {
    out.fuero = 'FRO';
  }

  return out;
}

export const MAX_TEXTO_ANALISIS = 350_000;

export function truncateTextoForAnalysis(texto: string): string {
  return prioritizeTextoForPruebaAnalysis(texto, MAX_TEXTO_ANALISIS);
}

export function mapImportToItems(
  analysis: ControlPruebaImportOutput,
  startOrden = 1,
): ControlPruebaItem[] {
  const rawItems = analysis.items ?? analysis.pruebas ?? [];
  const { items } = filtrarItemsImportados(rawItems, startOrden);
  return normalizeItems(items);
}

export function mapImportToItemsWithFilter(
  analysis: ControlPruebaImportOutput,
  startOrden = 1,
): ImportFilterResult & {
  items: ControlPruebaItem[];
  oficiosAutenticidadPendientes: import('@/types/control-prueba').OficioAutenticidadPendiente[];
  resumenEjecutivo?: import('@/types/control-prueba').ResumenEjecutivoImport;
} {
  const rawItems = analysis.items ?? analysis.pruebas ?? [];
  const filtered = filtrarItemsImportados(rawItems, startOrden);
  let items = normalizeItems(filtered.items);
  const meta = buildImportMeta(analysis, items);
  items = attachOficiosToDocumentalItems(items, meta.oficiosAutenticidadPendientes);
  items = consolidarInformativasAutenticidadImport(items);
  return { ...filtered, items, oficiosAutenticidadPendientes: [], resumenEjecutivo: meta.resumenEjecutivo };
}

export function serializeControlPruebaDoc(
  id: string,
  data: FirebaseFirestore.DocumentData,
): import('@/types/control-prueba').ControlPruebaExpediente {
  return {
    id,
    caratula: repairSpanishTextEncoding(String(data.caratula ?? '')),
    numeroExpediente: data.numeroExpediente ?? '',
    juzgado: repairSpanishTextEncoding(String(data.juzgado ?? '')),
    fuero: repairSpanishTextEncoding(String(data.fuero ?? '')),
    expedienteUrl: String(data.expedienteUrl ?? ''),
    sistema: data.sistema ?? detectSistemaFromUrl(String(data.expedienteUrl ?? '')),
    notas: repairSpanishTextEncoding(String(data.notas ?? '')),
    pdfFileName: data.pdfFileName ?? undefined,
    pdfImportedAt: data.pdfImportedAt ?? undefined,
    actor: data.actor ? repairSpanishTextEncoding(String(data.actor)) : undefined,
    demandado: data.demandado ? repairSpanishTextEncoding(String(data.demandado)) : undefined,
    terceros: Array.isArray(data.terceros)
      ? (data.terceros as string[]).map((t) => String(t).trim()).filter(Boolean)
      : undefined,
    parteRepresentada:
      data.parteRepresentada === 'demandado'
        ? 'demandado'
        : data.parteRepresentada === 'actor'
          ? 'actor'
          : data.parteRepresentada === 'tercero'
            ? 'tercero'
            : '',
    partesRepresentadas: (() => {
      const fromDoc = Array.isArray(data.partesRepresentadas)
        ? (data.partesRepresentadas as string[]).filter(
            (p): p is 'actor' | 'demandado' | 'tercero' =>
              p === 'actor' || p === 'demandado' || p === 'tercero',
          )
        : [];
      return normalizePartesRepresentadas(
        fromDoc,
        data.parteRepresentada === 'demandado' ||
          data.parteRepresentada === 'actor' ||
          data.parteRepresentada === 'tercero'
          ? data.parteRepresentada
          : '',
      );
    })(),
    items: consolidarAutenticidadDocumentalExpediente(
      normalizeItems(data.items),
      normalizeOficiosAutenticidad(data.oficiosAutenticidadPendientes as OficioAutenticidadPendiente[] | undefined),
    ).items,
    hitos: Array.isArray(data.hitos)
      ? (data.hitos as ExpedienteHito[]).map((h) => ({
          id: String(h.id || crypto.randomUUID()),
          tipo: h.tipo ?? 'otro',
          fecha: h.fecha || null,
          label: h.label,
        }))
      : undefined,
    oficiosAutenticidadPendientes: [],
    resumenEjecutivo: normalizeResumenEjecutivo(
      data.resumenEjecutivo as ResumenEjecutivoImport | undefined,
    ),
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? undefined,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt ?? undefined,
    createdBy: data.createdBy ?? undefined,
    sharedWith: normalizeSharedWith(data.sharedWith),
    sharedWithUids: Array.isArray(data.sharedWithUids)
      ? (data.sharedWithUids as string[]).filter((u) => typeof u === 'string' && u)
      : undefined,
    tokenUsage: data.tokenUsage ?? undefined,
  };
}
