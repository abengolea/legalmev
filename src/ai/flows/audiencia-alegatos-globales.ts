import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const AlegatosGlobalesInputSchema = z.object({
  expedienteContexto: z.string(),
  representacionContexto: z.string(),
  testimoniosAudienciaTexto: z.string().describe(
    'Todos los testimonios cerrados de la audiencia: P/R, admisiones y conclusiones por declarante.'
  ),
  caratula: z.string().optional(),
});

export const AlegatosGlobalesOutputSchema = z.object({
  alegatoGlobal: z.string().describe(
    'Alegato de cierre integral: introducción, desarrollo argumental cruzando todos los testimonios, y conclusión petitoria a favor de la parte representada.'
  ),
  puntosFuertes: z.array(z.string()).describe('Bullets de los argumentos más sólidos del alegato.'),
  debilidadesContraria: z
    .array(z.string())
    .describe('Puntos débiles de la contraria evidenciados en los testimonios.'),
});

export type AlegatosGlobalesInput = z.infer<typeof AlegatosGlobalesInputSchema>;
export type AlegatosGlobalesOutput = z.infer<typeof AlegatosGlobalesOutputSchema>;

export async function generarAlegatosGlobales(
  input: AlegatosGlobalesInput
): Promise<AlegatosGlobalesOutput> {
  return alegatosGlobalesFlow(input);
}

const alegatosGlobalesPrompt = ai.definePrompt({
  name: 'alegatosGlobalesPrompt',
  input: { schema: AlegatosGlobalesInputSchema },
  output: { schema: AlegatosGlobalesOutputSchema },
  prompt: `Sos abogado litigante argentino redactando el ALEGATO DE CIERRE GLOBAL de una audiencia.

Ya se cerraron TODOS los testimonios. Debés integrar lo declarado por cada declarante en un único discurso coherente, persuasivo y listo para leer en audiencia o adaptar al escrito.

REGLAS:
- Redactá SIEMPRE a favor de la parte que representamos (ver "Nuestra representación").
- No repitas testimonios uno por uno como transcripción: sintetizá, conectá, argumentá.
- Usá admisiones, contradicciones y puntos débiles de testigos contrarios cuando aparezcan en el material.
- Estructura sugerida del alegatoGlobal: (1) introducción y objeto, (2) hechos probados en audiencia, (3) análisis por ejes temáticos cruzando declarantes, (4) refutación de la línea contraria, (5) conclusión y petitorio.
- Tono profesional, oral pero preciso. Párrafos claros, sin markdown.
- Adaptá terminología al fuero (civil: actor/demandado; penal: defensa/fiscalía/imputado).

{{#if caratula}}**Carátula:** {{caratula}}{{/if}}

**Nuestra representación:**
{{{representacionContexto}}}

**Contexto del expediente:**
{{{expedienteContexto}}}

**Testimonios completos de la audiencia (todos los declarantes):**
{{{testimoniosAudienciaTexto}}}

Generá el alegato global integrado y los bullets de puntos fuertes y debilidades contrarias.`,
});

const alegatosGlobalesFlow = ai.defineFlow(
  {
    name: 'alegatosGlobalesFlow',
    inputSchema: AlegatosGlobalesInputSchema,
    outputSchema: AlegatosGlobalesOutputSchema,
  },
  async (input) => {
    const { output } = await alegatosGlobalesPrompt(input);
    return output!;
  }
);
