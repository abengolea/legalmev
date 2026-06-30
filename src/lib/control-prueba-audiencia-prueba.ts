import type { AudienciaPruebaMeta, ControlPruebaItem } from '@/types/control-prueba';
import { esCierrePrueba } from '@/lib/control-prueba-cierre';
import { estadosPruebaParaItemDocumentalAutenticidad } from '@/lib/control-prueba-documental-autenticidad';
import {
  estadosPruebaParaItemDocumental,
  requiereIntimacionDocumental,
} from '@/lib/control-prueba-documental-poder';

export const TIPOS_CON_AUDIENCIA = ['confesional', 'testimonial'] as const;

const ESTADOS_SOLO_AUDIENCIA = new Set(['audiencia_fijada', 'postpuesta_juez']);

export function requiereAudienciaPrueba(tipo: string): boolean {
  return (TIPOS_CON_AUDIENCIA as readonly string[]).includes(tipo);
}

export function audienciaEstaFijada(item: ControlPruebaItem): boolean {
  return item.estado === 'audiencia_fijada';
}

export function estadosPruebaParaItem(item: ControlPruebaItem, todos: readonly string[]): string[] {
  if (requiereIntimacionDocumental(item.tipo)) {
    return estadosPruebaParaItemDocumental(item, todos);
  }
  if (item.tipo === 'documental') {
    return estadosPruebaParaItemDocumentalAutenticidad(item, todos);
  }
  if (item.tipo === 'confesional' || requiereAudienciaPrueba(item.tipo)) return [...todos];
  return todos.filter((e) => !ESTADOS_SOLO_AUDIENCIA.has(e));
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

  if (esCierrePrueba(estado) && estado !== 'producida') {
    patch.audienciaPrueba = {
      ...item.audienciaPrueba,
      audienciaFijada: false,
      fechaAudiencia: null,
      horaAudiencia: null,
    };
    patch.fechaLimite = null;
    return patch;
  }

  if (estado !== 'producida' && item.estado === 'audiencia_fijada') {
    patch.audienciaPrueba = {
      ...item.audienciaPrueba,
      audienciaFijada: false,
    };
    patch.fechaLimite = null;
  }

  return patch;
}
