import type { AiTokenUsageMeta } from '@/lib/ai-token-usage';
import { normalizeTokenUsage, sumTokenUsage } from '@/lib/ai-token-usage';
import type { AudienciaTestigo } from '@/lib/audiencia-session-types';
import { estimateGeminiUsdCost } from '@/lib/gemini-token-pricing';

export type AudienciaCopilotReportRow = {
  id: string;
  titulo: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
  pdfFileName?: string;
  tipo: 'prueba' | 'pagada';
  testigoCount: number;
  intercambiosTotal: number;
  documentosCount: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model?: string;
    lastUpdatedAt?: string;
  };
  costUsd: number;
  pagoMonto?: number;
  pagoMoneda?: string;
  pagoAt?: string;
};

export type AudienciaCopilotReportSummary = {
  totalSessions: number;
  pruebaSessions: number;
  pagadasSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalIntercambios: number;
  totalCostUsd: number;
};

export function countSessionIntercambios(testigos: AudienciaTestigo[] | undefined): number {
  if (!Array.isArray(testigos)) return 0;
  return testigos.reduce((n, t) => n + (t.intercambios?.length ?? 0), 0);
}

export function mapSessionDocToReportRow(
  id: string,
  data: Record<string, unknown>,
  user?: { name?: string; email?: string }
): AudienciaCopilotReportRow {
  const testigos = (data.testigos as AudienciaTestigo[]) ?? [];
  const tokenRaw = data.tokenUsage as AiTokenUsageMeta | undefined;
  const tokenUsage = normalizeTokenUsage(tokenRaw);
  const pagoMeta = data.audienciaPagoMeta as
    | { monto?: number; moneda?: string; paidAt?: string }
    | undefined;

  return {
    id,
    titulo: (data.titulo as string) || 'Audiencia sin título',
    userId: (data.userId as string) || '',
    userName: user?.name?.trim() || '—',
    userEmail: user?.email?.trim() || '—',
    createdAt: (data.createdAt as string) || '',
    updatedAt: (data.updatedAt as string) || '',
    pdfFileName: data.pdfFileName as string | undefined,
    tipo: data.audienciaPagada === true ? 'pagada' : 'prueba',
    testigoCount: testigos.length,
    intercambiosTotal: countSessionIntercambios(testigos),
    documentosCount: Array.isArray(data.documentosAdicionales)
      ? data.documentosAdicionales.length
      : 0,
    tokenUsage: {
      ...tokenUsage,
      model: tokenRaw?.model,
      lastUpdatedAt: tokenRaw?.lastUpdatedAt,
    },
    costUsd: estimateGeminiUsdCost(tokenUsage),
    pagoMonto: typeof pagoMeta?.monto === 'number' ? pagoMeta.monto : undefined,
    pagoMoneda: pagoMeta?.moneda,
    pagoAt: pagoMeta?.paidAt,
  };
}

export function summarizeAudienciaReport(rows: AudienciaCopilotReportRow[]): AudienciaCopilotReportSummary {
  const usage = sumTokenUsage(...rows.map((r) => r.tokenUsage));
  return {
    totalSessions: rows.length,
    pruebaSessions: rows.filter((r) => r.tipo === 'prueba').length,
    pagadasSessions: rows.filter((r) => r.tipo === 'pagada').length,
    totalInputTokens: usage.inputTokens,
    totalOutputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    totalIntercambios: rows.reduce((n, r) => n + r.intercambiosTotal, 0),
    totalCostUsd: rows.reduce((n, r) => n + r.costUsd, 0),
  };
}
