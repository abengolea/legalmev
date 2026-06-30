import type { ControlPruebaImportOutput } from '@/ai/flows/control-prueba-import-flow';
import type { ControlPruebaItem, ItemCategoria } from '@/types/control-prueba';
import {
  defaultEstadoForItem,
  defaultTipoForCategoria,
  TIPOS_AUDIENCIA,
  TIPOS_DILIGENCIA,
  TIPOS_PRUEBA,
} from '@/lib/control-prueba';
import { inferirEspecialidadPericial } from '@/lib/control-prueba-pericial';
import {
  aplicarSubprocesosPostImport,
  esProduccionDocumentalTramite,
  resolveEstadoImport,
  vincularDiligenciasImport,
} from '@/lib/control-prueba-import-enrich';
import {
  esDocumentalYaAcompanada,
  esOfrecimientoDocumentalEnPoder,
  parteContrariaDefault,
} from '@/lib/control-prueba-documental-poder';

/** Actos procesales que NO son prueba ofrecida — descartar del import. */
const EXCLUIR_DESCRIPCION: RegExp[] = [
  /\bprovidencia\b/i,
  /\btiene presente\b/i,
  /\bagrega y tiene\b/i,
  /\breanuda el llamado\b/i,
  /\bconfiere traslado\b/i,
  /\bconfiere vista\b/i,
  /\bdictamina\b/i,
  /\bsentencia interlocutoria\b/i,
  /\bsentencia\b/i,
  /\brecurso de (apelaci|reconsideraci|queja|reposici)/i,
  /\binterpone recurso\b/i,
  /\bdeniega recurso\b/i,
  /\binadmisible\b/i,
  /\bcontesta traslado\b/i,
  /\bcontesta vista\b/i,
  /\befect[uú]a descargo\b/i,
  /\bimpugna (informe|pericia|experticia)\b/i,
  /\binforma (al juzgado|que|haber)\b/i,
  /\bsuspende decreto\b/i,
  /\bremite a lo (ordenado|dispuesto)\b/i,
  /\baclara que\b/i,
  /\bdeclara inadmisible\b/i,
  /\bsolicita (reiteraci|resoluci|nuevo oficio|que la|que el)\b/i,
  /\btribunal (ordena|informa|tiene|reanuda|confiere|deniega|declara|provee|agrega)\b/i,
  /\bc[aá]mara (de apelaci|informa|adjunta)\b/i,
  /\breceptor[ií]a\b/i,
  /\bagente fiscal\b/i,
];

/** Comunicaciones procesales → categoría diligencia. */
const ES_DILIGENCIA: RegExp[] = [
  /\boficio\b/i,
  /\bc[eé]dula\b/i,
  /\bmandamiento\b/i,
  /\bexhorto\b/i,
  /\brogatoria\b/i,
  /\bnotificaci[oó]n electr[oó]nica\b/i,
  /\bneo\b/i,
];

/** Producción de prueba pericial ya ordenada (no es ítem nuevo de ofrecimiento). */
const ES_PRODUCCION_PERICIAL: RegExp[] = [
  /\bpresenta informe pericial\b/i,
  /\bpresenta dictamen\b/i,
  /\binforme pericial de\b/i,
  /\bperito .+ presenta\b/i,
];

const TIPOS_PRUEBA_SET = new Set<string>(TIPOS_PRUEBA);
const TIPOS_DILIGENCIA_SET = new Set<string>(TIPOS_DILIGENCIA);
const TIPOS_AUDIENCIA_SET = new Set<string>(TIPOS_AUDIENCIA);

export type ImportFilterResult = {
  items: ControlPruebaItem[];
  descartados: { descripcion: string; motivo: string }[];
  reclasificados: { descripcion: string; de: string; a: string }[];
};

function observacionesImport(raw: ControlPruebaImportOutput['items'][number]): string | null {
  const parts = [
    raw.referenciaDocumental?.trim() ? `Ref: ${raw.referenciaDocumental.trim()}` : '',
    raw.observaciones?.trim() ?? '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function normalizarTipoDiligencia(descripcion: string, tipoRaw: string): string {
  const d = descripcion.toLowerCase();
  const t = tipoRaw.toLowerCase();
  if (t.includes('cedula_electronica') || t.includes('neo') || d.includes('notificación electrónica') || d.includes('cédula electrónica')) {
    return 'cedula_electronica';
  }
  if (t.includes('oficio_electronico') || d.includes('oficio electrónico')) return 'oficio_electronico';
  if (t.includes('cedula') || d.includes('cédula') || d.includes('cedula')) return 'cedula';
  if (t.includes('mandamiento') || d.includes('mandamiento')) return 'mandamiento';
  if (t.includes('exhorto') || d.includes('exhorto') || d.includes('rogatoria')) return 'exhorto';
  return 'oficio';
}

function debeExcluir(descripcion: string, categoria: ItemCategoria, ofrecidaPor?: string): string | null {
  if (ES_PRODUCCION_PERICIAL.some((re) => re.test(descripcion))) {
    return 'Producción pericial (dictamen presentado), no prueba ofrecida';
  }
  if (categoria === 'prueba' && ofrecidaPor === 'tribunal') {
    return 'El tribunal no ofrece prueba';
  }
  if (categoria === 'prueba' && ofrecidaPor === 'tercero') {
    if (ES_DILIGENCIA.some((re) => re.test(descripcion))) {
      return null; // se reclasifica abajo
    }
    if (!/\b(documental|testimonial|pericial|informativa|confesional|inspecci)/i.test(descripcion)) {
      return 'Actuación de tercero/perito, no prueba ofrecida en apertura';
    }
  }
  for (const re of EXCLUIR_DESCRIPCION) {
    if (re.test(descripcion)) {
      if (ES_DILIGENCIA.some((d) => d.test(descripcion))) return null;
      return 'Acto procesal / orden judicial (no es prueba ofrecida)';
    }
  }
  return null;
}

function clasificarItem(
  raw: ControlPruebaImportOutput['items'][number],
): { categoria: ItemCategoria; tipo: string; motivoReclasificacion?: string } {
  const desc = raw.descripcion.trim();
  let categoria = (raw.categoria ?? 'prueba') as ItemCategoria;
  const tipoNorm = raw.tipo.toLowerCase();

  if (tipoNorm === 'confesional' || /\bprueba confesional\b/i.test(desc) || /\bconfesional de la parte\b/i.test(desc)) {
    return { categoria: 'audiencia', tipo: 'confesional' };
  }

  if (
    tipoNorm === 'testimonial' ||
    tipoNorm === 'audiencia_testimonial' ||
    /\bprueba testimonial\b/i.test(desc) ||
    /\baudiencia testimonial\b/i.test(desc)
  ) {
    return { categoria: 'audiencia', tipo: 'testimonial' };
  }

  if (esDocumentalYaAcompanada(desc)) {
    return {
      categoria: 'prueba',
      tipo: 'documental',
      motivoReclasificacion: 'documental_ya_acompanada',
    };
  }

  if (tipoNorm === 'documental_en_poder' || esOfrecimientoDocumentalEnPoder(desc, tipoNorm)) {
    return { categoria: 'prueba', tipo: 'documental_en_poder' };
  }

  if (ES_DILIGENCIA.some((re) => re.test(desc))) {
    return {
      categoria: 'diligencia',
      tipo: normalizarTipoDiligencia(desc, raw.tipo),
      motivoReclasificacion: 'Comunicación procesal (oficio/cédula/mandamiento)',
    };
  }

  if (categoria === 'prueba') {
    const tipoNorm = raw.tipo.toLowerCase();
    if (!TIPOS_PRUEBA_SET.has(tipoNorm)) {
      if (tipoNorm.includes('oficio') || tipoNorm === 'informe') {
        return { categoria: 'diligencia', tipo: 'oficio', motivoReclasificacion: 'Tipo inválido como prueba' };
      }
      if (TIPOS_DILIGENCIA_SET.has(tipoNorm)) {
        return { categoria: 'diligencia', tipo: tipoNorm, motivoReclasificacion: 'Tipo inválido como prueba' };
      }
      // recurso, providencia, solicitud, etc.
      if (
        ['recurso', 'resolucion', 'providencia', 'solicitud', 'manifestacion', 'traslado', 'vista', 'sentencia', 'sentencia_in', 'impugnacion', 'informe'].includes(
          tipoNorm,
        )
      ) {
        return { categoria: 'prueba', tipo: 'otra', motivoReclasificacion: 'tipo_procesal_invalido' };
      }
    }
  }

  return { categoria, tipo: raw.tipo };
}

/**
 * Filtra y reclasifica ítems del import IA según derecho procesal SCBA:
 * - Prueba solo desde demanda / contestación / auto de apertura a prueba
 * - Oficios, cédulas, mandamientos → diligencias
 * - Providencias, traslados, recursos, etc. → descartados
 */
export function filtrarItemsImportados(
  rawItems: ControlPruebaImportOutput['items'],
  startOrden = 1,
): ImportFilterResult {
  const descartados: ImportFilterResult['descartados'] = [];
  const reclasificados: ImportFilterResult['reclasificados'] = [];
  const items: ControlPruebaItem[] = [];
  const rawKept: ControlPruebaImportOutput['items'] = [];
  let orden = startOrden;

  for (const raw of rawItems) {
    const descripcion = raw.descripcion.trim();
    if (!descripcion) continue;

    if (esProduccionDocumentalTramite(descripcion)) {
      descartados.push({
        descripcion,
        motivo: 'Acompañamiento documental en trámite (no prueba ofrecida en apertura)',
      });
      continue;
    }

    const { categoria, tipo, motivoReclasificacion } = clasificarItem(raw);

    if (motivoReclasificacion === 'tipo_procesal_invalido') {
      descartados.push({ descripcion, motivo: 'Acto procesal (tipo no es prueba)' });
      continue;
    }

    if (motivoReclasificacion === 'documental_ya_acompanada') {
      reclasificados.push({
        descripcion,
        de: raw.categoria ?? 'prueba',
        a: 'prueba/documental',
      });
    }

    const exclusion = debeExcluir(descripcion, categoria, raw.ofrecidaPor);
    if (exclusion) {
      descartados.push({ descripcion, motivo: exclusion });
      continue;
    }

    if (motivoReclasificacion && motivoReclasificacion !== 'tipo_procesal_invalido') {
      reclasificados.push({
        descripcion,
        de: raw.categoria ?? 'prueba',
        a: `${categoria}/${tipo}`,
      });
    }

    const catFinal = categoria;
    const tipoFinal =
      catFinal === 'diligencia'
        ? normalizarTipoDiligencia(descripcion, tipo)
        : catFinal === 'audiencia' && TIPOS_AUDIENCIA_SET.has(tipo)
          ? tipo
          : TIPOS_PRUEBA_SET.has(tipo)
            ? tipo
            : defaultTipoForCategoria(catFinal);

    const estadoResuelto =
      resolveEstadoImport(raw, catFinal, tipoFinal) ?? defaultEstadoForItem(catFinal, tipoFinal);

    const item: ControlPruebaItem = {
      id: crypto.randomUUID(),
      orden: orden++,
      categoria: catFinal,
      tipo: tipoFinal,
      descripcion,
      ofrecidaPor:
        raw.ofrecidaPor ??
        (catFinal === 'prueba' ||
        (catFinal === 'audiencia' && (tipoFinal === 'confesional' || tipoFinal === 'testimonial'))
          ? 'actor'
          : catFinal === 'diligencia'
            ? 'tribunal'
            : 'tribunal'),
      estado: estadoResuelto,
      fechaLimite: raw.fechaLimite ?? null,
      fechaProduccion: null,
      actuacionUrl: null,
      observaciones: observacionesImport(raw),
      ...(catFinal === 'diligencia' && {
        diligencia: {
          destinatario: raw.destinatarioOficio?.trim() || undefined,
          objeto: descripcion,
          fechaPresentacion: null,
          fechaLibramiento: null,
          fechaDiligenciamiento: null,
          plazoContestacion: raw.fechaLimite ?? null,
        },
      }),
      ...(catFinal === 'prueba' &&
        tipoFinal === 'pericial' && {
          pericial: {
            especialidad: inferirEspecialidadPericial(descripcion) ?? 'otra',
          },
        }),
      ...(catFinal === 'prueba' &&
        tipoFinal === 'documental_en_poder' && {
          documentalEnPoder: {
            parteConDocumentos:
              (raw.parteConDocumentos as 'actor' | 'demandado' | 'tercero' | undefined) ??
              parteContrariaDefault(raw.ofrecidaPor),
            documentosDetalle: descripcion,
            plazoPresentacion: raw.fechaLimite ?? null,
            medioIntimacion: 'papel' as const,
            intimacionOrdenada: estadoResuelto === 'intimacion_ordenada',
          },
        }),
      ...(catFinal === 'prueba' &&
        tipoFinal === 'documental' && {
          documental: {
            autenticidadImpugnada: estadoResuelto === 'autenticidad_impugnada',
            fechaImpugnacion: estadoResuelto === 'autenticidad_impugnada' ? raw.fechaLimite ?? null : null,
            destinatarioOficio: raw.destinatarioOficio?.trim() || null,
          },
        }),
      ...(catFinal === 'audiencia' &&
        tipoFinal === 'testimonial' &&
        raw.testigos?.length && {
          testigos: raw.testigos
            .map((t) => ({
              id: crypto.randomUUID(),
              nombre: t.nombre.trim(),
              domicilio: t.domicilio?.trim() || null,
            }))
            .filter((t) => t.nombre.length > 0),
        }),
    };

    items.push(item);
    rawKept.push(raw);
  }

  const vinculados = vincularDiligenciasImport(items, rawKept);
  const enriquecidos = aplicarSubprocesosPostImport(vinculados);

  return { items: enriquecidos, descartados, reclasificados };
}
