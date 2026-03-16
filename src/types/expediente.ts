export type Actuacion = {
  numero?: number;
  url?: string;
  titulo?: string;
  title?: string;
  tipo?: string;
  fecha?: string;
  hora?: string;
  firmante?: string;
  contenido?: string;
  content?: string;
  adjuntos?: { url?: string; nombre?: string }[];
};

export type Expediente = {
  numero?: string;
  caratula?: string;
  juzgado?: string;
  url?: string;
  pageTitle?: string;
};

/** Payload que envía la extensión Chrome al /api/export */
export type ExportRequest = {
  expedienteUrl: string;
  pageTitle?: string;
  actuaciones: Actuacion[];
  anexos?: Array<{ url?: string; title?: string }>;
  cookies?: string;
  caratula?: string;
  nroExpediente?: string;
  juzgado?: string;
};
