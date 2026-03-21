/**
 * Logs estructurados para DLocal en producción.
 *
 * Cómo buscar en Vercel: Dashboard → proyecto → Logs → filtrar por "[dlocal]"
 * Cómo buscar en Firebase: Logs → filtrar texto "[dlocal]"
 *
 * Eventos: create_order_start, create_order_ok, create_order_no_redirect,
 * create_order_error, create_order_reject, webhook_received, webhook_ignored,
 * webhook_rejected, webhook_premium_activated, webhook_colegio_paid, webhook_error.
 *
 * No loguea datos sensibles (API keys, tokens, emails).
 */

const PREFIX = '[dlocal]';

type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const payload = {
    event,
    ...data,
    env: process.env.NODE_ENV,
    ts: new Date().toISOString(),
  };
  const msg = `${PREFIX} ${event} | ${JSON.stringify(payload)}`;
  if (level === 'error') console.error(msg);
  else if (level === 'warn') console.warn(msg);
  else console.log(msg);
}

export const dlocalLog = {
  /** Creación de orden rechazada (usuario ya premium, etc.) */
  createOrderReject: (reason: string, uid?: string) =>
    log('info', 'create_order_reject', { reason, uid }),

  /** Creación de orden iniciada */
  createOrderStart: (uid: string, orderId: string, webhookUrl?: string) =>
    log('info', 'create_order_start', { uid, orderId, webhookUrl }),

  /** Creación de orden: DLocal respondió sin redirect_url */
  createOrderNoRedirect: (orderId: string, status: number, dlocalResponse: unknown) =>
    log('warn', 'create_order_no_redirect', {
      orderId,
      httpStatus: status,
      dlocalCode: (dlocalResponse as { code?: number })?.code,
      dlocalMsg: (dlocalResponse as { message?: string })?.message,
      dlocalError: (dlocalResponse as { error?: string })?.error,
    }),

  /** Creación de orden exitosa */
  createOrderOk: (orderId: string, uid: string) =>
    log('info', 'create_order_ok', { orderId, uid }),

  /** Error al crear orden */
  createOrderError: (error: unknown, uid?: string) =>
    log('error', 'create_order_error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      uid,
    }),

  /** Webhook recibido */
  webhookReceived: (status: string, orderId?: string) =>
    log('info', 'webhook_received', { status, orderId }),

  /** Webhook: status no PAID, ignorado */
  webhookIgnored: (reason: string, orderId?: string) =>
    log('info', 'webhook_ignored', { reason, orderId }),

  /** Webhook: pago rechazado/fallido */
  webhookRejected: (orderId: string, status: string, uid?: string) =>
    log('info', 'webhook_rejected', { orderId, status, uid }),

  /** Webhook: usuario actualizado a premium */
  webhookPremiumActivated: (orderId: string, uid: string) =>
    log('info', 'webhook_premium_activated', { orderId, uid }),

  /** Webhook: pago colegio registrado */
  webhookColegioPaid: (colegioId: string, periodo?: string) =>
    log('info', 'webhook_colegio_paid', { colegioId, periodo }),

  /** Webhook: error al procesar */
  webhookError: (error: unknown, orderId?: string) =>
    log('error', 'webhook_error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      orderId,
    }),

  /** Config: DLocal no configurado (solo si se intenta usar) */
  configMissing: (context: string) => log('warn', 'config_missing', { context }),
};
