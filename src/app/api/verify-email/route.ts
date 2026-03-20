import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/verify-email?token=xxx
 * Valida el token de verificación, marca el usuario como emailVerified y redirige.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar';
  const basePath = siteUrl.replace(/\/$/, '');

  if (!token) {
    return NextResponse.redirect(
      `${basePath}/auth/action?error=missing&message=${encodeURIComponent('Faltan parámetros. Usá el enlace del correo.')}`
    );
  }

  try {
    const adminDb = getAdminDb();
    const docSnap = await adminDb.collection('verificationTokens').doc(token).get();

    if (!docSnap.exists) {
      return NextResponse.redirect(
        `${basePath}/auth/action?error=invalid&message=${encodeURIComponent('El enlace no es válido o ya fue usado.')}`
      );
    }

    const data = docSnap.data()!;
    const { uid, expiresAt } = data;
    const now = Date.now();

    if (expiresAt < now) {
      await adminDb.collection('verificationTokens').doc(token).delete();
      return NextResponse.redirect(
        `${basePath}/auth/action?error=expired&message=${encodeURIComponent('El enlace venció. Solicitá uno nuevo desde la página de verificación.')}`
      );
    }

    const adminAuth = getAuth();
    await adminAuth.updateUser(uid, { emailVerified: true });
    await adminDb.collection('verificationTokens').doc(token).delete();

    return NextResponse.redirect(
      `${basePath}/auth/action?verified=1&continueUrl=${encodeURIComponent('/dashboard')}`
    );
  } catch (err) {
    console.error('[verify-email]', err);
    return NextResponse.redirect(
      `${basePath}/auth/action?error=server&message=${encodeURIComponent('Ocurrió un error. Intentá de nuevo.')}`
    );
  }
}
