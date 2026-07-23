import { esPruebaOfrecida, TIPO_LABELS } from '@/lib/control-prueba';
import { esEventoAudienciaPrueba } from '@/lib/control-prueba-audiencia-evento';
import type {
  ControlPruebaItem,
  OficioAutenticidadPendiente,
  PruebaParte,
  ResumenEjecutivoImport,
} from '@/types/control-prueba';

export type ParteRepresentada = 'actor' | 'demandado' | 'tercero';

const ESTADOS_PRODUCIDA = new Set(['producida', 'valoracion_judicial', 'desistida', 'no_admitida']);
const ESTADOS_PENDIENTE = new Set([
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'exhibicion_parcial',
  'apercibimiento_en_contra',
  'autenticidad_impugnada',
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
  if (parte === 'tercero') {
    if (ofrecida === 'tercero') return true;
  } else if (ofrecida === parte) {
    return true;
  }

  const padreId = item.vinculo?.parentItemId ?? item.diligencia?.pruebaVinculadaId ?? null;
  if (padreId) {
    const padre = items.find((i) => i.id === padreId);
    if (!padre) return false;
    const padreOfrecida = (padre.ofrecidaPor ?? 'actor') as PruebaParte;
    if (parte === 'tercero') return padreOfrecida === 'tercero';
    return padreOfrecida === parte;
  }

  return false;
}

/** True si el ítem pertenece a alguna de las partes representadas. */
export function itemEsDeAlgunaParteRepresentada(
  item: ControlPruebaItem,
  partes: ParteRepresentada[],
  items: ControlPruebaItem[],
): boolean {
  if (partes.length === 0) return true;
  return partes.some((p) => itemEsNuestraParte(item, p, items));
}

function bucketEstado(item: ControlPruebaItem): keyof ResumenEjecutivoImport | null {
  const estado = String(item.estado);
  if (item.tipo === 'informativa') {
    if (estado === 'valoracion_judicial') return 'producida';
    if (
      estado === 'producida' ||
      estado === 'cumplido' ||
      estado === 'diligenciado' ||
      estado === 'contestado'
    ) {
      return 'producida';
    }
    if (estado === 'vencido') return 'producida'; // cerrada sin éxito — no la dejamos en pendiente
    return 'pendiente';
  }
  if (ESTADOS_PRODUCIDA.has(estado)) return 'producida';
  if (ESTADOS_PENDIENTE.has(estado)) return 'pendiente';
  if (item.categoria === 'diligencia' || item.tipo === 'oficio' || item.tipo === 'cedula') {
    return 'aLibrar';
  }
  return 'pendiente';
}

/** Arma resumen ejecutivo desde los ítems actuales (opcionalmente filtrado por parte/s). */
export function buildResumenDesdeItems(
  items: ControlPruebaItem[],
  oficios: OficioAutenticidadPendiente[],
  parte?: ParteRepresentada | ParteRepresentada[] | '' | null,
): ResumenEjecutivoImport | undefined {
  const partes: ParteRepresentada[] = Array.isArray(parte)
    ? parte.filter((p) => p === 'actor' || p === 'demandado' || p === 'tercero')
    : parte === 'actor' || parte === 'demandado' || parte === 'tercero'
      ? [parte]
      : [];
  const nuestra =
    partes.length > 0
      ? items.filter((i) => itemEsDeAlgunaParteRepresentada(i, partes, items))
      : items;
  if (nuestra.length === 0 && oficios.length === 0) return undefined;

  const out: ResumenEjecutivoImport = {
    producida: [],
    pendiente: [],
    aLibrar: [],
  };

  const lineasPendiente = new Set<string>();
  const lineasProducida = new Set<string>();

  for (const item of nuestra) {
    if (!esPruebaOfrecida(item)) continue;
    const bucket = bucketEstado(item);
    if (bucket !== 'pendiente' && bucket !== 'producida') continue;
    const linea = lineaItem(item);
    if (bucket === 'pendiente') {
      if (lineasPendiente.has(linea)) continue;
      lineasPendiente.add(linea);
      out.pendiente!.push(linea);
    } else {
      if (lineasProducida.has(linea)) continue;
      lineasProducida.add(linea);
      out.producida!.push(linea);
    }
  }

  for (const item of nuestra) {
    if (esPruebaOfrecida(item)) continue;
    if (esEventoAudienciaPrueba(item)) continue;
    if (ESTADOS_EVENTO_CERRADO.has(String(item.estado))) continue;
    const cat = item.categoria ?? '';
    const esComunicacion =
      cat === 'diligencia' ||
      item.tipo === 'oficio' ||
      item.tipo === 'cedula' ||
      item.tipo === 'oficio_electronico' ||
      item.tipo === 'cedula_electronica';
    if (!esComunicacion && bucketEstado(item) !== 'aLibrar') continue;
    out.aLibrar!.push(lineaItem(item));
  }

  const idsDoc = new Set(nuestra.filter((i) => i.tipo === 'documental').map((i) => i.id));
  for (const o of oficios) {
    if (o.estado !== 'a_librar') continue;
    if (o.itemPruebaId && idsDoc.size > 0 && !idsDoc.has(o.itemPruebaId)) continue;
    if (partes.length > 0 && o.itemPruebaId && !idsDoc.has(o.itemPruebaId)) continue;
    const ref = o.referencia ? `${o.referencia} — ` : '';
    out.aLibrar!.push(`Oficio autenticidad: ${ref}${o.destinatarioOficio}`);
  }

  if (!out.producida?.length) delete out.producida;
  if (!out.pendiente?.length) delete out.pendiente;
  if (!out.aLibrar?.length) delete out.aLibrar;

  return Object.keys(out).length ? out : undefined;
}

/** @deprecated usar buildResumenDesdeItems */
export function buildResumenNuestraParte(
  items: ControlPruebaItem[],
  oficios: OficioAutenticidadPendiente[],
  parte: ParteRepresentada | '' | undefined,
): ResumenEjecutivoImport | undefined {
  if (!parte) return undefined;
  return buildResumenDesdeItems(items, oficios, parte);
}

/** Filtra un resumen importado por IA dejando líneas que mencionan nuestra parte. */
export function filtrarResumenImportPorParte(
  resumen: ResumenEjecutivoImport | undefined,
  parte: ParteRepresentada,
  actor?: string,
  demandado?: string,
): ResumenEjecutivoImport | undefined {
  if (!resumen) return undefined;
  if (parte === 'tercero') {
    // Sin hints fiables de nombre: no filtramos el texto de IA; preferí buildResumenDesdeItems.
    return resumen;
  }

  const hintsNuestra: string[] =
    parte === 'actor'
      ? (['actor', 'actora', 'demandante', actor?.split(/\s+/)[0]?.toLowerCase()].filter(Boolean) as string[])
      : (['demandado', 'demandada', demandado?.split(/\s+/)[0]?.toLowerCase()].filter(Boolean) as string[]);

  const hintsContraria =
    parte === 'actor'
      ? (['demandado', 'demandada', demandado?.split(/\s+/)[0]?.toLowerCase()].filter(Boolean) as string[])
      : (['actor', 'actora', 'demandante', actor?.split(/\s+/)[0]?.toLowerCase()].filter(Boolean) as string[]);

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
  parte: ParteRepresentada | ParteRepresentada[] | '' | undefined,
  resumenImport?: ResumenEjecutivoImport,
  actor?: string,
  demandado?: string,
): ResumenEjecutivoImport | undefined {
  const partes: ParteRepresentada[] = Array.isArray(parte)
    ? parte.filter((p) => p === 'actor' || p === 'demandado' || p === 'tercero')
    : parte === 'actor' || parte === 'demandado' || parte === 'tercero'
      ? [parte]
      : [];

  // Con parte(s) representada(s): siempre desde ítems actuales (se actualiza solo).
  if (partes.length > 0) {
    const desdeItems = buildResumenDesdeItems(items, oficios, partes);
    if (desdeItems) {
      return {
        ...desdeItems,
        // Conservá recomendaciones del import (la IA); el resto refleja el control.
        recomendaciones: resumenImport?.recomendaciones,
      };
    }
    if (partes.length === 1 && partes[0] !== 'tercero') {
      return filtrarResumenImportPorParte(resumenImport, partes[0], actor, demandado);
    }
    return resumenImport;
  }

  // Sin parte: snapshot del import (o el último “Actualizar”) hasta que regeneren.
  return resumenImport;
}
