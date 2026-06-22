import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';
import type { AiTokenUsageMeta } from '@/lib/ai-token-usage';

export type DestinatarioPregunta = 'testigo' | 'todos';

export type RepreguntaItem = {
  texto: string;
  destinatario: DestinatarioPregunta;
};

export function normalizeRepreguntas(items: unknown): RepreguntaItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === 'string') {
      return { texto: item, destinatario: 'testigo' as const };
    }
    if (item && typeof item === 'object' && 'texto' in item) {
      const o = item as { texto?: unknown; destinatario?: unknown };
      return {
        texto: String(o.texto ?? ''),
        destinatario: o.destinatario === 'todos' ? 'todos' : 'testigo',
      };
    }
    return { texto: String(item), destinatario: 'testigo' as const };
  });
}

export function splitRepreguntas(items: RepreguntaItem[]): {
  testigo: RepreguntaItem[];
  todos: RepreguntaItem[];
} {
  const testigo: RepreguntaItem[] = [];
  const todos: RepreguntaItem[] = [];
  for (const item of items) {
    if (item.destinatario === 'todos') {
      todos.push(item);
    } else {
      testigo.push({ ...item, destinatario: 'testigo' });
    }
  }
  return { testigo, todos };
}

export function mergePreguntasATodos(
  existing: RepreguntaItem[],
  incoming: RepreguntaItem[]
): RepreguntaItem[] {
  const map = new Map<string, RepreguntaItem>();
  for (const item of existing) {
    const key = item.texto.trim().toLowerCase();
    if (key) map.set(key, item);
  }
  for (const item of incoming) {
    if (item.destinatario !== 'todos') continue;
    const key = item.texto.trim().toLowerCase();
    if (key) map.set(key, { texto: item.texto.trim(), destinatario: 'todos' });
  }
  return Array.from(map.values());
}

export function normalizeAudienciaAnalysis<T extends { repreguntas?: unknown }>(
  analysis: T
): T & { repreguntas: RepreguntaItem[] } {
  const { testigo } = splitRepreguntas(normalizeRepreguntas(analysis.repreguntas));
  return {
    ...analysis,
    repreguntas: testigo,
  };
}

export type AudienciaIntercambio = {
  id: string;
  pregunta: string;
  respuesta: string;
};

export type AudienciaTestigo = {
  id: string;
  nombre: string;
  rol: string;
  /** Nuestra parte vs contraria según la representación del abogado. */
  bandeja: BandejaDeclarante;
  /** Descripción manual del abogado: quién es el testigo y por qué es relevante. */
  contextoDeclarante: string;
  testimonioPrevio: string;
  intercambios: AudienciaIntercambio[];
  /** El abogado marcó que terminó de interrogar a este declarante. */
  testimonioCerrado: boolean;
};

export type BandejaDeclarante = 'nuestra' | 'contraria' | 'indefinida';

export type TipoFuero = 'civil' | 'penal' | 'laboral' | 'otro';

export type ParteProcesalDeclarante =
  | 'actor'
  | 'demandado'
  | 'defensa'
  | 'fiscalia'
  | 'neutro'
  | 'desconocido';

export type ParteRepresentada = 'actor' | 'demandado' | 'defensa' | 'fiscalia' | 'otro' | '';

export type RepresentacionCaso = {
  parte: ParteRepresentada;
  clienteNombre: string;
  notas: string;
};

export const EMPTY_REPRESENTACION: RepresentacionCaso = {
  parte: '',
  clienteNombre: '',
  notas: '',
};

export function migrateSessionRepreguntas(session: {
  preguntasATodos?: RepreguntaItem[];
  analysisByTestigoId?: Record<string, AudienciaCopilotOutput>;
}): {
  preguntasATodos: RepreguntaItem[];
  analysisByTestigoId: Record<string, AudienciaCopilotOutput>;
} {
  let preguntasATodos = normalizeRepreguntas(session.preguntasATodos ?? []);
  const analysisByTestigoId: Record<string, AudienciaCopilotOutput> = {};

  for (const [id, raw] of Object.entries(session.analysisByTestigoId ?? {})) {
    const analysis = normalizeAudienciaAnalysis(raw);
    const split = splitRepreguntas(normalizeRepreguntas(raw.repreguntas));
    preguntasATodos = mergePreguntasATodos(preguntasATodos, split.todos);
    analysisByTestigoId[id] = { ...analysis, repreguntas: split.testigo };
  }

  return { preguntasATodos, analysisByTestigoId };
}

export type AudienciaSessionSummary = {
  id: string;
  titulo: string;
  updatedAt: string;
  createdAt: string;
  testigoCount: number;
  pdfFileName?: string;
};

export type AudienciaSessionData = {
  id: string;
  userId: string;
  titulo: string;
  pdfFileName?: string;
  expedienteAnalysis?: ExpedienteAnalysisOutput | null;
  analysisStatus?: 'pending' | 'ready';
  expedienteTexto?: string;
  testigos: AudienciaTestigo[];
  testigoActivoId: string | null;
  analysisByTestigoId: Record<string, AudienciaCopilotOutput>;
  preguntasATodos: RepreguntaItem[];
  representacion: RepresentacionCaso;
  alegatoGlobal?: string;
  alegatoGlobalMeta?: {
    puntosFuertes?: string[];
    debilidadesContraria?: string[];
    generadoAt?: string;
  };
  tokenUsage?: AiTokenUsageMeta;
  createdAt: string;
  updatedAt: string;
};

export type AudienciaSessionPatch = Partial<{
  titulo: string;
  testigos: AudienciaTestigo[];
  testigoActivoId: string | null;
  analysisByTestigoId: Record<string, AudienciaCopilotOutput>;
  preguntasATodos: RepreguntaItem[];
  representacion: RepresentacionCaso;
  alegatoGlobal?: string;
  alegatoGlobalMeta?: AudienciaSessionData['alegatoGlobalMeta'];
  tokenUsage?: AiTokenUsageMeta;
}>;
