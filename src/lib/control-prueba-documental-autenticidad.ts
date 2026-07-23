import type { ControlPruebaItem, DocumentalPruebaMeta, OficioAutenticidadPendiente } from '@/types/control-prueba';
import { esCierrePrueba } from '@/lib/control-prueba-cierre';
import { normalizeOficiosAutenticidad } from '@/lib/control-prueba-import-meta';

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
    return todos.filter(
      (e) =>
        e !== 'audiencia_fijada' &&
        e !== 'intimacion_ordenada' &&
        e !== 'exhibicion_parcial' &&
        e !== 'apercibimiento_en_contra',
    );
  }
  return todos.filter(
    (e) =>
      !ESTADOS_SOLO_AUTENTICIDAD.has(e) &&
      e !== 'intimacion_ordenada' &&
      e !== 'exhibicion_parcial' &&
      e !== 'apercibimiento_en_contra',
  );
}

export function ensureDocumentalMeta(item: ControlPruebaItem): ControlPruebaItem {
  if (!requiereFlujoAutenticidadDocumental(item.tipo)) return item;
  const prev = item.documental ?? {};
  const autenticidadImpugnada = item.estado === 'autenticidad_impugnada';
  const oficios = normalizeOficiosAutenticidad(prev.oficiosAutenticidad);
  const destinatarioOficio =
    prev.destinatarioOficio?.trim() || oficios[0]?.destinatarioOficio?.trim() || null;
  return {
    ...item,
    documental: {
      autenticidadImpugnada,
      fechaImpugnacion: prev.fechaImpugnacion ?? null,
      destinatarioOficio,
      oficiosAutenticidad: oficios.length ? oficios : undefined,
    },
  };
}

export function ensureOficiosAutenticidadDocumental(item: ControlPruebaItem): ControlPruebaItem {
  if (!requiereFlujoAutenticidadDocumental(item.tipo) || item.estado !== 'autenticidad_impugnada') {
    return item;
  }
  const prev = item.documental ?? {};
  const oficios = normalizeOficiosAutenticidad(prev.oficiosAutenticidad);
  const dest = prev.destinatarioOficio?.trim();
  if (oficios.length > 0) {
    return {
      ...item,
      documental: {
        ...prev,
        autenticidadImpugnada: true,
        oficiosAutenticidad: oficios,
        destinatarioOficio: dest || oficios[0]?.destinatarioOficio || null,
      },
    };
  }
  if (!dest) return ensureDocumentalMeta(item);
  const nuevo: OficioAutenticidadPendiente = {
    id: crypto.randomUUID(),
    referencia: null,
    descripcionDocumento: item.descripcion,
    destinatarioOficio: dest,
    objetoOficio: `Autenticidad — ${item.descripcion.slice(0, 100)}`,
    estado: 'a_librar',
    itemPruebaId: item.id,
    observaciones: null,
  };
  return {
    ...item,
    documental: {
      ...prev,
      autenticidadImpugnada: true,
      destinatarioOficio: dest,
      oficiosAutenticidad: [nuevo],
    },
  };
}

export function contarOficiosAutenticidadDocumental(item: ControlPruebaItem): number {
  if (item.tipo !== 'documental') return 0;
  return item.documental?.oficiosAutenticidad?.filter((o) => o.estado === 'a_librar').length ?? 0;
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
      oficiosAutenticidad: [],
    };
    return patch;
  }

  if (esCierrePrueba(estadoFinal)) {
    patch.documental = {
      ...item.documental,
      autenticidadImpugnada: false,
      oficiosAutenticidad: [],
    };
    return patch;
  }

  if (item.estado === 'autenticidad_impugnada') {
    patch.documental = {
      ...item.documental,
      autenticidadImpugnada: false,
      oficiosAutenticidad: [],
    };
  }

  return patch;
}
