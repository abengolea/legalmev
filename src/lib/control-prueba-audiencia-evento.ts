import type { ControlPruebaItem } from '@/types/control-prueba';
import { esAudienciaOfrecida, resolveCategoria, TIPO_LABELS } from '@/lib/control-prueba';
import {
  fechaHoraAudienciaParaCedula,
  requiereAudienciaPrueba,
} from '@/lib/control-prueba-audiencia-prueba';
import { parentTipoDeItem } from '@/lib/control-prueba-subprocesos';

export const ROL_AUDIENCIA_PRUEBA = 'audiencia_prueba' as const;

const ESTADOS_EVENTO_CERRADO = new Set(['realizada', 'cancelada', 'suspendida']);

function estadoEventoImplicaProducida(estado: string): boolean {
  return estado === 'realizada' || estado === 'producida' || estado === 'valoracion_judicial';
}

function fechaProduccionDesdeEvento(evento: ControlPruebaItem): string {
  return (
    evento.fechaProduccion ??
    evento.fechaLimite ??
    new Date().toISOString().slice(0, 10)
  );
}

/** Mapea estado del evento audiencia → estado de la prueba madre. */
export function mapEstadoEventoAEstadoPrueba(
  evento: ControlPruebaItem,
  prueba: ControlPruebaItem,
): Partial<ControlPruebaItem> | null {
  const estado = String(evento.estado);

  if (estadoEventoImplicaProducida(estado)) {
    if (prueba.estado === 'producida' || prueba.estado === 'valoracion_judicial') return null;
    return { estado: 'producida', fechaProduccion: fechaProduccionDesdeEvento(evento) };
  }

  if (estado === 'suspendida' || estado === 'cancelada' || estado === 'postpuesta_juez') {
    if (prueba.estado === 'postpuesta_juez') return null;
    if (prueba.estado === 'producida' || prueba.estado === 'valoracion_judicial') return null;
    return { estado: 'postpuesta_juez' };
  }

  if (estado === 'programada' || estado === 'reprogramada' || estado === 'audiencia_fijada') {
    if (
      prueba.estado === 'audiencia_fijada' ||
      prueba.estado === 'producida' ||
      prueba.estado === 'valoracion_judicial'
    ) {
      return null;
    }
    return { estado: 'audiencia_fijada' };
  }

  return null;
}

export function esEventoAudienciaPrueba(item: ControlPruebaItem): boolean {
  return resolveCategoria(item) === 'audiencia' && item.vinculo?.rol === ROL_AUDIENCIA_PRUEBA;
}

/** Vista de causa, mediación, etc. — no vinculadas a prueba ofrecida. */
export function esAudienciaProcesalStandalone(item: ControlPruebaItem): boolean {
  if (resolveCategoria(item) !== 'audiencia') return false;
  if (esEventoAudienciaPrueba(item)) return false;
  return !esAudienciaOfrecida(item);
}

export function pruebaIdDeEventoAudiencia(item: ControlPruebaItem): string | null {
  if (!esEventoAudienciaPrueba(item)) return null;
  return item.vinculo?.parentItemId ?? null;
}

export function eventosAudienciaDePrueba(items: ControlPruebaItem[], pruebaId: string): ControlPruebaItem[] {
  return items
    .filter((i) => esEventoAudienciaPrueba(i) && i.vinculo?.parentItemId === pruebaId)
    .sort((a, b) => a.orden - b.orden);
}

export function eventoAudienciaActivoDePrueba(
  items: ControlPruebaItem[],
  pruebaId: string,
): ControlPruebaItem | undefined {
  const eventos = eventosAudienciaDePrueba(items, pruebaId);
  const abiertos = eventos.filter((e) => !ESTADOS_EVENTO_CERRADO.has(String(e.estado)));
  return abiertos[abiertos.length - 1] ?? eventos[eventos.length - 1];
}

function labelTipoEvento(tipo: string): string {
  if (tipo === 'confesional') return 'confesional';
  if (tipo === 'testimonial') return 'testimonial';
  return TIPO_LABELS[tipo] ?? tipo;
}

function triggerKeyEventoAudiencia(pruebaId: string, intento: number): string {
  return `${ROL_AUDIENCIA_PRUEBA}|${pruebaId}|${intento}`;
}

function intentoEventoAudiencia(items: ControlPruebaItem[], pruebaId: string): number {
  return eventosAudienciaDePrueba(items, pruebaId).length + 1;
}

export function buildEventoAudienciaPrueba(
  prueba: ControlPruebaItem,
  items: ControlPruebaItem[],
  opts: { autoCreated?: boolean; triggerKey?: string; orden: number; intento?: number },
): ControlPruebaItem {
  const ap = prueba.audienciaPrueba ?? {};
  const { fecha, hora } = fechaHoraAudienciaParaCedula(prueba);
  const intento = opts.intento ?? intentoEventoAudiencia(items, prueba.id);
  const tipoEvento = prueba.tipo === 'audiencia_testimonial' ? 'testimonial' : prueba.tipo;
  const tipoLabel = labelTipoEvento(String(tipoEvento));
  const parentTipo = parentTipoDeItem(prueba) ?? 'confesional';
  const tk = opts.triggerKey ?? triggerKeyEventoAudiencia(prueba.id, intento);

  const vinculo = {
    parentItemId: prueba.id,
    parentTipo,
    parentCategoria: 'prueba' as const,
    rol: ROL_AUDIENCIA_PRUEBA,
    autoCreated: opts.autoCreated ?? true,
    vinculoLabel: `Audiencia ${tipoLabel} — ${prueba.descripcion.slice(0, 60)}`,
    triggerKey: tk,
  };

  const fechaTexto = fecha ? ` — ${fecha}${hora ? ` ${hora}` : ''}` : '';

  return {
    id: crypto.randomUUID(),
    orden: opts.orden,
    categoria: 'audiencia',
    tipo: String(tipoEvento),
    descripcion: `Audiencia ${tipoLabel}${fechaTexto}`.trim(),
    ofrecidaPor: prueba.ofrecidaPor ?? 'actor',
    terceroNombre: prueba.terceroNombre ?? null,
    estado: 'programada',
    fechaLimite: fecha,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: null,
    vinculo,
    audiencia: {
      hora: hora ?? null,
      sala: ap.sala ?? null,
      juzgado: null,
      resultado: null,
    },
  };
}

export function patchEventoAudienciaMeta(
  item: ControlPruebaItem,
  patch: Partial<NonNullable<ControlPruebaItem['audiencia']>>,
): Partial<ControlPruebaItem> {
  const aud = item.audiencia ?? {};
  const next = { ...aud, ...patch };
  const result: Partial<ControlPruebaItem> = { audiencia: next };
  if (patch.hora !== undefined) {
    result.descripcion = redescribirEventoAudiencia(item, item.fechaLimite, next.hora ?? null);
  }
  return result;
}

export function patchFechaEventoAudiencia(
  item: ControlPruebaItem,
  fechaLimite: string | null,
): Partial<ControlPruebaItem> {
  const hora = item.audiencia?.hora ?? null;
  return {
    fechaLimite,
    descripcion: redescribirEventoAudiencia(item, fechaLimite, hora),
  };
}

function redescribirEventoAudiencia(
  item: ControlPruebaItem,
  fecha: string | null | undefined,
  hora: string | null | undefined,
): string {
  const tipoLabel = labelTipoEvento(item.tipo);
  const fechaTexto = fecha ? ` — ${fecha}${hora ? ` ${hora}` : ''}` : '';
  return `Audiencia ${tipoLabel}${fechaTexto}`.trim();
}

export function pruebaTieneEventoAudienciaActivo(items: ControlPruebaItem[], pruebaId: string): boolean {
  const activo = eventoAudienciaActivoDePrueba(items, pruebaId);
  if (!activo) return false;
  return !ESTADOS_EVENTO_CERRADO.has(String(activo.estado));
}

/** Confesional/testimonial deben vivir en prueba ofrecida, no como ítem suelto en audiencias. */
export function debeSerPruebaOfrecida(item: ControlPruebaItem): boolean {
  return requiereAudienciaPrueba(item.tipo);
}

export function sincronizarEstadoPruebaConEventos(
  prueba: ControlPruebaItem,
  items: ControlPruebaItem[],
): Partial<ControlPruebaItem> | null {
  if (!requiereAudienciaPrueba(prueba.tipo)) return null;
  const eventos = eventosAudienciaDePrueba(items, prueba.id);
  if (eventos.length === 0) {
    if (prueba.estado === 'audiencia_fijada') {
      return { estado: 'pendiente_produccion' };
    }
    return null;
  }

  const activo = eventoAudienciaActivoDePrueba(items, prueba.id);
  if (activo && !ESTADOS_EVENTO_CERRADO.has(String(activo.estado))) {
    return mapEstadoEventoAEstadoPrueba(activo, prueba);
  }

  const ultimo = eventos[eventos.length - 1];
  if (ultimo) {
    return mapEstadoEventoAEstadoPrueba(ultimo, prueba);
  }

  return null;
}
