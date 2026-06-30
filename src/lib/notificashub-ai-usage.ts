/**
 * Reporte de uso IA al NotificasHub (/api/hub/ai-usage). Best-effort, no bloquea la app.
 */
export const NOTIFICASHUB_AI_APP_ID = "legalmev";

export type AiProvider = "gemini" | "openai" | "other";

export async function reportAiUsageToHub(opts: {
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  feature?: string;
}): Promise<void> {
  if (opts.inputTokens === 0 && opts.outputTokens === 0) return;
  const hubUrl = process.env.NOTIFICASHUB_URL?.trim();
  const secret =
    process.env.HUB_AI_USAGE_SECRET?.trim() ||
    process.env.NOTIFICASHUB_INBOUND_SECRET?.trim();
  if (!hubUrl || !secret) return;
  try {
    await fetch(`${hubUrl.replace(/\/$/, "")}/api/hub/ai-usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-ai-usage-secret": secret,
      },
      body: JSON.stringify({
        appId: NOTIFICASHUB_AI_APP_ID,
        provider: opts.provider,
        model: opts.model,
        inputTokens: opts.inputTokens,
        outputTokens: opts.outputTokens,
        feature: opts.feature ?? "external",
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    /* best-effort */
  }
}

export function extractGenkitUsage(result: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  const u = (result as { usage?: { inputTokens?: number; outputTokens?: number } })?.usage;
  return {
    inputTokens: u?.inputTokens ?? 0,
    outputTokens: u?.outputTokens ?? 0,
  };
}

export function providerFromModel(model: unknown): AiProvider {
  const s = String(model ?? "").toLowerCase();
  if (s.includes("gpt") || s.includes("openai") || s.includes("o1") || s.includes("o3")) {
    return "openai";
  }
  return "gemini";
}

export function modelIdFromRef(model: unknown): string {
  const s = String(model ?? "unknown");
  if (s.includes("[object")) {
    const m = (model as { name?: string })?.name;
    return m ?? "unknown";
  }
  return s.replace(/^googleai\//, "").replace(/^openai\//, "");
}

export function reportGenkitResult(
  result: unknown,
  model: unknown,
  feature: string
): void {
  const { inputTokens, outputTokens } = extractGenkitUsage(result);
  void reportAiUsageToHub({
    provider: providerFromModel(model),
    model: modelIdFromRef(model),
    inputTokens,
    outputTokens,
    feature,
  });
}

export function patchGenkitGenerate(
  ai: { generate: (...args: unknown[]) => Promise<unknown> },
  defaultFeature = "genkit.generate"
): void {
  const original = ai.generate.bind(ai);
  ai.generate = async (opts: unknown) => {
    const result = await original(opts);
    const model =
      opts && typeof opts === "object" && opts !== null && "model" in opts
        ? (opts as { model?: unknown }).model
        : undefined;
    reportGenkitResult(result, model, defaultFeature);
    return result;
  };
}

