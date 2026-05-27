const PRODUCTION_NOTIFICAS_URL = "https://notificas.com.ar";

/**
 * URL de Notificas para el modal de colegiados (enlace “Ir a Notificas”).
 * Siempre apunta a producción para que matriculados prueben el sitio real,
 * aunque LegalMev corra en local.
 *
 * Override opcional solo para pruebas internas: NOTIFICAS_PROMO_PUBLIC_URL
 */
export function getNotificasPromoPublicUrl(): string {
  const env = process.env.NOTIFICAS_PROMO_PUBLIC_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  return PRODUCTION_NOTIFICAS_URL;
}

export function buildNotificasLoginUrl(colegioId: string): string {
  const base = getNotificasPromoPublicUrl();
  const params = new URLSearchParams({
    ref: "legalmev",
    colegio: colegioId,
  });
  return `${base}/login?${params.toString()}`;
}
