import type { ControlPruebaImportOutput } from '@/ai/flows/control-prueba-import-flow';
import type {
  ControlPruebaItem,
  OficioAutenticidadPendiente,
  ResumenEjecutivoImport,
} from '@/types/control-prueba';

export type ImportMetaResult = {
  oficiosAutenticidadPendientes: OficioAutenticidadPendiente[];
  resumenEjecutivo?: ResumenEjecutivoImport;
};

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** Une oficios sugeridos por IA con los detectados en ítems documental + autenticidad. */
export function buildImportMeta(
  analysis: ControlPruebaImportOutput,
  items: ControlPruebaItem[],
): ImportMetaResult {
  const map = new Map<string, OficioAutenticidadPendiente>();

  for (const raw of analysis.oficiosAutenticidadPendientes ?? []) {
    const descripcionDocumento = raw.descripcionDocumento?.trim();
    const destinatarioOficio = raw.destinatarioOficio?.trim();
    if (!descripcionDocumento || !destinatarioOficio) continue;
    const key = `${normKey(destinatarioOficio)}|${normKey(descripcionDocumento)}`;
    map.set(key, {
      id: crypto.randomUUID(),
      referencia: raw.referencia?.trim() || null,
      descripcionDocumento,
      destinatarioOficio,
      objetoOficio: raw.objetoOficio?.trim() || null,
      estado: raw.yaLibrado ? 'librado' : 'a_librar',
      itemPruebaId: null,
      observaciones: raw.observaciones?.trim() || null,
    });
  }

  for (const item of items) {
    if (item.tipo !== 'documental' || item.estado !== 'autenticidad_impugnada') continue;
    const dest = item.documental?.destinatarioOficio?.trim();
    if (!dest) continue;
    const key = `${normKey(dest)}|${normKey(item.descripcion)}`;
    const prev = map.get(key);
    map.set(key, {
      id: prev?.id ?? crypto.randomUUID(),
      referencia: prev?.referencia ?? extractReferencia(item.observaciones) ?? null,
      descripcionDocumento: item.descripcion,
      destinatarioOficio: dest,
      objetoOficio: prev?.objetoOficio ?? `Autenticidad — ${item.descripcion.slice(0, 100)}`,
      estado: prev?.estado ?? 'a_librar',
      itemPruebaId: item.id,
      observaciones: prev?.observaciones ?? item.observaciones ?? null,
    });
  }

  const resumenEjecutivo = analysis.resumenEjecutivo
    ? {
        producida: analysis.resumenEjecutivo.producida?.filter(Boolean),
        pendiente: analysis.resumenEjecutivo.pendiente?.filter(Boolean),
        aLibrar: analysis.resumenEjecutivo.aLibrar?.filter(Boolean),
        recomendaciones: analysis.resumenEjecutivo.recomendaciones?.filter(Boolean),
      }
    : inferResumenFromOficios([...map.values()]);

  return {
    oficiosAutenticidadPendientes: [...map.values()],
    resumenEjecutivo,
  };
}

function extractReferencia(obs?: string | null): string | null {
  if (!obs) return null;
  const m = obs.match(/\bRef:\s*(Doc\.?\s*\d+|[^\·]+)/i);
  return m?.[1]?.trim() ?? null;
}

function inferResumenFromOficios(oficios: OficioAutenticidadPendiente[]): ResumenEjecutivoImport | undefined {
  const aLibrar = oficios.filter((o) => o.estado === 'a_librar').map((o) => `${o.referencia ? o.referencia + ' — ' : ''}${o.destinatarioOficio}`);
  if (aLibrar.length === 0) return undefined;
  return { aLibrar };
}

export function normalizeOficiosAutenticidad(
  raw?: OficioAutenticidadPendiente[] | null,
): OficioAutenticidadPendiente[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => ({
      id: o.id || crypto.randomUUID(),
      referencia: o.referencia ?? null,
      descripcionDocumento: String(o.descripcionDocumento ?? '').trim(),
      destinatarioOficio: String(o.destinatarioOficio ?? '').trim(),
      objetoOficio: o.objetoOficio ?? null,
      estado: (o.estado as OficioAutenticidadPendiente['estado']) ?? 'a_librar',
      itemPruebaId: o.itemPruebaId ?? null,
      observaciones: o.observaciones ?? null,
    }))
    .filter((o) => o.descripcionDocumento && o.destinatarioOficio);
}

export function normalizeResumenEjecutivo(raw?: ResumenEjecutivoImport | null): ResumenEjecutivoImport | undefined {
  if (!raw) return undefined;
  const out: ResumenEjecutivoImport = {};
  if (raw.producida?.length) out.producida = raw.producida.map(String);
  if (raw.pendiente?.length) out.pendiente = raw.pendiente.map(String);
  if (raw.aLibrar?.length) out.aLibrar = raw.aLibrar.map(String);
  if (raw.recomendaciones?.length) out.recomendaciones = raw.recomendaciones.map(String);
  return Object.keys(out).length ? out : undefined;
}
