import { buildUserInviteEmailHtml } from '@/lib/email-templates';
import { resend, canSendEmail, getFromAddress } from '@/lib/resend';
import {
  USER_INVITE_CONFIRM,
  USER_INVITE_DEFAULT_SUBJECT,
  USER_INVITE_MAX_RECIPIENTS,
  isValidEmail,
  parseEmailList,
} from '@/lib/user-invite-email.constants';

export {
  USER_INVITE_CONFIRM,
  USER_INVITE_DEFAULT_SUBJECT,
  USER_INVITE_MAX_RECIPIENTS,
  isValidEmail,
  parseEmailList,
};

const BATCH_SIZE = 50;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar').replace(
  /\/$/,
  ''
);

export function registerUrlForEmail(email: string): string {
  return `${SITE_URL}/register?email=${encodeURIComponent(email)}&invite=user`;
}

export async function sendUserInviteTest(params: {
  email: string;
  subject?: string;
  customMessage?: string;
}): Promise<void> {
  if (!canSendEmail() || !resend) {
    throw new Error('Resend no está configurado');
  }
  const subject = (params.subject || USER_INVITE_DEFAULT_SUBJECT).trim() || USER_INVITE_DEFAULT_SUBJECT;
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: params.email,
    subject,
    html: buildUserInviteEmailHtml({
      registerUrl: registerUrlForEmail(params.email),
      customMessage: params.customMessage,
    }),
  });
  if (error) throw new Error(error.message || 'Error al enviar');
}

export async function sendUserInvites(params: {
  emails: string[];
  subject?: string;
  customMessage?: string;
}): Promise<{ sent: number; failed: string[] }> {
  if (!canSendEmail() || !resend) {
    throw new Error('Resend no está configurado');
  }

  const from = getFromAddress();
  const subject = (params.subject || USER_INVITE_DEFAULT_SUBJECT).trim() || USER_INVITE_DEFAULT_SUBJECT;
  let sent = 0;
  const failed: string[] = [];

  for (let i = 0; i < params.emails.length; i += BATCH_SIZE) {
    const chunk = params.emails.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((email) => ({
      from,
      to: email,
      subject,
      html: buildUserInviteEmailHtml({
        registerUrl: registerUrlForEmail(email),
        customMessage: params.customMessage,
      }),
    }));

    const { error } = await resend.batch.send(payload);
    if (error) {
      for (const email of chunk) failed.push(email);
      console.error('[user-invite] batch error:', error);
      continue;
    }
    sent += chunk.length;
  }

  return { sent, failed };
}
