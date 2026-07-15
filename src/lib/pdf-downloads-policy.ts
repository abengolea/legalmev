/**
 * Política de descargas PDF (desde julio 2026).
 * Todos los usuarios tienen premium de por vida con bajadas ilimitadas.
 */
export const PDF_DOWNLOADS_UNLIMITED = true;

/** Campos de perfil para alta o migración a premium lifetime. */
export function lifetimePremiumUserFields(
  existingPremiumSource?: string | null
): Record<string, unknown> {
  const keepSource =
    existingPremiumSource === 'colegio' ||
    existingPremiumSource === 'payment' ||
    existingPremiumSource === 'admin' ||
    existingPremiumSource === 'lifetime';

  return {
    tier: 'premium',
    premiumForever: true,
    premiumSource: keepSource ? existingPremiumSource : 'lifetime',
    freeDownloadsUsed: 0,
    downloadsThisMonth: 0,
    monthlyResetAt: null,
    subscriptionLapsed: null,
  };
}
