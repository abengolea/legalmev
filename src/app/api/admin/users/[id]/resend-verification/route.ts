import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { resend, canSendEmail, getFromAddress } from '@/lib/resend';
import { buildVerificationEmailHtml } from '@/lib/email-templates';
import { randomUUID } from 'crypto';

const VERIFY_EMAIL_EXPIRY_MS = 60 * 60 * 1000; // 1 hora

/**
 * POST /api/admin/users/[id]/resend-verification
 * Reenvía el email de verificación a un usuario. Solo admins.
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

    if (!canSendEmail()) {
      return NextResponse.json(
        { ok: false, error: 'Servicio de email no configurado' },
        { status: 500 }
      );
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

    const userSnap = await adminDb.collection('users').doc(targetUserId).get();
    const userData = userSnap.data();
    const email = (userData?.email as string) || '';
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Usuario sin email' }, { status: 400 });
    }

    const verifyToken = randomUUID();
    const expiresAt = Date.now() + VERIFY_EMAIL_EXPIRY_MS;
    await adminDb.collection('verificationTokens').doc(verifyToken).set({
      uid: targetUserId,
      email,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar';
    const verifyUrl = `${siteUrl.replace(/\/$/, '')}/api/verify-email?token=${verifyToken}`;
    const html = buildVerificationEmailHtml(verifyUrl);

    const { error } = await resend!.emails.send({
      from: getFromAddress(),
      to: email,
      subject: 'Verificá tu email - LegalMev',
      html,
    });

    if (error) {
      console.error('[resend-verification] Resend error:', error);
      return NextResponse.json(
        { ok: false, error: 'No se pudo enviar el correo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Email enviado' });
  } catch (err) {
    console.error('[resend-verification]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
