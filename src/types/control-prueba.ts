export const PRUEBA_ESTADOS = [
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
] as const;

/** Estados del ítem padre pericial (fases del trámite pericial) */
export const PERICIAL_ESTADOS = [
  'pendiente_produccion',
  'perito_designado',
  'puntos_trasladados',
  'dictamen_presentado',
  'en_discusion',
  'valoracion_judicial',
  'producida',
  'desistida',
  'no_admitida',
] as const;

export type PericialEstado = (typeof PERICIAL_ESTADOS)[number];

export const DILIGENCIA_ESTADOS = [
  'pendiente',
  'presentado',
  'observado',
  'librado',
  'diligenciado',
  'contestado',
  'contestacion_parcial',
  'cumplido',
  'vencido',
] as const;

/**
 * Ciclo de prueba informativa (madre): sin «contestado» (se confunde con producida)
 * y cierre exitoso como «producida» (no «cumplido»).
 */
export const INFORMATIVA_ESTADOS = [
  'pendiente',
  'presentado',
  'observado',
  'librado',
  'diligenciado',
  'contestacion_parcial',
  'producida',
  'vencido',
  'valoracion_judicial',
  'desistida',
] as const;

/** Medio de la cédula de notificación de audiencia */
export const CEDULA_NOTIF_MEDIOS = ['papel', 'electronica'] as const;
export type CedulaNotifMedio = (typeof CEDULA_NOTIF_MEDIOS)[number];

/** Estados — cédula de notificación de audiencia en papel */
export const CEDULA_NOTIF_ESTADOS_PAPEL = [
  'pendiente_realizacion',
  'presentada',
  'observada',
  'librada',
  'retirada',
  'pendiente_diligenciamiento',
  'notificada',
  'resultado_negativo',
] as const;

/** Estados — cédula de notificación de audiencia electrónica */
export const CEDULA_NOTIF_ESTADOS_ELECTRONICA = [
  'pendiente_realizacion',
  'presentada',
  'observada',
  'librada_notificada',
] as const;

/** Estados — oficio electrónico (incluye contestación parcial → nuevo oficio) */
export const OFICIO_ELECTRONICO_ESTADOS = [
  'pendiente_realizacion',
  'presentada',
  'observada',
  'contestacion_parcial',
  'librada_notificada',
  'cumplido',
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

/** Trámite de producción en sede oficiada (Rogatorio Ley 22.172). */
export const TIPO_ROGATORIO_SEDE = 'rogatorio_sede' as const;

export const ROGATORIO_SEDE_ESTADOS = ['pendiente', 'en_tramite', 'remitido'] as const;
export type RogatorioSedeEstado = (typeof ROGATORIO_SEDE_ESTADOS)[number];

export const ROGATORIO_TIPOS_PRODUCCION = ['pericial', 'testimonial', 'confesional'] as const;
export type RogatorioTipoProduccion = (typeof ROGATORIO_TIPOS_PRODUCCION)[number];

export type RogatorioHito = {
  id: string;
  titulo: string;
  completada: boolean;
  fecha?: string | null;
};

/** Meta del ítem trámite `rogatorio_sede` (1:1 con oficio Ley 22.172). */
export type RogatorioMeta = {
  oficioId: string;
  tipoProduccion: RogatorioTipoProduccion;
  juzgadoOficiado?: string | null;
  expedienteRogatoria?: string | null;
  hitos: RogatorioHito[];
};

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
  'indagatoria',
  'conciliacion',
  'mediacion',
  'audiencia',
  'vista_causa',
  'audiencia_preliminar',
  'audiencia_vista',
  'audiencia_testimonial',
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
  'documental',
  'documental_en_poder',
] as const;
export type ParentTipoSubproceso = (typeof PARENT_TIPOS_SUBPROCESO)[number];

export const SUBPROCESO_ROLES = [
  'audiencia_prueba',
  'cedula_audiencia',
  'mandamiento_conduccion',
  'informativa_autenticidad',
  'cedula_intimacion_documental',
  'notificacion_perito',
  'traslado_puntos',
  'exhorto_pericia',
  'oficio_ley_22172',
  'tramite_sede_rogatoria',
  'oficio_autenticidad',
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
  /** Documentación aún faltante tras una exhibición parcial */
  documentosFaltantes?: string | null;
  plazoPresentacion?: string | null;
  medioIntimacion?: CedulaNotifMedio | string | null;
  intimacionOrdenada?: boolean;
};

/** Documental acompañada al escrito (demanda, contestación, ampliación). Si impugnan autenticidad → oficios a librar. */
export type DocumentalPruebaMeta = {
  autenticidadImpugnada?: boolean;
  fechaImpugnacion?: string | null;
  /** @deprecated usar oficiosAutenticidad — se mantiene como alias del primer destinatario */
  destinatarioOficio?: string | null;
  /** Oficios para certificar autenticidad (documental negada), embebidos en el ítem documental */
  oficiosAutenticidad?: OficioAutenticidadPendiente[];
};

/** Confesional / testimonial: fijación de audiencia (cédulas = ítems diligencia vinculados) */
export type AudienciaPruebaMeta = {
  audienciaFijada?: boolean;
  fechaAudiencia?: string | null;
  horaAudiencia?: string | null;
  sala?: string | null;
  motivoPostergacion?: string | null;
  /** Producción en sede oficiada (Rogatorio Ley 22.172) — creación del par es manual */
  extrañaJurisdiccion?: boolean;
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

/** Parte procesal que representamos (puede haber varias a la vez). */
export type ParteRepresentadaPrueba = 'actor' | 'demandado' | 'tercero';

export type ControlPruebaItem = {
  id: string;
  orden: number;
  categoria?: ItemCategoria | string;
  tipo: string;
  descripcion: string;
  ofrecidaPor?: PruebaParte | string;
  /** Solo si ofrecidaPor === 'tercero': identifica cuál tercero del expediente. */
  terceroNombre?: string | null;
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
  /** Trámite `rogatorio_sede`: producción en sede oficiada (Ley 22.172) */
  rogatorio?: RogatorioMeta;
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
  /**
   * Pipeline version. `2` = Control de prueba V2 (movimientos/eventos en subcolecciones).
   * Ausente o `1` = comportamiento V1 legacy.
   */
  controlPruebaVersion?: 1 | 2;
  actor?: string;
  demandado?: string;
  /** Nombres de terceros intervinientes (p. ej. co-demandados, garantes). */
  terceros?: string[];
  /**
   * Partes que representamos — el badge de pendientes, el resumen y el PDF
   * suman la prueba de todas las marcadas.
   */
  partesRepresentadas?: ParteRepresentadaPrueba[];
  /** @deprecated preferí `partesRepresentadas`; se mantiene por compatibilidad. */
  parteRepresentada?: ParteRepresentadaPrueba | '';
  items: ControlPruebaItem[];
  hitos?: ExpedienteHito[];
  oficiosAutenticidadPendientes?: OficioAutenticidadPendiente[];
  resumenEjecutivo?: ResumenEjecutivoImport;
  /** Tokens IA acumulados (imports / reanálisis). */
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model?: string;
    lastUpdatedAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  /** Colaboradores con acceso (solo el dueño gestiona el share). */
  sharedWith?: import('@/lib/resource-sharing').SharedCollaborator[];
  /** Índice para consultas array-contains. */
  sharedWithUids?: string[];
  /** Rol del usuario actual respecto al expediente (solo en respuestas API). */
  myAccess?: import('@/lib/resource-sharing').ResourceAccessLevel;
};

export type ControlPruebaExpedienteInput = {
  caratula: string;
  numeroExpediente?: string;
  juzgado?: string;
  fuero?: string;
  expedienteUrl: string;
  sistema?: PruebaSistema;
  notas?: string;
  partesRepresentadas?: ParteRepresentadaPrueba[];
  /** @deprecated preferí `partesRepresentadas`. */
  parteRepresentada?: ParteRepresentadaPrueba | '';
  terceros?: string[];
  items?: ControlPruebaItem[];
  hitos?: ExpedienteHito[];
  oficiosAutenticidadPendientes?: OficioAutenticidadPendiente[];
  resumenEjecutivo?: ResumenEjecutivoImport;
};
