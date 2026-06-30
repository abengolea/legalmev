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

function serializeDoc(id: string, data: FirebaseFirestore.DocumentData) {
  return serializeControlPruebaDoc(id, data);
}

function validateInput(body: Partial<ControlPruebaExpedienteInput>): string | null {
  if (!body.caratula?.trim()) return 'La carátula es obligatoria';
  return null;
}

/** GET /api/admin/control-prueba — lista expedientes con control de prueba */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireControlPruebaSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim().toLowerCase();

    const snap = await adminDb
      .collection(CONTROL_PRUEBA_COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(100)
      .get();

    let expedientes = snap.docs.map((d) => serializeDoc(d.id, d.data()));

    if (q) {
      expedientes = expedientes.filter((exp) => {
        const haystack = [
          exp.caratula,
          exp.numeroExpediente,
          exp.juzgado,
          exp.fuero,
          exp.notas,
          ...exp.items.map((i) => i.descripcion),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return NextResponse.json({ ok: true, expedientes });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    );
  }
}

/** POST /api/admin/control-prueba — crea un expediente de control de prueba */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireControlPruebaSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as Partial<ControlPruebaExpedienteInput>;
    const error = validateInput(body);
    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const now = FieldValue.serverTimestamp();
    const expedienteUrl = body.expedienteUrl?.trim() ?? '';
    const record = {
      caratula: body.caratula!.trim(),
      numeroExpediente: body.numeroExpediente?.trim() ?? '',
      juzgado: body.juzgado?.trim() ?? '',
      fuero: body.fuero?.trim() ?? '',
      expedienteUrl,
      sistema: body.sistema ?? detectSistemaFromUrl(expedienteUrl),
      notas: body.notas?.trim() ?? '',
      items: normalizeItems(body.items),
      createdAt: now,
      updatedAt: now,
      createdBy: auth.uid,
    };

    const ref = await adminDb.collection(CONTROL_PRUEBA_COLLECTION).add(record);
    const created = await ref.get();

    return NextResponse.json({
      ok: true,
      expediente: serializeDoc(ref.id, created.data() ?? record),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: NextMessage(err) },
      { status: 500 },
    );
  }
}

function NextMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Error';
}
