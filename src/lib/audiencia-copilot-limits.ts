import type { AudienciaSessionData, AudienciaTestigo } from '@/lib/audiencia-session-types';

/** Límites dentro de una audiencia para usuarios en prueba (no ilimitados / no pagos). */
export const TRIAL_COPILOT_LIMITS = {
  maxTestigos: 10,
  maxIntercambiosPerTestigo: 25,
  maxIntercambiosTotal: 100,
  maxDocumentosAdicionales: 3,
} as const;

export type AudienciaCopilotLimits = {
  trial: true;
  maxTestigos: number;
  maxIntercambiosPerTestigo: number;
  maxIntercambiosTotal: number;
  maxDocumentosAdicionales: number;
};

export type AudienciaSessionUsage = {
  testigos: number;
  intercambiosTotal: number;
  documentosAdicionales: number;
};

export function getCopilotLimitsForUser(unlimited: boolean): AudienciaCopilotLimits | null {
  return getCopilotLimitsForContext(unlimited, false);
}

/** Sin límites de prueba si el usuario es ilimitado o la sesión está pagada. */
export function getCopilotLimitsForContext(
  unlimited: boolean,
  sessionPaid: boolean
): AudienciaCopilotLimits | null {
  if (unlimited || sessionPaid) return null;
  return { trial: true, ...TRIAL_COPILOT_LIMITS };
}

export function isAudienciaSessionPaid(data: Record<string, unknown> | undefined): boolean {
  return data?.audienciaPagada === true;
}

export function countAudienciaSessionUsage(session: {
  testigos?: AudienciaTestigo[];
  documentosAdicionales?: AudienciaSessionData['documentosAdicionales'];
}): AudienciaSessionUsage {
  const testigos = session.testigos ?? [];
  return {
    testigos: testigos.length,
    intercambiosTotal: testigos.reduce((n, t) => n + (t.intercambios?.length ?? 0), 0),
    documentosAdicionales: session.documentosAdicionales?.length ?? 0,
  };
}

export function trialLimitError(
  limits: AudienciaCopilotLimits,
  usage: AudienciaSessionUsage,
  intent:
    | 'add_testigo'
    | 'add_intercambio'
    | 'add_documento'
    | 'analyze_expediente_testigos'
): string | null {
  if (intent === 'add_testigo' || intent === 'analyze_expediente_testigos') {
    if (usage.testigos >= limits.maxTestigos) {
      return `La fase de prueba permite hasta ${limits.maxTestigos} declarantes por audiencia. Escribinos si tu causa necesita más testigos.`;
    }
  }

  if (intent === 'add_intercambio') {
    if (usage.intercambiosTotal >= limits.maxIntercambiosTotal) {
      return `La fase de prueba permite hasta ${limits.maxIntercambiosTotal} preguntas y respuestas en total. Escribinos si necesitás seguir o querés dejarnos tu devolución.`;
    }
  }

  if (intent === 'add_documento') {
    if (usage.documentosAdicionales >= limits.maxDocumentosAdicionales) {
      return `La prueba gratuita permite hasta ${limits.maxDocumentosAdicionales} documentos adicionales.`;
    }
  }

  return null;
}

export function trialIntercambioLimitForTestigo(
  limits: AudienciaCopilotLimits,
  testigo: AudienciaTestigo
): string | null {
  const count = testigo.intercambios?.length ?? 0;
  if (count >= limits.maxIntercambiosPerTestigo) {
    return `La prueba permite hasta ${limits.maxIntercambiosPerTestigo} preguntas por declarante.`;
  }
  return null;
}

export function capTestigosForTrial<T>(items: T[], unlimited: boolean, max: number): T[] {
  if (unlimited) return items;
  return items.slice(0, max);
}

/** Cuenta intercambios en el texto formateado P1:/R: del copiloto. */
export function countIntercambiosInTexto(texto: string): number {
  if (!texto.trim() || texto.includes('Sin preguntas registradas')) return 0;
  return (texto.match(/^P\d+:/gm) ?? []).length;
}
