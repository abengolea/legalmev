import type {
  ControlPruebaItem,
  DocumentalPruebaMeta,
  OficioAutenticidadPendiente,
} from '@/types/control-prueba';
import { normalizeOficiosAutenticidad } from '@/lib/control-prueba-import-meta';

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}


function mergeOficios(
  prev: OficioAutenticidadPendiente[],
  incoming: OficioAutenticidadPendiente[],
): OficioAutenticidadPendiente[] {
  const map = new Map<string, OficioAutenticidadPendiente>();
  for (const o of [...prev, ...incoming]) {
    if (!o.descripcionDocumento?.trim() || !o.destinatarioOficio?.trim()) continue;
    const key = `${normKey(o.destinatarioOficio)}|${normKey(o.descripcionDocumento)}`;
    const existing = map.get(key);
    map.set(key, {
      id: existing?.id ?? o.id ?? crypto.randomUUID(),
      referencia: existing?.referencia ?? o.referencia ?? null,
      descripcionDocumento: o.descripcionDocumento.trim(),
      destinatarioOficio: o.destinatarioOficio.trim(),
      objetoOficio: existing?.objetoOficio ?? o.objetoOficio ?? null,
      estado: existing?.estado === 'librado' || o.estado === 'librado' ? 'librado' : (existing?.estado ?? o.estado),
      itemPruebaId: existing?.itemPruebaId ?? o.itemPruebaId ?? null,
      observaciones: existing?.observaciones ?? o.observaciones ?? null,
    });
  }
  return [...map.values()];
}

function patchDocumentalOficios(
  item: ControlPruebaItem,
  oficios: OficioAutenticidadPendiente[],
  destinatario?: string | null,
): ControlPruebaItem {
  const doc: DocumentalPruebaMeta = {
    ...(item.documental ?? {}),
    autenticidadImpugnada: true,
    fechaImpugnacion: item.documental?.fechaImpugnacion ?? new Date().toISOString().slice(0, 10),
    oficiosAutenticidad: oficios,
    destinatarioOficio: destinatario?.trim() || oficios[0]?.destinatarioOficio?.trim() || item.documental?.destinatarioOficio || null,
  };
  return {
    ...item,
    estado: 'autenticidad_impugnada',
    documental: doc,
  };
}

/** Ítems legados embebidos — ya no se ocultan los vínculos informativa/oficio. */
export function esItemOcultoAutenticidadDocumental(
  _item: ControlPruebaItem,
  _allItems: ControlPruebaItem[],
): boolean {
  return false;
}

export function collectOficiosAutenticidadFromItems(items: ControlPruebaItem[]): OficioAutenticidadPendiente[] {
  const out: OficioAutenticidadPendiente[] = [];
  for (const item of items) {
    if (item.tipo !== 'documental') continue;
    for (const o of item.documental?.oficiosAutenticidad ?? []) {
      out.push({ ...o, itemPruebaId: item.id });
    }
  }
  return out;
}

export function attachOficiosToDocumentalItems(
  items: ControlPruebaItem[],
  oficios: OficioAutenticidadPendiente[],
): ControlPruebaItem[] {
  if (!oficios.length) return items;
  const byItemId = new Map<string, OficioAutenticidadPendiente[]>();
  const sueltos: OficioAutenticidadPendiente[] = [];

  for (const raw of oficios) {
    const o = {
      ...raw,
      id: raw.id || crypto.randomUUID(),
      descripcionDocumento: raw.descripcionDocumento?.trim() ?? '',
      destinatarioOficio: raw.destinatarioOficio?.trim() ?? '',
    };
    if (!o.descripcionDocumento || !o.destinatarioOficio) continue;
    if (o.itemPruebaId) {
      const list = byItemId.get(o.itemPruebaId) ?? [];
      list.push(o);
      byItemId.set(o.itemPruebaId, list);
    } else {
      sueltos.push(o);
    }
  }

  return items.map((item) => {
    if (item.tipo !== 'documental') return item;
    const direct = byItemId.get(item.id) ?? [];
    const porDesc = sueltos.filter(
      (o) =>
        normKey(o.descripcionDocumento) === normKey(item.descripcion) ||
        normKey(item.descripcion).includes(normKey(o.descripcionDocumento)) ||
        normKey(o.descripcionDocumento).includes(normKey(item.descripcion)),
    );
    const merged = mergeOficios(item.documental?.oficiosAutenticidad ?? [], [...direct, ...porDesc]);
    if (merged.length === 0) return item;
    const needsEstado = item.estado !== 'autenticidad_impugnada';
    const next = patchDocumentalOficios(item, merged.map((o) => ({ ...o, itemPruebaId: item.id })));
    return needsEstado ? next : { ...item, documental: next.documental };
  });
}

/**
 * Adjunta oficios importados al meta documental. Los vínculos informativa/oficio
 * permanecen visibles en Comunicaciones con el flujo completo de diligencia.
 */
export function consolidarAutenticidadDocumentalExpediente(
  items: ControlPruebaItem[],
  oficiosExpediente: OficioAutenticidadPendiente[] = [],
): { items: ControlPruebaItem[]; oficiosExpediente: OficioAutenticidadPendiente[] } {
  const working = attachOficiosToDocumentalItems(items, normalizeOficiosAutenticidad(oficiosExpediente));
  return { items: working, oficiosExpediente: [] };
}

export function consolidarInformativasAutenticidadImport(items: ControlPruebaItem[]): ControlPruebaItem[] {
  return consolidarAutenticidadDocumentalExpediente(items, []).items;
}

export function itemsVisiblesControlExpediente(items: ControlPruebaItem[]): ControlPruebaItem[] {
  return items.filter((item) => !esItemOcultoAutenticidadDocumental(item, items));
}
