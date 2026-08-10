import { buildResourceShareEmailHtml } from '@/lib/email-templates';
import { canSendEmail, getFromAddress, resend } from '@/lib/resend';
import type { ShareRole } from '@/lib/resource-sharing';
import { roleLabelEs } from '@/lib/resource-sharing';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar').replace(
  /\/$/,
  '',
);

export type ShareEmailResourceKind = 'control-prueba' | 'copiloto-audiencias';

export async function sendResourceShareNotification(params: {
  toEmail: string;
  recipientName?: string;
  sharerName: string;
  kind: ShareEmailResourceKind;
  resourceId: string;
  resourceTitle: string;
  role: ShareRole;
}): Promise<{ sent: boolean; error?: string }> {
  if (!canSendEmail() || !resend) {
    return { sent: false, error: 'Resend no está configurado' };
  }

  const resourceLabel =
    params.kind === 'control-prueba' ? 'control de prueba' : 'copiloto de audiencias';
  const path =
    params.kind === 'control-prueba'
      ? `/dashboard/control-prueba?id=${encodeURIComponent(params.resourceId)}`
      : `/dashboard/copiloto-audiencias?sessionId=${encodeURIComponent(params.resourceId)}`;
  const actionUrl = `${SITE_URL}${path}`;
  const roleText = roleLabelEs(params.role);

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: params.toEmail,
    subject: `[LegalMev] Te compartieron un ${resourceLabel} (${roleText})`,
    html: buildResourceShareEmailHtml({
      recipientName: params.recipientName,
      sharerName: params.sharerName,
      resourceLabel,
      resourceTitle: params.resourceTitle,
      role: params.role,
      actionUrl,
    }),
  });

  if (error) {
    console.error('[share-notification] Resend error:', error);
    return { sent: false, error: error.message || 'Error al enviar el email' };
  }

  return { sent: true };
}
