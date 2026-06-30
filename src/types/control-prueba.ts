export const PRUEBA_ESTADOS = [
  'pendiente_produccion',
  'postpuesta_juez',
  'audiencia_fijada',
  'intimacion_ordenada',
  'autenticidad_impugnada',
  'producida',
  'desistida',
  'no_admitida',
] as const;

/** Estados del ítem padre pericial (fases del trámite pericial) */
export const PERICIAL_ESTADOS = [
  'pendiente_produccion',
  'perito_designado',
  'puntos_trasladados',
  'dictamen_presentado',
  'en_discusion',
  'producida',
  'desistida',
  'no_admitida',
] as const;

export type PericialEstado = (typeof PERICIAL_ESTADOS)[number];

export const DILIGENCIA_ESTADOS = [
  'pendiente',
  'librado',
  'diligenciado',
  'enviado',
  'contestado',
  'contestacion_parcial',
  'cumplido',
  'vencido',
] as const;

/** Medio de la cédula de notificación de audiencia */
export const CEDULA_NOTIF_MEDIOS = ['papel', 'electronica'] as const;
export type CedulaNotifMedio = (typeof CEDULA_NOTIF_MEDIOS)[number];

/** Estados — cédula de notificación de audiencia en papel */
export const CEDULA_NOTIF_ESTADOS_PAPEL = [
  'pendiente_realizacion',
  'presentada',
  'librada',
  'observada',
  'retirada',
  'pendiente_diligenciamiento',
  'notificada',
  'resultado_negativo',
] as const;

/** Estados — cédula de notificación de audiencia electrónica */
export const CEDULA_NOTIF_ESTADOS_ELECTRONICA = [
  'pendiente_realizacion',
  'observada',
  'librada_notificada',
] as const;

/** Estados — oficio electrónico (incluye contestación parcial → nuevo oficio) */
export const OFICIO_ELECTRONICO_ESTADOS = [
  'pendiente_realizacion',
  'observada',
  'contestacion_parcial',
  'librada_notificada',
] as const;

export type CedulaNotifEstadoPapel = (typeof CEDULA_NOTIF_ESTADOS_PAPEL)[number];
export type CedulaNotifEstadoElectronica = (typeof CEDULA_NOTIF_ESTADOS_ELECTRONICA)[number];

export const AUDIENCIA_ESTADOS = [
  'programada',
  'realizada',
  'suspendida',
  'reprogramada',
  'cancelada',
] as const;

export type PruebaEstado = (typeof PRUEBA_ESTADOS)[number];
export type DiligenciaEstado = (typeof DILIGENCIA_ESTADOS)[number];
export type AudienciaEstado = (typeof AUDIENCIA_ESTADOS)[number];
export type ControlItemEstado = PruebaEstado | DiligenciaEstado | AudienciaEstado | string;

export const MEJOR_PROVEER_ESTADOS = [
  'ordenada',
  'en_cumplimiento',
  'cumplida',
  'incumplida',
  'dispensada',
] as const;
export type MejorProveerEstado = (typeof MEJOR_PROVEER_ESTADOS)[number];

/** Tipos habituales de medida de mejor proveer ordenada por el juez */
export const TIPOS_MEJOR_PROVEER = [
  'documentacion',
  'informacion',
  'comparendo',
  'prueba_adicional',
  'otra',
] as const;
export type TipoMejorProveer = (typeof TIPOS_MEJOR_PROVEER)[number];

export const ITEM_CATEGORIAS = ['prueba', 'diligencia', 'audiencia', 'tramite', 'mejor_proveer'] as const;
export type ItemCategoria = (typeof ITEM_CATEGORIAS)[number];

/** Movimientos vinculados a prueba pericial (impugnaciones, aclaraciones, dictámenes) */
export const TIPOS_TRAMITE_PERICIAL = [
  'impugnacion_informe',
  'aclaracion_perito',
  'dictamen_complementario',
  'dictamen_pericial',
  'traslado_puntos',
] as const;
export type TipoTramitePericial = (typeof TIPOS_TRAMITE_PERICIAL)[number];

export const IMPUGNACION_INFORME_ESTADOS = [
  'presentada',
  'traslado_concedido',
  'aclaraciones_ordenadas',
  'resuelta_admitida',
  'resuelta_rechazada',
] as const;

export const ACLARACION_DICTAMEN_ESTADOS = ['pendiente', 'presentada', 'impugnada'] as const;

export const TRASLADO_PUNTOS_ESTADOS = ['pendiente', 'presentada', 'cumplida'] as const;

export const TIPOS_PRUEBA = [
  'documental',
  'documental_en_poder',
  'pericial',
  'informativa',
  'inspeccion',
  'otra',
] as const;

export const TIPOS_DILIGENCIA = [
  'oficio',
  'cedula',
  'mandamiento',
  'exhorto',
  'oficio_electronico',
  'cedula_electronica',
] as const;

export const TIPOS_AUDIENCIA = [
  'confesional',
  'testimonial',
  'audiencia',
  'vista_causa',
  'audiencia_preliminar',
  'audiencia_vista',
  'audiencia_testimonial',
  'mediacion',
  'conciliacion',
  'audiencia_inicial',
  'otra_audiencia',
] as const;

/** @deprecated usar TIPOS_PRUEBA */
export const PRUEBA_TIPOS = TIPOS_PRUEBA;
export type PruebaTipo = (typeof TIPOS_PRUEBA)[number];

export const PRUEBA_PARTES = ['actor', 'demandado', 'tercero', 'tribunal'] as const;
export type PruebaParte = (typeof PRUEBA_PARTES)[number];

export const PRUEBA_SISTEMAS = ['mev', 'pjn', 'otro'] as const;
export type PruebaSistema = (typeof PRUEBA_SISTEMAS)[number];

export const PARENT_TIPOS_SUBPROCESO = [
  'testimonial',
  'confesional',
  'pericial',
  'informativa',
  'documental',
  'documental_en_poder',
] as const;
export type ParentTipoSubproceso = (typeof PARENT_TIPOS_SUBPROCESO)[number];

export const SUBPROCESO_ROLES = [
  'cedula_audiencia',
  'mandamiento_conduccion',
  'informativa_autenticidad',
  'cedula_intimacion_documental',
  'notificacion_perito',
  'traslado_puntos',
  'exhorto_pericia',
  'oficio_informativa',
  'intimacion_informativa',
  'dictamen_pericial',
  'impugnacion_informe',
  'aclaracion_perito',
  'dictamen_complementario',
] as const;
export type SubprocesoRol = (typeof SUBPROCESO_ROLES)[number];

/** @deprecated Solo lectura al migrar expedientes viejos — la cédula canónica es ítem diligencia */
export type CedulaNotificacionPruebaLegacy = {
  id: string;
  destinatario: string;
  rol: 'parte' | 'testigo' | 'tercero';
  estado: 'pendiente' | 'librada' | 'notificada' | 'negativa' | 'sin_efecto';
  fechaLibramiento?: string | null;
  fechaDiligenciamiento?: string | null;
  observaciones?: string | null;
};

/** Vínculo padre → hijo (ítem diligencia auto-creado o manual) */
export type SubprocesoVinculo = {
  parentItemId: string;
  parentTipo: ParentTipoSubproceso;
  parentCategoria?: ItemCategoria;
  rol: SubprocesoRol;
  autoCreated: boolean;
  vinculoLabel: string;
  triggerKey: string;
};

export type ItemSubtarea = {
  id: string;
  titulo: string;
  completada: boolean;
  fechaLimite?: string | null;
  observaciones?: string | null;
};

/** Testigo ofrecido en una prueba testimonial — permite cédula de notificación individual por testigo. */
export type ItemTestigo = {
  id: string;
  nombre: string;
  domicilio?: string | null;
};

export type ItemHistorialEntry = {
  id: string;
  timestamp: string;
  usuario?: string;
  campo: string;
  valorAnterior?: string;
  valorNuevo: string;
};

export type ItemAdjunto = {
  id: string;
  nombre: string;
  url: string;
  tipo?: 'link' | 'pdf' | 'otro';
};

export type DiligenciaMeta = {
  destinatario?: string;
  objeto?: string;
  /** Escrito/pedido que dio origen a la comunicación */
  fechaPresentacion?: string | null;
  fechaLibramiento?: string | null;
  fechaDiligenciamiento?: string | null;
  /** Plazo para contestación del oficiado */
  plazoContestacion?: string | null;
  resultado?: string;
  pruebaVinculadaId?: string | null;
  plantillaTexto?: string | null;
  /** Cédula de notificación de audiencia: papel vs electrónica (define estados disponibles) */
  medioNotificacion?: CedulaNotifMedio;
  /** Oficio anterior cuando este es reiteración por contestación parcial */
  oficioOrigenId?: string | null;
  /** Oficio nuevo pedido por aclaraciones tras contestación parcial */
  oficioSucesorId?: string | null;
};

export type PericialMeta = {
  /** contable, informatica, ingenieria, etc. */
  especialidad?: string;
  /** Pericia en tribunal local vs rogatoria / extraña jurisdicción */
  extrañaJurisdiccion?: boolean;
  /** Expte. formado ante juez oficiado (ej. rogatoria San Isidro) */
  expedienteRogatoria?: string | null;
  juzgadoOficiado?: string | null;
  peritoDesignado?: string | null;
};

export type AudienciaMeta = {
  hora?: string;
  sala?: string;
  juzgado?: string;
  abogadoAsistente?: string;
  resultado?: string;
  actaTexto?: string;
  actaUrl?: string | null;
  cedulaVinculadaId?: string | null;
  cedulaNotificada?: boolean;
  checklist?: { id: string; titulo: string; completada: boolean }[];
};

/** Documental en poder de la contraparte (ofrecida en apertura, NO adjunta al escrito). Se resuelve con intimación/cédula. */
export type DocumentalEnPoderMeta = {
  /** Parte que detenta la documentación */
  parteConDocumentos?: PruebaParte | string | null;
  documentosDetalle?: string | null;
  plazoPresentacion?: string | null;
  medioIntimacion?: CedulaNotifMedio | string | null;
  intimacionOrdenada?: boolean;
};

/** Documental acompañada al escrito (demanda, contestación, ampliación). Si impugnan autenticidad → informativa + oficio. */
export type DocumentalPruebaMeta = {
  autenticidadImpugnada?: boolean;
  fechaImpugnacion?: string | null;
  /** Destinatario del oficio informativo (banco, escribano, etc.) */
  destinatarioOficio?: string | null;
};

/** Confesional / testimonial: fijación de audiencia (cédulas = ítems diligencia vinculados) */
export type AudienciaPruebaMeta = {
  audienciaFijada?: boolean;
  fechaAudiencia?: string | null;
  horaAudiencia?: string | null;
  sala?: string | null;
  motivoPostergacion?: string | null;
  /** @deprecated migrado a ítems diligencia con vinculo.parentItemId */
  cedulasNotificacion?: CedulaNotificacionPruebaLegacy[];
};

export type ExpedienteHito = {
  id: string;
  tipo: 'demanda' | 'contestacion' | 'apertura_prueba' | 'cierre_prueba' | 'sentencia' | 'otro';
  fecha?: string | null;
  label?: string;
};

/** Oficio de autenticidad pendiente o en trámite (documental negada). */
export type OficioAutenticidadEstado = 'a_librar' | 'librado' | 'contestado' | 'no_aplica';

export type OficioAutenticidadPendiente = {
  id: string;
  /** Ej. "Doc. 1", "Doc. 2" */
  referencia?: string | null;
  descripcionDocumento: string;
  destinatarioOficio: string;
  objetoOficio?: string | null;
  estado: OficioAutenticidadEstado;
  /** Ítem prueba documental vinculado */
  itemPruebaId?: string | null;
  observaciones?: string | null;
};

export type ResumenEjecutivoImport = {
  producida?: string[];
  pendiente?: string[];
  aLibrar?: string[];
  recomendaciones?: string[];
};

/** Parte procesal que representamos (actor o demandado). */
export type ParteRepresentadaPrueba = 'actor' | 'demandado';

export type ControlPruebaItem = {
  id: string;
  orden: number;
  categoria?: ItemCategoria | string;
  tipo: string;
  descripcion: string;
  ofrecidaPor?: PruebaParte | string;
  estado: ControlItemEstado;
  fechaLimite?: string | null;
  /** Pericial: plazo designación perito / informativa: plazo secundario */
  fechaLimiteSecundaria?: string | null;
  fechaProduccion?: string | null;
  actuacionUrl?: string | null;
  observaciones?: string | null;
  subtareas?: ItemSubtarea[];
  /** Solo prueba testimonial: testigos ofrecidos (permite cédula individual por testigo) */
  testigos?: ItemTestigo[];
  historial?: ItemHistorialEntry[];
  adjuntos?: ItemAdjunto[];
  diligencia?: DiligenciaMeta;
  pericial?: PericialMeta;
  audiencia?: AudienciaMeta;
  audienciaPrueba?: AudienciaPruebaMeta;
  documentalEnPoder?: DocumentalEnPoderMeta;
  /** Documental acompañada: impugnación de autenticidad */
  documental?: DocumentalPruebaMeta;
  /** Solo en ítems hijo (diligencia vinculada a prueba/audiencia) */
  vinculo?: SubprocesoVinculo;
};

export type ControlPruebaExpediente = {
  id: string;
  caratula: string;
  numeroExpediente?: string;
  juzgado?: string;
  fuero?: string;
  expedienteUrl: string;
  sistema?: PruebaSistema;
  notas?: string;
  pdfFileName?: string;
  pdfImportedAt?: string;
  actor?: string;
  demandado?: string;
  /** Parte que representamos — filtra el resumen ejecutivo a nuestra prueba. */
  parteRepresentada?: ParteRepresentadaPrueba | '';
  items: ControlPruebaItem[];
  hitos?: ExpedienteHito[];
  oficiosAutenticidadPendientes?: OficioAutenticidadPendiente[];
  resumenEjecutivo?: ResumenEjecutivoImport;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
};

export type ControlPruebaExpedienteInput = {
  caratula: string;
  numeroExpediente?: string;
  juzgado?: string;
  fuero?: string;
  expedienteUrl: string;
  sistema?: PruebaSistema;
  notas?: string;
  parteRepresentada?: ParteRepresentadaPrueba | '';
  items?: ControlPruebaItem[];
  hitos?: ExpedienteHito[];
  oficiosAutenticidadPendientes?: OficioAutenticidadPendiente[];
  resumenEjecutivo?: ResumenEjecutivoImport;
};
