import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/colegios
 * Lista todos los colegios. Solo admins.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

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
 * Crea un nuevo colegio. Solo admins.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

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
