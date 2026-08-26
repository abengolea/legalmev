import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { normalizeTokenUsage, type AiFlowResult } from '@/lib/ai-token-usage';

export const ExpedienteAnalysisInputSchema = z.object({
  expedienteTexto: z.string().describe('Texto completo del expediente judicial exportado.'),
  representacionContexto: z
    .string()
    .optional()
    .describe('Parte representada y objetivo estratégico del abogado, si se reanaliza el caso.'),
  testimoniosAudienciaContexto: z
    .string()
    .optional()
    .describe('Resumen de lo declarado en audiencia hasta el momento, si existe.'),
  contextoAdicionalAbogado: z
    .string()
    .optional()
    .describe(
      'Notas extra del abogado: de qué va la causa, lista de testigos de la audiencia y qué se espera de cada uno. No es un alta manual de testigos sueltos.'
    ),
});

export const DeclaracionPreviaSchema = z.object({
  nombre: z.string(),
  rol: z.string(),
  resumen: z.string(),
});

export const ExpedienteAnalysisOutputSchema = z.object({
  tipoFuero: z
    .enum(['civil', 'penal', 'laboral', 'otro'])
    .describe(
      'Materia del proceso: civil (daños, contratos, familia civil, etc.), penal (causa penal, imputado, fiscalía), laboral u otro.'
    ),
  resumen: z.string().describe('Resumen ejecutivo del expediente en 3-5 oraciones.'),
  caratula: z.string().optional(),
  actor: z
    .string()
    .optional()
    .describe('Civil: actor/demandante. Penal: Fiscalía o Ministerio Público.'),
  demandado: z
    .string()
    .optional()
    .describe('Civil: demandado. Penal: imputado(s) o parte defendida.'),
  objetoLitigio: z.string().describe('Objeto del litigio y pretensión principal.'),
  hechosCentrales: z.array(z.string()),
  pruebaDocumentalClave: z.array(z.string()),
  periciasResumen: z.array(z.string()),
  declaracionesPrevias: z.array(DeclaracionPreviaSchema),
  teoríaActor: z
    .string()
    .describe('Civil: teoría del actor. Penal: teoría o línea de la fiscalía.'),
  teoríaDemandado: z
    .string()
    .describe('Civil: teoría del demandado. Penal: teoría de la defensa.'),
  puntosControvertidos: z.array(z.string()),
  ejeEstrategico: z
    .string()
    .optional()
    .describe(
      'Cuando hay representación del abogado: cómo entendiste su objetivo y qué eje prioriza el caso desde su posición.'
    ),
  testigosIdentificados: z.array(
    z.object({
      nombre: z.string(),
      rol: z.string(),
      relevancia: z.string(),
      parteProcesal: z
        .enum(['actor', 'demandado', 'defensa', 'fiscalia', 'neutro', 'desconocido'])
        .describe(
          'Civil: actor o demandado. Penal: defensa (propuesto por/defensor del imputado) o fiscalia (propuesto por el MP). neutro: perito u oficial. desconocido si no se determina.'
        ),
      preguntasSugeridas: z
        .array(z.string())
        .optional()
        .describe(
          'Preguntas literales a formular a este declarante en audiencia (6 a 10), listas para leer.'
        ),
    })
  ),
});
export type ExpedienteAnalysisInput = z.infer<typeof ExpedienteAnalysisInputSchema>;
export type ExpedienteAnalysisOutput = z.infer<typeof ExpedienteAnalysisOutputSchema>;

export async function analyzeExpediente(
  input: ExpedienteAnalysisInput
): Promise<AiFlowResult<ExpedienteAnalysisOutput>> {
  const response = await expedienteAnalysisPrompt(input);
  return {
    output: response.output!,
    usage: normalizeTokenUsage(response.usage),
  };
}

const expedienteAnalysisPrompt = ai.definePrompt({
  name: 'expedienteAnalysisPrompt',
  input: { schema: ExpedienteAnalysisInputSchema },
  output: { schema: ExpedienteAnalysisOutputSchema },
  prompt: `Sos un abogado litigante experto en derecho argentino. Leé el expediente completo y construí un mapa estratégico del caso.

PRIMERO determiná tipoFuero: civil, penal, laboral u otro según la naturaleza del expediente (causa penal con imputado/fiscalía = penal; daños, contratos, familia sin fuero penal = civil).

Debés entender de qué va el expediente: partes, conflicto, hechos, prueba existente y declaraciones previas de testigos.

Identificá todos los testigos o declarantes mencionados (indagatoria, declaración testimonial previa, pericia, etc.) para que el abogado pueda trabajar declaración por declaración en audiencia.

Para cada testigo, indicá parteProcesal según el fuero:
- CIVIL: actor o demandado (quién lo propuso o a qué parte pertenece).
- PENAL: defensa (testigo de la defensa / imputado) o fiscalia (testigo del MP / fiscalía).
- neutro: perito, oficial de justicia u otro tercero.
- desconocido: no se puede determinar.

En causas PENALES: completá actor con Fiscalía/MP y demandado con imputado(s). teoríaActor = línea fiscal; teoríaDemandado = línea defensa.

{{#if representacionContexto}}
**REANÁLISIS ESTRATÉGICO (prioritario):**
El abogado ya indicó a quién representa y su objetivo. NO repitas un resumen neutral: reencuadrá TODO el mapa del caso desde ESA posición.

- resumen: enfocá en lo que importa para la parte que representamos y el objetivo estratégico.
- objetoLitigio: reformulá destacando la pretensión o defensa relevante para nuestro cliente.
- puntosControvertidos: ordená y redactá priorizando los ejes útiles para nuestro objetivo (máx. 5).
- ejeEstrategico (OBLIGATORIO): 2-4 oraciones confirmando cómo entendiste el objetivo del abogado y cuál es el eje central del litigio desde su posición.
- teoríaActor / teoríaDemandado (o fiscalía/defensa en penal): enfatizá la línea de nuestra parte.

**Representación y objetivo del abogado:**
{{{representacionContexto}}}

{{#if testimoniosAudienciaContexto}}
**Lo ya declarado en esta audiencia (incorporá al reencuadre):**
{{{testimoniosAudienciaContexto}}}
{{/if}}
{{/if}}

{{#if contextoAdicionalAbogado}}
**CONTEXTO ADICIONAL DEL ABOGADO (prioridad máxima para declarantes y preguntas):**
El abogado pegó notas extra: de qué va la causa y/o la lista de quienes declaran.

OBLIGATORIO:
- Incluí en testigosIdentificados a TODAS las personas que el abogado nombre en estas notas, aunque no figuren en el expediente. Las notas del abogado mandan.
- No omitas un testigo de la lista: si hay 4 nombres, deben ser 4 entradas (más los del expediente que no estén en la lista).
- Para CADA testigoIdentificado completá preguntasSugeridas: 6 a 10 preguntas literales, concretas, listas para formular en audiencia, según de qué va ese declarante y la representación.
- relevancia: de qué va ese testigo (hechos que puede acreditar, relación con las partes).

{{{contextoAdicionalAbogado}}}
{{else}}
Para cada testigoIdentificado del expediente, si podés, incluí preguntasSugeridas (6 a 10 preguntas literales a formular).
{{/if}}

**Expediente:**
{{{expedienteTexto}}}

Generá el análisis estructurado.`,
});

const expedienteAnalysisFlow = ai.defineFlow(
  {
    name: 'expedienteAnalysisFlow',
    inputSchema: ExpedienteAnalysisInputSchema,
    outputSchema: ExpedienteAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await expedienteAnalysisPrompt(input);
    return output!;
  }
);
