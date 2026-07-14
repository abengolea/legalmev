import { esAudienciaOfrecida, TIPO_LABELS } from '@/lib/control-prueba';
import { esEventoAudienciaPrueba } from '@/lib/control-prueba-audiencia-evento';
import type {
  ControlPruebaItem,
  OficioAutenticidadPendiente,
  PruebaParte,
  ResumenEjecutivoImport,
} from '@/types/control-prueba';

export type ParteRepresentada = 'actor' | 'demandado';

const ESTADOS_PRODUCIDA = new Set(['producida', 'valoracion_judicial', 'desistida', 'no_admitida']);
const ESTADOS_PENDIENTE = new Set([
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'autenticidad_impugnada',
  // Eventos de audiencia abiertos (categoria audiencia)
  'programada',
  'reprogramada',
]);
const ESTADOS_EVENTO_CERRADO = new Set(['realizada', 'cancelada']);

function lineaItem(item: ControlPruebaItem): string {
  const tipo = TIPO_LABELS[item.tipo] ?? item.tipo;
  const desc = item.descripcion.trim();
  const base = desc.length > 90 ? `${tipo}: ${desc.slice(0, 87)}…` : `${tipo}: ${desc}`;
  if (String(item.estado) === 'valoracion_judicial') {
    return `${base} (a valoración judicial)`;
  }
  if (String(item.estado) === 'audiencia_fijada' || String(item.estado) === 'programada') {
    return `${base} (audiencia pendiente)`;
  }
  return base;
}

/** Ítem de prueba/audiencia/diligencia vinculada a la parte que representamos. */
export function itemEsNuestraParte(
  item: ControlPruebaItem,
  parte: ParteRepresentada,
  items: ControlPruebaItem[],
): boolean {
  const ofrecida = (item.ofrecidaPor ?? 'actor') as PruebaParte;
  if (ofrecida === parte) return true;

  const padreId = item.vinculo?.parentItemId ?? item.diligencia?.pruebaVinculadaId ?? null;
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

function padreIdDeItem(item: ControlPruebaItem): string | null {
  return item.vinculo?.parentItemId ?? item.diligencia?.pruebaVinculadaId ?? null;
}

function esAudienciaOEvento(item: ControlPruebaItem): boolean {
  return esEventoAudienciaPrueba(item) || esAudienciaOfrecida(item);
}

/** Arma resumen ejecutivo solo con la prueba de la parte que representamos. */
export function buildResumenNuestraParte(
  items: ControlPruebaItem[],
  oficios: OficioAutenticidadPendiente[],
  parte: ParteRepresentada | '' | undefined,
): ResumenEjecutivoImport | undefined {
  if (!parte) return undefined;

  const nuestra = items.filter((i) => {
    if (!itemEsNuestraParte(i, parte, items)) return false;
    // Eventos cerrados: la prueba padre ya refleja el resultado
    if (esEventoAudienciaPrueba(i) && ESTADOS_EVENTO_CERRADO.has(String(i.estado))) return false;
    return true;
  });
  if (nuestra.length === 0 && oficios.length === 0) return undefined;

  const out: ResumenEjecutivoImport = {
    producida: [],
    pendiente: [],
    aLibrar: [],
  };

  const lineasPendiente = new Set<string>();
  const lineasProducida = new Set<string>();

  for (const item of nuestra) {
    // Evitar duplicar evento si el confesional/testimonial padre ya figura en pendiente
    if (esEventoAudienciaPrueba(item)) {
      const padre = items.find((i) => i.id === item.vinculo?.parentItemId);
      if (padre && ESTADOS_PENDIENTE.has(String(padre.estado))) continue;
    }

    const bucket = bucketEstado(item);
    if (!bucket || bucket === 'recomendaciones') continue;
    const linea = lineaItem(item);
    if (bucket === 'pendiente') {
      if (lineasPendiente.has(linea)) continue;
      lineasPendiente.add(linea);
      out.pendiente!.push(linea);
    } else if (bucket === 'producida') {
      if (lineasProducida.has(linea)) continue;
      lineasProducida.add(linea);
      out.producida!.push(linea);
    } else {
      out.aLibrar!.push(linea);
    }
  }

  // Cédulas/oficios de audiencia: si el padre no quedó en pendiente (p. ej. marcado producida),
  // igual mostrar la audiencia en Pend. producción.
  for (const item of nuestra) {
    if (bucketEstado(item) !== 'aLibrar') continue;
    const padreId = padreIdDeItem(item);
    if (!padreId) continue;
    const padre = items.find((i) => i.id === padreId);
    if (!padre || !esAudienciaOEvento(padre)) continue;
    if (ESTADOS_EVENTO_CERRADO.has(String(padre.estado))) continue;
    const linea = lineaItem(padre);
    if (lineasPendiente.has(linea)) continue;
    lineasPendiente.add(linea);
    out.pendiente!.push(linea);
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
