import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { normalizeTokenUsage, type AiFlowResult } from '@/lib/ai-token-usage';

export const AudienciaCopilotInputSchema = z.object({
  expedienteContexto: z.string().describe(
    'Resumen estructurado del expediente: partes, hechos, teorías, prueba y declaraciones previas.'
  ),
  representacionContexto: z.string().describe(
    'A qué parte representa el abogado y objetivo estratégico procesal.'
  ),
  declaranteNombre: z.string(),
  declaranteRol: z.string(),
  contextoDeclarante: z.string().describe(
    'Descripción del abogado sobre quién es el testigo, su relación con el caso y qué se espera de su declaración.'
  ),
  testimonioPrevio: z.string().describe(
    'Declaraciones o testimonios previos de este declarante en el expediente.'
  ),
  intercambiosTexto: z.string().describe('Preguntas y respuestas formateadas de la audiencia actual.'),
});
export type AudienciaCopilotInput = z.infer<typeof AudienciaCopilotInputSchema>;

const AlertaSchema = z.object({
  tipo: z.enum(['roja', 'amarilla', 'azul']),
  mensaje: z.string(),
  detalle: z.string().optional(),
});

const RepreguntaSchema = z.object({
  texto: z.string().describe('Pregunta literal lista para leer en audiencia.'),
  destinatario: z
    .enum(['testigo', 'todos'])
    .describe(
      'testigo = dirigida solo al declarante activo; todos = pregunta general a quienes están en audiencia.'
    ),
});

export const AudienciaCopilotOutputSchema = z.object({
  alertas: z.array(AlertaSchema),
  repreguntas: z.array(RepreguntaSchema).describe(
    'Preguntas concretas sugeridas para formular ahora, con destinatario.'
  ),
  preguntasIneludibles: z.array(z.string()),
  contradicciones: z.array(z.string()),
  admisiones: z.array(z.string()),
  evasivas: z.array(z.string()),
  observacionUltimaRespuesta: z.string().optional(),
  conclusiones: z.array(z.string()).describe(
    'Conclusiones provisionales sobre lo declarado hasta el momento.'
  ),
  estrategia: z.string().describe('Estrategia recomendada para el resto de la declaración.'),
  borradorAlegato: z.string().describe(
    'Borrador de alegato o argumentación basado en lo declarado y el expediente.'
  ),
});

export type AudienciaCopilotOutput = z.infer<typeof AudienciaCopilotOutputSchema>;

export async function analyzeAudiencia(
  input: AudienciaCopilotInput
): Promise<AiFlowResult<AudienciaCopilotOutput>> {
  const response = await audienciaCopilotPrompt(input);
  return {
    output: response.output!,
    usage: normalizeTokenUsage(response.usage),
  };
}

const audienciaCopilotPrompt = ai.definePrompt({
  name: 'audienciaCopilotPrompt',
  input: { schema: AudienciaCopilotInputSchema },
  output: { schema: AudienciaCopilotOutputSchema },
  prompt: `Sos copiloto litigante en una audiencia judicial argentina.

Ya conocés el expediente completo. El abogado está interrogando a un declarante y va anotando manualmente cada pregunta y respuesta.

Tu trabajo: asistir al abogado desde LA POSICIÓN PROCESAL DE SU CLIENTE — sugerir preguntas, sacar conclusiones, alertar contradicciones y armar borradores de alegato SIEMPRE a favor de la parte que representamos.

El contexto del expediente indica el FUERO (civil o penal). En causas penales usá terminología de defensa/fiscalía e imputado; en civiles, actor/demandado.

REGLA FUNDAMENTAL: Leé primero "Nuestra representación". Toda salida debe alinearse con defender a nuestro cliente y perjudicar argumentalmente a la contraria. Las admisiones útiles son las que favorecen a nuestro cliente; las contradicciones a destacar son las de la contraria o las que fortalecen nuestra teoría del caso.

FUNCIONES:
1. Detectar contradicciones entre las respuestas actuales y: expediente, demanda, contestación, documental, pericias, testimonio previo de este declarante, o respuestas anteriores en esta audiencia.
2. Detectar evasivas, omisiones y ambigüedades en la última respuesta.
3. Identificar admisiones relevantes.
4. Proponer repreguntas concretas, breves y litigables (preguntas literales listas para leer en audiencia). Para cada una indicá destinatario: "testigo" si va solo al declarante activo, "todos" si es pregunta general a quienes están en audiencia (partes, letrados, juez). Si aún NO hay preguntas registradas, devolvé un plan de interrogatorio completo: 6 a 10 repreguntas listas para usar con este declarante (según quién es, de qué va y nuestra estrategia), más 3 a 6 preguntasIneludibles.
5. Listar preguntas ineludibles antes de cerrar esta declaración.
6. Alertas: ROJA (contradicción/admisión), AMARILLA (evasiva/incompleta), AZUL (tema no explorado).
7. Sacar conclusiones provisionales sobre lo declarado hasta el momento (2-4 bullets concretos).
8. Indicar estrategia para el resto de la declaración.
9. borradorAlegato: devolvé siempre cadena vacía "". Los alegatos finales se arman al cerrar todos los testimonios.

PRIORIDAD: estrategia de litigio a favor de NUESTRO cliente — contradicciones útiles, admisiones favorables, preguntas clave y material para alegatos.

---

**Nuestra representación (parte que defendemos):**
{{{representacionContexto}}}

**Contexto del expediente:**
{{{expedienteContexto}}}

**Declarante actual:** {{declaranteNombre}} ({{declaranteRol}})

**Quién es este testigo (notas del abogado):**
{{{contextoDeclarante}}}

**Testimonio previo de este declarante:**
{{{testimonioPrevio}}}

**Preguntas y respuestas en esta audiencia:**
{{{intercambiosTexto}}}

Generá sugerencias actualizadas.`,
});

const audienciaCopilotFlow = ai.defineFlow(
  {
    name: 'audienciaCopilotFlow',
    inputSchema: AudienciaCopilotInputSchema,
    outputSchema: AudienciaCopilotOutputSchema,
  },
  async (input) => {
    const { output } = await audienciaCopilotPrompt(input);
    return output!;
  }
);
