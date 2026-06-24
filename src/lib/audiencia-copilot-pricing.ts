/** Precio lista por audiencia completa del copiloto (ARS). */
export const AUDIENCIA_COPILOT_PRECIO_LISTA = 10_000;

/** Precio con convenio de colegio (−30%). */
export const AUDIENCIA_COPILOT_PRECIO_COLEGIO = 7_000;

export type AudienciaCopilotPrice = {
  amount: number;
  esColegio: boolean;
  currency: 'ARS';
};

export function resolveAudienciaCopilotPrice(
  userData: Record<string, unknown> | undefined,
  currency = 'ARS'
): AudienciaCopilotPrice {
  const premiumSource = userData?.premiumSource;
  const tieneConvenioColegio = premiumSource === 'colegio' || !!userData?.colegioId;
  return {
    amount: tieneConvenioColegio
      ? AUDIENCIA_COPILOT_PRECIO_COLEGIO
      : AUDIENCIA_COPILOT_PRECIO_LISTA,
    esColegio: tieneConvenioColegio,
    currency: currency as 'ARS',
  };
}
