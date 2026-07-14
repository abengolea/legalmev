import type { AiTokenUsage } from '@/lib/ai-token-usage';

/**
 * Precios Gemini 2.5 Flash (paid tier, USD / 1M tokens).
 * Fuentes: https://ai.google.dev/gemini-api/docs/pricing
 * Override con env: GEMINI_INPUT_USD_PER_1M / GEMINI_OUTPUT_USD_PER_1M
 */
export const GEMINI_FLASH_INPUT_USD_PER_1M = Number(
  process.env.GEMINI_INPUT_USD_PER_1M?.trim() || '0.30',
);
export const GEMINI_FLASH_OUTPUT_USD_PER_1M = Number(
  process.env.GEMINI_OUTPUT_USD_PER_1M?.trim() || '2.50',
);

export function estimateGeminiUsdCost(usage: AiTokenUsage): number {
  const inputRate = Number.isFinite(GEMINI_FLASH_INPUT_USD_PER_1M)
    ? GEMINI_FLASH_INPUT_USD_PER_1M
    : 0.3;
  const outputRate = Number.isFinite(GEMINI_FLASH_OUTPUT_USD_PER_1M)
    ? GEMINI_FLASH_OUTPUT_USD_PER_1M
    : 2.5;
  return (
    (usage.inputTokens / 1_000_000) * inputRate +
    (usage.outputTokens / 1_000_000) * outputRate
  );
}

export function formatUsdCost(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'US$ 0,00';
  if (value < 0.01) {
    return `US$ ${value.toLocaleString('es-AR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })}`;
  }
  return `US$ ${value.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export type CostPeriodBucket = {
  key: string;
  label: string;
  count: number;
  costUsd: number;
};

export type CostByPeriod = {
  byMonth: CostPeriodBucket[];
  byYear: CostPeriodBucket[];
};

const MONTH_LABELS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

function parseRowDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Agrupa costos USD por mes y por año a partir de filas con fecha + costo. */
export function buildCostByPeriod(
  rows: Array<{ dateIso?: string; costUsd: number }>,
): CostByPeriod {
  const monthMap = new Map<string, CostPeriodBucket>();
  const yearMap = new Map<string, CostPeriodBucket>();

  for (const row of rows) {
    const d = parseRowDate(row.dateIso);
    if (!d) continue;
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const yearKey = String(year);
    const cost = Number.isFinite(row.costUsd) ? row.costUsd : 0;

    const monthBucket = monthMap.get(monthKey) ?? {
      key: monthKey,
      label: `${MONTH_LABELS[month]} ${year}`,
      count: 0,
      costUsd: 0,
    };
    monthBucket.count += 1;
    monthBucket.costUsd += cost;
    monthMap.set(monthKey, monthBucket);

    const yearBucket = yearMap.get(yearKey) ?? {
      key: yearKey,
      label: yearKey,
      count: 0,
      costUsd: 0,
    };
    yearBucket.count += 1;
    yearBucket.costUsd += cost;
    yearMap.set(yearKey, yearBucket);
  }

  return {
    byMonth: [...monthMap.values()].sort((a, b) => b.key.localeCompare(a.key)),
    byYear: [...yearMap.values()].sort((a, b) => b.key.localeCompare(a.key)),
  };
}
