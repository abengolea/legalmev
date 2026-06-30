import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireControlPruebaSuperAdmin } from '@/lib/api-auth';
import {
  CONTROL_PRUEBA_COLLECTION,
  detectSistemaFromUrl,
  normalizeItems,
  serializeControlPruebaDoc,
} from '@/lib/control-prueba';
import type { ControlPruebaExpedienteInput } from '@/types/control-prueba';

type RouteContext = { params: Promise<{ id: string }> };

function serializeDoc(id: string, data: FirebaseFirestore.DocumentData) {
  return serializeControlPruebaDoc(id, data);
}

/** GET /api/admin/control-prueba/[id] */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireControlPruebaSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const adminDb = getAdminDb();
    const snap = await adminDb.collection(CONTROL_PRUEBA_COLLECTION).doc(id).get();

    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Expediente no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, expediente: serializeDoc(snap.id, snap.data() ?? {}) });
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
    const auth = await requireControlPruebaSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = (await request.json()) as Partial<ControlPruebaExpedienteInput>;
    const adminDb = getAdminDb();
    const ref = adminDb.collection(CONTROL_PRUEBA_COLLECTION).doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Expediente no encontrado' }, { status: 404 });
    }

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.caratula !== undefined) {
      if (!body.caratula.trim()) {
        return NextResponse.json({ ok: false, error: 'La carátula es obligatoria' }, { status: 400 });
      }
      update.caratula = body.caratula.trim();
    }
    if (body.numeroExpediente !== undefined) update.numeroExpediente = body.numeroExpediente.trim();
    if (body.juzgado !== undefined) update.juzgado = body.juzgado.trim();
    if (body.fuero !== undefined) update.fuero = body.fuero.trim();
    if (body.notas !== undefined) update.notas = body.notas.trim();
    if (body.expedienteUrl !== undefined) {
      const url = body.expedienteUrl.trim();
      update.expedienteUrl = url;
      update.sistema = body.sistema ?? detectSistemaFromUrl(url);
    } else if (body.sistema !== undefined) {
      update.sistema = body.sistema;
    }
    if (body.items !== undefined) {
      update.items = normalizeItems(body.items);
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
    const auth = await requireControlPruebaSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const adminDb = getAdminDb();
    const ref = adminDb.collection(CONTROL_PRUEBA_COLLECTION).doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Expediente no encontrado' }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}
