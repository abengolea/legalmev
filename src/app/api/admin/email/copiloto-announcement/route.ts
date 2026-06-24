import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';
import { canSendEmail } from '@/lib/resend';
import {
  COPILOTO_ANNOUNCEMENT_CONFIRM,
  loadAnnouncementRecipients,
  sendCopilotoAnnouncementTest,
  sendCopilotoAnnouncementToRecipients,
} from '@/lib/copiloto-announcement-email';

/**
 * GET /api/admin/email/copiloto-announcement
 * Estadísticas de la campaña de anuncio del copiloto.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const skipAlreadySent = request.nextUrl.searchParams.get('skipAlreadySent') !== 'false';
    const adminDb = getAdminDb();
    const stats = await loadAnnouncementRecipients(adminDb, skipAlreadySent);

    const campaignSnap = await adminDb.doc('settings/email_campaigns').get();
    const lastRun = campaignSnap.data()?.lastCopilotoAnnouncement as
      | { sentAt?: string; sentCount?: number; failedCount?: number; sentBy?: string }
      | undefined;

    return NextResponse.json({
      ok: true,
      resendConfigured: canSendEmail(),
      pending: stats.eligible.length,
      alreadySent: stats.alreadySent,
      skippedNoEmail: stats.skippedNoEmail,
      skippedInactive: stats.skippedInactive,
      lastRun: lastRun ?? null,
    });
  } catch (err) {
    console.error('[admin/email/copiloto-announcement GET]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/email/copiloto-announcement
 * Body test: { mode: "test", email: "..." }
 * Body bulk: { mode: "send", confirm: "ENVIAR_COPILOTO", skipAlreadySent?: true }
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

    if (mode === 'test') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 });
      }
      await sendCopilotoAnnouncementTest(email);
      return NextResponse.json({ ok: true, message: `Correo de prueba enviado a ${email}` });
    }

    if (mode === 'send') {
      if (body.confirm !== COPILOTO_ANNOUNCEMENT_CONFIRM) {
        return NextResponse.json(
          {
            ok: false,
            error: `Confirmación requerida: escribí exactamente "${COPILOTO_ANNOUNCEMENT_CONFIRM}"`,
          },
          { status: 400 }
        );
      }

      const skipAlreadySent = body.skipAlreadySent !== false;
      const adminDb = getAdminDb();
      const { eligible } = await loadAnnouncementRecipients(adminDb, skipAlreadySent);

      if (eligible.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No hay destinatarios pendientes para enviar.' },
          { status: 400 }
        );
      }

      const { sent, failed } = await sendCopilotoAnnouncementToRecipients(
        adminDb,
        eligible,
        auth.uid
      );

      return NextResponse.json({
        ok: true,
        sent,
        failed: failed.length,
        failedEmails: failed.slice(0, 20),
        message: `Campaña enviada: ${sent} correo(s)${failed.length ? `, ${failed.length} fallido(s)` : ''}.`,
      });
    }

    return NextResponse.json({ ok: false, error: 'mode debe ser "test" o "send"' }, { status: 400 });
  } catch (err) {
    console.error('[admin/email/copiloto-announcement POST]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error al enviar' },
      { status: 500 }
    );
  }
}
