import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';
import type {
  AudienciaIntercambio,
  AudienciaTestigo,
  BandejaDeclarante,
  DocumentoAdicionalAudiencia,
  ParteProcesalDeclarante,
  ParteRepresentada,
  RepresentacionCaso,
  TipoFuero,
} from '@/lib/audiencia-session-types';
import { redactSensitiveIdentifiers } from '@/lib/redact-identifiers';

const PARTE_LABEL_CIVIL: Record<string, string> = {
  actor: 'ACTOR (parte demandante)',
  demandado: 'DEMANDADO',
  otro: 'OTRA PARTE',
};

const PARTE_LABEL_PENAL: Record<string, string> = {
  defensa: 'DEFENSA (imputado / querellado)',
  fiscalia: 'FISCALÍA / MINISTERIO PÚBLICO',
  demandado: 'DEFENSA (imputado)',
  actor: 'FISCALÍA',
  otro: 'OTRA PARTE',
};

export function esFueroPenal(tipoFuero?: TipoFuero | null): boolean {
  return tipoFuero === 'penal';
}

export function tipoFueroLabel(tipoFuero?: TipoFuero | null): string {
  switch (tipoFuero) {
    case 'penal':
      return 'Penal';
    case 'laboral':
      return 'Laboral';
    case 'otro':
      return 'Otro fuero';
    default:
      return 'Civil';
  }
}

export function normalizarParteProcesal(
  parte: string,
  tipoFuero?: TipoFuero | null
): ParteProcesalDeclarante {
  if (esFueroPenal(tipoFuero)) {
    if (parte === 'defensa' || parte === 'demandado') return 'defensa';
    if (parte === 'fiscalia' || parte === 'actor') return 'fiscalia';
  } else {
    if (parte === 'defensa') return 'demandado';
    if (parte === 'fiscalia') return 'actor';
    if (parte === 'actor' || parte === 'demandado') return parte;
  }
  if (parte === 'neutro' || parte === 'desconocido') return parte;
  return 'desconocido';
}

function parteProcesalDeRepresentacion(
  parte: ParteRepresentada,
  tipoFuero?: TipoFuero | null
): ParteProcesalDeclarante | null {
  if (esFueroPenal(tipoFuero)) {
    if (parte === 'defensa' || parte === 'demandado') return 'defensa';
    if (parte === 'fiscalia' || parte === 'actor') return 'fiscalia';
    return null;
  }
  if (parte === 'actor') return 'actor';
  if (parte === 'demandado') return 'demandado';
  return null;
}

export function nombreClienteSugerido(
  parte: ParteRepresentada,
  expediente?: ExpedienteAnalysisOutput | null
): string {
  if (!expediente) return '';
  if (esFueroPenal(expediente.tipoFuero)) {
    if (parte === 'defensa' || parte === 'demandado') return expediente.demandado ?? '';
    if (parte === 'fiscalia' || parte === 'actor') return expediente.actor ?? '';
  } else {
    if (parte === 'actor') return expediente.actor ?? '';
    if (parte === 'demandado') return expediente.demandado ?? '';
  }
  return '';
}

export function formatExpedienteContexto(ctx: ExpedienteAnalysisOutput): string {
  const penal = esFueroPenal(ctx.tipoFuero);
  const lines = [
    `FUERO: ${tipoFueroLabel(ctx.tipoFuero)}`,
    `RESUMEN: ${ctx.resumen}`,
    ctx.caratula ? `CARÁTULA: ${ctx.caratula}` : '',
    penal
      ? ctx.actor
        ? `FISCALÍA / MP: ${ctx.actor}`
        : ''
      : ctx.actor
        ? `ACTOR: ${ctx.actor}`
        : '',
    penal
      ? ctx.demandado
        ? `IMPUTADO / DEFENSA: ${ctx.demandado}`
        : ''
      : ctx.demandado
        ? `DEMANDADO: ${ctx.demandado}`
        : '',
    `OBJETO: ${ctx.objetoLitigio}`,
    ctx.ejeEstrategico ? `EJE ESTRATÉGICO (según representación): ${ctx.ejeEstrategico}` : '',
    `HECHOS CENTRALES:\n${ctx.hechosCentrales.map((h) => `- ${h}`).join('\n')}`,
    `PRUEBA DOCUMENTAL:\n${ctx.pruebaDocumentalClave.map((p) => `- ${p}`).join('\n')}`,
    `PERICIAS:\n${ctx.periciasResumen.map((p) => `- ${p}`).join('\n')}`,
    penal
      ? `TEORÍA FISCALÍA: ${ctx.teoríaActor}\nTEORÍA DEFENSA: ${ctx.teoríaDemandado}`
      : `TEORÍA ACTOR: ${ctx.teoríaActor}\nTEORÍA DEMANDADO: ${ctx.teoríaDemandado}`,
    `PUNTOS CONTROVERTIDOS:\n${ctx.puntosControvertidos.map((p) => `- ${p}`).join('\n')}`,
    `DECLARACIONES PREVIAS:\n${ctx.declaracionesPrevias.map((d) => `- ${d.nombre} (${d.rol}): ${d.resumen}`).join('\n')}`,
  ];
  return lines.filter(Boolean).join('\n\n');
}

export function formatRepresentacionContexto(
  rep: RepresentacionCaso,
  expediente?: ExpedienteAnalysisOutput | null
): string {
  if (!rep.parte) {
    return '(El abogado aún no indicó a qué parte representa. Asumí posición neutral — configurá la representación.)';
  }

  const penal = esFueroPenal(expediente?.tipoFuero);
  const labels = penal ? PARTE_LABEL_PENAL : PARTE_LABEL_CIVIL;
  const parteLabel = labels[rep.parte] ?? rep.parte;

  let contraria: string | undefined;
  if (penal) {
    if (rep.parte === 'defensa' || rep.parte === 'demandado') {
      contraria = expediente?.actor;
    } else if (rep.parte === 'fiscalia' || rep.parte === 'actor') {
      contraria = expediente?.demandado;
    }
  } else if (rep.parte === 'actor') {
    contraria = expediente?.demandado;
  } else if (rep.parte === 'demandado') {
    contraria = expediente?.actor;
  }

  const contrariaLabel = penal ? 'PARTE CONTRARIA (fiscalía o defensa según corresponda)' : 'PARTE CONTRARIA';

  const lines = [
    `FUERO DEL CASO: ${tipoFueroLabel(expediente?.tipoFuero)}`,
    `PARTE QUE REPRESENTAMOS: ${parteLabel}`,
    rep.clienteNombre ? `CLIENTE / REPRESENTADO: ${rep.clienteNombre}` : '',
    contraria ? `${contrariaLabel}: ${contraria}` : '',
    rep.notas ? `OBJETIVO ESTRATÉGICO DEL ABOGADO: ${rep.notas}` : '',
    '',
    penal
      ? 'INSTRUCCIÓN OBLIGATORIA: Caso penal. Las repreguntas, alertas y alegatos deben favorecer a la parte que representamos (defensa o fiscalía) y debilitar a la contraria. Usá terminología penal argentina.'
      : 'INSTRUCCIÓN OBLIGATORIA: Todas las repreguntas, alertas, conclusiones, estrategia y alegatos deben favorecer a NUESTRA parte y debilitar a la contraria. No sugieras líneas que beneficien a la parte adversa.',
  ];
  return lines.filter(Boolean).join('\n');
}

export function inferBandejaDeclarante(
  parteProcesalRaw: string,
  representacion: RepresentacionCaso,
  tipoFuero?: TipoFuero | null
): BandejaDeclarante {
  const parteProcesal = normalizarParteProcesal(parteProcesalRaw, tipoFuero);
  if (
    !representacion.parte ||
    parteProcesal === 'neutro' ||
    parteProcesal === 'desconocido'
  ) {
    return 'indefinida';
  }

  const nuestraParte = parteProcesalDeRepresentacion(representacion.parte, tipoFuero);
  if (!nuestraParte) return 'indefinida';

  return parteProcesal === nuestraParte ? 'nuestra' : 'contraria';
}

export function etiquetasBandejaDeclarante(
  representacion: RepresentacionCaso,
  tipoFuero?: TipoFuero | null
): { nuestra: string; contraria: string } {
  if (esFueroPenal(tipoFuero)) {
    const somosFiscalia =
      representacion.parte === 'fiscalia' || representacion.parte === 'actor';
    if (somosFiscalia) {
      return {
        nuestra: 'Testigos de fiscalía',
        contraria: 'Testigos de defensa',
      };
    }
    return {
      nuestra: 'Testigos de defensa',
      contraria: 'Testigos de fiscalía',
    };
  }

  if (representacion.parte === 'demandado') {
    return {
      nuestra: 'Nuestra parte (demandado)',
      contraria: 'Parte contraria (actor)',
    };
  }
  if (representacion.parte === 'actor') {
    return {
      nuestra: 'Nuestra parte (actor)',
      contraria: 'Parte contraria (demandado)',
    };
  }
  return { nuestra: 'Nuestra parte', contraria: 'Parte contraria' };
}

export function mensajeModoRepresentacion(
  representacion: RepresentacionCaso,
  tipoFuero?: TipoFuero | null
): string | null {
  if (!representacion.parte) return null;
  const cliente = representacion.clienteNombre ? ` (${representacion.clienteNombre})` : '';

  if (esFueroPenal(tipoFuero)) {
    if (representacion.parte === 'defensa' || representacion.parte === 'demandado') {
      return `Modo defensa penal: las sugerencias favorecerán al imputado${cliente}.`;
    }
    if (representacion.parte === 'fiscalia' || representacion.parte === 'actor') {
      return `Modo fiscalía: las sugerencias favorecerán al Ministerio Público${cliente}.`;
    }
    return null;
  }

  if (representacion.parte === 'demandado') {
    return `Modo defensa: las sugerencias favorecerán al demandado${cliente}.`;
  }
  if (representacion.parte === 'actor') {
    return `Modo actor: las sugerencias favorecerán al demandante${cliente}.`;
  }
  return null;
}

function formatIntercambiosLine(intercambios: AudienciaIntercambio[]): string {
  if (intercambios.length === 0) return '(Sin preguntas registradas en audiencia)';
  return intercambios
    .map((i, n) => {
      const p = redactSensitiveIdentifiers(i.pregunta);
      const r = redactSensitiveIdentifiers(i.respuesta);
      return `P${n + 1}: ${p}\nR: ${r}`;
    })
    .join('\n\n');
}

export function formatTestimoniosAudienciaContexto(
  testigos: AudienciaTestigo[],
  analysisByTestigoId: Record<string, AudienciaCopilotOutput>,
  representacion: RepresentacionCaso,
  tipoFuero?: TipoFuero | null
): string {
  const labels = etiquetasBandejaDeclarante(representacion, tipoFuero);
  const bandejaLabel = (bandeja: AudienciaTestigo['bandeja']) => {
    if (bandeja === 'nuestra') return labels.nuestra;
    if (bandeja === 'contraria') return labels.contraria;
    return 'Sin clasificar';
  };

  return testigos
    .map((t, idx) => {
      const analysis = analysisByTestigoId[t.id];
      const blocks = [
        `=== DECLARANTE ${idx + 1}: ${t.nombre} (${t.rol}) — ${bandejaLabel(t.bandeja)} ===`,
        t.contextoDeclarante
          ? `Contexto del abogado: ${redactSensitiveIdentifiers(t.contextoDeclarante)}`
          : '',
        t.testimonioPrevio
          ? `Testimonio previo en expediente: ${redactSensitiveIdentifiers(t.testimonioPrevio)}`
          : '',
        `PREGUNTAS Y RESPUESTAS EN ESTA AUDIENCIA:\n${formatIntercambiosLine(t.intercambios)}`,
      ];
      if (analysis) {
        if (analysis.admisiones.length) {
          blocks.push(`ADMISIONES DETECTADAS: ${analysis.admisiones.join(' | ')}`);
        }
        if (analysis.contradicciones.length) {
          blocks.push(`CONTRADICCIONES: ${analysis.contradicciones.join(' | ')}`);
        }
        if (analysis.conclusiones.length) {
          blocks.push(`CONCLUSIONES PROVISIONALES: ${analysis.conclusiones.join(' | ')}`);
        }
      }
      return blocks.filter(Boolean).join('\n');
    })
    .join('\n\n');
}

const MAX_DOC_CONTEXTO_CHARS = 48_000;

export function formatDocumentosAdicionalesContexto(
  documentos: DocumentoAdicionalAudiencia[] | undefined | null
): string {
  if (!documentos?.length) return '';

  let remaining = MAX_DOC_CONTEXTO_CHARS;
  const parts: string[] = [];

  for (const doc of documentos) {
    if (remaining <= 0) break;
    const header = doc.descripcion.trim()
      ? `--- ${doc.descripcion.trim()} (${doc.fileName}) ---`
      : `--- ${doc.fileName} ---`;
    let body = redactSensitiveIdentifiers(doc.texto.trim());
    if (body.length > remaining) {
      body = `${body.slice(0, remaining)}\n[... documento truncado por tamaño ...]`;
      remaining = 0;
    } else {
      remaining -= body.length;
    }
    parts.push(`${header}\n${body}`);
  }

  return parts.join('\n\n');
}
