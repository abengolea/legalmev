import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { resend, canSendEmail, getFromAddress } from '@/lib/resend';
import { buildTestEmailHtml } from '@/lib/email-templates';

/**
 * GET /api/admin/settings/test-resend
 * Devuelve el estado de Resend (configurado o no) y el remitente actual.
 * Requiere admin.
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
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }

    const configured = canSendEmail();
    const from = getFromAddress();

    return NextResponse.json({
      ok: true,
      configured,
      from: configured ? from : null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 401 }
    );
  }
}

/**
 * POST /api/admin/settings/test-resend
 * Envía un correo de prueba a la dirección indicada. Requiere admin.
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
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }

    if (!canSendEmail()) {
      return NextResponse.json(
        { ok: false, error: 'Resend no está configurado. Configurá RESEND_API_KEY y RESEND_FROM en .env.local' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: 'Indicá un email válido para el envío de prueba.' },
        { status: 400 }
      );
    }

    const html = buildTestEmailHtml(getFromAddress());

    const { error } = await resend!.emails.send({
      from: getFromAddress(),
      to: email,
      subject: '[LegalMev] Correo de prueba - Resend OK',
      html,
    });

    if (error) {
      console.error('[test-resend] Resend error:', error);
      return NextResponse.json(
        { ok: false, error: error.message || 'No se pudo enviar el correo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Correo de prueba enviado a ${email}`,
    });
  } catch (err) {
    console.error('[test-resend]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
