export type AiFlowResult<T> = {
  output: T;
  usage: AiTokenUsage;
};

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiTokenUsageMeta = AiTokenUsage & {
  model?: string;
  lastUpdatedAt?: string;
};

export const EMPTY_TOKEN_USAGE: AiTokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
};

function readNumber(obj: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

/** Normaliza usage de Genkit, Gemini SDK u objetos guardados en Firestore. */
export function normalizeTokenUsage(raw: unknown): AiTokenUsage {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_TOKEN_USAGE };

  const obj = raw as Record<string, unknown>;
  const inputTokens = readNumber(obj, [
    'inputTokens',
    'promptTokens',
    'promptTokenCount',
  ]);
  const outputTokens = readNumber(obj, [
    'outputTokens',
    'completionTokens',
    'candidatesTokenCount',
    'responseTokenCount',
  ]);
  const totalTokens =
    readNumber(obj, ['totalTokens', 'totalTokenCount']) ||
    inputTokens + outputTokens;

  return { inputTokens, outputTokens, totalTokens };
}

/** Usage devuelto por @google/generative-ai (usageMetadata). */
export function normalizeGeminiSdkUsage(raw: unknown): AiTokenUsage {
  return normalizeTokenUsage(raw);
}

export function sumTokenUsage(
  ...items: (AiTokenUsage | null | undefined)[]
): AiTokenUsage {
  return items.reduce<AiTokenUsage>(
    (acc, item) => {
      if (!item) return acc;
      const normalized = normalizeTokenUsage(item);
      return {
        inputTokens: acc.inputTokens + normalized.inputTokens,
        outputTokens: acc.outputTokens + normalized.outputTokens,
        totalTokens: acc.totalTokens + normalized.totalTokens,
      };
    },
    { ...EMPTY_TOKEN_USAGE }
  );
}

export function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1_000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString('es-AR');
}
