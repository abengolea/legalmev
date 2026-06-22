import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type { AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';

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
  representacion: RepresentacionCaso;
  alegatoGlobal?: string;
  alegatoGlobalMeta?: {
    puntosFuertes?: string[];
    debilidadesContraria?: string[];
    generadoAt?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AudienciaSessionPatch = Partial<{
  titulo: string;
  testigos: AudienciaTestigo[];
  testigoActivoId: string | null;
  analysisByTestigoId: Record<string, AudienciaCopilotOutput>;
  representacion: RepresentacionCaso;
  alegatoGlobal?: string;
  alegatoGlobalMeta?: AudienciaSessionData['alegatoGlobalMeta'];
}>;
