import type {
  CedulaNotifMedio,
  ControlPruebaItem,
  DocumentalEnPoderMeta,
  PruebaParte,
} from '@/types/control-prueba';
import { PARTE_LABELS } from '@/lib/control-prueba';
import { esCierrePrueba } from '@/lib/control-prueba-cierre';

export const TIPO_DOCUMENTAL_EN_PODER = 'documental_en_poder' as const;

const ESTADOS_SOLO_INTIMACION = new Set(['intimacion_ordenada']);

export function requiereFlujoDocumentalEnPoder(tipo: string): boolean {
  return tipo === TIPO_DOCUMENTAL_EN_PODER;
}

/** @deprecated alias */
export const requiereIntimacionDocumental = requiereFlujoDocumentalEnPoder;

export function parteContrariaDefault(ofrecidaPor?: string): PruebaParte {
  if (ofrecidaPor === 'actor') return 'demandado';
  if (ofrecidaPor === 'demandado') return 'actor';
  return 'tercero';
}

export function estadosPruebaParaItemDocumental(
  item: ControlPruebaItem,
  todos: readonly string[],
): string[] {
  if (requiereFlujoDocumentalEnPoder(item.tipo)) {
    return todos.filter((e) => e !== 'audiencia_fijada' && e !== 'autenticidad_impugnada');
  }
  return todos.filter((e) => !ESTADOS_SOLO_INTIMACION.has(e) && e !== 'intimacion_ordenada');
}

export function ensureDocumentalEnPoderMeta(item: ControlPruebaItem): ControlPruebaItem {
  if (!requiereFlujoDocumentalEnPoder(item.tipo)) return item;
  const prev = item.documentalEnPoder ?? {};
  const estado =
    item.estado === 'autenticidad_impugnada' ? 'intimacion_ordenada' : item.estado;
  const intimacionOrdenada = estado === 'intimacion_ordenada';
  return {
    ...item,
    estado,
    documentalEnPoder: {
      parteConDocumentos: prev.parteConDocumentos ?? parteContrariaDefault(item.ofrecidaPor),
      documentosDetalle: prev.documentosDetalle ?? null,
      plazoPresentacion: prev.plazoPresentacion ?? item.fechaLimite ?? null,
      medioIntimacion: (prev.medioIntimacion as CedulaNotifMedio) ?? 'papel',
      intimacionOrdenada,
    },
  };
}

export function syncFechaLimiteDocumentalEnPoder(item: ControlPruebaItem): ControlPruebaItem {
  if (!requiereFlujoDocumentalEnPoder(item.tipo)) return item;
  const plazo = item.documentalEnPoder?.plazoPresentacion;
  if (item.estado === 'intimacion_ordenada' && plazo) {
    return { ...item, fechaLimite: plazo };
  }
  if (item.estado !== 'intimacion_ordenada') {
    return { ...item, fechaLimite: null };
  }
  return item;
}

export function patchDocumentalEnPoder(
  item: ControlPruebaItem,
  patch: Partial<DocumentalEnPoderMeta>,
): Partial<ControlPruebaItem> {
  const dep = { ...item.documentalEnPoder, ...patch };
  const result: Partial<ControlPruebaItem> = { documentalEnPoder: dep };
  if (patch.plazoPresentacion !== undefined) {
    result.fechaLimite = patch.plazoPresentacion || null;
  }
  return result;
}

export function patchEstadoDocumentalEnPoder(
  item: ControlPruebaItem,
  estado: string,
): Partial<ControlPruebaItem> {
  const patch: Partial<ControlPruebaItem> = { estado };
  if (!requiereFlujoDocumentalEnPoder(item.tipo)) return patch;

  const estadoFinal = String(estado);

  if (estadoFinal === 'intimacion_ordenada') {
    const prev = item.documentalEnPoder ?? {};
    const plazo = prev.plazoPresentacion ?? item.fechaLimite ?? null;
    patch.documentalEnPoder = {
      ...prev,
      intimacionOrdenada: true,
      parteConDocumentos: prev.parteConDocumentos ?? parteContrariaDefault(item.ofrecidaPor),
      plazoPresentacion: plazo,
      medioIntimacion: prev.medioIntimacion ?? 'papel',
    };
    patch.fechaLimite = plazo;
    return patch;
  }

  if (estadoFinal === 'postpuesta_juez' || estadoFinal === 'pendiente_produccion') {
    patch.documentalEnPoder = {
      ...item.documentalEnPoder,
      intimacionOrdenada: false,
      plazoPresentacion: null,
    };
    patch.fechaLimite = null;
    return patch;
  }

  if (esCierrePrueba(estadoFinal) && estadoFinal !== 'producida') {
    patch.documentalEnPoder = {
      ...item.documentalEnPoder,
      intimacionOrdenada: false,
      plazoPresentacion: null,
    };
    patch.fechaLimite = null;
    return patch;
  }

  if (estadoFinal !== 'producida' && item.estado === 'intimacion_ordenada') {
    patch.documentalEnPoder = {
      ...item.documentalEnPoder,
      intimacionOrdenada: false,
    };
  }

  return patch;
}

export function labelParteConDocumentos(parte?: string | null): string {
  if (!parte) return 'Contraparte';
  return PARTE_LABELS[parte] ?? parte;
}

export function usaFlujoDocumentalEnPoder(item: ControlPruebaItem): boolean {
  return requiereFlujoDocumentalEnPoder(item.tipo);
}

/** @deprecated alias */
export const usaFlujoIntimacionDocumental = usaFlujoDocumentalEnPoder;

export function esOficioAutenticidadDocumental(
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo' | 'vinculo' | 'diligencia'>,
): boolean {
  return (
    item.categoria === 'diligencia' &&
    (item.tipo === 'oficio' || item.tipo === 'oficio_electronico') &&
    (item.vinculo?.rol === 'oficio_autenticidad' || item.vinculo?.rol === 'oficio_informativa') &&
    Boolean(item.diligencia?.pruebaVinculadaId)
  );
}

/** @deprecated alias */
export const esOficioInformativaAutenticidad = esOficioAutenticidadDocumental;

/** Documental ya adjunta a demanda/contestación/ampliación — tipo `documental`, no `documental_en_poder`. */
export function esDocumentalYaAcompanada(descripcion: string): boolean {
  const conEscrito =
    /\b(demanda|contestaci[oó]n de (la )?demanda|ampliaci[oó]n|r[eé]plica|duplica|escrito inicial)\b/i.test(
      descripcion,
    );
  const adjunta =
    /\b(acompañad|adjunt|agregad|incorporad|obrante en|obra en|se acompaña|acompaña|producid)\b/i.test(descripcion);
  return (adjunta && conEscrito) || /\bdocumental (ya )?(acompañad|producid|agregad|adjunt)/i.test(descripcion);
}

/** Ofrecimiento válido de documental en poder de contraparte (no adjunta al escrito). */
export function esOfrecimientoDocumentalEnPoder(descripcion: string, tipoRaw?: string): boolean {
  const tipo = (tipoRaw ?? '').toLowerCase();
  if (tipo === 'documental_en_poder') return !esDocumentalYaAcompanada(descripcion);
  if (esDocumentalYaAcompanada(descripcion)) return false;
  return (
    /\ben poder de la (demandada|actora|actor|contraparte|parte demandada|parte actora)\b/i.test(descripcion) ||
    /\bdocumental en poder\b/i.test(descripcion) ||
    /\b(documentaci[oó]n|documentos).+(poder|detenta|posee).+(demandad|actor|contraparte)\b/i.test(descripcion)
  );
}

/**
 * Documentación formal/instrumental (personería, tasas, DNI, CUIT letrado…) —
 * no es prueba sustancial del objeto del juicio.
 */
const DOCUMENTAL_FORMAL_PROCESAL: RegExp[] = [
  /\bfotocopia[s]?\s+(de\s+)?(dni|documento\s+nacional)\b/i,
  /\bcopia[s]?\s+(de\s+)?(dni|documento\s+nacional)\b/i,
  /\bdoc\.?\s*dni\b/i,
  /\bdni\s+(de\s+)?(las?\s+)?actor/i,
  /\bconstancia\s+de\s+cuit\b/i,
  /\bcuit\b.+\b(dr\.?|dra\.?|letrad|abogad|estudio)\b/i,
  /\b(dr\.?|dra\.?|letrad|abogad|estudio).+\bcuit\b/i,
  /\bjus\s+previsional\b/i,
  /\banticipo\s+de\s+jus\b/i,
  /\bbono\s+ley\s*8480\b/i,
  /\bbono\s+ley\b/i,
  /\btasa\s+de\s+justicia\b/i,
  /\bconstancia\s+de\s+matr[ií]cula\b/i,
  /\bacreditaci[oó]n\s+de\s+personer[ií]a\b/i,
  /\bpersoner[ií]a\s+(del\s+)?(letrad|abogad)\b/i,
  /\bpoder\s+(especial|general)\s+(para\s+juicios?|judicial)\b/i,
];

export function esDocumentalFormalProcesal(
  descripcion: string,
  referenciaDocumental?: string | null,
): boolean {
  const texto = `${descripcion}\n${referenciaDocumental ?? ''}`.trim();
  if (!texto) return false;
  return DOCUMENTAL_FORMAL_PROCESAL.some((re) => re.test(texto));
}

function fraseParteDetentadora(parte: string | null | undefined): string {
  switch (parte) {
    case 'actor':
      return 'la actora';
    case 'tercero':
      return 'tercero';
    default:
      return 'la demandada';
  }
}

/**
 * Une N ítems `documental_en_poder` del mismo oferente/parte detentadora
 * en uno solo (listado completo → una intimación).
 */
export function consolidarDocumentalEnPoderItems(items: ControlPruebaItem[]): ControlPruebaItem[] {
  const indicesPorClave = new Map<string, number[]>();
  items.forEach((item, index) => {
    if (item.tipo !== 'documental_en_poder') return;
    const parte = item.documentalEnPoder?.parteConDocumentos ?? parteContrariaDefault(item.ofrecidaPor);
    const key = `${item.ofrecidaPor ?? 'actor'}|${parte}`;
    const list = indicesPorClave.get(key) ?? [];
    list.push(index);
    indicesPorClave.set(key, list);
  });

  const omitir = new Set<number>();
  const reemplazos = new Map<number, ControlPruebaItem>();

  for (const [, indices] of indicesPorClave) {
    if (indices.length <= 1) continue;
    const grupo = indices.map((i) => items[i]!);
    const baseIdx = indices[0]!;
    const base = grupo[0]!;
    const parte =
      base.documentalEnPoder?.parteConDocumentos ?? parteContrariaDefault(base.ofrecidaPor);
    const lineas = grupo.map((g, n) => {
      const det = g.documentalEnPoder?.documentosDetalle?.trim();
      const desc = det && det !== g.descripcion.trim() ? det : g.descripcion.trim();
      return `${n + 1}. ${desc}`;
    });
    const intimacion = grupo.some(
      (g) => g.estado === 'intimacion_ordenada' || g.documentalEnPoder?.intimacionOrdenada,
    );
    const plazo =
      grupo.map((g) => g.fechaLimite || g.documentalEnPoder?.plazoPresentacion || null).find(Boolean) ??
      null;
    const obs = grupo
      .map((g) => g.observaciones?.trim())
      .filter(Boolean)
      .join(' · ');

    reemplazos.set(baseIdx, {
      ...base,
      descripcion: `Documental en poder de ${fraseParteDetentadora(parte)} (${grupo.length} documentos)`,
      estado: intimacion ? 'intimacion_ordenada' : base.estado,
      fechaLimite: plazo,
      observaciones: obs || null,
      documentalEnPoder: {
        parteConDocumentos: parte,
        documentosDetalle: lineas.join('\n'),
        plazoPresentacion: plazo,
        medioIntimacion: base.documentalEnPoder?.medioIntimacion ?? 'papel',
        intimacionOrdenada: intimacion,
      },
    });
    for (let k = 1; k < indices.length; k++) omitir.add(indices[k]!);
  }

  if (reemplazos.size === 0) return items;

  return items
    .map((item, index) => (reemplazos.has(index) ? reemplazos.get(index)! : item))
    .filter((_, index) => !omitir.has(index))
    .map((item, index) => ({ ...item, orden: index + 1 }));
}
