import type { ControlPruebaItem, DocumentalPruebaMeta } from '@/types/control-prueba';
import { esCierrePrueba } from '@/lib/control-prueba-cierre';

export const TIPO_DOCUMENTAL = 'documental' as const;

const ESTADOS_SOLO_AUTENTICIDAD = new Set(['autenticidad_impugnada']);

export function requiereFlujoAutenticidadDocumental(tipo: string): boolean {
  return tipo === TIPO_DOCUMENTAL;
}

export function usaFlujoAutenticidadDocumental(item: ControlPruebaItem): boolean {
  return requiereFlujoAutenticidadDocumental(item.tipo);
}

export function estadosPruebaParaItemDocumentalAutenticidad(
  item: ControlPruebaItem,
  todos: readonly string[],
): string[] {
  if (requiereFlujoAutenticidadDocumental(item.tipo)) {
    return todos.filter((e) => e !== 'audiencia_fijada' && e !== 'intimacion_ordenada');
  }
  return todos.filter((e) => !ESTADOS_SOLO_AUTENTICIDAD.has(e) && e !== 'intimacion_ordenada');
}

export function ensureDocumentalMeta(item: ControlPruebaItem): ControlPruebaItem {
  if (!requiereFlujoAutenticidadDocumental(item.tipo)) return item;
  const prev = item.documental ?? {};
  const autenticidadImpugnada = item.estado === 'autenticidad_impugnada';
  return {
    ...item,
    documental: {
      autenticidadImpugnada,
      fechaImpugnacion: prev.fechaImpugnacion ?? null,
      destinatarioOficio: prev.destinatarioOficio ?? null,
    },
  };
}

export function patchDocumentalMeta(
  item: ControlPruebaItem,
  patch: Partial<DocumentalPruebaMeta>,
): Partial<ControlPruebaItem> {
  return { documental: { ...item.documental, ...patch } };
}

export function patchEstadoDocumentalAutenticidad(
  item: ControlPruebaItem,
  estado: string,
): Partial<ControlPruebaItem> {
  const patch: Partial<ControlPruebaItem> = { estado };
  if (!requiereFlujoAutenticidadDocumental(item.tipo)) return patch;

  const estadoFinal = String(estado);

  if (estadoFinal === 'autenticidad_impugnada') {
    const prev = item.documental ?? {};
    patch.documental = {
      ...prev,
      autenticidadImpugnada: true,
      fechaImpugnacion: prev.fechaImpugnacion ?? new Date().toISOString().slice(0, 10),
    };
    return patch;
  }

  if (estadoFinal === 'postpuesta_juez' || estadoFinal === 'pendiente_produccion') {
    patch.documental = {
      ...item.documental,
      autenticidadImpugnada: false,
      fechaImpugnacion: null,
    };
    return patch;
  }

  if (esCierrePrueba(estadoFinal) && estadoFinal !== 'producida') {
    patch.documental = {
      ...item.documental,
      autenticidadImpugnada: false,
    };
    return patch;
  }

  if (estadoFinal !== 'producida' && item.estado === 'autenticidad_impugnada') {
    patch.documental = {
      ...item.documental,
      autenticidadImpugnada: false,
    };
  }

  return patch;
}
