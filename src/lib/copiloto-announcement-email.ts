import type { Firestore } from 'firebase-admin/firestore';
import { buildCopilotoAudienciaAnnouncementHtml } from '@/lib/email-templates';
import { resend, canSendEmail, getFromAddress } from '@/lib/resend';

import {
  COPILOTO_ANNOUNCEMENT_CAMPAIGN,
  COPILOTO_ANNOUNCEMENT_CONFIRM,
} from '@/lib/copiloto-announcement-email.constants';

export { COPILOTO_ANNOUNCEMENT_CAMPAIGN, COPILOTO_ANNOUNCEMENT_CONFIRM };

const BATCH_SIZE = 50;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar').replace(
  /\/$/,
  ''
);

export type AnnouncementRecipient = {
  uid: string;
  email: string;
  name?: string;
};

export function firstNameFromUser(name?: string, email?: string): string | undefined {
  if (name?.trim()) return name.trim().split(/\s+/)[0];
  if (email?.includes('@')) return email.split('@')[0];
  return undefined;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function loadAnnouncementRecipients(
  adminDb: Firestore,
  skipAlreadySent: boolean
): Promise<{
  eligible: AnnouncementRecipient[];
  alreadySent: number;
  skippedNoEmail: number;
  skippedInactive: number;
}> {
  const snap = await adminDb.collection('users').get();
  const eligible: AnnouncementRecipient[] = [];
  let alreadySent = 0;
  let skippedNoEmail = 0;
  let skippedInactive = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (!email || !isValidEmail(email)) {
      skippedNoEmail++;
      continue;
    }
    if (data.status === 'inactivo') {
      skippedInactive++;
      continue;
    }
    if (skipAlreadySent && data.copilotoAnnouncementEmailSentAt) {
      alreadySent++;
      continue;
    }
    eligible.push({
      uid: doc.id,
      email,
      name: typeof data.name === 'string' ? data.name : undefined,
    });
  }

  return { eligible, alreadySent, skippedNoEmail, skippedInactive };
}

export async function sendCopilotoAnnouncementToRecipients(
  adminDb: Firestore,
  recipients: AnnouncementRecipient[],
  sentBy: string
): Promise<{ sent: number; failed: string[] }> {
  if (!canSendEmail() || !resend) {
    throw new Error('Resend no está configurado');
  }

  const from = getFromAddress();
  const subject = 'Nuevo en LegalMev: Copiloto de Audiencias — 1 audiencia de prueba incluida';
  const copilotUrl = `${SITE_URL}/dashboard/copiloto-audiencias`;
  const now = new Date().toISOString();
  let sent = 0;
  const failed: string[] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((r) => ({
      from,
      to: r.email,
      subject,
      html: buildCopilotoAudienciaAnnouncementHtml({
        firstName: firstNameFromUser(r.name, r.email),
        copilotUrl,
      }),
    }));

    const { error } = await resend.batch.send(payload);
    if (error) {
      for (const r of chunk) failed.push(r.email);
      console.error('[copiloto-announcement] batch error:', error);
      continue;
    }

    const writeBatch = adminDb.batch();
    for (const r of chunk) {
      writeBatch.set(
        adminDb.collection('users').doc(r.uid),
        {
          copilotoAnnouncementEmailSentAt: now,
          copilotoAnnouncementEmailCampaign: COPILOTO_ANNOUNCEMENT_CAMPAIGN,
          updatedAt: now,
        },
        { merge: true }
      );
    }
    await writeBatch.commit();
    sent += chunk.length;
  }

  if (sent > 0) {
    await adminDb.doc('settings/email_campaigns').set(
      {
        lastCopilotoAnnouncement: {
          campaign: COPILOTO_ANNOUNCEMENT_CAMPAIGN,
          sentAt: now,
          sentBy,
          sentCount: sent,
          failedCount: failed.length,
        },
        updatedAt: now,
      },
      { merge: true }
    );
  }

  return { sent, failed };
}

export async function sendCopilotoAnnouncementTest(email: string): Promise<void> {
  if (!canSendEmail() || !resend) {
    throw new Error('Resend no está configurado');
  }
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: email,
    subject: 'Nuevo en LegalMev: Copiloto de Audiencias — 1 audiencia de prueba incluida',
    html: buildCopilotoAudienciaAnnouncementHtml({
      firstName: firstNameFromUser(undefined, email),
      copilotUrl: `${SITE_URL}/dashboard/copiloto-audiencias`,
    }),
  });
  if (error) throw new Error(error.message || 'Error al enviar');
}
