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

export function esOficioInformativaAutenticidad(
  item: Pick<ControlPruebaItem, 'categoria' | 'tipo' | 'vinculo' | 'diligencia'>,
): boolean {
  return (
    item.categoria === 'diligencia' &&
    (item.tipo === 'oficio' || item.tipo === 'oficio_electronico') &&
    item.vinculo?.rol === 'oficio_informativa' &&
    Boolean(item.diligencia?.pruebaVinculadaId)
  );
}

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
