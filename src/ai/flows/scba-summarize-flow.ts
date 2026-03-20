/**
 * Flow para resumir sentencias SCBA con IA.
 * Usa @google/generative-ai directo (más estable que Genkit en API routes).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ScbaSentencia } from '@/lib/scba-scraper';

const MAX_RESUMEN_CHARS = 2000;

function getApiKey(): string | null {
  return (
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  );
}

/**
 * Resumir una sentencia SCBA con IA (API de Google directa).
 */
export async function summarizeScbaSentencia(
  sentencia: Pick<ScbaSentencia, 'titulo' | 'resumen' | 'causa'>
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Falta GOOGLE_GENAI_API_KEY en .env.local');
  }

  const resumen = sentencia.resumen.slice(0, MAX_RESUMEN_CHARS);
  const prompt = `Eres un asistente jurídico experto en derecho argentino. Reducí este fallo de la Suprema Corte de Buenos Aires a un resumen breve (2-4 oraciones) que destaque: el tema central, la decisión del Tribunal y un punto clave del fundamento. Solo el resumen, sin preámbulos.

**Título:** ${sentencia.titulo}

**Texto:** ${resumen}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  const response = result.response;

  if (!response.candidates?.length) {
    const blockReason = response.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Contenido bloqueado: ${blockReason}` : 'Respuesta vacía');
  }

  const text = response.text?.();
  return (text ?? '').trim() || '(Sin resumen)';
}
