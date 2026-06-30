import type {
  ControlPruebaItem,
  DocumentalPruebaMeta,
  OficioAutenticidadPendiente,
} from '@/types/control-prueba';
import { esOficioInformativaAutenticidad } from '@/lib/control-prueba-documental-poder';
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

function extractReferencia(obs?: string | null): string | null {
  if (!obs) return null;
  const m = obs.match(/\bRef:\s*(Doc\.?\s*[\d.a-z]+|[^\·]+)/i);
  return m?.[1]?.trim() ?? null;
}

function esInformativaSoloAutenticidad(item: ControlPruebaItem): boolean {
  if (item.tipo !== 'informativa') return false;
  const t = `${item.descripcion} ${item.observaciones ?? ''} ${item.vinculo?.vinculoLabel ?? ''}`;
  return (
    item.vinculo?.rol === 'informativa_autenticidad' ||
    /\binformativa\b.{0,40}\bautenticidad\b/i.test(t) ||
    /\bautenticidad\b.{0,40}\bdocumental\b/i.test(t) ||
    /\bimpugnaci[oó]n\b.{0,40}\bautenticidad\b/i.test(t)
  );
}

function oficioDesdeDiligencia(
  item: ControlPruebaItem,
  documental: ControlPruebaItem,
): OficioAutenticidadPendiente {
  const dest = item.diligencia?.destinatario?.trim() || documental.documental?.destinatarioOficio?.trim() || '';
  return {
    id: crypto.randomUUID(),
    referencia: extractReferencia(documental.observaciones),
    descripcionDocumento: documental.descripcion,
    destinatarioOficio: dest,
    objetoOficio: item.diligencia?.objeto?.trim() || null,
    estado: item.estado === 'librado' || item.estado === 'enviado' ? 'librado' : 'a_librar',
    itemPruebaId: documental.id,
    observaciones: item.observaciones ?? null,
  };
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

/** Ítems legados (informativa/oficio hijo) que no deben figurar como prueba suelta. */
export function esItemOcultoAutenticidadDocumental(
  item: ControlPruebaItem,
  allItems: ControlPruebaItem[],
): boolean {
  if (item.vinculo?.rol === 'informativa_autenticidad') return true;
  if (esOficioInformativaAutenticidad(item)) {
    const padreId = item.diligencia?.pruebaVinculadaId;
    const padre = padreId ? allItems.find((i) => i.id === padreId) : undefined;
    if (padre?.tipo === 'documental') return true;
  }
  if (esInformativaSoloAutenticidad(item) && !item.vinculo?.parentItemId) {
    return true;
  }
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
 * Unifica documental negada: oficios embebidos en el ítem documental,
 * sin informativas sueltas ni oficios hijos en diligencias.
 */
export function consolidarAutenticidadDocumentalExpediente(
  items: ControlPruebaItem[],
  oficiosExpediente: OficioAutenticidadPendiente[] = [],
): { items: ControlPruebaItem[]; oficiosExpediente: OficioAutenticidadPendiente[] } {
  let working = attachOficiosToDocumentalItems(items, normalizeOficiosAutenticidad(oficiosExpediente));
  const removeIds = new Set<string>();

  for (const item of working) {
    if (item.vinculo?.rol !== 'informativa_autenticidad') continue;
    const padreId = item.vinculo.parentItemId;
    const padre = working.find((i) => i.id === padreId);
    if (!padre || padre.tipo !== 'documental') {
      removeIds.add(item.id);
      continue;
    }
    const dest = padre.documental?.destinatarioOficio?.trim();
    const oficio = {
      id: crypto.randomUUID(),
      referencia: extractReferencia(padre.observaciones),
      descripcionDocumento: padre.descripcion,
      destinatarioOficio: dest || 'Oficiado',
      objetoOficio: `Autenticidad — ${padre.descripcion.slice(0, 100)}`,
      estado: 'a_librar' as const,
      itemPruebaId: padre.id,
      observaciones: item.observaciones ?? null,
    };
    const idx = working.findIndex((i) => i.id === padre.id);
    if (idx >= 0) {
      const merged = mergeOficios(working[idx]!.documental?.oficiosAutenticidad ?? [], [oficio]);
      working[idx] = patchDocumentalOficios(working[idx]!, merged);
    }
    removeIds.add(item.id);
  }

  for (const item of working) {
    if (!esOficioInformativaAutenticidad(item)) continue;
    const padreId = item.diligencia?.pruebaVinculadaId;
    if (!padreId) continue;
    const padre = working.find((i) => i.id === padreId);
    if (!padre || padre.tipo !== 'documental') continue;
    const idx = working.findIndex((i) => i.id === padre.id);
    if (idx >= 0) {
      const merged = mergeOficios(
        working[idx]!.documental?.oficiosAutenticidad ?? [],
        [oficioDesdeDiligencia(item, padre)],
      );
      working[idx] = patchDocumentalOficios(working[idx]!, merged);
    }
    removeIds.add(item.id);
  }

  for (const item of working) {
    if (!esInformativaSoloAutenticidad(item) || item.vinculo?.parentItemId) continue;
    const candidato = working.find(
      (d) =>
        d.tipo === 'documental' &&
        !removeIds.has(d.id) &&
        (normKey(d.descripcion).includes(normKey(item.descripcion).slice(0, 40)) ||
          normKey(item.descripcion).includes(normKey(d.descripcion).slice(0, 40))),
    );
    if (!candidato) {
      removeIds.add(item.id);
      continue;
    }
    const dest =
      candidato.documental?.destinatarioOficio?.trim() ||
      item.observaciones?.match(/oficiar\s+a\s+([^·]+)/i)?.[1]?.trim();
    const oficio: OficioAutenticidadPendiente = {
      id: crypto.randomUUID(),
      referencia: extractReferencia(candidato.observaciones),
      descripcionDocumento: candidato.descripcion,
      destinatarioOficio: dest || 'Oficiado',
      objetoOficio: `Autenticidad — ${candidato.descripcion.slice(0, 100)}`,
      estado: 'a_librar',
      itemPruebaId: candidato.id,
      observaciones: item.observaciones ?? null,
    };
    const idx = working.findIndex((i) => i.id === candidato.id);
    if (idx >= 0) {
      const merged = mergeOficios(working[idx]!.documental?.oficiosAutenticidad ?? [], [oficio]);
      working[idx] = patchDocumentalOficios(working[idx]!, merged, dest);
    }
    removeIds.add(item.id);
  }

  working = working
    .filter((i) => !removeIds.has(i.id))
    .map((item) => {
      if (item.tipo !== 'documental' || item.estado !== 'autenticidad_impugnada') return item;
      const oficios = item.documental?.oficiosAutenticidad ?? [];
      if (oficios.length > 0) return item;
      const dest = item.documental?.destinatarioOficio?.trim();
      if (!dest) return item;
      return patchDocumentalOficios(item, [
        {
          id: crypto.randomUUID(),
          referencia: extractReferencia(item.observaciones),
          descripcionDocumento: item.descripcion,
          destinatarioOficio: dest,
          objetoOficio: `Autenticidad — ${item.descripcion.slice(0, 100)}`,
          estado: 'a_librar',
          itemPruebaId: item.id,
          observaciones: null,
        },
      ]);
    });

  return { items: working, oficiosExpediente: [] };
}

export function consolidarInformativasAutenticidadImport(items: ControlPruebaItem[]): ControlPruebaItem[] {
  return consolidarAutenticidadDocumentalExpediente(items, []).items;
}

export function itemsVisiblesControlExpediente(items: ControlPruebaItem[]): ControlPruebaItem[] {
  return items.filter((item) => !esItemOcultoAutenticidadDocumental(item, items));
}
