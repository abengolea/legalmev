import type { AudienciaPruebaMeta, ControlPruebaItem } from '@/types/control-prueba';
import { AUDIENCIA_ESTADOS, PRUEBA_ESTADOS } from '@/types/control-prueba';
import { esCierrePrueba } from '@/lib/control-prueba-cierre';
import { esEventoAudienciaPrueba } from '@/lib/control-prueba-audiencia-evento';
import { estadosPruebaParaItemDocumentalAutenticidad } from '@/lib/control-prueba-documental-autenticidad';
import {
  estadosPruebaParaItemDocumental,
  requiereIntimacionDocumental,
} from '@/lib/control-prueba-documental-poder';

export const TIPOS_CON_AUDIENCIA = ['confesional', 'testimonial'] as const;

/** Estados de confesional/testimonial — sin mezclar documental ni intimación. */
export const ESTADOS_PRUEBA_AUDIENCIA_OFRECIDA = [
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'producida',
  'valoracion_judicial',
  'desistida',
  'no_admitida',
] as const;

const ESTADOS_SOLO_AUDIENCIA = new Set(['audiencia_fijada', 'postpuesta_juez']);

export function requiereAudienciaPrueba(tipo: string): boolean {
  return (TIPOS_CON_AUDIENCIA as readonly string[]).includes(tipo);
}

function esAudienciaOfrecidaItem(item: Pick<ControlPruebaItem, 'tipo' | 'categoria'>): boolean {
  return (
    (item.tipo === 'confesional' || item.tipo === 'testimonial') &&
    (item.categoria === 'prueba' || !item.categoria)
  );
}

function esAudienciaProcesalItem(item: ControlPruebaItem): boolean {
  if (esEventoAudienciaPrueba(item)) return true;
  return item.categoria === 'audiencia' && !esAudienciaOfrecidaItem(item);
}

function coerceEstadoEventoAudiencia(item: ControlPruebaItem): string {
  const estado = String(item.estado);
  if ((AUDIENCIA_ESTADOS as readonly string[]).includes(estado)) return estado;
  if (estado === 'audiencia_fijada' || estado === 'pendiente_produccion') return 'programada';
  if (estado === 'postpuesta_juez') return 'suspendida';
  if (estado === 'producida' || estado === 'valoracion_judicial') return 'realizada';
  if (estado === 'desistida' || estado === 'no_admitida') return 'cancelada';
  return 'programada';
}

export function audienciaEstaFijada(item: ControlPruebaItem): boolean {
  return audienciaEstaFijadaParaCedula(item);
}

/** Confesional/testimonial (u otras) con audiencia programada — habilita cédula vinculada. */
export function audienciaEstaFijadaParaCedula(item: ControlPruebaItem): boolean {
  const estado = String(item.estado);
  if (estado === 'audiencia_fijada' || estado === 'programada' || estado === 'reprogramada') {
    return true;
  }
  return Boolean(item.audienciaPrueba?.audienciaFijada);
}

const ESTADOS_EVENTO_AUDIENCIA_FIJADA = new Set(['programada', 'reprogramada', 'audiencia_fijada']);

/** Prueba o evento hijo visible bajo el filtro «Audiencia fijada». */
export function itemCuentaComoAudienciaFijadaEnFiltro(item: ControlPruebaItem): boolean {
  const estado = String(item.estado);
  if (estado === 'audiencia_fijada') return true;
  if (esEventoAudienciaPrueba(item) && ESTADOS_EVENTO_AUDIENCIA_FIJADA.has(estado)) return true;
  return false;
}

export function fechaHoraAudienciaParaCedula(item: ControlPruebaItem): {
  fecha: string | null;
  hora: string | null;
} {
  const ap = item.audienciaPrueba ?? {};
  const aud = item.audiencia ?? {};
  return {
    fecha: ap.fechaAudiencia?.trim() || item.fechaLimite?.trim() || null,
    hora: ap.horaAudiencia?.trim() || aud.hora?.trim() || null,
  };
}

export function estadosPruebaParaItem(item: ControlPruebaItem, todos: readonly string[]): string[] {
  if (requiereIntimacionDocumental(item.tipo)) {
    return estadosPruebaParaItemDocumental(item, todos);
  }
  if (item.tipo === 'documental') {
    return estadosPruebaParaItemDocumentalAutenticidad(item, todos);
  }
  if (esAudienciaProcesalItem(item)) {
    return [...AUDIENCIA_ESTADOS];
  }
  if (esAudienciaOfrecidaItem(item)) {
    return ESTADOS_PRUEBA_AUDIENCIA_OFRECIDA.filter((e) => (todos as readonly string[]).includes(e));
  }
  return todos.filter((e) => !ESTADOS_SOLO_AUDIENCIA.has(e));
}

export function coerceEstadoAudienciaItem(item: ControlPruebaItem): string {
  const estado = String(item.estado);
  if (esAudienciaProcesalItem(item)) {
    return coerceEstadoEventoAudiencia(item);
  }
  if (esAudienciaOfrecidaItem(item)) {
    if ((ESTADOS_PRUEBA_AUDIENCIA_OFRECIDA as readonly string[]).includes(estado)) return estado;
    if ((PRUEBA_ESTADOS as readonly string[]).includes(estado) && !['intimacion_ordenada', 'exhibicion_parcial', 'apercibimiento_en_contra', 'autenticidad_impugnada'].includes(estado)) {
      return estado;
    }
    return 'pendiente_produccion';
  }
  return estado;
}

export function patchTipoAudiencia(item: ControlPruebaItem, nuevoTipo: string): Partial<ControlPruebaItem> {
  const patch: Partial<ControlPruebaItem> = {
    tipo: nuevoTipo,
    categoria: 'audiencia',
  };
  const preview = { ...item, ...patch };
  patch.estado = coerceEstadoAudienciaItem(preview);
  if (!esAudienciaOfrecidaItem(preview)) {
    patch.audienciaPrueba = undefined;
  }
  return patch;
}

export function ensureAudienciaPruebaMeta(item: ControlPruebaItem): ControlPruebaItem {
  if (!requiereAudienciaPrueba(item.tipo)) return item;
  const prev = item.audienciaPrueba ?? {};
  const postergada = item.estado === 'postpuesta_juez';
  const fijada = item.estado === 'audiencia_fijada';
  return {
    ...item,
    audienciaPrueba: {
      audienciaFijada: fijada,
      fechaAudiencia: postergada ? null : (prev.fechaAudiencia ?? (fijada ? item.fechaLimite : null) ?? null),
      horaAudiencia: postergada ? null : (prev.horaAudiencia ?? null),
      sala: prev.sala ?? null,
      motivoPostergacion: prev.motivoPostergacion ?? null,
    },
  };
}

export function syncFechaLimiteAudiencia(item: ControlPruebaItem): ControlPruebaItem {
  if (!requiereAudienciaPrueba(item.tipo)) return item;
  const ap = item.audienciaPrueba;
  if (item.estado === 'audiencia_fijada' && ap?.fechaAudiencia) {
    return { ...item, fechaLimite: ap.fechaAudiencia };
  }
  if (item.estado !== 'audiencia_fijada') {
    return { ...item, fechaLimite: null };
  }
  return item;
}

export function patchAudienciaPrueba(
  item: ControlPruebaItem,
  patch: Partial<AudienciaPruebaMeta>,
): Partial<ControlPruebaItem> {
  const ap: AudienciaPruebaMeta = { ...item.audienciaPrueba, ...patch, audienciaFijada: true };
  const result: Partial<ControlPruebaItem> = {
    audienciaPrueba: ap,
    estado: 'audiencia_fijada',
  };
  if (ap.fechaAudiencia) {
    result.fechaLimite = ap.fechaAudiencia;
  }
  return result;
}

export function patchEstadoAudienciaPrueba(
  item: ControlPruebaItem,
  estado: string,
): Partial<ControlPruebaItem> {
  const patch: Partial<ControlPruebaItem> = { estado };
  if (!requiereAudienciaPrueba(item.tipo)) return patch;

  if (estado === 'audiencia_fijada') {
    const prev = item.audienciaPrueba ?? {};
    patch.audienciaPrueba = {
      ...prev,
      audienciaFijada: true,
      fechaAudiencia: prev.fechaAudiencia ?? item.fechaLimite ?? null,
      horaAudiencia: prev.horaAudiencia ?? null,
    };
    if (patch.audienciaPrueba.fechaAudiencia) {
      patch.fechaLimite = patch.audienciaPrueba.fechaAudiencia;
    }
    return patch;
  }

  if (estado === 'postpuesta_juez' || estado === 'pendiente_produccion') {
    patch.audienciaPrueba = {
      ...item.audienciaPrueba,
      audienciaFijada: false,
      fechaAudiencia: null,
      horaAudiencia: null,
    };
    patch.fechaLimite = null;
    return patch;
  }

  if (estado === 'producida') {
    if (item.audienciaPrueba?.audienciaFijada) {
      patch.audienciaPrueba = { ...item.audienciaPrueba, audienciaFijada: false };
    }
    return patch;
  }

  if (esCierrePrueba(estado)) {
    patch.audienciaPrueba = {
      ...item.audienciaPrueba,
      audienciaFijada: false,
      fechaAudiencia: null,
      horaAudiencia: null,
    };
    patch.fechaLimite = null;
    return patch;
  }

  if (item.estado === 'audiencia_fijada') {
    patch.audienciaPrueba = {
      ...item.audienciaPrueba,
      audienciaFijada: false,
    };
    patch.fechaLimite = null;
  }

  return patch;
}
