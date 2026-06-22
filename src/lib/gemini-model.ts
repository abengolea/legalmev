/** Modelo Gemini para API directa (@google/generative-ai). */
export const GEMINI_MODEL_ID =
  process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

/** Modelo para Genkit (@genkit-ai/googleai). */
export const GENKIT_GEMINI_MODEL = `googleai/${GEMINI_MODEL_ID}`;
