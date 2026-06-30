export type FueroPlantilla = 'civil' | 'laboral' | 'familia' | 'contencioso' | 'general';

export function inferirFueroPlantilla(fuero?: string): FueroPlantilla {
  const f = (fuero ?? '').toLowerCase();
  if (f.includes('labor') || f.includes('ltr')) return 'laboral';
  if (f.includes('famil') || f.includes('ffa')) return 'familia';
  if (f.includes('contenc') || f.includes('fca')) return 'contencioso';
  if (f.includes('civil') || f.includes('comercial') || f.includes('fro') || f.includes('fcn')) return 'civil';
  return 'general';
}

type PlantillaVars = {
  juzgado?: string;
  numeroExpediente?: string;
  caratula?: string;
  destinatario?: string;
  objeto?: string;
  fecha?: string;
};

function reemplazarVars(texto: string, vars: PlantillaVars): string {
  return texto
    .replace(/\{\{JUZGADO\}\}/g, vars.juzgado ?? '_______________')
    .replace(/\{\{EXPEDIENTE\}\}/g, vars.numeroExpediente ?? '_______________')
    .replace(/\{\{CARATULA\}\}/g, vars.caratula ?? '_______________')
    .replace(/\{\{DESTINATARIO\}\}/g, vars.destinatario ?? '_______________')
    .replace(/\{\{OBJETO\}\}/g, vars.objeto ?? '_______________')
    .replace(/\{\{FECHA\}\}/g, vars.fecha ?? new Date().toLocaleDateString('es-AR'));
}

const OFICIO_CIVIL = `Señor/a {{DESTINATARIO}}:

Tengo el agrado de dirigirme a Ud. en mi carácter de letrado patrocinante en autos caratulados "{{CARATULA}}", Expte. Nº {{EXPEDIENTE}}, que tramitan por ante el {{JUZGADO}}, a fin de solicitarle tenga a bien informar sobre:

{{OBJETO}}

Se deja constancia que la presente solicita cumplimiento en el plazo legal.

{{FECHA}}`;

const CEDULA_CIVIL = `CÉDULA

Sr/a. {{DESTINATARIO}}:

Notifico a Ud. que en autos "{{CARATULA}}", Expte. Nº {{EXPEDIENTE}}, {{JUZGADO}}, se ha ordenado:

{{OBJETO}}

Queda Ud. debidamente notificado/a.

{{FECHA}}`;

const OFICIO_LABORAL = `Oficio — Fuero Laboral

Expte. Nº {{EXPEDIENTE}} — "{{CARATULA}}"

Señor/a {{DESTINATARIO}}:

Solicito informe sobre {{OBJETO}}, conforme plazo procesal laboral.

{{FECHA}}`;

const PLANTILLAS: Record<string, Record<FueroPlantilla, string>> = {
  oficio: {
    civil: OFICIO_CIVIL,
    laboral: OFICIO_LABORAL,
    familia: OFICIO_CIVIL,
    contencioso: OFICIO_CIVIL,
    general: OFICIO_CIVIL,
  },
  cedula: {
    civil: CEDULA_CIVIL,
    laboral: CEDULA_CIVIL,
    familia: CEDULA_CIVIL,
    contencioso: CEDULA_CIVIL,
    general: CEDULA_CIVIL,
  },
  mandamiento: {
    civil: `MANDAMIENTO\n\nExpte. {{EXPEDIENTE}} — {{CARATULA}}\n\n{{OBJETO}}\n\n{{FECHA}}`,
    laboral: `MANDAMIENTO (Laboral)\n\n{{OBJETO}}\n\n{{FECHA}}`,
    familia: `MANDAMIENTO\n\n{{OBJETO}}\n\n{{FECHA}}`,
    contencioso: `MANDAMIENTO\n\n{{OBJETO}}\n\n{{FECHA}}`,
    general: `MANDAMIENTO\n\n{{OBJETO}}\n\n{{FECHA}}`,
  },
  exhorto: {
    civil: `EXHORTO\n\nAutos: {{CARATULA}}\nExpte. {{EXPEDIENTE}}\n\nSírvase diligenciar: {{OBJETO}}\n\n{{FECHA}}`,
    laboral: `EXHORTO\n\n{{OBJETO}}\n\n{{FECHA}}`,
    familia: `EXHORTO\n\n{{OBJETO}}\n\n{{FECHA}}`,
    contencioso: `EXHORTO\n\n{{OBJETO}}\n\n{{FECHA}}`,
    general: `EXHORTO\n\n{{OBJETO}}\n\n{{FECHA}}`,
  },
  oficio_electronico: {
    civil: `OFICIO ELECTRÓNICO\n\nExpte. {{EXPEDIENTE}}\n\n{{OBJETO}}\n\n{{FECHA}}`,
    laboral: `OFICIO ELECTRÓNICO\n\n{{OBJETO}}\n\n{{FECHA}}`,
    familia: `OFICIO ELECTRÓNICO\n\n{{OBJETO}}\n\n{{FECHA}}`,
    contencioso: `OFICIO ELECTRÓNICO\n\n{{OBJETO}}\n\n{{FECHA}}`,
    general: `OFICIO ELECTRÓNICO\n\n{{OBJETO}}\n\n{{FECHA}}`,
  },
  cedula_electronica: {
    civil: `CÉDULA ELECTRÓNICA\n\nExpte. {{EXPEDIENTE}}\n\n{{OBJETO}}\n\n{{FECHA}}`,
    laboral: `CÉDULA ELECTRÓNICA\n\n{{OBJETO}}\n\n{{FECHA}}`,
    familia: `CÉDULA ELECTRÓNICA\n\n{{OBJETO}}\n\n{{FECHA}}`,
    contencioso: `CÉDULA ELECTRÓNICA\n\n{{OBJETO}}\n\n{{FECHA}}`,
    general: `CÉDULA ELECTRÓNICA\n\n{{OBJETO}}\n\n{{FECHA}}`,
  },
};

export function generarPlantillaDiligencia(
  tipo: string,
  fuero: FueroPlantilla,
  vars: PlantillaVars,
): string {
  const tpl = PLANTILLAS[tipo]?.[fuero] ?? PLANTILLAS.oficio.general;
  return reemplazarVars(tpl, vars);
}

export const CHECKLIST_AUDIENCIA: Record<string, readonly string[]> = {
  vista_causa: ['Revisar prueba producida', 'Preparar alegatos', 'Confirmar testigos', 'Expediente impreso/digital'],
  audiencia_preliminar: ['Propuesta conciliatoria', 'Fijar hechos controvertidos', 'Acuerdo de prueba'],
  audiencia_vista: ['Alegatos de apertura', 'Examen testigos', 'Alegatos de clausura'],
  testimonial: ['Lista de testigos', 'Preguntas preparadas', 'Acta'],
  audiencia_testimonial: ['Lista de testigos', 'Preguntas preparadas', 'Acta'],
  mediacion: ['Propuesta de bases', 'Mandato del cliente', 'Alternativas de acuerdo'],
  conciliacion: ['Propuesta numérica', 'Autorización del cliente', 'Minuta de acuerdo'],
  audiencia: ['Cédula de notificación librada', 'Cédula diligenciada', 'Revisar prueba', 'Documentación', 'Confirmar fecha/hora'],
};

export function checklistInicialAudiencia(tipo: string): { id: string; titulo: string; completada: boolean }[] {
  const items = CHECKLIST_AUDIENCIA[tipo] ?? CHECKLIST_AUDIENCIA.audiencia;
  return items.map((titulo) => ({ id: crypto.randomUUID(), titulo, completada: false }));
}
