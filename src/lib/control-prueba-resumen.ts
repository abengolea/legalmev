import { TIPO_LABELS } from '@/lib/control-prueba';
import type {
  ControlPruebaItem,
  OficioAutenticidadPendiente,
  PruebaParte,
  ResumenEjecutivoImport,
} from '@/types/control-prueba';

export type ParteRepresentada = 'actor' | 'demandado';

const ESTADOS_PRODUCIDA = new Set(['producida', 'desistida', 'no_admitida']);
const ESTADOS_PENDIENTE = new Set([
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'autenticidad_impugnada',
]);

function lineaItem(item: ControlPruebaItem): string {
  const tipo = TIPO_LABELS[item.tipo] ?? item.tipo;
  const desc = item.descripcion.trim();
  return desc.length > 90 ? `${tipo}: ${desc.slice(0, 87)}…` : `${tipo}: ${desc}`;
}

/** Ítem de prueba/audiencia/diligencia vinculada a la parte que representamos. */
export function itemEsNuestraParte(
  item: ControlPruebaItem,
  parte: ParteRepresentada,
  items: ControlPruebaItem[],
): boolean {
  const ofrecida = (item.ofrecidaPor ?? 'actor') as PruebaParte;
  if (ofrecida === parte) return true;

  const padreId = item.vinculo?.padreItemId;
  if (padreId) {
    const padre = items.find((i) => i.id === padreId);
    if (padre && (padre.ofrecidaPor ?? 'actor') === parte) return true;
  }

  return false;
}

function bucketEstado(item: ControlPruebaItem): keyof ResumenEjecutivoImport | null {
  const estado = String(item.estado);
  if (ESTADOS_PRODUCIDA.has(estado)) return 'producida';
  if (ESTADOS_PENDIENTE.has(estado)) return 'pendiente';
  if (item.categoria === 'diligencia' || item.tipo === 'oficio' || item.tipo === 'cedula') {
    return 'aLibrar';
  }
  return 'pendiente';
}

/** Arma resumen ejecutivo solo con la prueba de la parte que representamos. */
export function buildResumenNuestraParte(
  items: ControlPruebaItem[],
  oficios: OficioAutenticidadPendiente[],
  parte: ParteRepresentada | '' | undefined,
): ResumenEjecutivoImport | undefined {
  if (!parte) return undefined;

  const nuestra = items.filter((i) => itemEsNuestraParte(i, parte, items));
  if (nuestra.length === 0 && oficios.length === 0) return undefined;

  const out: ResumenEjecutivoImport = {
    producida: [],
    pendiente: [],
    aLibrar: [],
  };

  for (const item of nuestra) {
    const bucket = bucketEstado(item);
    if (!bucket || bucket === 'recomendaciones') continue;
    out[bucket]!.push(lineaItem(item));
  }

  const idsNuestra = new Set(
    nuestra.filter((i) => i.tipo === 'documental').map((i) => i.id),
  );
  for (const o of oficios) {
    if (o.estado !== 'a_librar') continue;
    if (o.itemPruebaId && !idsNuestra.has(o.itemPruebaId)) continue;
    const ref = o.referencia ? `${o.referencia} — ` : '';
    out.aLibrar!.push(`Oficio autenticidad: ${ref}${o.destinatarioOficio}`);
  }

  if (!out.producida?.length) delete out.producida;
  if (!out.pendiente?.length) delete out.pendiente;
  if (!out.aLibrar?.length) delete out.aLibrar;

  return Object.keys(out).length ? out : undefined;
}

/** Filtra un resumen importado por IA dejando líneas que mencionan nuestra parte. */
export function filtrarResumenImportPorParte(
  resumen: ResumenEjecutivoImport | undefined,
  parte: ParteRepresentada,
  actor?: string,
  demandado?: string,
): ResumenEjecutivoImport | undefined {
  if (!resumen) return undefined;

  const hintsNuestra: string[] =
    parte === 'actor'
      ? ['actor', 'actora', 'demandante', actor?.split(/\s+/)[0]?.toLowerCase()].filter(Boolean) as string[]
      : ['demandado', 'demandada', demandado?.split(/\s+/)[0]?.toLowerCase()].filter(Boolean) as string[];

  const hintsContraria =
    parte === 'actor'
      ? ['demandado', 'demandada', demandado?.split(/\s+/)[0]?.toLowerCase()].filter(Boolean) as string[]
      : ['actor', 'actora', 'demandante', actor?.split(/\s+/)[0]?.toLowerCase()].filter(Boolean) as string[];

  const filtrarLineas = (lineas?: string[]) =>
    lineas?.filter((linea) => {
      const l = linea.toLowerCase();
      if (hintsContraria.some((h) => h && l.includes(h))) return false;
      if (hintsNuestra.some((h) => h && l.includes(h))) return true;
      return !hintsContraria.some((h) => h && l.includes(h));
    });

  const out: ResumenEjecutivoImport = {};
  const producida = filtrarLineas(resumen.producida);
  const pendiente = filtrarLineas(resumen.pendiente);
  const aLibrar = filtrarLineas(resumen.aLibrar);
  const recomendaciones = filtrarLineas(resumen.recomendaciones);

  if (producida?.length) out.producida = producida;
  if (pendiente?.length) out.pendiente = pendiente;
  if (aLibrar?.length) out.aLibrar = aLibrar;
  if (recomendaciones?.length) out.recomendaciones = recomendaciones;

  return Object.keys(out).length ? out : undefined;
}

export function resumenParaParteRepresentada(
  items: ControlPruebaItem[],
  oficios: OficioAutenticidadPendiente[],
  parte: ParteRepresentada | '' | undefined,
  resumenImport?: ResumenEjecutivoImport,
  actor?: string,
  demandado?: string,
): ResumenEjecutivoImport | undefined {
  if (!parte) return resumenImport;

  const desdeItems = buildResumenNuestraParte(items, oficios, parte);
  if (desdeItems) return desdeItems;

  return filtrarResumenImportPorParte(resumenImport, parte, actor, demandado);
}
