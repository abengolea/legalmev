import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/admin/users/[id]/reset-downloads
 * Resetea freeDownloadsUsed y/o downloadsThisMonth. Solo admins.
 * Body: { type?: 'free' | 'premium' | 'both' } - default 'both'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDb = getAdminDb();
    const adminSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (adminSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const type = (body?.type as string) || 'both';

    const userRef = adminDb.collection('users').doc(targetUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (type === 'free' || type === 'both') update.freeDownloadsUsed = 0;
    if (type === 'premium' || type === 'both') {
      update.downloadsThisMonth = 0;
      const userData = userSnap.data();
      if (userData?.tier === 'premium' && !userData.premiumForever) {
        update.monthlyResetAt = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();
      }
    }

    await userRef.update(update);
    return NextResponse.json({ ok: true, message: 'Descargas reseteadas' });
  } catch (err) {
    console.error('[reset-downloads]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
