import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { authorizeControlPrueba } from '@/lib/control-prueba-api-auth';
import { assertControlPruebaExpedienteOwner } from '@/lib/control-prueba-access';
import {
  CONTROL_PRUEBA_COLLECTION,
  detectSistemaFromUrl,
  normalizeItems,
  sanitizeForFirestore,
  serializeControlPruebaDoc,
} from '@/lib/control-prueba';
import { repairSpanishTextEncoding } from '@/lib/text-encoding-repair';
import type { ControlPruebaExpedienteInput } from '@/types/control-prueba';

type RouteContext = { params: Promise<{ id: string }> };

function serializeDoc(id: string, data: FirebaseFirestore.DocumentData) {
  return serializeControlPruebaDoc(id, data);
}

/** GET /api/admin/control-prueba/[id] */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authorizeControlPrueba(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const adminDb = getAdminDb();
    const owned = await assertControlPruebaExpedienteOwner(adminDb, id, auth.uid);
    if (!owned.ok) {
      return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    }

    return NextResponse.json({ ok: true, expediente: serializeDoc(id, owned.data) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}

/** PATCH /api/admin/control-prueba/[id] */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authorizeControlPrueba(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json()) as Partial<ControlPruebaExpedienteInput>;
    const adminDb = getAdminDb();
    const owned = await assertControlPruebaExpedienteOwner(adminDb, id, auth.uid);
    if (!owned.ok) {
      return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    }

    const ref = adminDb.collection(CONTROL_PRUEBA_COLLECTION).doc(id);
    const snap = await ref.get();

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.caratula !== undefined) {
      if (!body.caratula.trim()) {
        return NextResponse.json({ ok: false, error: 'La carátula es obligatoria' }, { status: 400 });
      }
      update.caratula = repairSpanishTextEncoding(body.caratula.trim());
    }
    if (body.numeroExpediente !== undefined) update.numeroExpediente = body.numeroExpediente.trim();
    if (body.juzgado !== undefined) update.juzgado = repairSpanishTextEncoding(body.juzgado.trim());
    if (body.fuero !== undefined) update.fuero = repairSpanishTextEncoding(body.fuero.trim());
    if (body.notas !== undefined) update.notas = repairSpanishTextEncoding(body.notas.trim());
    if (body.expedienteUrl !== undefined) {
      const url = body.expedienteUrl.trim();
      update.expedienteUrl = url;
      update.sistema = body.sistema ?? detectSistemaFromUrl(url);
    } else if (body.sistema !== undefined) {
      update.sistema = body.sistema;
    }
    if (body.items !== undefined) {
      update.items = sanitizeForFirestore(normalizeItems(body.items));
    }
    if (body.hitos !== undefined && Array.isArray(body.hitos)) {
      update.hitos = body.hitos;
    }
    if (body.oficiosAutenticidadPendientes !== undefined) {
      update.oficiosAutenticidadPendientes = body.oficiosAutenticidadPendientes;
    }
    if (body.resumenEjecutivo !== undefined) {
      update.resumenEjecutivo = body.resumenEjecutivo;
    }
    if (body.parteRepresentada !== undefined || body.partesRepresentadas !== undefined) {
      const fromArray = Array.isArray(body.partesRepresentadas)
        ? (body.partesRepresentadas as string[]).filter(
            (p): p is 'actor' | 'demandado' | 'tercero' =>
              p === 'actor' || p === 'demandado' || p === 'tercero',
          )
        : [];
      const legacy =
        body.parteRepresentada === 'demandado' ||
        body.parteRepresentada === 'actor' ||
        body.parteRepresentada === 'tercero'
          ? (body.parteRepresentada as 'actor' | 'demandado' | 'tercero')
          : '';
      const partes =
        fromArray.length > 0 ? [...new Set(fromArray)] : legacy ? [legacy] : [];
      update.partesRepresentadas = partes;
      update.parteRepresentada = partes[0] ?? '';
    }
    if (body.terceros !== undefined && Array.isArray(body.terceros)) {
      update.terceros = body.terceros.map((t) => String(t).trim()).filter(Boolean);
    }

    await ref.update(update);
    const updated = await ref.get();

    return NextResponse.json({ ok: true, expediente: serializeDoc(updated.id, updated.data() ?? {}) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}

/** DELETE /api/admin/control-prueba/[id] */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authorizeControlPrueba(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const adminDb = getAdminDb();
    const owned = await assertControlPruebaExpedienteOwner(adminDb, id, auth.uid);
    if (!owned.ok) {
      return NextResponse.json({ ok: false, error: owned.error }, { status: owned.status });
    }

    await adminDb.collection(CONTROL_PRUEBA_COLLECTION).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}
