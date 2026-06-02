import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

/**
 * GET /api/admin/colegios
 * Lista todos los colegios. Solo superadmins de plataforma.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminDb = getAdminDb();
    const colegiosSnap = await adminDb.collection('colegios').orderBy('createdAt', 'desc').get();
    const colegios = colegiosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ ok: true, colegios });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}

/**
 * POST /api/admin/colegios
 * Crea un nuevo colegio. Solo superadmins de plataforma.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;
    const uid = auth.uid;

    const adminDb = getAdminDb();
    const body = await request.json();
    const name = body?.name?.trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: 'El nombre del colegio es requerido' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const adminEmails = Array.isArray(body.adminEmails)
      ? (body.adminEmails as string[]).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)
      : [];

    const docRef = await adminDb.collection('colegios').add({
      name,
      convenioActivo: true,
      members: [],
      adminEmails,
      cuotaMensual: null,
      montoConvenio: null,
      moneda: 'ARS',
      periodoFacturacion: 'mensual',
      notas: '',
      contactoFacturacion: '',
      cuit: null,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    });

    return NextResponse.json({
      ok: true,
      colegio: { id: docRef.id, name, convenioActivo: true, members: [], createdAt: now, updatedAt: now },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
