import type { AiTokenUsageMeta } from '@/lib/ai-token-usage';
import {
  estimateControlPruebaTokenUsageFromItems,
  normalizeTokenUsage,
  sumTokenUsage,
} from '@/lib/ai-token-usage';
import { estimateGeminiUsdCost } from '@/lib/gemini-token-pricing';

export type ControlPruebaReportRow = {
  id: string;
  caratula: string;
  numeroExpediente?: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
  pdfFileName?: string;
  itemCount: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model?: string;
    lastUpdatedAt?: string;
  };
  /** true si el usage se estimó porque el import no lo había persistido */
  tokenUsageEstimated: boolean;
  /** Costo estimado en USD (Gemini Flash paid tier). */
  costUsd: number;
};

export type ControlPruebaReportSummary = {
  totalExpedientes: number;
  uniqueUsers: number;
  totalItems: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  expedientesWithTokens: number;
  expedientesEstimatedTokens: number;
  totalCostUsd: number;
};

export function mapExpedienteDocToReportRow(
  id: string,
  data: Record<string, unknown>,
  user?: { name?: string; email?: string }
): ControlPruebaReportRow {
  const tokenRaw = data.tokenUsage as AiTokenUsageMeta | undefined;
  const items = Array.isArray(data.items) ? data.items : [];
  const measured = normalizeTokenUsage(tokenRaw);
  const hasMeasured = measured.totalTokens > 0;
  const tokenUsage = hasMeasured
    ? measured
    : items.length > 0
      ? estimateControlPruebaTokenUsageFromItems(items.length)
      : measured;

  const createdAtRaw = data.createdAt;
  const updatedAtRaw = data.updatedAt;
  const createdAt =
    typeof createdAtRaw === 'string'
      ? createdAtRaw
      : createdAtRaw && typeof createdAtRaw === 'object' && 'toDate' in createdAtRaw
        ? (createdAtRaw as { toDate: () => Date }).toDate().toISOString()
        : '';
  const updatedAt =
    typeof updatedAtRaw === 'string'
      ? updatedAtRaw
      : updatedAtRaw && typeof updatedAtRaw === 'object' && 'toDate' in updatedAtRaw
        ? (updatedAtRaw as { toDate: () => Date }).toDate().toISOString()
        : '';

  return {
    id,
    caratula: (data.caratula as string) || 'Sin carátula',
    numeroExpediente: (data.numeroExpediente as string) || undefined,
    userId: (data.createdBy as string) || '',
    userName: user?.name?.trim() || '—',
    userEmail: user?.email?.trim() || '—',
    createdAt,
    updatedAt,
    pdfFileName: data.pdfFileName as string | undefined,
    itemCount: items.length,
    tokenUsage: {
      ...tokenUsage,
      model: hasMeasured ? tokenRaw?.model : 'estimado',
      lastUpdatedAt: tokenRaw?.lastUpdatedAt,
    },
    tokenUsageEstimated: !hasMeasured && items.length > 0,
    costUsd: estimateGeminiUsdCost(tokenUsage),
  };
}

export function summarizeControlPruebaReport(
  rows: ControlPruebaReportRow[]
): ControlPruebaReportSummary {
  const usage = sumTokenUsage(...rows.map((r) => r.tokenUsage));
  return {
    totalExpedientes: rows.length,
    uniqueUsers: new Set(rows.map((r) => r.userId).filter(Boolean)).size,
    totalItems: rows.reduce((n, r) => n + r.itemCount, 0),
    totalInputTokens: usage.inputTokens,
    totalOutputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    expedientesWithTokens: rows.filter((r) => r.tokenUsage.totalTokens > 0 && !r.tokenUsageEstimated)
      .length,
    expedientesEstimatedTokens: rows.filter((r) => r.tokenUsageEstimated).length,
    totalCostUsd: rows.reduce((n, r) => n + r.costUsd, 0),
  };
}
