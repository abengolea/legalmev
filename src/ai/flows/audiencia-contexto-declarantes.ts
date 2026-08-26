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
    .describe('5 a 8 preguntas literales listas para formular a este declarante.'),
});

export const ExtraerDeclarantesContextoInputSchema = z.object({
  expedienteResumen: z.string().describe('Mapa breve del expediente ya analizado.'),
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
  prompt: `Sos copiloto litigante en una audiencia argentina. El expediente YA fue leído. El abogado pegó notas extra (lista de testigos y de qué va cada uno).

Tu ÚNICA tarea: extraer los declarantes de esas notas y armar preguntas a formular.

REGLAS:
- Incluí a TODA persona nombrada en las notas del abogado, aunque no esté en el resumen del expediente.
- Si un nombre ya figura en "Ya cargados", igual devolvelo (para completar rol, relevancia y preguntas).
- No inventes personas que el abogado no haya nombrado.
- Para cada uno: nombre, rol, relevancia (de qué va), parteProcesal, y 5 a 8 preguntasSugeridas literales, breves, litigables, a favor de la parte que representamos.

**Nuestra representación:**
{{{representacionContexto}}}

**Mapa del expediente (ya analizado):**
{{{expedienteResumen}}}

**Ya cargados en esta audiencia:**
{{{testigosYaCargados}}}

**Notas / lista del abogado:**
{{{contextoAdicionalAbogado}}}

Devolvé testigosIdentificados completo.`,
});
