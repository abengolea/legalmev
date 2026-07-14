import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  estimateTokenUsageFromChars,
  extractUsageFromAiResponse,
  type AiFlowResult,
} from '@/lib/ai-token-usage';

const ControlItemSchema = z.object({
  categoria: z
    .enum(['prueba', 'diligencia', 'audiencia'])
    .describe(
      'SOLO medios probatorios OFRECIDOS/ADMITIDOS en demanda, contestación o auto de apertura; o comunicaciones (diligencias) que instrumentan prueba informativa.',
    ),
  tipo: z.string().describe('Subtipo válido según categoría.'),
  descripcion: z.string().describe('Descripción concreta del ítem tal como figura en el auto de apertura o escrito.'),
  ofrecidaPor: z
    .enum(['actor', 'demandado', 'tercero', 'tribunal'])
    .optional()
    .describe('Prueba/audiencia: actor o demandado. Diligencias: tribunal (salvo que la parte presentó el pedido de libramiento).'),
  fechaLimite: z
    .string()
    .optional()
    .describe('YYYY-MM-DD: plazo de exhibición, contestación de oficio o fecha de audiencia si consta.'),
  observaciones: z
    .string()
    .optional()
    .describe('Contexto procesal breve: acto que originó el ítem, impugnación, intimación, destinatario del oficio.'),
  actoOrigen: z
    .string()
    .optional()
    .describe('Referencia al acto (ej. "Auto apertura a prueba 12/03/2024", "Contestación de demanda").'),
  estadoSugerido: z
    .enum([
      'pendiente_produccion',
      'postpuesta_juez',
      'audiencia_fijada',
      'intimacion_ordenada',
      'autenticidad_impugnada',
      'valoracion_judicial',
      'producida',
      'desistida',
      'no_admitida',
    ])
    .optional()
    .describe(
      'Estado actual. documental YA acompañada sin impugnación de autenticidad → producida. documental con autenticidad impugnada → autenticidad_impugnada. documental_en_poder con intimación → intimacion_ordenada.',
    ),
  impugnacionAutenticidad: z
    .boolean()
    .optional()
    .describe(
      'true si la contraparte negó/impugnó la AUTENTICIDAD de documental ya acompañada (demanda/contestación). Dispara informativa + oficio.',
    ),
  intimacionOrdenada: z
    .boolean()
    .optional()
    .describe(
      'true si el tribunal ya ordenó intimación a la contraparte para exhibir documental_en_poder. Dispara cédula de intimación.',
    ),
  destinatarioOficio: z
    .string()
    .optional()
    .describe(
      'Destinatario del oficio: banco, registro, juzgado, AFIP, etc. Obligatorio en diligencias oficio vinculadas a informativa o autenticidad.',
    ),
  oficioVinculadoA: z
    .string()
    .optional()
    .describe(
      'Si categoria=diligencia y tipo=oficio: descripción de la prueba INFORMATIVA (categoría prueba) a la que instrumenta este oficio.',
    ),
  parteConDocumentos: z
    .enum(['actor', 'demandado', 'tercero'])
    .optional()
    .describe('Solo documental_en_poder: parte que tiene la documentación (normalmente la contraparte del oferente).'),
  referenciaDocumental: z
    .string()
    .optional()
    .describe(
      'Solo documental sustancial acompañada: referencia corta ej. "Doc. 1 — Resumen cuenta". Un ítem por pieza sustancial. NO usar para DNI, CUIT del letrado, jus previsional ni bono ley.',
    ),
  testigos: z
    .array(
      z.object({
        nombre: z.string().describe('Nombre completo del testigo tal como figura en el escrito.'),
        domicilio: z.string().optional().describe('Domicilio del testigo si consta en el escrito.'),
      }),
    )
    .optional()
    .describe(
      'SOLO si categoria=audiencia y tipo=testimonial: testigos ofrecidos en demanda o contestación. No inventar nombres.',
    ),
});

export const ControlPruebaImportInputSchema = z.object({
  expedienteTexto: z.string().describe('Texto del PDF del expediente o escritos.'),
});

export const ControlPruebaImportOutputSchema = z.object({
  caratula: z.string().optional().describe('Carátula completa del expediente.'),
  numeroExpediente: z.string().optional(),
  juzgado: z.string().optional().describe('Juzgado y número si constan (ej. Juzgado Civil y Comercial N° X de ...).'),
  fuero: z.string().optional(),
  actor: z.string().optional().describe('Nombre del actor/demandante.'),
  demandado: z.string().optional().describe('Nombre del demandado.'),
  resumenCaso: z.string().optional().describe('2-3 oraciones: objeto del juicio y estado actual de la prueba.'),
  autoAperturaPrueba: z.string().optional().describe('Fecha y/o extracto del auto de apertura a prueba.'),
  resumenEjecutivo: z
    .object({
      producida: z.array(z.string()).optional().describe('Prueba ya producida o concluida.'),
      pendiente: z.array(z.string()).optional().describe('Prueba pendiente de respuesta o verificación.'),
      aLibrar: z.array(z.string()).optional().describe('Oficios/comunicaciones que faltan librar.'),
      recomendaciones: z.array(z.string()).optional().describe('Sugerencias al abogado (ej. pericia ya cumplida).'),
    })
    .optional(),
  oficiosAutenticidadPendientes: z
    .array(
      z.object({
        referencia: z.string().optional().describe('Doc. 1, Doc. 2, etc.'),
        descripcionDocumento: z.string().describe('Documento cuya autenticidad fue negada.'),
        destinatarioOficio: z.string().describe('Entidad a oficiar (banco, Assist Card, Andreani, etc.).'),
        objetoOficio: z.string().optional(),
        yaLibrado: z.boolean().optional().describe('true si el oficio ya fue librado en el trámite.'),
        observaciones: z.string().optional(),
      }),
    )
    .optional()
    .describe('Lista de oficios de autenticidad a librar por documental negada (auto de apertura o contestación).'),
  items: z.array(ControlItemSchema),
  /** @deprecated compat */ pruebas: z.array(ControlItemSchema).optional(),
});

export type ControlPruebaImportInput = z.infer<typeof ControlPruebaImportInputSchema>;
export type ControlPruebaImportOutput = z.infer<typeof ControlPruebaImportOutputSchema>;

const controlPruebaImportPrompt = ai.definePrompt({
  name: 'controlPruebaImportPrompt',
  input: { schema: ControlPruebaImportInputSchema },
  output: { schema: ControlPruebaImportOutputSchema },
  prompt: `Sos un abogado litigante experto en derecho procesal civil y comercial de Argentina (SCBA / CPCC Ley 7425).

Tu tarea: armar el **control de prueba** del expediente — completar carátula, partes, juzgado y cada medio probatorio admitido, con su estado procesal y las comunicaciones (oficios/cédulas) pendientes o en trámite.

## METADATOS (completar siempre que consten en el texto)
- caratula, numeroExpediente, juzgado, fuero, actor, demandado
- autoAperturaPrueba (fecha)
- resumenCaso: objeto del juicio + estado de la prueba

## FUENTES VÁLIDAS PARA ÍTEMS DE PRUEBA
Extraé ítems **únicamente** de:
1. **Demanda** — prueba ofrecida por el actor
2. **Contestación de demanda** — prueba ofrecida por el demandado
3. **Auto de apertura a prueba** — prueba admitida/denegada/modificada
4. Resoluciones que **modifiquen** el objeto de prueba del auto de apertura

## LO QUE NO ES PRUEBA OFRECIDA (NO INCLUIR)
- Providencias, traslados, vistas, sentencias, recursos, manifestaciones, "tiene presente", "agrega"
- Impugnaciones a informes periciales, descargos del perito
- Solicitudes al tribunal ("solicita reiteración", "solicita resolución integral")
- **Documental que una parte acompaña durante el trámite** (ej. "actor acompaña anexo", "acompaña contestación de oficio") — NO es prueba ofrecida en apertura
- Presentación de dictamen pericial ya producido
- **Documentación formal / instrumental (NO sustancial al objeto del juicio)** — EXCLUIR siempre:
  - Fotocopias o copias de DNI / documento de identidad de las partes o letrados
  - Constancia de CUIT / CUIL del abogado o del estudio
  - Anticipo / pago de jus previsional
  - Bono ley 8480 (u otras tasas/bonos de actuación)
  - Tasa de justicia, personería, matrícula profesional, poderes y acreditaciones formales similares
  Solo incluir documental **sustancial** (contratos, comunicaciones, historias clínicas, comprobantes de hechos, etc.)

## TRES CATEGORÍAS

### 1. prueba
Tipos válidos: documental, documental_en_poder, pericial, inspeccion, otra
ofrecidaPor: **solo actor o demandado**

**A) documental** — Documentación **sustancial** que la parte **ya presentó** con demanda, contestación o ampliaciones (obra en autos).
- **UN ÍTEM POR CADA PIEZA SUSTANCIAL** (Doc. 1, Doc. 2…): resumen de cuenta, e-mail, carta documento, contrato, etc. Usar referenciaDocumental.
- **NO** crear ítems por DNI, CUIT del letrado, jus previsional, bono ley u otras piezas formales.
- NO crear ítems por cada "acompaña documentación" posterior al auto de apertura.
- **Estado por defecto (muy importante):** si la pieza **obra en autos** y la contraparte **NO impugna/niega su autenticidad** → estadoSugerido: **producida** (ya está producida: acompañada e incorporada).
- Si en contestación/trámite la contraparte **niega o impugna la autenticidad**:
  - estadoSugerido: autenticidad_impugnada
  - impugnacionAutenticidad: true
  - destinatarioOficio: entidad que debe informar (ej. otro juzgado, banco, registro, ARBA)
  - **NO crear ítem informativa separado** — la documental negada queda en el mismo ítem documental con oficios en oficiosAutenticidadPendientes
- **Nunca** dejar documental ya acompañada en pendiente_produccion salvo que exista impugnación de autenticidad u otra obstáculo explícito en autos.

**B) documental_en_poder** — Documentación en poder de la **contraparte**, ofrecida en apertura pero NO adjunta al escrito.
- **UN SOLO ÍTEM** por oferente + parte que detenta los documentos (casi siempre: actor ofrece → demandada detenta).
- En \`descripcion\`: título breve del ofrecimiento (ej. "Documental en poder de la demandada").
- Listá **todos** los documentos pedidos en observaciones o en la descripción como viñetas / "1. … 2. …" — el listado completo va en **un** ítem.
- **PROHIBIDO** crear un ítem por cada documento en poder de contraparte (eso genera N intimaciones; debe haber **una sola intimación** con el listado).
- parteConDocumentos: actor | demandado | tercero (quien tiene los documentos)
- Si el auto ya ordenó intimación con plazo → intimacionOrdenada: true, estadoSugerido: intimacion_ordenada, fechaLimite = plazo de exhibición.
- El sistema creará **una** cédula de intimación automáticamente.

**C) Prueba informativa admitida** — NO crear ítem prueba separado. Registrar como **diligencia tipo oficio** en Comunicaciones (ver abajo), con descripción del objeto probatorio en descripcion y oficioVinculadoA si aplica.

**D) pericial, inspeccion, otra** — Según auto de apertura.
- **IMPORTANTE:** "pericia de oficio", "pericia médica de oficio", "experticia de oficio" = prueba **pericial** ordenada por el tribunal (categoria=prueba, tipo=pericial). **NO** es diligencia tipo oficio.
- Solo usar categoria=diligencia tipo=oficio cuando se trata de una **comunicación judicial** al destinatario (banco, hospital, registro, etc.): "oficio al…", "oficio electrónico a…", "libramiento de oficio…".

### 2. diligencia (Comunicaciones)
Tipos: oficio, cedula, mandamiento, exhorto, oficio_electronico, cedula_electronica
ofrecidaPor: tribunal (o parte si presentó el pedido)

Incluir oficios/cédulas **pendientes de control** que instrumenten:
- Prueba informativa admitida (cada oficio como diligencia; oficioVinculadoA = objeto probatorio si hay documental vinculada)
- Intimación documental (si ya fue librada cédula, puede figurar como diligencia)
- Rogatorias / exhortos para pericia (comunicación al juzgado del domicilio del perito — NO confundir con la pericia en sí)

**NO registrar como oficio:** pericias, experticias, dictámenes periciales ni inspecciones — aunque digan "de oficio".

Para cada oficio indicar:
- destinatarioOficio (ej. "Juzgado Civil y Comercial N° 2 de San Nicolás", "Banco X")
- fechaLimite si hay plazo de contestación
- observaciones: si es reiteratorio, si informa sobre autenticidad, etc.

### 3. audiencia
Tipos: confesional, testimonial, audiencia, vista_causa, mediacion, audiencia_inicial
ofrecidaPor: actor o demandado
testimonial → completar testigos desde el ofrecimiento en demanda/contestación
fechaLimite = fecha de audiencia si está fijada → estadoSugerido: audiencia_fijada

## EJEMPLO DE RAZONAMIENTO (autenticidad documental)
Si en autos: actor acompañó contrato con la demanda; demandado en contestación niega autenticidad; tribunal ordena oficio al juzgado donde se otorgó la escritura:
1. Ítem prueba tipo documental (ofrecida en demanda) — NO duplicar cada "acompaña" posterior
2. Si consta la negación → estadoSugerido autenticidad_impugnada, destinatarioOficio = entidad oficiada, oficio en oficiosAutenticidadPendientes
3. **No** duplicar como prueba informativa suelta

Si el mismo contrato **no** fue impugnado en autenticidad:
1. Ítem documental con estadoSugerido **producida** (obra en autos, ya producida)

## EJEMPLO (documental en poder)
Si en auto/demanda se ofrece documental en poder de la demandada con muchos documentos (contrato, comunicaciones, historia clínica, protocolos…):
- **Un solo** ítem tipo documental_en_poder, parteConDocumentos demandado
- descripcion: "Documental en poder de la demandada"
- observaciones o cuerpo: listado completo numerado de todos los documentos
- Si el juez intimó a exhibir → intimacionOrdenada true, fechaLimite = vencimiento
- **Incorrecto:** 20 ítems documentales_en_poder (uno por documento)

## SALIDA
- Completar TODOS los metadatos disponibles
- **oficiosAutenticidadPendientes**: cada documental negada con destinatario concreto del oficio
- **resumenEjecutivo**: producida / pendiente / aLibrar / recomendaciones (breve, útil al abogado)
- Menos ítems pero **correctos** — no listar las 40+ actuaciones procesales del expediente
- No inventar prueba ni testigos

**Texto del expediente:**
{{{expedienteTexto}}}
`,
});

export async function extractControlPruebaFromText(
  input: ControlPruebaImportInput,
): Promise<AiFlowResult<ControlPruebaImportOutput>> {
  const response = await controlPruebaImportPrompt(input);
  const output = response.output!;
  let usage = extractUsageFromAiResponse(response);
  if (usage.totalTokens === 0) {
    // Genkit a veces no reporta usage; estimar para no perder el costo en el admin.
    usage = estimateTokenUsageFromChars(
      input.expedienteTexto.length,
      JSON.stringify(output).length,
    );
  }
  return { output, usage };
}
