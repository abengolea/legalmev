import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { resend, canSendEmail, getFromAddress } from '@/lib/resend';
import { randomUUID } from 'crypto';

const VERIFY_EMAIL_EXPIRY_MS = 60 * 60 * 1000; // 1 hora

function buildVerificationEmailHtml(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.6;color:#333;background-color:#f5f5f5;">
  <div style="max-width:480px;margin:32px auto;padding:32px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <p style="margin:0 0 16px;font-size:16px;">Hola,</p>
    <p style="margin:0 0 24px;">Verificá tu correo electrónico para activar tu cuenta en LegalMev.</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background-color:#2A6A78;color:#fff !important;text-decoration:none;font-weight:600;font-size:15px;border-radius:6px;">Verificar mi email</a>
    </p>
    <p style="margin:0;font-size:14px;color:#666;">Si no pediste esto, ignorá este correo.</p>
    <p style="margin:24px 0 0;font-size:14px;color:#999;">— El equipo de LegalMev</p>
  </div>
</body>
</html>
`;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    if (!canSendEmail()) {
      return NextResponse.json(
        { ok: false, error: 'Servicio de email no configurado. Configurá RESEND_API_KEY y RESEND_FROM.' },
        { status: 500 }
      );
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email as string) || '';

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email no encontrado' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar';
    const verifyToken = randomUUID();
    const expiresAt = Date.now() + VERIFY_EMAIL_EXPIRY_MS;

    const adminDb = getAdminDb();
    await adminDb.collection('verificationTokens').doc(verifyToken).set({
      uid,
      email,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    const verifyUrl = `${siteUrl.replace(/\/$/, '')}/api/verify-email?token=${verifyToken}`;
    const html = buildVerificationEmailHtml(verifyUrl);

    const { error } = await resend!.emails.send({
      from: getFromAddress(),
      to: email,
      subject: 'Verificá tu email - LegalMev',
      html,
    });

    if (error) {
      console.error('[send-verification-email] Resend error:', error);
      return NextResponse.json(
        { ok: false, error: 'No se pudo enviar el correo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-verification-email]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}
