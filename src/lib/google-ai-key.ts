/** Clave de Google AI / Gemini (servidor). */
export function getGoogleGenAiApiKey(): string | null {
  const key =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';
  return key.trim() || null;
}

export function requireGoogleGenAiApiKey(): string {
  const key = getGoogleGenAiApiKey();
  if (!key) {
    throw new Error(
      'Falta GOOGLE_GENAI_API_KEY en .env.local. Obtené una en https://aistudio.google.com/apikey'
    );
  }
  return key;
}
