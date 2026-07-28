import type {
  ControlPruebaItem,
  ItemCategoria,
  ParentTipoSubproceso,
  SubprocesoRol,
  SubprocesoVinculo,
  CedulaNotificacionPruebaLegacy,
} from '@/types/control-prueba';
import { esConfesional, resolveCategoria, TIPO_LABELS } from '@/lib/control-prueba';
import {
  requiereAudienciaPrueba,
  audienciaEstaFijadaParaCedula,
  fechaHoraAudienciaParaCedula,
  coerceEstadoAudienciaItem,
} from '@/lib/control-prueba-audiencia-prueba';
import {
  buildEventoAudienciaPrueba,
  esEventoAudienciaPrueba,
  eventoAudienciaActivoDePrueba,
  eventosAudienciaDePrueba,
  pruebaIdDeEventoAudiencia,
  sincronizarEstadoPruebaConEventos,
} from '@/lib/control-prueba-audiencia-evento';
import {
  labelParteConDocumentos,
  parteContrariaDefault,
  requiereFlujoDocumentalEnPoder,
  intimacionDocumentalActiva,
} from '@/lib/control-prueba-documental-poder';
import { requiereFlujoAutenticidadDocumental } from '@/lib/control-prueba-documental-autenticidad';
import type { CedulaNotifMedio } from '@/types/control-prueba';
import { restarDiasHabiles } from '@/lib/control-prueba-plazos';

const DIAS_ANTES_AUDIENCIA_CEDULA = 10;
const DIAS_ANTES_PLAZO_PRESENTACION_CEDULA = 5;

export type SubprocesoEvalContext = {
  items: ControlPruebaItem[];
  itemId: string;
  itemAnterior: ControlPruebaItem;
  patch: Partial<ControlPruebaItem>;
  usuario?: string;
};

export type SubprocesoEvalResult = {
  items: ControlPruebaItem[];
  creados: ControlPruebaItem[];
  alertas: string[];
};

/** Índice parentId → hijos vinculados (O(n), una pasada). */
export function buildHijosIndex(items: ControlPruebaItem[]): Map<string, ControlPruebaItem[]> {
  const map = new Map<string, ControlPruebaItem[]>();
  for (const item of items) {
    const parentId = item.vinculo?.parentItemId;
    if (!parentId) continue;
    const list = map.get(parentId) ?? [];
    list.push(item);
    map.set(parentId, list);
  }
  return map;
}

export function hijosDePadre(parentId: string, items: ControlPruebaItem[]): ControlPruebaItem[] {
  return items.filter((i) => i.vinculo?.parentItemId === parentId);
}

export function parentTipoDeItem(item: ControlPruebaItem): ParentTipoSubproceso | null {
  if (esConfesional(item) || item.tipo === 'confesional') return 'confesional';
  if (item.tipo === 'testimonial' || item.tipo === 'audiencia_testimonial') return 'testimonial';
  if (item.tipo === 'pericial') return 'pericial';
  if (item.tipo === 'documental_en_poder') return 'documental_en_poder';
  if (item.tipo === 'documental') return 'documental';
  return null;
}

export function esPadreSubprocesos(item: ControlPruebaItem): boolean {
  return (
    parentTipoDeItem(item) !== null &&
    (requiereAudienciaPrueba(item.tipo) ||
      item.tipo === 'pericial' ||
      requiereFlujoDocumentalEnPoder(item.tipo))
  );
}

function triggerKeyCedula(parentId: string, destinatario: string, fecha: string, hora: string): string {
  const dest = destinatario.trim() || '_default';
  return `cedula_audiencia|${parentId}|${dest}|${fecha}|${hora}`;
}

function mapEstadoCedulaLegacyAEmbedded(estado: CedulaNotificacionPruebaLegacy['estado']): string {
  switch (estado) {
    case 'librada':
      return 'librada';
    case 'notificada':
      return 'notificada';
    case 'negativa':
      return 'resultado_negativo';
    case 'sin_efecto':
      return 'resultado_negativo';
    default:
      return 'pendiente_realizacion';
  }
}

function labelTipoAudiencia(tipo: string): string {
  if (tipo === 'confesional') return 'confesional';
  if (tipo === 'testimonial') return 'testimonial';
  return TIPO_LABELS[tipo] ?? tipo;
}

export function buildCedulaAudienciaDiligencia(
  padre: ControlPruebaItem,
  opts: {
    destinatario?: string;
    autoCreated?: boolean;
    triggerKey?: string;
    orden: number;
    estadoDiligencia?: string;
    fechaLibramiento?: string | null;
    fechaDiligenciamiento?: string | null;
    observaciones?: string | null;
  },
  pruebaRef?: ControlPruebaItem | null,
): ControlPruebaItem {
  const esEvento = esEventoAudienciaPrueba(padre);
  const prueba = pruebaRef ?? (esEvento ? undefined : padre);
  const ap = prueba?.audienciaPrueba ?? padre.audienciaPrueba ?? {};
  const aud = padre.audiencia ?? {};
  const fechaDesdeEvento = esEvento ? padre.fechaLimite : null;
  const horaDesdeEvento = esEvento ? aud.hora : null;
  const { fecha, hora } = esEvento
    ? { fecha: fechaDesdeEvento, hora: horaDesdeEvento }
    : fechaHoraAudienciaParaCedula(padre);
  const fechaVal = fecha ?? ap.fechaAudiencia ?? padre.fechaLimite ?? '';
  const horaVal = hora ?? ap.horaAudiencia ?? aud.hora ?? '';
  const destinatario = opts.destinatario?.trim() ?? '';
  const tipoLabel = labelTipoAudiencia(esEvento ? padre.tipo : padre.tipo);
  const parentTipo = esEvento
    ? (padre.vinculo?.parentTipo ?? parentTipoDeItem(padre))
    : parentTipoDeItem(padre);
  const tk = opts.triggerKey ?? triggerKeyCedula(padre.id, destinatario, fechaVal, horaVal);
  const fechaLimite = fechaVal ? restarDiasHabiles(fechaVal, DIAS_ANTES_AUDIENCIA_CEDULA) : null;
  const pruebaVinculadaId = esEvento ? (pruebaIdDeEventoAudiencia(padre) ?? padre.id) : padre.id;
  const objetoDesc = prueba?.descripcion ?? padre.descripcion;

  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo: parentTipo ?? 'confesional',
    parentCategoria: resolveCategoria(padre),
    rol: 'cedula_audiencia',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: `Cédula audiencia ${tipoLabel}${destinatario ? ` — ${destinatario}` : ''}`,
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'diligencia',
    tipo: 'cedula',
    descripcion: `Cédula de notificación de audiencia ${tipoLabel}${fechaVal ? ` — ${fechaVal}` : ''}${horaVal ? ` ${horaVal}` : ''}`.trim(),
    ofrecidaPor: prueba?.ofrecidaPor ?? padre.ofrecidaPor ?? 'actor',
    estado: opts.estadoDiligencia ?? 'pendiente_realizacion',
    fechaLimite,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: opts.observaciones ?? null,
    vinculo,
    diligencia: {
      destinatario: destinatario || undefined,
      objeto: objetoDesc,
      medioNotificacion: 'papel',
      fechaPresentacion: null,
      fechaLibramiento: opts.fechaLibramiento ?? null,
      fechaDiligenciamiento: opts.fechaDiligenciamiento ?? null,
      pruebaVinculadaId,
    },
  };
}

function existeHijoConTrigger(items: ControlPruebaItem[], triggerKey: string): boolean {
  return items.some((i) => i.vinculo?.triggerKey === triggerKey);
}

function cedulasActivasDePadre(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  return cedulasAudienciaDeEvento(items, parentId);
}

export function cedulasAudienciaDeEvento(items: ControlPruebaItem[], eventoId: string): ControlPruebaItem[] {
  return hijosDePadre(eventoId, items).filter(
    (i) => i.vinculo?.rol === 'cedula_audiencia' && resolveCategoria(i) === 'diligencia',
  );
}

export function cedulasAudienciaDePrueba(items: ControlPruebaItem[], pruebaId: string): ControlPruebaItem[] {
  const porEvento = eventosAudienciaDePrueba(items, pruebaId).flatMap((e) =>
    cedulasAudienciaDeEvento(items, e.id),
  );
  const legacy = hijosDePadre(pruebaId, items).filter(
    (i) => i.vinculo?.rol === 'cedula_audiencia' && resolveCategoria(i) === 'diligencia',
  );
  const ids = new Set(porEvento.map((c) => c.id));
  return [...porEvento, ...legacy.filter((c) => !ids.has(c.id))];
}

function eliminarEventosAudienciaAutoDePrueba(items: ControlPruebaItem[], pruebaId: string): ControlPruebaItem[] {
  const eventoIds = new Set(
    eventosAudienciaDePrueba(items, pruebaId)
      .filter((e) => e.vinculo?.autoCreated)
      .map((e) => e.id),
  );
  return items.filter((i) => {
    if (eventoIds.has(i.id)) return false;
    if (i.vinculo?.autoCreated && eventoIds.has(i.vinculo.parentItemId)) return false;
    return true;
  });
}

/** Quita cédulas auto-creadas al desfijar/postergar audiencia o eliminar el ítem padre. */
function eliminarHijosAutoCreados(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  return items.filter((i) => !(i.vinculo?.parentItemId === parentId && i.vinculo.autoCreated));
}

/** Al eliminar padre: quitar cédulas auto-creadas vinculadas (las manuales se conservan). */
export function marcarHijosSinEfectoPorPadreEliminado(
  items: ControlPruebaItem[],
  parentId: string,
): ControlPruebaItem[] {
  return eliminarHijosAutoCreados(items, parentId);
}

/**
 * Al desistir una prueba madre: elimina todas las diligencias hijas
 * (directas, bajo eventos de audiencia, por pruebaVinculadaId / oficioOrigenId y sucesoras).
 */
export function eliminarDiligenciasHijasDeMadre(
  items: ControlPruebaItem[],
  madreId: string,
): ControlPruebaItem[] {
  const eventoIds = new Set(
    items
      .filter(
        (i) =>
          i.vinculo?.parentItemId === madreId &&
          (i.vinculo?.rol === 'audiencia_prueba' || resolveCategoria(i) === 'audiencia'),
      )
      .map((i) => i.id),
  );

  const toRemove = new Set<string>();
  for (const i of items) {
    if (resolveCategoria(i) !== 'diligencia') continue;
    const parentId = i.vinculo?.parentItemId;
    if (parentId === madreId || (parentId && eventoIds.has(parentId))) {
      toRemove.add(i.id);
      continue;
    }
    if (i.diligencia?.pruebaVinculadaId === madreId) {
      toRemove.add(i.id);
      continue;
    }
    if (i.diligencia?.oficioOrigenId === madreId) {
      toRemove.add(i.id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const i of items) {
      if (resolveCategoria(i) !== 'diligencia') continue;
      if (toRemove.has(i.id)) continue;
      const origen = i.diligencia?.oficioOrigenId;
      if (origen && toRemove.has(origen)) {
        toRemove.add(i.id);
        changed = true;
      }
    }
  }

  if (toRemove.size === 0) return items;
  return items.filter((i) => !toRemove.has(i.id));
}

function evaluarDesistimientoPrueba(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const alertas: string[] = [];
  let items = [...ctx.items];

  if (ctx.patch.estado === undefined || String(ctx.patch.estado) !== 'desistida') {
    return { items, creados: [], alertas };
  }
  if (String(ctx.itemAnterior.estado) === 'desistida') {
    return { items, creados: [], alertas };
  }

  const padre = items.find((i) => i.id === ctx.itemId);
  if (!padre || padre.vinculo?.parentItemId) {
    return { items, creados: [], alertas };
  }
  const cat = resolveCategoria(padre);
  if (cat === 'diligencia' || cat === 'tramite' || cat === 'mejor_proveer') {
    return { items, creados: [], alertas };
  }

  const before = items.length;
  items = eliminarDiligenciasHijasDeMadre(items, padre.id);
  const removed = before - items.length;
  if (removed > 0) {
    alertas.push(
      removed === 1
        ? 'Se eliminó 1 diligencia vinculada (prueba desistida).'
        : `Se eliminaron ${removed} diligencias vinculadas (prueba desistida).`,
    );
  }
  return { items, creados: [], alertas };
}

function actualizarPlazosCedulasActivas(items: ControlPruebaItem[], padre: ControlPruebaItem): ControlPruebaItem[] {
  const fecha = esEventoAudienciaPrueba(padre)
    ? padre.fechaLimite
    : (padre.audienciaPrueba?.fechaAudiencia ?? padre.fechaLimite);
  if (!fecha) return items;
  const hora = esEventoAudienciaPrueba(padre)
    ? (padre.audiencia?.hora ?? '')
    : (padre.audienciaPrueba?.horaAudiencia ?? '');
  const fechaLimite = restarDiasHabiles(fecha, DIAS_ANTES_AUDIENCIA_CEDULA);
  const tipoLabel = labelTipoAudiencia(padre.tipo);

  return items.map((i) => {
    if (i.vinculo?.parentItemId !== padre.id || i.vinculo.rol !== 'cedula_audiencia') return i;
    const dest = i.diligencia?.destinatario ?? '';
    return {
      ...i,
      fechaLimite,
      descripcion: `Cédula de notificación de audiencia ${tipoLabel} — ${fecha}${hora ? ` ${hora}` : ''}`,
      vinculo: {
        ...i.vinculo,
        triggerKey: triggerKeyCedula(padre.id, dest, fecha, hora),
        vinculoLabel: `Cédula audiencia ${tipoLabel}${dest ? ` — ${dest}` : ''}`,
      },
    };
  });
}

/** Migra cedulasNotificacion[] embebidas → ítems diligencia (una sola copia canónica). */
export function migrarCedulasEmbebidas(items: ControlPruebaItem[]): ControlPruebaItem[] {
  let result = [...items];
  const nuevos: ControlPruebaItem[] = [];

  for (const padre of result) {
    const embebidas = padre.audienciaPrueba?.cedulasNotificacion ?? [];
    if (embebidas.length === 0) continue;

    for (const ced of embebidas) {
      const ap = padre.audienciaPrueba ?? {};
      const fecha = ap.fechaAudiencia ?? '';
      const hora = ap.horaAudiencia ?? '';
      const tk = triggerKeyCedula(padre.id, ced.destinatario, fecha, hora);
      if (existeHijoConTrigger([...result, ...nuevos], tk)) continue;

      nuevos.push(
        buildCedulaAudienciaDiligencia(padre, {
          destinatario: ced.destinatario,
          autoCreated: true,
          triggerKey: tk,
          orden: result.length + nuevos.length + 1,
          estadoDiligencia: mapEstadoCedulaLegacyAEmbedded(ced.estado),
          fechaLibramiento: ced.fechaLibramiento,
          fechaDiligenciamiento: ced.fechaDiligenciamiento,
          observaciones: ced.observaciones,
        }),
      );
    }

    result = result.map((i) => {
      if (i.id !== padre.id || !i.audienciaPrueba?.cedulasNotificacion) return i;
      const { cedulasNotificacion: _ced, ...apRest } = i.audienciaPrueba;
      return { ...i, audienciaPrueba: apRest };
    });
  }

  if (nuevos.length === 0) {
    return result;
  }

  return [...result, ...nuevos].map((item, index) => ({ ...item, orden: index + 1 }));
}

export function cedulasIntimacionDocumentalDePadre(
  items: ControlPruebaItem[],
  parentId: string,
): ControlPruebaItem[] {
  return items.filter(
    (i) => i.vinculo?.parentItemId === parentId && i.vinculo?.rol === 'cedula_intimacion_documental',
  );
}

function triggerKeyIntimacionDocumental(parentId: string, parte: string, plazo: string, medio: string): string {
  return `cedula_intimacion_documental|${parentId}|${parte}|${plazo}|${medio}`;
}

export function buildCedulaIntimacionDocumental(
  padre: ControlPruebaItem,
  opts: {
    destinatario?: string;
    autoCreated?: boolean;
    triggerKey?: string;
    orden: number;
    estadoDiligencia?: string;
    fechaLibramiento?: string | null;
    fechaDiligenciamiento?: string | null;
    observaciones?: string | null;
    porFaltantes?: boolean;
  },
): ControlPruebaItem {
  const dep = padre.documentalEnPoder ?? {};
  const plazo = dep.plazoPresentacion ?? padre.fechaLimite ?? '';
  const parte = String(dep.parteConDocumentos ?? parteContrariaDefault(padre.ofrecidaPor));
  const medio = (dep.medioIntimacion as CedulaNotifMedio) ?? 'papel';
  const destinatario = opts.destinatario?.trim() || labelParteConDocumentos(parte);
  const tk = opts.triggerKey ?? triggerKeyIntimacionDocumental(padre.id, parte, plazo, medio);
  const tipoCedula = medio === 'electronica' ? 'cedula_electronica' : 'cedula';
  const porFaltantes =
    opts.porFaltantes || String(padre.estado) === 'exhibicion_parcial';
  const objeto =
    (porFaltantes ? dep.documentosFaltantes?.trim() : null) ||
    dep.documentosDetalle ||
    padre.descripcion;
  const label = porFaltantes
    ? `Cédula intimación (documental faltante) — ${destinatario}`
    : `Cédula intimación documental — ${destinatario}`;

  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo: 'documental_en_poder',
    parentCategoria: resolveCategoria(padre),
    rol: 'cedula_intimacion_documental',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: label,
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'diligencia',
    tipo: tipoCedula,
    descripcion: label,
    ofrecidaPor: padre.ofrecidaPor ?? 'tribunal',
    estado: opts.estadoDiligencia ?? 'pendiente_realizacion',
    fechaLimite: plazo || null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones:
      opts.observaciones ??
      (porFaltantes ? 'Intimación por exhibición parcial — presentar documental faltante' : null),
    vinculo,
    diligencia: {
      destinatario,
      objeto,
      medioNotificacion: medio,
      fechaPresentacion: null,
      fechaLibramiento: opts.fechaLibramiento ?? null,
      fechaDiligenciamiento: opts.fechaDiligenciamiento ?? null,
      plazoContestacion: plazo || null,
      pruebaVinculadaId: padre.id,
    },
  };
}

function triggerKeyOficioAutenticidadDocumental(parentId: string, destinatario: string): string {
  const norm = destinatario.toLowerCase().trim().replace(/\s+/g, ' ');
  return `oficio_autenticidad|${parentId}|${norm}`;
}

/** @deprecated Puente informativa eliminado — solo lectura legacy. */
export function hijosInformativaAutenticidad(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  return items.filter(
    (i) => i.vinculo?.parentItemId === parentId && i.vinculo?.rol === 'informativa_autenticidad',
  );
}

function esOficioAutenticidadItem(item: ControlPruebaItem): boolean {
  return (
    resolveCategoria(item) === 'diligencia' &&
    (item.tipo === 'oficio' || item.tipo === 'oficio_electronico') &&
    (item.vinculo?.rol === 'oficio_autenticidad' || item.vinculo?.rol === 'oficio_informativa')
  );
}

export function oficiosAutenticidadDeDocumental(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  const directos = items.filter(
    (i) => esOficioAutenticidadItem(i) && i.vinculo?.parentItemId === parentId,
  );
  const porPruebaVinculada = items.filter(
    (i) => esOficioAutenticidadItem(i) && i.diligencia?.pruebaVinculadaId === parentId,
  );
  const ids = new Set(directos.map((i) => i.id));
  return [...directos, ...porPruebaVinculada.filter((i) => !ids.has(i.id))];
}

function normDestinatarioAutenticidad(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae el oficiado de observaciones sin arrastrar "para obtener…". */
function destinatarioDesdeObservaciones(obs: string | null | undefined): string | null {
  if (!obs) return null;
  const m = obs.match(
    /oficio\s+a\s+([^·.\n,]+?)(?=\s+para\b|\s+con\b|\s+a\s+efectos|\s+en\s+orden|\s+de\s+fecha|[·.\n,]|$)/i,
  );
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  // Evitar capturas demasiado largas (frases enteras).
  if (raw.split(/\s+/).length > 6) return raw.split(/\s+/).slice(0, 4).join(' ');
  return raw;
}

/** True si dos destinatarios apuntan al mismo oficiado (casi iguales / uno contiene al otro). */
function mismoDestinatarioAutenticidad(a: string, b: string): boolean {
  const na = normDestinatarioAutenticidad(a);
  const nb = normDestinatarioAutenticidad(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.startsWith(nb) || nb.startsWith(na);
}

function fusionarDestinatariosAutenticidad(candidatos: string[]): string[] {
  const out: string[] = [];
  for (const raw of candidatos) {
    const d = raw.trim();
    if (!d) continue;
    const idx = out.findIndex((x) => mismoDestinatarioAutenticidad(x, d));
    if (idx < 0) {
      out.push(d);
      continue;
    }
    // Preferir el más corto / canónico (p.ej. "Andreani" vs "Andreani para obtener original").
    if (d.length < out[idx]!.length) out[idx] = d;
  }
  return out;
}

function destinatariosAutenticidadDocumental(padre: ControlPruebaItem): string[] {
  const doc = padre.documental ?? {};
  const candidatos: string[] = [];
  const principal = doc.destinatarioOficio?.trim();
  if (principal) candidatos.push(principal);
  for (const o of doc.oficiosAutenticidad ?? []) {
    const d = o.destinatarioOficio?.trim();
    if (d) candidatos.push(d);
  }
  const fromObs = destinatarioDesdeObservaciones(padre.observaciones);
  if (fromObs) candidatos.push(fromObs);
  return fusionarDestinatariosAutenticidad(candidatos);
}

/** Quita oficios auto-creados redundantes del mismo padre (destinatario casi igual). */
function dedupeOficiosAutenticidadDocumental(
  items: ControlPruebaItem[],
  parentId: string,
): ControlPruebaItem[] {
  const oficios = oficiosAutenticidadDeDocumental(items, parentId);
  if (oficios.length < 2) return items;

  const keep = new Set<string>();
  const drop = new Set<string>();
  // Preferir manual/import sobre auto; entre iguales, el destinatario más corto.
  const sorted = [...oficios].sort((a, b) => {
    const aAuto = a.vinculo?.autoCreated ? 1 : 0;
    const bAuto = b.vinculo?.autoCreated ? 1 : 0;
    if (aAuto !== bAuto) return aAuto - bAuto;
    const aLen = (a.diligencia?.destinatario ?? '').length;
    const bLen = (b.diligencia?.destinatario ?? '').length;
    return aLen - bLen;
  });

  for (const o of sorted) {
    if (drop.has(o.id)) continue;
    const dest = o.diligencia?.destinatario?.trim() ?? '';
    const dup = sorted.find(
      (other) =>
        other.id !== o.id &&
        !drop.has(other.id) &&
        !keep.has(other.id) &&
        mismoDestinatarioAutenticidad(dest, other.diligencia?.destinatario?.trim() ?? ''),
    );
    if (dup) {
      // Conservar `o` (mejor ranking); marcar el resto de casi-iguales.
      keep.add(o.id);
      for (const other of sorted) {
        if (other.id === o.id || keep.has(other.id) || drop.has(other.id)) continue;
        if (mismoDestinatarioAutenticidad(dest, other.diligencia?.destinatario?.trim() ?? '')) {
          // Solo auto-creados: no borrar oficios manuales distintos a propósito.
          if (other.vinculo?.autoCreated) drop.add(other.id);
          else keep.add(other.id);
        }
      }
    } else {
      keep.add(o.id);
    }
  }

  if (drop.size === 0) return items;
  return items.filter((i) => !drop.has(i.id));
}

function ensureVinculosAutenticidadDocumental(
  items: ControlPruebaItem[],
  parentId: string,
): SubprocesoEvalResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  let working = dedupeOficiosAutenticidadDocumental([...items], parentId);

  const padreIdx = working.findIndex((i) => i.id === parentId);
  const padre = padreIdx >= 0 ? working[padreIdx] : undefined;
  if (!padre || !requiereFlujoAutenticidadDocumental(padre.tipo) || !padreConAutenticidadImpugnada(padre)) {
    return { items: working, creados, alertas };
  }

  const destinatarios = destinatariosAutenticidadDocumental(padre);
  for (const dest of destinatarios) {
    const tkOficio = triggerKeyOficioAutenticidadDocumental(padre.id, dest);
    const yaExiste = oficiosAutenticidadDeDocumental(working, padre.id).some((o) =>
      mismoDestinatarioAutenticidad(o.diligencia?.destinatario?.trim() ?? '', dest),
    );
    if (yaExiste || existeHijoConTrigger(working, tkOficio)) continue;

    const oficio = buildOficioAutenticidadDocumental(padre, {
      autoCreated: true,
      triggerKey: tkOficio,
      orden: working.length + creados.length + 1,
      destinatario: dest,
    });
    working = [...working, oficio];
    creados.push(oficio);
  }

  if (creados.length > 0) {
    alertas.push('Se creó oficio de autenticidad en Comunicaciones.');
  }

  return { items: working, creados, alertas };
}

export function buildOficioAutenticidadDocumental(
  padre: ControlPruebaItem,
  opts: { autoCreated?: boolean; triggerKey?: string; orden: number; destinatario?: string },
): ControlPruebaItem {
  const dep = padre.documental ?? {};
  const destinatario = opts.destinatario?.trim() || dep.destinatarioOficio?.trim() || 'Oficiado';
  const parentTipo = parentTipoDeItem(padre) ?? 'documental';
  const tk = opts.triggerKey ?? triggerKeyOficioAutenticidadDocumental(padre.id, destinatario);

  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo,
    parentCategoria: resolveCategoria(padre),
    rol: 'oficio_autenticidad',
    autoCreated: opts.autoCreated ?? false,
    vinculoLabel: `Oficio autenticidad — ${destinatario}`,
    triggerKey: tk,
  };

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'diligencia',
    tipo: 'oficio',
    descripcion: `Oficio autenticidad — ${padre.descripcion.slice(0, 100)}`,
    // Misma parte que el documental: así aparece en Actor/Demandada, no solo en Tribunal.
    ofrecidaPor: padre.ofrecidaPor ?? 'tribunal',
    estado: 'pendiente',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: null,
    vinculo,
    diligencia: {
      destinatario,
      objeto: `Informar sobre autenticidad de: ${padre.descripcion}`,
      fechaPresentacion: null,
      fechaLibramiento: null,
      fechaDiligenciamiento: null,
      pruebaVinculadaId: padre.id,
    },
  };
}

/** @deprecated Usar buildOficioAutenticidadDocumental */
export function buildOficioInformativaAutenticidad(
  padre: ControlPruebaItem,
  _informativa: ControlPruebaItem,
  opts: { autoCreated?: boolean; triggerKey?: string; orden: number; destinatario?: string },
): ControlPruebaItem {
  return buildOficioAutenticidadDocumental(padre, opts);
}

/** @deprecated Puente informativa eliminado */
export function buildInformativaAutenticidadDocumental(
  padre: ControlPruebaItem,
  opts: { autoCreated?: boolean; triggerKey?: string; orden: number },
): ControlPruebaItem {
  return buildOficioAutenticidadDocumental(padre, {
    ...opts,
    destinatario: padre.documental?.destinatarioOficio?.trim() || 'Oficiado',
  });
}

function padreConIntimacionOrdenada(item: ControlPruebaItem): boolean {
  return item.estado === 'intimacion_ordenada';
}

function padreConAutenticidadImpugnada(item: ControlPruebaItem): boolean {
  return item.estado === 'autenticidad_impugnada';
}

function padreConAudienciaFijada(item: ControlPruebaItem): boolean {
  return audienciaEstaFijadaParaCedula(item);
}

function evaluarSubProcesosAudiencia(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  let items = [...ctx.items];

  const padre = items.find((i) => i.id === ctx.itemId);
  if (!padre) return { items, creados, alertas };

  if (esEventoAudienciaPrueba(padre)) {
    const anterior = ctx.itemAnterior;
    let evento = padre;
    const estadoNormalizado = coerceEstadoAudienciaItem(padre);
    if (String(padre.estado) !== estadoNormalizado) {
      items = items.map((i) => (i.id === padre.id ? { ...i, estado: estadoNormalizado } : i));
      evento = { ...padre, estado: estadoNormalizado };
    }
    const fechaCambio =
      evento.fechaLimite !== anterior.fechaLimite || evento.audiencia?.hora !== anterior.audiencia?.hora;
    if (fechaCambio && cedulasActivasDePadre(items, evento.id).length > 0) {
      items = actualizarPlazosCedulasActivas(items, evento);
      alertas.push('Plazos de cédulas vinculadas actualizados.');
    }
    const pruebaId = pruebaIdDeEventoAudiencia(evento);
    if (pruebaId) {
      const pruebaIdx = items.findIndex((i) => i.id === pruebaId);
      if (pruebaIdx >= 0) {
        const sync = sincronizarEstadoPruebaConEventos(items[pruebaIdx]!, items);
        if (sync) {
          items[pruebaIdx] = { ...items[pruebaIdx]!, ...sync };
          if (sync.estado === 'producida') {
            alertas.push('Prueba vinculada actualizada a Producida.');
          } else if (sync.estado === 'postpuesta_juez') {
            alertas.push('Prueba vinculada actualizada a Postergada.');
          } else if (sync.estado === 'audiencia_fijada') {
            alertas.push('Prueba vinculada actualizada a Audiencia fijada.');
          }
        }
      }
    }
    return { items, creados, alertas };
  }

  if (!requiereAudienciaPrueba(padre.tipo) || resolveCategoria(padre) !== 'prueba') {
    return { items, creados, alertas };
  }

  const anterior = ctx.itemAnterior;
  const nuevoEstado = padre.estado;
  const estadoAnterior = anterior.estado;

  const ESTADOS_TERMINALES_PRUEBA = new Set(['producida', 'valoracion_judicial', 'desistida', 'no_admitida']);
  if (ctx.patch.estado !== undefined && ESTADOS_TERMINALES_PRUEBA.has(String(ctx.patch.estado))) {
    const activo = eventoAudienciaActivoDePrueba(items, padre.id);
    if (activo && !['realizada', 'cancelada'].includes(String(activo.estado))) {
      const estadoEvento =
        nuevoEstado === 'producida' || nuevoEstado === 'valoracion_judicial' ? 'realizada' : 'cancelada';
      items = items.map((i) => (i.id === activo.id ? { ...i, estado: estadoEvento } : i));
      alertas.push(
        estadoEvento === 'realizada'
          ? 'Audiencia vinculada marcada como Realizada.'
          : 'Audiencia vinculada marcada como Cancelada.',
      );
    }
    return { items, creados, alertas };
  }

  if (
    (nuevoEstado === 'postpuesta_juez' || nuevoEstado === 'pendiente_produccion') &&
    (estadoAnterior === 'audiencia_fijada' || eventosAudienciaDePrueba(items, padre.id).length > 0)
  ) {
    items = eliminarEventosAudienciaAutoDePrueba(items, padre.id);
    alertas.push('Audiencia(s) auto-creadas eliminadas (desfijada o postergada).');
    return { items, creados, alertas };
  }

  if (padreConAudienciaFijada(padre)) {
    const activo = eventoAudienciaActivoDePrueba(items, padre.id);
    if (!activo) {
      const evento = buildEventoAudienciaPrueba(padre, items, {
        autoCreated: true,
        orden: items.length + creados.length + 1,
      });
      items = [...items, evento];
      creados.push(evento);
      alertas.push('Se creó audiencia fijada vinculada a la prueba.');
    } else {
      const { fecha, hora } = fechaHoraAudienciaParaCedula(padre);
      const fechaCambio =
        fecha !== anterior.audienciaPrueba?.fechaAudiencia ||
        hora !== anterior.audienciaPrueba?.horaAudiencia;
      if (fechaCambio && (fecha || hora)) {
        items = items.map((i) =>
          i.id === activo.id
            ? {
                ...i,
                fechaLimite: fecha ?? i.fechaLimite,
                audiencia: { ...i.audiencia, hora: hora ?? i.audiencia?.hora ?? null },
              }
            : i,
        );
      }
    }
  }

  return { items, creados, alertas };
}

function evaluarSubProcesosDocumentalEnPoder(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  let items = [...ctx.items];

  const padre = items.find((i) => i.id === ctx.itemId);
  if (!padre || !requiereFlujoDocumentalEnPoder(padre.tipo)) {
    return { items, creados, alertas };
  }

  const anterior = ctx.itemAnterior;
  const nuevoEstado = padre.estado;
  const estadoAnterior = anterior.estado;

  if (
    (nuevoEstado === 'postpuesta_juez' || nuevoEstado === 'pendiente_produccion') &&
    estadoAnterior === 'intimacion_ordenada'
  ) {
    items = eliminarHijosAutoCreados(items, padre.id);
    alertas.push('Cédula(s) de intimación eliminadas (intimación revertida o postergada).');
    return { items, creados, alertas };
  }

  // Exhibición parcial → siempre nueva cédula por documental faltante (aunque ya haya cédulas previas).
  if (
    String(nuevoEstado) === 'exhibicion_parcial' &&
    String(estadoAnterior) !== 'exhibicion_parcial' &&
    ctx.patch.estado !== undefined
  ) {
    const n = cedulasIntimacionDocumentalDePadre(items, padre.id).length + 1;
    const tk = `cedula_intimacion_documental|${padre.id}|parcial|${n}`;
    if (!existeHijoConTrigger(items, tk)) {
      const cedula = buildCedulaIntimacionDocumental(padre, {
        autoCreated: true,
        triggerKey: tk,
        orden: items.length + 1,
        porFaltantes: true,
      });
      items = [...items, cedula];
      creados.push(cedula);
      alertas.push('Se creó cédula de intimación por documental faltante (exhibición parcial).');
    }
    return { items, creados, alertas };
  }

  // Apercibimiento: no crea cédula nueva; conserva historial.
  if (String(nuevoEstado) === 'apercibimiento_en_contra') {
    return { items, creados, alertas };
  }

  if (padreConIntimacionOrdenada(padre)) {
    const dep = padre.documentalEnPoder ?? {};
    const parte = String(dep.parteConDocumentos ?? parteContrariaDefault(padre.ofrecidaPor));
    const plazo = dep.plazoPresentacion ?? padre.fechaLimite ?? '';
    const medio = String(dep.medioIntimacion ?? 'papel');
    const tk = triggerKeyIntimacionDocumental(padre.id, parte, plazo, medio);
    const activas = cedulasIntimacionDocumentalDePadre(items, padre.id);

    if (activas.length === 0 && !existeHijoConTrigger(items, tk)) {
      const cedula = buildCedulaIntimacionDocumental(padre, {
        autoCreated: true,
        triggerKey: tk,
        orden: items.length + 1,
      });
      items = [...items, cedula];
      creados.push(cedula);
      alertas.push('Se creó cédula de intimación documental en Comunicaciones.');
    }
  }

  return { items, creados, alertas };
}

/** Al salir de impugnada (cierre o revert): quita todos los oficios de autenticidad del padre. */
function eliminarHijosAutenticidadDePadre(items: ControlPruebaItem[], parentId: string): ControlPruebaItem[] {
  return items.filter((i) => {
    if (!esOficioAutenticidadItem(i)) return true;
    if (i.vinculo?.parentItemId === parentId) return false;
    if (i.diligencia?.pruebaVinculadaId === parentId) return false;
    return true;
  });
}

function limpiarMetaAutenticidadDocumental(item: ControlPruebaItem): ControlPruebaItem {
  return {
    ...item,
    documental: {
      ...item.documental,
      autenticidadImpugnada: false,
      oficiosAutenticidad: [],
    },
  };
}

function evaluarSubProcesosDocumentalAutenticidad(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const alertas: string[] = [];
  const creados: ControlPruebaItem[] = [];
  let items = [...ctx.items];

  const padreIdx = items.findIndex((i) => i.id === ctx.itemId);
  const padre = padreIdx >= 0 ? items[padreIdx] : undefined;
  if (!padre || !requiereFlujoAutenticidadDocumental(padre.tipo)) {
    return { items, creados, alertas };
  }

  const estadoAnterior = ctx.itemAnterior.estado;
  const nuevoEstado = padre.estado;
  const ESTADOS_CIERRE_AUTH = new Set(['producida', 'valoracion_judicial', 'desistida', 'no_admitida']);

  // Cualquier salida de impugnada: oficios hijos dejan de tener sentido.
  if (
    estadoAnterior === 'autenticidad_impugnada' &&
    String(nuevoEstado) !== 'autenticidad_impugnada'
  ) {
    const esCierre = ESTADOS_CIERRE_AUTH.has(String(nuevoEstado));
    items = eliminarHijosAutenticidadDePadre(items, padre.id);
    const idx = items.findIndex((i) => i.id === padre.id);
    if (idx >= 0) {
      items[idx] = limpiarMetaAutenticidadDocumental(items[idx]!);
    }
    alertas.push(
      esCierre
        ? 'Oficios de autenticidad eliminados (prueba cerrada).'
        : 'Oficios de autenticidad eliminados (impugnación revertida o postergada).',
    );
    return { items, creados, alertas };
  }

  if (padreConAutenticidadImpugnada(padre)) {
    const vinculos = ensureVinculosAutenticidadDocumental(items, padre.id);
    return {
      items: vinculos.items,
      creados: [...creados, ...vinculos.creados],
      alertas: [...alertas, ...vinculos.alertas],
    };
  }

  return { items, creados, alertas };
}

/** Al cargar expediente: asegura oficios vinculados para documentales impugnadas
 *  y limpia oficios huérfanos si el documental ya no está impugnado. */
export function hydrateAutenticidadDocumentalVinculos(items: ControlPruebaItem[]): ControlPruebaItem[] {
  let result = items;
  for (const item of items) {
    if (item.tipo !== 'documental') continue;
    if (item.estado === 'autenticidad_impugnada') {
      result = ensureVinculosAutenticidadDocumental(result, item.id).items;
      continue;
    }
    // Padre ya no impugnado: oficios hijos no deben quedar en Comunicaciones.
    const huerfanos = oficiosAutenticidadDeDocumental(result, item.id);
    if (huerfanos.length === 0) continue;
    result = eliminarHijosAutenticidadDePadre(result, item.id);
    const idx = result.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      result[idx] = limpiarMetaAutenticidadDocumental(result[idx]!);
    }
  }
  return result;
}

/**
 * Parte efectiva de una diligencia: si quedó como `tribunal` pero el padre es actor/demandada/tercero,
 * se atribuye al padre (listados sin mutar items → evita autosave en loop).
 */
export function parteEfectivaItem(
  item: ControlPruebaItem,
  allItems: ControlPruebaItem[],
): NonNullable<ControlPruebaItem['ofrecidaPor']> {
  const fallback = resolveCategoria(item) === 'diligencia' ? 'tribunal' : 'actor';
  const directa = (item.ofrecidaPor ?? fallback) as NonNullable<ControlPruebaItem['ofrecidaPor']>;
  if (directa !== 'tribunal') return directa;

  const padreId = item.vinculo?.parentItemId ?? item.diligencia?.pruebaVinculadaId ?? null;
  if (!padreId) return directa;
  const padre = allItems.find((i) => i.id === padreId);
  const partePadre = padre?.ofrecidaPor;
  if (!partePadre || partePadre === 'tribunal') return directa;
  return partePadre;
}

export function crearOficioAutenticidadManual(
  items: ControlPruebaItem[],
  parentId: string,
  destinatario = '',
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre || !requiereFlujoAutenticidadDocumental(padre.tipo) || padre.estado !== 'autenticidad_impugnada') {
    return { items, creado: null };
  }

  let working = items;
  const dest = destinatario.trim() || padre.documental?.destinatarioOficio?.trim() || 'Oficiado';
  const tkOficio = triggerKeyOficioAutenticidadDocumental(parentId, dest);
  if (
    existeHijoConTrigger(working, tkOficio) ||
    oficiosAutenticidadDeDocumental(working, parentId).some((o) =>
      mismoDestinatarioAutenticidad(o.diligencia?.destinatario?.trim() ?? '', dest),
    )
  ) {
    return { items: working, creado: null };
  }

  const creado = buildOficioAutenticidadDocumental(padre, {
    autoCreated: false,
    triggerKey: tkOficio,
    orden: working.length + 1,
    destinatario: dest,
  });
  return { items: [...working, creado], creado };
}

export function evaluarSubProcesosAutomaticos(ctx: SubprocesoEvalContext): SubprocesoEvalResult {
  const audiencia = evaluarSubProcesosAudiencia(ctx);
  const documentalPoder = evaluarSubProcesosDocumentalEnPoder({ ...ctx, items: audiencia.items });
  const documentalAuth = evaluarSubProcesosDocumentalAutenticidad({
    ...ctx,
    items: documentalPoder.items,
  });
  const desistimiento = evaluarDesistimientoPrueba({
    ...ctx,
    items: documentalAuth.items,
  });
  return {
    items: desistimiento.items,
    creados: [...audiencia.creados, ...documentalPoder.creados, ...documentalAuth.creados],
    alertas: [
      ...audiencia.alertas,
      ...documentalPoder.alertas,
      ...documentalAuth.alertas,
      ...desistimiento.alertas,
    ],
  };
}

export function crearCedulaManualVinculada(
  items: ControlPruebaItem[],
  parentId: string,
  destinatario = '',
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre) return { items, creado: null };

  if (
    requiereFlujoDocumentalEnPoder(padre.tipo) &&
    intimacionDocumentalActiva(String(padre.estado))
  ) {
    const porFaltantes = String(padre.estado) === 'exhibicion_parcial';
    const n = cedulasIntimacionDocumentalDePadre(items, padre.id).length + 1;
    // Clave única por creación manual (no reutilizar la del auto-create).
    const tk = porFaltantes
      ? `cedula_intimacion_documental|${padre.id}|parcial|manual|${n}`
      : `cedula_intimacion_documental|${padre.id}|manual|${n}`;
    const creado = buildCedulaIntimacionDocumental(padre, {
      destinatario,
      autoCreated: false,
      triggerKey: tk,
      orden: items.length + 1,
      porFaltantes,
    });
    return { items: [...items, creado], creado };
  }

  if (esEventoAudienciaPrueba(padre)) {
    const prueba = items.find((i) => i.id === pruebaIdDeEventoAudiencia(padre));
    const tk = triggerKeyCedula(
      padre.id,
      destinatario,
      padre.fechaLimite ?? '',
      padre.audiencia?.hora ?? '',
    );
    if (existeHijoConTrigger(items, tk)) return { items, creado: null };
    const creado = buildCedulaAudienciaDiligencia(
      padre,
      { destinatario, autoCreated: false, triggerKey: tk, orden: items.length + 1 },
      prueba,
    );
    return { items: [...items, creado], creado };
  }

  if (requiereAudienciaPrueba(padre.tipo) && audienciaEstaFijadaParaCedula(padre)) {
    const evento = eventoAudienciaActivoDePrueba(items, padre.id);
    if (evento) {
      return crearCedulaManualVinculada(items, evento.id, destinatario);
    }
  }

  if (!requiereAudienciaPrueba(padre.tipo) || !audienciaEstaFijadaParaCedula(padre)) {
    return { items, creado: null };
  }
  return { items, creado: null };
}

/** Reintento de notificación cuando la cédula de un testigo volvió rebotada/negativa. */
export function crearCedulaReintentoVinculada(
  items: ControlPruebaItem[],
  parentId: string,
  destinatario: string,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre) return { items, creado: null };

  let evento: ControlPruebaItem | undefined;
  let prueba: ControlPruebaItem | undefined;

  if (esEventoAudienciaPrueba(padre)) {
    evento = padre;
    const pruebaId = pruebaIdDeEventoAudiencia(padre);
    prueba = pruebaId ? items.find((i) => i.id === pruebaId) : undefined;
  } else if (requiereAudienciaPrueba(padre.tipo)) {
    prueba = padre;
    evento = eventoAudienciaActivoDePrueba(items, padre.id);
  }

  if (!evento || !prueba) return { items, creado: null };

  const fecha = evento.fechaLimite ?? '';
  const hora = evento.audiencia?.hora ?? '';
  const intentosPrevios = cedulasAudienciaDeEvento(items, evento.id).filter(
    (i) => i.diligencia?.destinatario === destinatario,
  ).length;
  const tk = `${triggerKeyCedula(evento.id, destinatario, fecha, hora)}#reintento${intentosPrevios}`;

  const creado = buildCedulaAudienciaDiligencia(
    evento,
    {
      destinatario,
      autoCreated: false,
      triggerKey: tk,
      orden: items.length + 1,
      observaciones: 'Reintento de notificación tras cédula rebotada / resultado negativo.',
    },
    prueba,
  );
  return { items: [...items, creado], creado };
}

function triggerKeyMandamientoConduccion(parentId: string, testigo: string, intento: number): string {
  return `mandamiento_conduccion|${parentId}|${testigo}|${intento}`;
}

/** El testigo, ya notificado, no compareció a la audiencia → mandamiento de conducción por fuerza pública. */
export function crearMandamientoConduccionTestigo(
  items: ControlPruebaItem[],
  parentId: string,
  testigoNombre: string,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const padre = items.find((i) => i.id === parentId);
  if (!padre || !requiereAudienciaPrueba(padre.tipo)) return { items, creado: null };

  const intentosPrevios = items.filter(
    (i) =>
      i.vinculo?.parentItemId === parentId &&
      i.vinculo?.rol === 'mandamiento_conduccion' &&
      i.diligencia?.destinatario === testigoNombre,
  ).length;
  const tk = triggerKeyMandamientoConduccion(parentId, testigoNombre, intentosPrevios);

  const ap = padre.audienciaPrueba ?? {};
  const fechaTexto = ap.fechaAudiencia ? ` del ${ap.fechaAudiencia}` : '';
  const parentTipo = parentTipoDeItem(padre) ?? 'testimonial';

  const vinculo: SubprocesoVinculo = {
    parentItemId: padre.id,
    parentTipo,
    parentCategoria: resolveCategoria(padre),
    rol: 'mandamiento_conduccion',
    autoCreated: false,
    vinculoLabel: `Mandamiento de conducción — ${testigoNombre}`,
    triggerKey: tk,
  };

  const creado: ControlPruebaItem = {
    id: crypto.randomUUID(),
    orden: items.length + 1,
    categoria: 'diligencia',
    tipo: 'mandamiento',
    descripcion: `Mandamiento de conducción — el testigo ${testigoNombre} no compareció a la audiencia testimonial${fechaTexto}.`,
    ofrecidaPor: padre.ofrecidaPor ?? 'actor',
    estado: 'pendiente',
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: 'Comparecencia compulsiva por fuerza pública (art. 437 CPCC) por incomparecencia injustificada.',
    vinculo,
    diligencia: {
      destinatario: testigoNombre,
      objeto: `Conducción por la fuerza pública del testigo ${testigoNombre} a audiencia testimonial.`,
      pruebaVinculadaId: padre.id,
    },
  };

  return { items: [...items, creado], creado };
}

export function contarSubprocesosActivos(parentId: string, items: ControlPruebaItem[]): number {
  const padre = items.find((i) => i.id === parentId);
  if (padre?.tipo === 'documental' && padre.estado === 'autenticidad_impugnada') {
    return oficiosAutenticidadDeDocumental(items, parentId).length;
  }
  if (padre && requiereAudienciaPrueba(padre.tipo)) {
    const eventos = eventosAudienciaDePrueba(items, parentId);
    return eventos.length + eventos.reduce((n, e) => n + cedulasAudienciaDeEvento(items, e.id).length, 0);
  }
  const directos = hijosDePadre(parentId, items).filter(
    (i) => i.vinculo?.rol !== 'informativa_autenticidad',
  );
  return directos.length;
}

export function crearEventoAudienciaManual(
  items: ControlPruebaItem[],
  pruebaId: string,
): { items: ControlPruebaItem[]; creado: ControlPruebaItem | null } {
  const prueba = items.find((i) => i.id === pruebaId);
  if (!prueba || !requiereAudienciaPrueba(prueba.tipo)) return { items, creado: null };
  const activo = eventoAudienciaActivoDePrueba(items, pruebaId);
  if (activo && !['cancelada', 'realizada', 'suspendida'].includes(String(activo.estado))) {
    return { items, creado: null };
  }
  const creado = buildEventoAudienciaPrueba(prueba, items, {
    autoCreated: false,
    orden: items.length + 1,
  });
  return { items: [...items, creado], creado };
}
