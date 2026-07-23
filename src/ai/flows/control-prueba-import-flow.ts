import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  estimateTokenUsageFromChars,
  extractUsageFromAiResponse,
  type AiFlowResult,
} from '@/lib/ai-token-usage';

/** Estados que la IA puede sugerir según tipo (unión de los sets del producto). */
const ESTADOS_SUGERIDOS_IMPORT = [
  // Prueba genérica / documental / confesional-testimonial
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'exhibicion_parcial',
  'apercibimiento_en_contra',
  'autenticidad_impugnada',
  'valoracion_judicial',
  'producida',
  'desistida',
  'no_admitida',
  // Pericial
  'perito_designado',
  'puntos_trasladados',
  'dictamen_presentado',
  'en_discusion',
  // Informativa / diligencia genérica
  'pendiente',
  'presentado',
  'observado',
  'librado',
  'diligenciado',
  'contestado',
  'contestacion_parcial',
  'cumplido',
  'vencido',
  // Comunicaciones especiales (cédula / oficio electrónico)
  'pendiente_realizacion',
  'presentada',
  'observada',
  'librada',
  'retirada',
  'pendiente_diligenciamiento',
  'notificada',
  'resultado_negativo',
  'librada_notificada',
  // Evento de audiencia (hijo)
  'programada',
  'realizada',
  'suspendida',
  'reprogramada',
  'cancelada',
  // Mejor proveer
  'ordenada',
  'en_cumplimiento',
  'cumplida',
  'incumplida',
  'dispensada',
] as const;

const ControlItemSchema = z.object({
  categoria: z
    .enum(['prueba', 'diligencia', 'audiencia', 'mejor_proveer'])
    .describe(
      'prueba = medios ofrecidos/admitidos (documental, pericial, informativa, confesional, testimonial…). diligencia = comunicaciones instrumentales. audiencia = SOLO eventos procesales (vista de causa, mediación…), NUNCA confesional/testimonial ofrecidas. mejor_proveer = medidas ordenadas por el juez.',
    ),
  tipo: z.string().describe('Subtipo válido según categoría.'),
  descripcion: z.string().describe('Descripción concreta del ítem tal como figura en el auto de apertura o escrito.'),
  ofrecidaPor: z
    .enum(['actor', 'demandado', 'tercero', 'tribunal'])
    .optional()
    .describe(
      'Prueba (documental, informativa, confesional, testimonial…): actor o demandado — quien OFRECIÓ el medio (aunque el tribunal libre el oficio). Pericial de oficio: tribunal. Diligencias: tribunal (salvo pedido de libramiento de la parte). Mejor proveer: tribunal. NUNCA poner tribunal en informativa.',
    ),
  fechaLimite: z
    .string()
    .optional()
    .describe('YYYY-MM-DD: plazo de exhibición, contestación de oficio o fecha de audiencia si consta.'),
  observaciones: z
    .string()
    .optional()
    .describe(
      'Contexto procesal breve: acto que originó el ítem, impugnación, intimación, listado de documentos. NO poner aquí el destinatario del oficio (usar destinatarioOficio).',
    ),
  actoOrigen: z
    .string()
    .optional()
    .describe('Referencia al acto (ej. "Auto apertura a prueba 12/03/2024", "Contestación de demanda").'),
  estadoSugerido: z
    .enum(ESTADOS_SUGERIDOS_IMPORT)
    .optional()
    .describe(
      'Estado más avanzado que conste. documental acompañada sin impugnación → producida. autenticidad impugnada → autenticidad_impugnada. documental_en_poder: intimación → intimacion_ordenada; parcial → exhibicion_parcial; apercibimiento → apercibimiento_en_contra. confesional/testimonial con fecha → audiencia_fijada. informativa: pendiente|presentado|observado|librado|diligenciado|contestacion_parcial|producida (NUNCA contestado ni cumplido). pericial: pendiente_produccion|perito_designado|puntos_trasladados|dictamen_presentado|en_discusion|producida. diligencia: pendiente|presentado|librado|diligenciado|contestado|cumplido. cédula/oficio electrónico: pendiente_realizacion|presentada|librada|notificada|librada_notificada.',
    ),
  impugnacionAutenticidad: z
    .boolean()
    .optional()
    .describe(
      'true si la contraparte negó/impugnó la AUTENTICIDAD de documental ya acompañada (demanda/contestación). Dispara oficios de autenticidad (hijos del documental).',
    ),
  intimacionOrdenada: z
    .boolean()
    .optional()
    .describe(
      'true si el tribunal ya ordenó intimación a la contraparte para exhibir documental_en_poder. El sistema crea UNA cédula automáticamente — NO crear ítem diligencia/cedula manual.',
    ),
  destinatarioOficio: z
    .string()
    .optional()
    .describe(
      'Destinatario del oficio: banco, registro, juzgado, AFIP, etc. Usar en prueba informativa o en oficios de autenticidad. Campo obligatorio cuando hay destinatario (no ponerlo solo en observaciones).',
    ),
  oficioVinculadoA: z
    .string()
    .optional()
    .describe(
      'Si categoria=diligencia y tipo=oficio hijo: descripción breve de la prueba padre (p. ej. documental impugnada) a la que instrumenta.',
    ),
  parteConDocumentos: z
    .enum(['actor', 'demandado', 'tercero'])
    .optional()
    .describe(
      'Solo documental_en_poder: parte que detenta los documentos. Un ítem por par (oferente → detentador).',
    ),
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
      'SOLO si categoria=prueba y tipo=testimonial: testigos ofrecidos en demanda o contestación. No inventar nombres.',
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
      pendiente: z
        .array(z.string())
        .optional()
        .describe('Prueba ya en trámite esperando respuesta externa (oficio librado sin contestar, etc.).'),
      aLibrar: z
        .array(z.string())
        .optional()
        .describe('Acciones a iniciar: oficios/comunicaciones que faltan presentar o librar.'),
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
        yaLibrado: z
          .boolean()
          .optional()
          .describe(
            'OBLIGATORIO indicar cuando conste: true si el tribunal YA libró el oficio en el trámite; false si aún falta librarlo.',
          ),
        observaciones: z.string().optional(),
      }),
    )
    .optional()
    .describe(
      'Lista de oficios de autenticidad por documental negada. Completar yaLibrado en cada uno (true=ya librado, false=pendiente de librar).',
    ),
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

━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCIPIO RECTOR (antes de procesar cualquier ítem):
Elegí **siempre** el estado más avanzado que conste en el texto. Si el oficio ya fue contestado → producida (informativa), no librado. Si hay audiencia fijada → audiencia_fijada, no pendiente_produccion. Si la documental obra en autos sin impugnación → producida, no pendiente_produccion. No dejes “a medio camino” lo que el escrito ya resolvió.
━━━━━━━━━━━━━━━━━━━━━━━━━━

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
5. Actos que fijen audiencia de prueba, intimaciones de exhibición, oficios de autenticidad, medidas de mejor proveer

## LO QUE NO ES PRUEBA OFRECIDA (NO INCLUIR)
- Providencias, traslados, vistas, sentencias, recursos, manifestaciones, "tiene presente", "agrega"
- Impugnaciones a informes periciales, descargos del perito (van como trámite interno si ya existe la pericia; no crear ítems sueltos de “impugna”)
- Solicitudes al tribunal ("solicita reiteración", "solicita resolución integral")
- **Documental que una parte acompaña durante el trámite** (ej. "actor acompaña anexo", "acompaña contestación de oficio") — NO es prueba ofrecida en apertura
- Presentación de dictamen pericial ya producido (actualizá el estado de la pericia madre a dictamen_presentado / producida; no creés ítem nuevo)
- **Documentación formal / instrumental (NO sustancial al objeto del juicio)** — EXCLUIR siempre:
  - Fotocopias o copias de DNI / documento de identidad de las partes o letrados
  - Constancia de CUIT / CUIL del abogado o del estudio
  - Anticipo / pago de jus previsional
  - Bono ley 8480 (u otras tasas/bonos de actuación)
  - Tasa de justicia, personería, matrícula profesional, poderes y acreditaciones formales similares
  Solo incluir documental **sustancial** (contratos, comunicaciones, historias clínicas, comprobantes de hechos, etc.)

## CATEGORÍAS Y UBICACIÓN EN EL TABLERO

### 1. prueba (Prueba ofrecida)
Tipos válidos: documental, documental_en_poder, pericial, informativa, inspeccion, otra, **confesional**, **testimonial**
ofrecidaPor: **actor o demandado** (quien ofreció el medio). Excepción: pericial de oficio del tribunal → ofrecidaPor: tribunal.

**A) documental** — Documentación **sustancial** que la parte **ya presentó** con demanda, contestación o ampliaciones (obra en autos).
- **UN ÍTEM POR CADA PIEZA SUSTANCIAL** (Doc. 1, Doc. 2…): resumen de cuenta, e-mail, carta documento, contrato, etc. Usar referenciaDocumental.
- **NO** crear ítems por DNI, CUIT del letrado, jus previsional, bono ley u otras piezas formales.
- NO crear ítems por cada "acompaña documentación" posterior al auto de apertura.
- **Estado por defecto (muy importante):** si la pieza **obra en autos** y la contraparte **NO impugna/niega su autenticidad** → estadoSugerido: **producida** (ya está producida: acompañada e incorporada).
- Si en contestación/trámite la contraparte **niega o impugna la autenticidad**:
  - estadoSugerido: autenticidad_impugnada
  - impugnacionAutenticidad: true
  - destinatarioOficio: entidad que debe informar (ej. otro juzgado, banco, registro, ARBA)
  - agregar en oficiosAutenticidadPendientes con **yaLibrado: true** si el tribunal ya libró el oficio, **yaLibrado: false** si aún falta
  - **NO crear ítem informativa separado** — la documental negada queda en el mismo ítem documental
- **Nunca** dejar documental ya acompañada en pendiente_produccion salvo que exista impugnación de autenticidad u otra obstáculo explícito en autos.

**B) documental_en_poder** — Documentación en poder de la **contraparte**, ofrecida en apertura pero NO adjunta al escrito.
- **UN SOLO ÍTEM por par (oferente → parte detentadora)**. NO es “un solo ítem en todo el expediente”.
  - Actor ofrece y demandada detenta → 1 ítem (parteConDocumentos: demandado)
  - Demandado ofrece y actor detenta → **otro** ítem separado (parteConDocumentos: actor)
  - Si ambas partes ofrecen → pueden coexistir **2** ítems documental_en_poder
- En \`descripcion\`: título breve del ofrecimiento (ej. "Documental en poder de la demandada").
- Listá **todos** los documentos pedidos en observaciones como viñetas / "1. … 2. …" — el listado completo va en **ese** ítem del par.
- **PROHIBIDO** crear un ítem por cada documento individual (eso genera N intimaciones).
- Estados (elegí el más avanzado que conste):
  - Solo ofrecida, sin intimación → pendiente_produccion
  - Tribunal intimó a exhibir → intimacionOrdenada: true, estadoSugerido: **intimacion_ordenada**, fechaLimite = plazo
  - Acompañaron **parte** de lo intimado / faltan documentos → **exhibicion_parcial**
  - Venció el plazo sin acompañar / apercibimiento → **apercibimiento_en_contra**
- **PROHIBIDO** crear ítem diligencia/cedula de intimación a mano. El sistema crea **una** cédula automáticamente cuando intimacionOrdenada=true (o exhibicion_parcial).

**C) Prueba informativa admitida** — categoria=prueba, tipo=**informativa** (apartado Prueba). Medio originario (“se informa / se oficia a…”). Completar destinatarioOficio (campo propio, no en observaciones) y fechaLimite si hay plazo.
- **ofrecidaPor: actor o demandado** — quien la ofreció en demanda/contestación/apertura. **NUNCA** tribunal (el tribunal libera el oficio; la parte ofrece el medio).
- Estados válidos: pendiente → **presentado** → **observado** → librado → diligenciado → contestacion_parcial → **producida** (cierre exitoso). También vencido / valoracion_judicial.
- **PROHIBIDO** usar estado \`contestado\` o \`cumplido\` en informativa: el cierre exitoso es **producida**.
- **NO** registrarla como diligencia tipo oficio suelta en Comunicaciones.
- Los oficios **hijos** de autenticidad documental van aparte (oficiosAutenticidadPendientes / vinculo al documental), no como informativa.

**D) pericial, inspeccion, otra** — Según auto de apertura.
- "pericia de oficio", "pericia médica de oficio", "experticia de oficio", "experticia técnica", "pericia contable" = prueba **pericial** (categoria=prueba, tipo=pericial). **NO** es diligencia tipo oficio ni informativa.
- Estados pericial: pendiente_produccion → perito_designado → puntos_trasladados → dictamen_presentado → en_discusion → valoracion_judicial / producida. Usá el más avanzado que conste en autos.

**E) confesional y testimonial (MODELO B — muy importante)**
- Son **prueba ofrecida**: categoria=**prueba**, tipo=confesional | testimonial. Van en el bloque Prueba, NO en Audiencias fijadas.
- **NO** uses categoria=audiencia para la prueba ofrecida.
- Estados: pendiente_produccion | postpuesta_juez | **audiencia_fijada** | producida | valoracion_judicial | desistida | no_admitida.
- Si el tribunal **ya fijó fecha** de audiencia → estadoSugerido: **audiencia_fijada**, fechaLimite = fecha. El sistema crea solo el **evento hijo** en Audiencias; vos NO creés ese evento a mano.
- testimonial → completar \`testigos\` desde demanda/contestación (nombre + domicilio si consta). No inventar.

### 2. diligencia (Comunicaciones)
Tipos: oficio, cedula, mandamiento, exhorto, oficio_electronico, cedula_electronica
ofrecidaPor: tribunal (o parte si presentó el pedido)

Incluir oficios/cédulas **pendientes de control** que instrumenten:
- Autenticidad documental impugnada (preferir oficiosAutenticidadPendientes + yaLibrado; **no** crear informativa puente)
- Rogatorias / exhortos para pericia (comunicación al juzgado del domicilio del perito — NO confundir con la pericia en sí)

**PROHIBIDO** crear diligencia/cédula por intimación de documental_en_poder cuando intimacionOrdenada=true (o exhibicion_parcial): el sistema la crea sola.

**NO registrar como oficio en Comunicaciones:** la prueba informativa originaria (va en prueba/informativa), pericias, experticias, dictámenes periciales ni inspecciones — aunque digan "de oficio".

Estados:
- oficio/mandamiento/exhorto genéricos: pendiente | presentado | observado | librado | diligenciado | contestado | contestacion_parcial | cumplido | vencido
- cedula_electronica / oficio_electronico / cédulas especiales: pendiente_realizacion | presentada | observada | librada | librada_notificada | notificada | etc. según lo que conste

Para cada oficio indicar:
- destinatarioOficio (campo propio; ej. "Juzgado Civil y Comercial N° 2 de San Nicolás", "Banco X")
- fechaLimite si hay plazo de contestación
- observaciones: si es reiteratorio, si informa sobre autenticidad, etc. (NO el destinatario)

### 3. audiencia (SOLO eventos procesales — NO confesional/testimonial ofrecidas)
Tipos: audiencia, vista_causa, mediacion, audiencia_inicial, audiencia_preliminar, conciliacion, otra_audiencia
- **PROHIBIDO** poner confesional o testimonial aquí como prueba ofrecida (eso va en prueba).
- Usá esta categoría solo para audiencias procesales puras (vista de causa, mediación, audiencia inicial, etc.).
- Estados: programada | realizada | suspendida | reprogramada | cancelada.
- fechaLimite = fecha si está fijada → estadoSugerido: programada

### 4. mejor_proveer
Tipos: documentacion, informacion, comparendo, prueba_adicional, otra
- Solo si el juez ordenó una medida de mejor proveer.
- Estados: ordenada | en_cumplimiento | cumplida | incumplida | dispensada.
- ofrecidaPor: tribunal

## EJEMPLO DE RAZONAMIENTO (autenticidad documental)
Si en autos: actor acompañó contrato con la demanda; demandado en contestación niega autenticidad; tribunal ordena oficio al juzgado donde se otorgó la escritura:
1. Ítem prueba tipo documental (ofrecida en demanda) — NO duplicar cada "acompaña" posterior
2. estadoSugerido autenticidad_impugnada, destinatarioOficio = entidad oficiada
3. oficiosAutenticidadPendientes con yaLibrado true/false según conste el libramiento
4. **No** duplicar como prueba informativa suelta

Si el mismo contrato **no** fue impugnado en autenticidad:
1. Ítem documental con estadoSugerido **producida** (obra en autos, ya producida)

## EJEMPLO (documental en poder)
Si en auto/demanda se ofrece documental en poder de la demandada con muchos documentos:
- **Un solo** ítem tipo documental_en_poder para ese par, parteConDocumentos demandado
- Si además el demandado ofrece documental en poder del actor → **segundo** ítem, parteConDocumentos actor
- observaciones: listado completo numerado
- Si el juez intimó → intimacionOrdenada true, fechaLimite = vencimiento, estado intimacion_ordenada — **sin** ítem cédula manual
- **Incorrecto:** N ítems (uno por documento) o 1 ítem fusionando ambos pares

## EJEMPLO (confesional / testimonial — Modelo B)
Si el actor ofreció prueba confesional y testimonial, y el juez fijó audiencia para el 15/05/2025:
1. Ítem categoria=prueba tipo=confesional, estadoSugerido=audiencia_fijada, fechaLimite=2025-05-15
2. Ítem categoria=prueba tipo=testimonial, estadoSugerido=audiencia_fijada, fechaLimite=2025-05-15, testigos=[…]
3. **No** crear ítems categoria=audiencia para esas pruebas (el sistema crea el evento hijo)

## SALIDA
- Completar TODOS los metadatos disponibles
- **oficiosAutenticidadPendientes**: cada documental negada con destinatario + **yaLibrado** (true si ya librado, false si falta)
- **resumenEjecutivo**: producida = concluida; pendiente = en trámite esperando respuesta; aLibrar = acciones a iniciar (presentar/librar)
- Menos ítems pero **correctos** — no listar las 40+ actuaciones procesales del expediente
- informativa → ofrecidaPor = parte oferente (nunca tribunal)
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
