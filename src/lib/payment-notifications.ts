import { resend, canSendEmail, getFromAddress } from '@/lib/resend';
import { buildPaymentSuccessHtml, buildPaymentRejectedHtml, buildConvenioSuspendedHtml } from '@/lib/email-templates';

/**
 * Envía email al usuario cuando se cobró exitosamente su suscripción mensual (o primer pago).
 */
export async function sendPaymentSuccessEmail(opts: {
  to: string;
  userName?: string;
  amount: number;
  currency: string;
}): Promise<boolean> {
  if (!canSendEmail() || !resend) return false;
  const { to, userName, amount, currency } = opts;
  const displayAmount = `${currency} ${amount.toLocaleString('es-AR')}`;
  const html = buildPaymentSuccessHtml({ userName, amount: displayAmount, currency });
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject: `Cobro exitoso - Suscripción LegalMev (${displayAmount})`,
    html,
  });
  if (error) {
    console.error('[payment-notifications] sendPaymentSuccessEmail:', error);
    return false;
  }
  return true;
}

/**
 * Envía email al usuario cuando su pago fue rechazado.
 */
export async function sendPaymentRejectedEmail(opts: {
  to: string;
  userName?: string;
}): Promise<boolean> {
  if (!canSendEmail() || !resend) return false;
  const { to, userName } = opts;
  const html = buildPaymentRejectedHtml({ userName });
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject: 'Tu pago fue rechazado - LegalMev',
    html,
  });
  if (error) {
    console.error('[payment-notifications] sendPaymentRejectedEmail:', error);
    return false;
  }
  return true;
}

/**
 * Envía email a usuarios cuando el convenio de su colegio fue suspendido.
 */
export async function sendConvenioSuspendedEmail(opts: {
  to: string;
  colegioName: string;
}): Promise<boolean> {
  if (!canSendEmail() || !resend) return false;
  const { to, colegioName } = opts;
  const html = buildConvenioSuspendedHtml({ colegioName });
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject: `Convenio suspendido - ${colegioName}`,
    html,
  });
  if (error) {
    console.error('[payment-notifications] sendConvenioSuspendedEmail:', error);
    return false;
  }
  return true;
}
