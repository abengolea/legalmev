import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { normalizeTokenUsage, type AiFlowResult } from '@/lib/ai-token-usage';

const DeclaranteDesdeContextoSchema = z.object({
  nombre: z.string(),
  rol: z.string(),
  relevancia: z.string().describe('De qué va este declarante y qué se espera de su testimonio.'),
  parteProcesal: z.enum(['actor', 'demandado', 'defensa', 'fiscalia', 'neutro', 'desconocido']),
  preguntasSugeridas: z
    .array(z.string())
    .describe(
      '5 a 8 preguntas literales alineadas al eje estratégico; al menos 2 no obvias pero todavía dentro del eje.'
    ),
});

export const ExtraerDeclarantesContextoInputSchema = z.object({
  ejeEstrategico: z
    .string()
    .describe('Eje estratégico, objeto y puntos controvertidos ya analizados. No es el expediente completo.'),
  representacionContexto: z.string(),
  contextoAdicionalAbogado: z.string(),
  testigosYaCargados: z.string().describe('Nombres ya cargados en la audiencia, si hay.'),
});

export const ExtraerDeclarantesContextoOutputSchema = z.object({
  testigosIdentificados: z.array(DeclaranteDesdeContextoSchema),
});

export type ExtraerDeclarantesContextoInput = z.infer<typeof ExtraerDeclarantesContextoInputSchema>;
export type ExtraerDeclarantesContextoOutput = z.infer<typeof ExtraerDeclarantesContextoOutputSchema>;

export async function extraerDeclarantesDesdeContexto(
  input: ExtraerDeclarantesContextoInput
): Promise<AiFlowResult<ExtraerDeclarantesContextoOutput>> {
  const response = await extraerDeclarantesContextoPrompt(input);
  const output = response.output;
  if (!output?.testigosIdentificados?.length) {
    throw new Error(
      'La IA no identificó declarantes en el contexto. Revisá que la lista tenga nombres claros.'
    );
  }
  return {
    output,
    usage: normalizeTokenUsage(response.usage),
  };
}

const extraerDeclarantesContextoPrompt = ai.definePrompt({
  name: 'extraerDeclarantesContextoPrompt',
  input: { schema: ExtraerDeclarantesContextoInputSchema },
  output: { schema: ExtraerDeclarantesContextoOutputSchema },
  prompt: `Sos copiloto litigante en una audiencia argentina. El expediente YA fue leído: NO lo releyés. Trabajás SOLO con el eje estratégico del caso y las notas del abogado.

Tu tarea: extraer los declarantes de las notas y armar preguntas a formular.

REGLAS DE DECLARANTES:
- Incluí a TODA persona nombrada en las notas del abogado.
- Si un nombre ya figura en "Ya cargados", igual devolvelo (rol, relevancia y preguntas).
- No inventes personas que el abogado no haya nombrado.

REGLAS DE PREGUNTAS (obligatorio):
- TODA pregunta debe servir al EJE ESTRATÉGICO. Descartá lo que se desvíe (anécdotas, trámites, hechos que no mueven ese eje).
- 5 a 8 preguntasSugeridas por declarante, literales, breves, listas para leer.
- La mayoría: las que un litigante atento haría sobre ese eje.
- Al menos 2 deben ser NO OBVIAS: ángulos que suelen pasarse por alto (omisión, cadena de conocimiento, contradicción futura, hecho periférico que cierra el eje). Siguen siendo del eje, no ocurrencias sueltas.
- A favor de la parte que representamos.

**Nuestra representación:**
{{{representacionContexto}}}

**Eje estratégico del caso (única brújula; no hay expediente completo):**
{{{ejeEstrategico}}}

**Ya cargados en esta audiencia:**
{{{testigosYaCargados}}}

**Notas / lista del abogado:**
{{{contextoAdicionalAbogado}}}

Devolvé testigosIdentificados completo.`,
});
