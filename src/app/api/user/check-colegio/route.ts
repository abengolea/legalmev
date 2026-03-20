import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/user/check-colegio
 * Llamado tras el registro. Si el email está en algún colegio activo, asigna premium.
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
    const userData = userSnap.data();
    if (!userSnap.exists || !userData) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (userData.tier === 'premium') {
      return NextResponse.json({ ok: true, alreadyPremium: true });
    }

    const email = (userData.email || '').toString().toLowerCase();
    if (!email) return NextResponse.json({ ok: true, noEmail: true });

    const colegiosSnap = await adminDb.collection('colegios').where('convenioActivo', '==', true).get();

    for (const doc of colegiosSnap.docs) {
      const data = doc.data();
      const members = (data.members || []) as { email: string; name: string }[];
      const found = members.some((m) => String(m?.email || '').toLowerCase() === email);
      if (found) {
        await adminDb.collection('users').doc(uid).update({
          tier: 'premium',
          colegioId: doc.id,
          premiumSource: 'colegio',
          colegioName: data.name,
          downloadsThisMonth: 0,
          monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return NextResponse.json({
          ok: true,
          premiumFromColegio: true,
          colegioName: data.name,
        });
      }
    }

    return NextResponse.json({ ok: true, notInColegio: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}
