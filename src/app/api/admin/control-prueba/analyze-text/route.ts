import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeControlPrueba } from '@/lib/control-prueba-api-auth';
import {
  assertControlPruebaExpedienteOwner,
  consumeControlPruebaQuota,
  type ControlPruebaTrial,
} from '@/lib/control-prueba-access';
import type { ControlPruebaItem } from '@/types/control-prueba';
import {
  applyImportToFirestore,
  runImportAnalysis,
  type ImportPreviewPayload,
} from '@/lib/control-prueba-import-apply';
import { serializeControlPruebaDoc } from '@/lib/control-prueba';

export const maxDuration = 120;

type AnalyzeBody = {
  texto?: string;
  caratula?: string;
  numeroExpediente?: string;
  juzgado?: string;
  fuero?: string;
  expedienteUrl?: string;
  expedienteId?: string;
  mergeMode?: 'append' | 'replace' | 'reconcile';
  pdfFileName?: string;
  /** Solo analiza con IA y devuelve preview (no guarda). */
  previewOnly?: boolean;
  /** Confirma importación con datos del preview (sin re-ejecutar IA). */
  confirmImport?: boolean;
  preview?: ImportPreviewPayload;
  selectedItemIds?: string[];
  /** Parte(s) que representamos — filtra resumen a nuestra prueba. */
  parteRepresentada?: 'actor' | 'demandado' | 'tercero' | '';
  partesRepresentadas?: ('actor' | 'demandado' | 'tercero')[];
};

function countByCategoria(items: ControlPruebaItem[]): Record<string, number> {
  const counts: Record<string, number> = { prueba: 0, diligencia: 0, audiencia: 0 };
  for (const item of items) {
    const cat = item.categoria ?? 'prueba';
    if (cat in counts) counts[cat] += 1;
  }
  return counts;
}

function countByParte(items: ControlPruebaItem[]): Record<string, number> {
  const counts: Record<string, number> = { actor: 0, demandado: 0, otros: 0 };
  for (const item of items) {
    const parte = item.ofrecidaPor ?? 'actor';
    if (parte === 'actor') counts.actor += 1;
    else if (parte === 'demandado') counts.demandado += 1;
    else counts.otros += 1;
  }
  return counts;
}

/**
 * POST /api/admin/control-prueba/analyze-text
 * Paso 2: previewOnly → IA + preview | confirmImport → guardar | default → previewOnly
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeControlPrueba(request);
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as AnalyzeBody;
    const mergeMode = body.mergeMode === 'append' ? 'append' : body.mergeMode === 'reconcile' ? 'reconcile' : 'replace';

    if (body.confirmImport && body.preview) {
      const expedienteId = body.expedienteId?.trim() || null;
      const adminDb = getAdminDb();

      if (expedienteId) {
        const owned = await assertControlPruebaExpedienteOwner(
          adminDb,
          expedienteId,
          auth.uid,
        );
        if (!owned.ok) {
          return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
        }
      } else if (!auth.unlimited) {
        if (!auth.access.canCreate) {
          return NextResponse.json(
            {
              ok: false,
              error: `Alcanzaste el límite de ${auth.access.limit ?? 10} controles este mes. Se renueva automáticamente.`,
            },
            { status: 403 },
          );
        }
        const quota = await consumeControlPruebaQuota(adminDb, auth.uid, {
          email: auth.userData.email as string | undefined,
          controlPruebaTrial: auth.userData.controlPruebaTrial as ControlPruebaTrial | undefined,
        });
        if (!quota.ok) {
          return NextResponse.json({ ok: false, error: quota.error }, { status: 403 });
        }
      }

      const applied = await applyImportToFirestore({
        expedienteId,
        mergeMode,
        pdfFileName: body.pdfFileName,
        preview: body.preview,
        selectedItemIds: body.selectedItemIds,
        uid: auth.uid,
      });

      if (!applied.ok) {
        return NextResponse.json({ ok: false, error: applied.error }, { status: 400 });
      }

      const itemsForStats = body.selectedItemIds?.length
        ? body.preview.items.filter((i) => body.selectedItemIds!.includes(i.id))
        : body.preview.items;

      return NextResponse.json({
        ok: true,
        step: 'confirmed',
        expediente: serializeControlPruebaDoc(applied.expedienteId, applied.data),
        import: {
          itemsAdded: applied.importedCount,
          mergeMode: applied.mergeMode,
          pdfFileName: body.pdfFileName,
          resumen: body.preview.resumenCaso,
          byParte: countByParte(itemsForStats),
          byCategoria: countByCategoria(itemsForStats),
          reconcile: applied.reconcileStats,
          filter: {
            descartados: body.preview.descartados.length,
            reclasificados: body.preview.reclasificados.length,
          },
          oficiosAutenticidad: body.preview.oficiosAutenticidadPendientes.length,
          tokenUsage: body.preview.tokenUsage,
        },
      });
    }

    const rawTexto = body.texto?.trim();
    if (!rawTexto || rawTexto.length < 200) {
      console.warn('[control-prueba/analyze-text] Texto insuficiente', {
        pdfFileName: body.pdfFileName ?? '',
        textoChars: rawTexto?.length ?? 0,
      });
      return NextResponse.json(
        { ok: false, error: 'Texto insuficiente. Primero extraé el PDF (paso 1).' },
        { status: 400 },
      );
    }

    console.info('[control-prueba/analyze-text] POST preview', {
      pdfFileName: body.pdfFileName ?? '',
      textoChars: rawTexto.length,
      expedienteId: body.expedienteId ?? null,
    });

    const result = await runImportAnalysis({
      texto: rawTexto,
      caratula: body.caratula,
      numeroExpediente: body.numeroExpediente,
      juzgado: body.juzgado,
      fuero: body.fuero,
      expedienteUrl: body.expedienteUrl,
      pdfFileName: body.pdfFileName,
      parteRepresentada: body.parteRepresentada,
      partesRepresentadas: body.partesRepresentadas,
    });

    if (!result.ok) {
      console.warn('[control-prueba/analyze-text] Sin ítems tras filtro', {
        pdfFileName: body.pdfFileName ?? '',
        descartados: result.filter?.descartados ?? 0,
        muestra: result.filter?.muestra?.slice(0, 3),
      });
      return NextResponse.json(
        { ok: false, error: result.error, filter: result.filter },
        { status: 422 },
      );
    }

    const { preview, usage } = result;

    return NextResponse.json({
      ok: true,
      step: 'preview',
      preview,
      import: {
        itemsAdded: preview.items.length,
        pdfFileName: body.pdfFileName,
        resumen: preview.resumenCaso,
        byParte: countByParte(preview.items),
        byCategoria: countByCategoria(preview.items),
        filter: {
          descartados: preview.descartados.length,
          reclasificados: preview.reclasificados.length,
          descartadosMuestra: preview.descartadosMuestra,
        },
        oficiosAutenticidad: preview.oficiosAutenticidadPendientes.length,
        tokenUsage: usage,
      },
    });
  } catch (err) {
    console.error('[control-prueba/analyze-text]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    );
  }
}
