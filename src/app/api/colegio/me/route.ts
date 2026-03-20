import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/colegio/me
 * Devuelve el colegio que el usuario administra (su email está en adminEmails).
 * Si no administra ningún colegio, devuelve ok: false.
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
    const userData = userSnap.data();
    if (!userSnap.exists || !userData) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const email = (userData.email || '').toString().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Sin email' });
    }

    const colegiosSnap = await adminDb
      .collection('colegios')
      .where('adminEmails', 'array-contains', email)
      .limit(1)
      .get();

    if (colegiosSnap.empty) {
      return NextResponse.json({ ok: false, error: 'No administrás ningún colegio' });
    }

    const doc = colegiosSnap.docs[0];
    const data = doc.data();

    return NextResponse.json({
      ok: true,
      colegio: {
        id: doc.id,
        name: data.name,
        convenioActivo: data.convenioActivo ?? true,
        membersCount: (data.members || []).length,
        members: data.members || [],
        montoConvenio: data.montoConvenio ?? null,
        moneda: data.moneda ?? 'ARS',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}
