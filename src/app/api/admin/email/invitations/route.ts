import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { canSendEmail } from '@/lib/resend';
import {
  USER_INVITE_CONFIRM,
  USER_INVITE_MAX_RECIPIENTS,
  parseEmailList,
  sendUserInviteTest,
  sendUserInvites,
} from '@/lib/user-invite-email';

/**
 * GET /api/admin/email/invitations
 * Estado de Resend para la UI de invitaciones.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    return NextResponse.json({
      ok: true,
      resendConfigured: canSendEmail(),
      maxRecipients: USER_INVITE_MAX_RECIPIENTS,
      confirmPhrase: USER_INVITE_CONFIRM,
    });
  } catch (err) {
    console.error('[admin/email/invitations GET]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/invitations
 * Body test: { mode: "test", email: "...", subject?, customMessage? }
 * Body send: { mode: "send", emails: string[] | raw text, confirm: "ENVIAR_INVITACIONES", subject?, customMessage? }
 *
 * Cada destinatario recibe un correo individual (sin CC) con link de registro prefijado.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    if (!canSendEmail()) {
      return NextResponse.json(
        { ok: false, error: 'Resend no está configurado (RESEND_API_KEY y RESEND_FROM).' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const mode = body.mode as string;
    const subject = typeof body.subject === 'string' ? body.subject : undefined;
    const customMessage = typeof body.customMessage === 'string' ? body.customMessage : undefined;

    if (mode === 'test') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const { emails, invalid } = parseEmailList(email);
      if (emails.length !== 1 || invalid.length > 0) {
        return NextResponse.json({ ok: false, error: 'Email de prueba inválido' }, { status: 400 });
      }
      await sendUserInviteTest({ email: emails[0], subject, customMessage });
      return NextResponse.json({ ok: true, message: `Invitación de prueba enviada a ${emails[0]}` });
    }

    if (mode === 'send') {
      if (body.confirm !== USER_INVITE_CONFIRM) {
        return NextResponse.json(
          {
            ok: false,
            error: `Confirmación requerida: escribí exactamente "${USER_INVITE_CONFIRM}"`,
          },
          { status: 400 }
        );
      }

      let emails: string[] = [];
      let invalid: string[] = [];

      if (Array.isArray(body.emails)) {
        const parsed = parseEmailList((body.emails as unknown[]).map(String).join('\n'));
        emails = parsed.emails;
        invalid = parsed.invalid;
      } else if (typeof body.emails === 'string') {
        const parsed = parseEmailList(body.emails);
        emails = parsed.emails;
        invalid = parsed.invalid;
      } else if (typeof body.raw === 'string') {
        const parsed = parseEmailList(body.raw);
        emails = parsed.emails;
        invalid = parsed.invalid;
      }

      if (emails.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: invalid.length
              ? `No hay emails válidos. Inválidos: ${invalid.slice(0, 5).join(', ')}`
              : 'Pegá al menos un email válido.',
          },
          { status: 400 }
        );
      }

      if (emails.length > USER_INVITE_MAX_RECIPIENTS) {
        return NextResponse.json(
          {
            ok: false,
            error: `Máximo ${USER_INVITE_MAX_RECIPIENTS} destinatarios por envío (recibidos: ${emails.length}).`,
          },
          { status: 400 }
        );
      }

      const { sent, failed } = await sendUserInvites({ emails, subject, customMessage });

      return NextResponse.json({
        ok: true,
        sent,
        failed: failed.length,
        failedEmails: failed.slice(0, 30),
        invalidCount: invalid.length,
        invalidEmails: invalid.slice(0, 10),
        message: `Invitaciones enviadas: ${sent} correo(s)${failed.length ? `, ${failed.length} fallido(s)` : ''}${invalid.length ? `, ${invalid.length} inválido(s) omitido(s)` : ''}.`,
      });
    }

    return NextResponse.json({ ok: false, error: 'mode debe ser "test" o "send"' }, { status: 400 });
  } catch (err) {
    console.error('[admin/email/invitations POST]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error al enviar' },
      { status: 500 }
    );
  }
}
