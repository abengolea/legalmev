import { FieldValue } from 'firebase-admin/firestore';
import type { ControlPruebaImportOutput } from '@/ai/flows/control-prueba-import-flow';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  CONTROL_PRUEBA_COLLECTION,
  mapImportToItemsWithFilter,
  normalizeItems,
  truncateTextoForAnalysis,
} from '@/lib/control-prueba';
import { extractControlPruebaFromText } from '@/ai/flows/control-prueba-import-flow';
import { reconciliarItems } from '@/lib/control-prueba-reconcile';
import type {
  ControlPruebaItem,
  OficioAutenticidadPendiente,
  ResumenEjecutivoImport,
} from '@/types/control-prueba';
import {
  normalizeOficiosAutenticidad,
  normalizeResumenEjecutivo,
} from '@/lib/control-prueba-import-meta';
import { collectOficiosAutenticidadFromItems } from '@/lib/control-prueba-documental-autenticidad-consolidate';
import { resumenParaParteRepresentada } from '@/lib/control-prueba-resumen';
import {
  normalizePartesRepresentadas,
  payloadPartesRepresentadas,
} from '@/lib/control-prueba-partes-representadas';
import type { ParteRepresentadaPrueba } from '@/types/control-prueba';
import {
  normalizeTokenUsage,
  sumTokenUsage,
  type AiTokenUsage,
  type AiTokenUsageMeta,
} from '@/lib/ai-token-usage';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { repairSpanishTextEncoding } from '@/lib/text-encoding-repair';

export type ImportPreviewPayload = {
  caratula: string;
  numeroExpediente: string;
  juzgado: string;
  fuero: string;
  expedienteUrl: string;
  notas: string;
  actor: string;
  demandado: string;
  parteRepresentada?: ParteRepresentadaPrueba | '';
  partesRepresentadas?: ParteRepresentadaPrueba[];
  resumenCaso?: string;
  autoAperturaPrueba?: string;
  items: ControlPruebaItem[];
  oficiosAutenticidadPendientes: OficioAutenticidadPendiente[];
  resumenEjecutivo?: ResumenEjecutivoImport;
  descartados: { descripcion: string; motivo: string }[];
  reclasificados: { descripcion: string; de: string; a: string }[];
  descartadosMuestra: { descripcion: string; motivo: string }[];
  /** Tokens del análisis IA que generó este preview (se acumulan al confirmar). */
  tokenUsage?: AiTokenUsage;
};

export type RunImportAnalysisInput = {
  texto: string;
  caratula?: string;
  numeroExpediente?: string;
  juzgado?: string;
  fuero?: string;
  expedienteUrl?: string;
  pdfFileName?: string;
  parteRepresentada?: ParteRepresentadaPrueba | '';
  partesRepresentadas?: ParteRepresentadaPrueba[];
};

export async function runImportAnalysis(input: RunImportAnalysisInput) {
  const texto = truncateTextoForAnalysis(input.texto.trim());
  const started = Date.now();
  console.info('[control-prueba/import] Inicio análisis IA', {
    pdfFileName: input.pdfFileName ?? '',
    textoChars: texto.length,
    caratula: input.caratula?.slice(0, 80) ?? '',
  });

  let analysis;
  let usage;
  try {
    const result = await extractControlPruebaFromText({ expedienteTexto: texto });
    analysis = result.output;
    usage = result.usage;
  } catch (err) {
    console.error('[control-prueba/import] Falló extractControlPruebaFromText', {
      pdfFileName: input.pdfFileName ?? '',
      textoChars: texto.length,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }

  if (!analysis?.items?.length && !analysis?.pruebas?.length) {
    console.warn('[control-prueba/import] IA devolvió cero ítems', {
      pdfFileName: input.pdfFileName ?? '',
      ms: Date.now() - started,
      caratula: analysis?.caratula ?? '',
    });
  }

  const importResult = mapImportToItemsWithFilter(analysis);
  console.info('[control-prueba/import] Post-filtro', {
    pdfFileName: input.pdfFileName ?? '',
    rawItems: (analysis.items ?? analysis.pruebas ?? []).length,
    finalItems: importResult.items.length,
    descartados: importResult.descartados.length,
    ms: Date.now() - started,
  });

  if (importResult.items.length === 0) {
    return {
      ok: false as const,
      error:
        'No se detectó prueba válida tras filtrar actos procesales. Verificá que el PDF incluya demanda, contestación o auto de apertura a prueba.',
      filter: {
        descartados: importResult.descartados.length,
        muestra: importResult.descartados.slice(0, 8),
      },
    };
  }

  const preview = buildPreviewPayload(analysis, importResult, input);
  preview.tokenUsage = normalizeTokenUsage(usage);
  const partes = normalizePartesRepresentadas(input.partesRepresentadas, input.parteRepresentada);
  if (partes.length > 0) {
    const payload = payloadPartesRepresentadas(partes);
    preview.partesRepresentadas = payload.partesRepresentadas;
    preview.parteRepresentada = payload.parteRepresentada;
    preview.resumenEjecutivo = resumenParaParteRepresentada(
      preview.items,
      preview.oficiosAutenticidadPendientes,
      partes,
      preview.resumenEjecutivo,
      preview.actor,
      preview.demandado,
    );
  }
  console.info('[control-prueba/import] Preview listo', {
    pdfFileName: input.pdfFileName ?? '',
    items: preview.items.length,
    oficiosAutenticidad: collectOficiosAutenticidadFromItems(preview.items).length,
    tokens: preview.tokenUsage.totalTokens,
    ms: Date.now() - started,
  });
  return { ok: true as const, preview, usage, analysis };
}

function buildPreviewPayload(
  analysis: ControlPruebaImportOutput,
  importResult: ReturnType<typeof mapImportToItemsWithFilter>,
  input: RunImportAnalysisInput,
): ImportPreviewPayload {
  const resumenNotas = [
    analysis.resumenCaso?.trim(),
    analysis.autoAperturaPrueba ? `Auto apertura a prueba: ${analysis.autoAperturaPrueba}` : '',
    analysis.actor ? `Actor: ${analysis.actor}` : '',
    analysis.demandado ? `Demandado: ${analysis.demandado}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    caratula:
      repairSpanishTextEncoding(
        input.caratula?.trim() ||
          analysis.caratula?.trim() ||
          input.pdfFileName?.replace(/\.pdf$/i, '') ||
          'Causa importada desde PDF',
      ),
    numeroExpediente: input.numeroExpediente?.trim() || analysis.numeroExpediente?.trim() || '',
    juzgado: repairSpanishTextEncoding(input.juzgado?.trim() || analysis.juzgado?.trim() || ''),
    fuero: repairSpanishTextEncoding(input.fuero?.trim() || analysis.fuero?.trim() || ''),
    expedienteUrl: input.expedienteUrl?.trim() ?? '',
    notas: repairSpanishTextEncoding(resumenNotas),
    actor: repairSpanishTextEncoding(analysis.actor?.trim() ?? ''),
    demandado: repairSpanishTextEncoding(analysis.demandado?.trim() ?? ''),
    ...payloadPartesRepresentadas(
      normalizePartesRepresentadas(input.partesRepresentadas, input.parteRepresentada),
    ),
    resumenCaso: analysis.resumenCaso?.trim(),
    autoAperturaPrueba: analysis.autoAperturaPrueba?.trim(),
    items: importResult.items,
    oficiosAutenticidadPendientes: importResult.oficiosAutenticidadPendientes,
    resumenEjecutivo: importResult.resumenEjecutivo,
    descartados: importResult.descartados,
    reclasificados: importResult.reclasificados,
    descartadosMuestra: importResult.descartados.slice(0, 12),
  };
}

export type ApplyImportInput = {
  expedienteId?: string | null;
  mergeMode: 'append' | 'replace' | 'reconcile';
  pdfFileName?: string;
  preview: ImportPreviewPayload;
  /** Si se envía, solo estos ítems (por id) se importan */
  selectedItemIds?: string[];
  uid: string;
};

export async function applyImportToFirestore(input: ApplyImportInput) {
  const adminDb = getAdminDb();
  const nowIso = new Date().toISOString();
  const { preview } = input;

  let importedItems = preview.items;
  if (input.selectedItemIds?.length) {
    const set = new Set(input.selectedItemIds);
    importedItems = preview.items.filter((i) => set.has(i.id));
  }

  if (importedItems.length === 0) {
    return { ok: false as const, error: 'Seleccioná al menos un ítem para importar.' };
  }

  const expedienteId = input.expedienteId?.trim() || null;
  let expedienteRef;
  let existingItems: ControlPruebaItem[] = [];

  if (expedienteId) {
    expedienteRef = adminDb.collection(CONTROL_PRUEBA_COLLECTION).doc(expedienteId);
    const snap = await expedienteRef.get();
    if (!snap.exists) {
      return { ok: false as const, error: 'Expediente no encontrado' };
    }
    existingItems = normalizeItems(snap.data()?.items);
  }

  let mergedItems: ControlPruebaItem[];
  let reconcileStats: { added: number; updated: number; unchanged: number } | undefined;

  if (expedienteId && input.mergeMode === 'append') {
    mergedItems = normalizeItems([
      ...existingItems,
      ...importedItems.map((item, i) => ({ ...item, orden: existingItems.length + i + 1 })),
    ]);
  } else if (expedienteId && input.mergeMode === 'reconcile') {
    const result = reconciliarItems(existingItems, importedItems);
    mergedItems = result.items;
    reconcileStats = { added: result.added, updated: result.updated, unchanged: result.unchanged };
  } else {
    mergedItems = importedItems;
  }

  const oficiosImport = collectOficiosAutenticidadFromItems(mergedItems);

  const partes = normalizePartesRepresentadas(preview.partesRepresentadas, preview.parteRepresentada);
  const partesPayload = payloadPartesRepresentadas(partes);

  const importMeta = {
    pdfFileName: input.pdfFileName?.trim() || '',
    pdfImportedAt: nowIso,
    actor: preview.actor,
    demandado: preview.demandado,
    ...partesPayload,
    oficiosAutenticidadPendientes: [],
    resumenEjecutivo: normalizeResumenEjecutivo(
      resumenParaParteRepresentada(
        mergedItems,
        oficiosImport,
        partes,
        preview.resumenEjecutivo,
        preview.actor,
        preview.demandado,
      ) ?? preview.resumenEjecutivo,
    ),
  };

  const incomingUsage = normalizeTokenUsage(preview.tokenUsage);
  // Siempre persistimos un usage (medido o ya estimado en el flow); no descartar ceros de más.
  const tokenUsageMeta: AiTokenUsageMeta | undefined =
    incomingUsage.totalTokens > 0
      ? {
          ...incomingUsage,
          model: GEMINI_MODEL_ID,
          lastUpdatedAt: nowIso,
        }
      : undefined;

  if (expedienteId && expedienteRef) {
    const snap = await expedienteRef.get();
    const prev = snap.data() ?? {};
    const update: Record<string, unknown> = {
      items: mergedItems,
      updatedAt: FieldValue.serverTimestamp(),
      ...importMeta,
    };
    if (preview.caratula && !prev.caratula) update.caratula = preview.caratula;
    if (preview.numeroExpediente && !prev.numeroExpediente) update.numeroExpediente = preview.numeroExpediente;
    if (preview.juzgado && !prev.juzgado) update.juzgado = preview.juzgado;
    if (preview.fuero && !prev.fuero) update.fuero = preview.fuero;
    if (preview.notas && !prev.notas) update.notas = preview.notas;
    if (preview.expedienteUrl && !prev.expedienteUrl) update.expedienteUrl = preview.expedienteUrl;
    if (preview.parteRepresentada || (preview.partesRepresentadas?.length ?? 0) > 0) {
      const p = payloadPartesRepresentadas(
        normalizePartesRepresentadas(preview.partesRepresentadas, preview.parteRepresentada),
      );
      update.parteRepresentada = p.parteRepresentada;
      update.partesRepresentadas = p.partesRepresentadas;
    }
    if (tokenUsageMeta) {
      update.tokenUsage = {
        ...sumTokenUsage(normalizeTokenUsage(prev.tokenUsage), tokenUsageMeta),
        model: GEMINI_MODEL_ID,
        lastUpdatedAt: nowIso,
      };
    }

    await expedienteRef.update(update);
    const updated = await expedienteRef.get();
    return {
      ok: true as const,
      expedienteId: updated.id,
      data: updated.data() ?? {},
      importedCount: importedItems.length,
      mergeMode: input.mergeMode,
      reconcileStats,
    };
  }

  const record = {
    caratula: preview.caratula,
    numeroExpediente: preview.numeroExpediente,
    juzgado: preview.juzgado,
    fuero: preview.fuero,
    expedienteUrl: preview.expedienteUrl,
    sistema: 'otro',
    notas: preview.notas,
    items: mergedItems,
    ...importMeta,
    ...(tokenUsageMeta ? { tokenUsage: tokenUsageMeta } : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: input.uid,
  };

  expedienteRef = await adminDb.collection(CONTROL_PRUEBA_COLLECTION).add(record);
  const created = await expedienteRef.get();

  return {
    ok: true as const,
    expedienteId: created.id,
    data: created.data() ?? record,
    importedCount: importedItems.length,
    mergeMode: 'replace' as const,
    reconcileStats,
  };
}
