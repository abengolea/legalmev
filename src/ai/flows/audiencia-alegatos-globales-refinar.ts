import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { normalizeTokenUsage, type AiFlowResult } from '@/lib/ai-token-usage';
import { AlegatosGlobalesOutputSchema } from '@/ai/flows/audiencia-alegatos-globales';

export const RefinarAlegatosGlobalesInputSchema = z.object({
  instrucciones: z.string().describe(
    'Indicaciones del abogado para mejorar el alegato: énfasis, recortes, tono, temas a profundizar o minimizar.'
  ),
  alegatoActual: z.string().describe('Borrador actual del alegato de cierre (puede incluir ediciones manuales).'),
  puntosFuertesActuales: z.string().optional().describe('Bullets actuales de puntos fuertes, si existen.'),
  debilidadesContrariaActuales: z
    .string()
    .optional()
    .describe('Bullets actuales de debilidades de la contraria, si existen.'),
  representacionContexto: z.string(),
  expedienteContexto: z.string().optional(),
  testimoniosAudienciaTexto: z.string().optional(),
  documentosAdicionalesTexto: z.string().optional(),
  caratula: z.string().optional(),
});

export type RefinarAlegatosGlobalesInput = z.infer<typeof RefinarAlegatosGlobalesInputSchema>;
export type RefinarAlegatosGlobalesOutput = z.infer<typeof AlegatosGlobalesOutputSchema>;

export async function refinarAlegatosGlobales(
  input: RefinarAlegatosGlobalesInput
): Promise<AiFlowResult<RefinarAlegatosGlobalesOutput>> {
  const response = await refinarAlegatosGlobalesPrompt(input);
  return {
    output: response.output!,
    usage: normalizeTokenUsage(response.usage),
  };
}

const refinarAlegatosGlobalesPrompt = ai.definePrompt({
  name: 'refinarAlegatosGlobalesPrompt',
  input: { schema: RefinarAlegatosGlobalesInputSchema },
  output: { schema: AlegatosGlobalesOutputSchema },
  prompt: `Sos abogado litigante argentino. El abogado ya tiene un borrador de ALEGATO DE CIERRE GLOBAL y te pide mejorarlo según sus instrucciones.

Tu tarea: revisar el borrador actual y devolver una versión mejorada que cumpla las instrucciones del abogado, sin inventar hechos ni testimonios que no figuren en el material de referencia.

REGLAS:
- Mantené SIEMPRE la posición procesal de la parte que representamos.
- Respetá el tono profesional, oral pero preciso, apto para audiencia argentina.
- Si el abogado pide más énfasis en un tema, desarrollalo con argumentos del expediente y testimonios; no alucines prueba nueva.
- Si pide acortar, condensá sin perder los argumentos centrales.
- Si pide menos énfasis en algo, reducilo pero no contradigas hechos probados.
- Conservá estructura clara: introducción, desarrollo, refutación si corresponde, conclusión petitoria.
- Sin markdown en alegatoGlobal.
- Actualizá puntosFuertes y debilidadesContraria si las instrucciones lo ameritan; si no, mantenelos coherentes con el nuevo texto.

{{#if caratula}}**Carátula:** {{caratula}}{{/if}}

**Nuestra representación:**
{{{representacionContexto}}}

{{#if expedienteContexto}}
**Contexto del expediente (referencia factual):**
{{{expedienteContexto}}}
{{/if}}

{{#if testimoniosAudienciaTexto}}
**Testimonios de la audiencia (referencia factual):**
{{{testimoniosAudienciaTexto}}}
{{/if}}

{{#if documentosAdicionalesTexto}}
**Documentos adicionales del abogado (referencia factual):**
{{{documentosAdicionalesTexto}}}
{{/if}}

**Instrucciones del abogado para mejorar el alegato:**
{{{instrucciones}}}

**Borrador actual del alegato:**
{{{alegatoActual}}}

{{#if puntosFuertesActuales}}
**Puntos fuertes actuales:**
{{{puntosFuertesActuales}}}
{{/if}}

{{#if debilidadesContrariaActuales}}
**Debilidades de la contraria actuales:**
{{{debilidadesContrariaActuales}}}
{{/if}}

Devolvé el alegato refinado y los bullets actualizados.`,
});

const refinarAlegatosGlobalesFlow = ai.defineFlow(
  {
    name: 'refinarAlegatosGlobalesFlow',
    inputSchema: RefinarAlegatosGlobalesInputSchema,
    outputSchema: AlegatosGlobalesOutputSchema,
  },
  async (input) => {
    const { output } = await refinarAlegatosGlobalesPrompt(input);
    return output!;
  }
);
