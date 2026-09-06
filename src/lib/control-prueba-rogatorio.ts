/**
 * Rogatorio — Oficio Ley 22.172
 * Oficio (diligencia normal) + trámite sede 1:1, colgados de la prueba madre.
 * Creación manual (no auto al importar).
 */

import type {
  ControlPruebaItem,
  ParentTipoSubproceso,
  RogatorioHito,
  RogatorioMeta,
  RogatorioTipoProduccion,
  SubprocesoVinculo,
} from '@/types/control-prueba';
import {
  ROGATORIO_SEDE_ESTADOS,
  TIPO_ROGATORIO_SEDE,
} from '@/types/control-prueba';
import { resolveCategoria } from '@/lib/control-prueba';
import { hijosDePadre } from '@/lib/control-prueba-subprocesos';

export const ROGATORIO_UI_LABEL = 'Rogatorio — Oficio Ley 22.172';

const HITOS_PERICIAL: { id: string; titulo: string }[] = [
  { id: 'expte_formado', titulo: 'Expediente formado en sede oficiada' },
  { id: 'perito_sorteado', titulo: 'Perito sorteado / designado' },
  { id: 'cargo_aceptado', titulo: 'Aceptación de cargo' },
  { id: 'en_produccion', titulo: 'Pericia en producción' },
  { id: 'dictamen', titulo: 'Dictamen presentado' },
  { id: 'remitido', titulo: 'Remitido al juzgado de origen' },
];

const HITOS_AUDIENCIA: { id: string; titulo: string }[] = [
  { id: 'expte_formado', titulo: 'Expediente formado en sede oficiada' },
  { id: 'audiencia_fijada', titulo: 'Audiencia fijada' },
  { id: 'celebrada', titulo: 'Audiencia celebrada' },
  { id: 'acta_remitida', titulo: 'Acta remitida al juzgado de origen' },
];

export function puedeTenerRogatorio(
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo'>,
): boolean {
  if (resolveCategoria(item as ControlPruebaItem) !== 'prueba') return false;
  return item.tipo === 'pericial' || item.tipo === 'testimonial' || item.tipo === 'confesional';
}

export function tipoProduccionRogatorio(
  item: Pick<ControlPruebaItem, 'tipo'>,
): RogatorioTipoProduccion | null {
  if (item.tipo === 'pericial') return 'pericial';
  if (item.tipo === 'testimonial') return 'testimonial';
  if (item.tipo === 'confesional') return 'confesional';
  return null;
}

/** Flag UI: producción en sede oficiada (creación del par es manual). */
export function esRogatorioMarcado(item: ControlPruebaItem): boolean {
  if (!puedeTenerRogatorio(item)) return false;
  if (item.tipo === 'pericial') return Boolean(item.pericial?.extrañaJurisdiccion);
  return Boolean(item.audienciaPrueba?.extrañaJurisdiccion);
}

export function patchMarcarRogatorio(
  item: ControlPruebaItem,
  marcado: boolean,
): Partial<ControlPruebaItem> {
  if (item.tipo === 'pericial') {
    return { pericial: { ...item.pericial, extrañaJurisdiccion: marcado } };
  }
  if (item.tipo === 'testimonial' || item.tipo === 'confesional') {
    return {
      audienciaPrueba: { ...item.audienciaPrueba, extrañaJurisdiccion: marcado },
    };
  }
  return {};
}

export function hitosPlantillaRogatorio(tipo: RogatorioTipoProduccion): RogatorioHito[] {
  const base = tipo === 'pericial' ? HITOS_PERICIAL : HITOS_AUDIENCIA;
  return base.map((h) => ({ ...h, completada: false, fecha: null }));
}

export function esOficioLey22172(
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo' | 'vinculo'>,
): boolean {
  return (
    resolveCategoria(item as ControlPruebaItem) === 'diligencia' &&
    (item.vinculo?.rol === 'oficio_ley_22172' || item.vinculo?.rol === 'exhorto_pericia')
  );
}

export function esTramiteSedeRogatoria(
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo' | 'vinculo'>,
): boolean {
  return (
    resolveCategoria(item as ControlPruebaItem) === 'tramite' &&
    (item.tipo === TIPO_ROGATORIO_SEDE || item.vinculo?.rol === 'tramite_sede_rogatoria')
  );
}

export function oficiosLey22172DePadre(
  items: ControlPruebaItem[],
  parentId: string,
): ControlPruebaItem[] {
  return hijosDePadre(parentId, items)
    .filter(esOficioLey22172)
    .sort((a, b) => a.orden - b.orden);
}

export function tramitesSedeDePadre(
  items: ControlPruebaItem[],
  parentId: string,
): ControlPruebaItem[] {
  return hijosDePadre(parentId, items)
    .filter(esTramiteSedeRogatoria)
    .sort((a, b) => a.orden - b.orden);
}

export function tramiteDeOficioRogatorio(
  items: ControlPruebaItem[],
  oficioId: string,
): ControlPruebaItem | undefined {
  return items.find((i) => esTramiteSedeRogatoria(i) && i.rogatorio?.oficioId === oficioId);
}

function parentTipoDeMadre(padre: ControlPruebaItem): ParentTipoSubproceso {
  if (padre.tipo === 'pericial') return 'pericial';
  if (padre.tipo === 'testimonial') return 'testimonial';
  return 'confesional';
}

function triggerKeyOficio(parentId: string, n: number): string {
  return `oficio_ley_22172|${parentId}|${n}`;
}

function triggerKeyTramite(parentId: string, oficioId: string): string {
  return `tramite_sede_rogatoria|${parentId}|${oficioId}`;
}

export function buildOficioLey22172(
  padre: ControlPruebaItem,
  opts: {
    orden: number;
    destinatario?: string;
    indice: number;
    autoCreated?: boolean;
  },
): ControlPruebaItem {
  const dest =
    opts.destinatario?.trim() ||
    padre.pericial?.juzgadoOficiado?.trim() ||
    'Juez oficiado (Ley 22.172)';
  const parentTipo = parentTipoDeMadre(padre);
  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo,
    parentCategoria: 'prueba',
    rol: 'oficio_ley_22172',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: `${ROGATORIO_UI_LABEL} — ${dest}`,
    triggerKey: triggerKeyOficio(padre.id, opts.indice),
  };

  const objetoBase =
    padre.tipo === 'pericial'
      ? `Rogatorio Ley 22.172 — sorteo/designación de perito y producción. ${padre.descripcion}`
      : padre.tipo === 'testimonial'
        ? `Rogatorio Ley 22.172 — declaración testimonial. ${padre.descripcion}`
        : `Rogatorio Ley 22.172 — declaración confesional. ${padre.descripcion}`;

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'diligencia',
    tipo: 'oficio',
    descripcion: `${ROGATORIO_UI_LABEL} — ${padre.descripcion.slice(0, 120)}`.slice(0, 240),
    ofrecidaPor: padre.ofrecidaPor ?? 'actor',
    estado: 'pendiente',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones:
      'Oficio Ley 22.172 — diligenciar como cualquier oficio. Al cumplirse, completar el trámite de sede oficiada.',
    vinculo,
    diligencia: {
      destinatario: dest,
      objeto: objetoBase.slice(0, 400),
      fechaPresentacion: null,
      fechaLibramiento: null,
      fechaDiligenciamiento: null,
      pruebaVinculadaId: padre.id,
    },
  };
}

export function buildTramiteSedeRogatoria(
  padre: ControlPruebaItem,
  oficio: ControlPruebaItem,
  opts: { orden: number; autoCreated?: boolean },
): ControlPruebaItem {
  const tipoProd = tipoProduccionRogatorio(padre) ?? 'pericial';
  const dest = oficio.diligencia?.destinatario?.trim() || 'Sede oficiada';
  const parentTipo = parentTipoDeMadre(padre);
  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo,
    parentCategoria: 'prueba',
    rol: 'tramite_sede_rogatoria',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: `Trámite sede — ${dest}`,
    triggerKey: triggerKeyTramite(padre.id, oficio.id),
  };

  const rogatorio: RogatorioMeta = {
    oficioId: oficio.id,
    tipoProduccion: tipoProd,
    juzgadoOficiado:
      padre.pericial?.juzgadoOficiado?.trim() || oficio.diligencia?.destinatario?.trim() || null,
    expedienteRogatoria: padre.pericial?.expedienteRogatoria?.trim() || null,
    hitos: hitosPlantillaRogatorio(tipoProd),
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'tramite',
    tipo: TIPO_ROGATORIO_SEDE,
    descripcion: `Trámite sede oficiada — ${padre.descripcion.slice(0, 140)}`.slice(0, 240),
    ofrecidaPor: padre.ofrecidaPor ?? 'actor',
    estado: 'pendiente',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: null,
    vinculo,
    rogatorio,
  };
}

/**
 * Crea el par oficio + trámite bajo la madre.
 * Requiere flag rogatorio marcado. Permite N pares (varias sedes).
 */
export function crearRogatorioLey22172(
  items: ControlPruebaItem[],
  parentId: string,
  opts?: { destinatario?: string },
): { items: ControlPruebaItem[]; oficio: ControlPruebaItem | null; tramite: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre || !puedeTenerRogatorio(padre) || !esRogatorioMarcado(padre)) {
    return { items, oficio: null, tramite: null };
  }

  const n = oficiosLey22172DePadre(items, parentId).length + 1;
  const oficio = buildOficioLey22172(padre, {
    orden: items.length + 1,
    destinatario: opts?.destinatario,
    indice: n,
  });
  const tramite = buildTramiteSedeRogatoria(padre, oficio, {
    orden: items.length + 2,
  });

  return {
    items: [...items, oficio, tramite],
    oficio,
    tramite,
  };
}

export function normalizeRogatorio(raw: unknown): RogatorioMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as RogatorioMeta;
  if (!r.oficioId || !r.tipoProduccion) return undefined;
  const plantilla = hitosPlantillaRogatorio(r.tipoProduccion);
  const prevById = new Map((r.hitos ?? []).map((h) => [h.id, h]));
  const hitos = plantilla.map((h) => {
    const prev = prevById.get(h.id);
    return {
      ...h,
      completada: Boolean(prev?.completada),
      fecha: prev?.fecha ?? null,
    };
  });
  return {
    oficioId: String(r.oficioId),
    tipoProduccion: r.tipoProduccion,
    juzgadoOficiado: r.juzgadoOficiado?.trim() || null,
    expedienteRogatoria: r.expedienteRogatoria?.trim() || null,
    hitos,
  };
}

export function estadosParaTramiteRogatorio(): readonly string[] {
  return ROGATORIO_SEDE_ESTADOS;
}

/** Al completar hito de remisión, empuja estado de la madre. */
export function syncMadreTrasHitoRogatorio(
  items: ControlPruebaItem[],
  tramiteId: string,
  hitos: RogatorioHito[],
): ControlPruebaItem[] {
  const tramite = items.find((i) => i.id === tramiteId);
  if (!tramite || !esTramiteSedeRogatoria(tramite)) return items;
  const parentId = tramite.vinculo?.parentItemId;
  if (!parentId) return items;

  const remitido =
    hitos.some((h) => (h.id === 'remitido' || h.id === 'acta_remitida') && h.completada) ||
    hitos.filter((h) => h.completada).length === hitos.length;

  let next = items.map((i) => {
    if (i.id !== tramiteId) return i;
    const estado = remitido ? 'remitido' : hitos.some((h) => h.completada) ? 'en_tramite' : 'pendiente';
    return {
      ...i,
      estado,
      rogatorio: i.rogatorio ? { ...i.rogatorio, hitos } : i.rogatorio,
      fechaProduccion: remitido ? i.fechaProduccion || new Date().toISOString().slice(0, 10) : i.fechaProduccion,
    };
  });

  if (!remitido) return next;

  const madre = next.find((i) => i.id === parentId);
  if (!madre) return next;
  const tipo = tramite.rogatorio?.tipoProduccion ?? tipoProduccionRogatorio(madre);
  if (tipo === 'pericial') {
    const e = String(madre.estado);
    if (
      e === 'pendiente_produccion' ||
      e === 'perito_designado' ||
      e === 'puntos_trasladados' ||
      e === 'en_produccion'
    ) {
      next = next.map((i) => (i.id === parentId ? { ...i, estado: 'dictamen_presentado' } : i));
    }
  } else if (tipo === 'testimonial' || tipo === 'confesional') {
    const e = String(madre.estado);
    if (e === 'pendiente_produccion' || e === 'audiencia_fijada' || e === 'postpuesta_juez') {
      next = next.map((i) => (i.id === parentId ? { ...i, estado: 'producida' } : i));
    }
  }

  return next;
}
