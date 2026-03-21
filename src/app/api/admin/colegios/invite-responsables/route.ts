import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import { resend, canSendEmail, getFromAddress } from '@/lib/resend';
import { buildInviteEmailHtml } from '@/lib/email-templates';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar';

/**
 * POST /api/admin/colegios/invite-responsables
 * Da de alta responsables y envía email para creación/configuración de contraseña.
 * Body: { colegioId: string, emails: string[] }
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
    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (userSnap.data()?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Solo administradores' }, { status: 403 });
    }

    const body = await request.json();
    const colegioId = typeof body.colegioId === 'string' ? body.colegioId.trim() : '';
    const rawEmails = Array.isArray(body.emails)
      ? (body.emails as string[]).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)
      : [];

    if (!colegioId || rawEmails.length === 0) {
      return NextResponse.json({ ok: false, error: 'Se requiere colegioId y al menos un email' }, { status: 400 });
    }

    const colegioSnap = await adminDb.collection('colegios').doc(colegioId).get();
    if (!colegioSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Colegio no encontrado' }, { status: 404 });
    }

    const colegioData = colegioSnap.data();
    const colegioName = (colegioData?.name as string) ?? 'Colegio';
    const currentEmails = (colegioData?.adminEmails || []) as string[];
    const merged = [...new Set([...currentEmails, ...rawEmails])];

    await adminDb.collection('colegios').doc(colegioId).update({
      adminEmails: merged,
      updatedAt: new Date().toISOString(),
    });

    const emailsSent: string[] = [];
    const emailsFailed: string[] = [];

    if (canSendEmail()) {
      for (const email of rawEmails) {
        try {
          let userExists = false;
          try {
            await adminAuth.getUserByEmail(email);
            userExists = true;
          } catch {
            // User doesn't exist
          }

          let actionUrl: string;
          let subject: string;
          if (userExists) {
            const resetLink = await adminAuth.generatePasswordResetLink(email, { url: `${siteUrl.replace(/\/$/, '')}/dashboard` });
            actionUrl = resetLink;
            subject = `Configurá tu contraseña - Responsable de ${colegioName}`;
          } else {
            const registerUrl = `${siteUrl.replace(/\/$/, '')}/register?email=${encodeURIComponent(email)}&invite=colegio`;
            actionUrl = registerUrl;
            subject = `Creá tu cuenta - Responsable de ${colegioName}`;
          }

          const html = buildInviteEmailHtml({
            colegioName,
            actionUrl,
            isNewUser: !userExists,
          });

          const { error } = await resend!.emails.send({
            from: getFromAddress(),
            to: email,
            subject,
            html,
          });

          if (error) {
            console.error('[invite-responsables] Resend error for', email, error);
            emailsFailed.push(email);
          } else {
            emailsSent.push(email);
          }
        } catch (err) {
          console.error('[invite-responsables] Error sending to', email, err);
          emailsFailed.push(email);
        }
      }
    } else {
      return NextResponse.json({
        ok: true,
        added: rawEmails.length,
        emailsSent: 0,
        emailsFailed: rawEmails,
        message: 'Responsables agregados. El servicio de email no está configurado (RESEND_API_KEY). Los usuarios no recibieron el correo de invitación.',
      });
    }

    return NextResponse.json({
      ok: true,
      added: rawEmails.length,
      emailsSent: emailsSent.length,
      emailsFailed,
      message:
        emailsFailed.length > 0
          ? `${emailsSent.length} correo(s) enviado(s). No se pudo enviar a: ${emailsFailed.join(', ')}`
          : `${emailsSent.length} correo(s) de invitación enviado(s).`,
    });
  } catch (err) {
    console.error('[invite-responsables]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
