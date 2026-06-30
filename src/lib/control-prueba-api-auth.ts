import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyUidFromRequest } from '@/lib/api-auth';
import {
  resolveControlPruebaAccessForUser,
  type ControlPruebaAccess,
  type ControlPruebaTrial,
} from '@/lib/control-prueba-access';

export type ControlPruebaAuth = {
  uid: string;
  unlimited: boolean;
  access: ControlPruebaAccess;
  userData: Record<string, unknown>;
};

export async function authorizeControlPrueba(
  request: NextRequest,
): Promise<ControlPruebaAuth | NextResponse> {
  const auth = await verifyUidFromRequest(request);
  if (auth instanceof NextResponse) return auth;

  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection('users').doc(auth.uid).get();
  const userData = userSnap.data();

  if (!userSnap.exists || !userData) {
    return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 });
  }

  const access = await resolveControlPruebaAccessForUser(adminDb, auth.uid, {
    email: userData.email as string | undefined,
    controlPruebaTrial: userData.controlPruebaTrial as ControlPruebaTrial | undefined,
  });

  if (!access.hasAccess) {
    return NextResponse.json(
      { ok: false, error: 'Acceso restringido a Control de prueba' },
      { status: 403 },
    );
  }

  return {
    uid: auth.uid,
    unlimited: access.unlimited,
    access,
    userData,
  };
}
