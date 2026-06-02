import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyUidFromRequest } from '@/lib/api-auth';
import { isKnownPlatformAdminEmail } from '@/lib/platform-admin';

export type ColegioAdminContext = {
  uid: string;
  colegioId: string;
  colegioData: Record<string, unknown>;
  colegioName: string;
};

/**
 * Verifica que el usuario autenticado administra un colegio (email en adminEmails).
 */
export async function resolveColegioAdmin(
  request: NextRequest
): Promise<ColegioAdminContext | NextResponse> {
  const auth = await verifyUidFromRequest(request);
  if (auth instanceof NextResponse) return auth;

  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(auth.uid).get();
  const userData = userSnap.data();
  if (!userSnap.exists || !userData) {
    return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
  }

  const email = (userData.email as string | undefined)?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Sin email en el perfil' }, { status: 400 });
  }

  if (userData.role === 'admin' || isKnownPlatformAdminEmail(email)) {
    return NextResponse.json(
      { ok: false, error: 'Los superadmins usan el panel Admin de LegalMev' },
      { status: 403 }
    );
  }

  const colegiosSnap = await adminDb
    .collection('colegios')
    .where('adminEmails', 'array-contains', email)
    .limit(1)
    .get();

  if (colegiosSnap.empty) {
    return NextResponse.json(
      { ok: false, error: 'No administrás ningún colegio' },
      { status: 403 }
    );
  }

  const doc = colegiosSnap.docs[0];
  const data = doc.data();
  return {
    uid: auth.uid,
    colegioId: doc.id,
    colegioData: data,
    colegioName: (data.name as string) ?? 'Colegio',
  };
}
