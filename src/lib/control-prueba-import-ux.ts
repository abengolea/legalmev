export const IMPORT_STAGES = [
  { id: 'upload', label: 'Cargar PDF', hint: 'Subí el expediente. Extraer texto no usa IA.' },
  { id: 'analyze', label: 'Analizar con IA', hint: 'El análisis comienza cuando lo solicitás.' },
  { id: 'review', label: 'Revisar resultados', hint: 'Confirmá o corregí las medidas detectadas.' },
  { id: 'confirm', label: 'Confirmar y guardar', hint: 'La importación termina al confirmar.' },
] as const;

export type ImportStageId = (typeof IMPORT_STAGES)[number]['id'];
export type ImportStageStatus = 'pending' | 'current' | 'done';

export type ImportWizardProgress = {
  hasFile: boolean;
  extracting: boolean;
  extracted: boolean;
  analyzing: boolean;
  hasPreview: boolean;
  reviewing: boolean;
  confirming: boolean;
  confirmed?: boolean;
};

export function resolveImportStageStatuses(
  progress: ImportWizardProgress,
): Record<ImportStageId, ImportStageStatus> {
  if (progress.confirmed) {
    return { upload: 'done', analyze: 'done', review: 'done', confirm: 'done' };
  }
  if (progress.confirming) {
    return { upload: 'done', analyze: 'done', review: 'done', confirm: 'current' };
  }
  if (progress.hasPreview) {
    return {
      upload: 'done',
      analyze: 'done',
      review: progress.reviewing ? 'current' : 'current',
      confirm: 'pending',
    };
  }
  if (progress.analyzing) {
    return { upload: 'done', analyze: 'current', review: 'pending', confirm: 'pending' };
  }
  if (progress.extracted) {
    return { upload: 'done', analyze: 'current', review: 'pending', confirm: 'pending' };
  }
  if (progress.extracting || progress.hasFile) {
    return { upload: 'current', analyze: 'pending', review: 'pending', confirm: 'pending' };
  }
  return { upload: 'current', analyze: 'pending', review: 'pending', confirm: 'pending' };
}

export function importProgressMessage(progress: ImportWizardProgress): string | null {
  if (progress.confirming) {
    return 'Guardando las medidas seleccionadas en el expediente. La importación termina al confirmar.';
  }
  if (progress.analyzing) {
    return 'Identificando las medidas probatorias con inteligencia artificial. Puede tardar uno o dos minutos.';
  }
  if (progress.extracting) {
    return 'Extrayendo el texto del PDF. Esta etapa no usa inteligencia artificial.';
  }
  if (progress.hasPreview) {
    return 'Revisá las medidas detectadas. Nada se guarda hasta que confirmes la importación.';
  }
  if (progress.extracted) {
    return 'Texto extraído. El análisis con IA comienza cuando lo solicites; subir el PDF no alcanza.';
  }
  return null;
}

export const PDF_FILE_HELP = {
  title: '¿Qué archivo debo subir?',
  body: 'Un PDF del expediente judicial que contenga las actuaciones relevantes, especialmente los escritos de ofrecimiento de prueba y las resoluciones judiciales vinculadas.',
  warning:
    'El documento debe contener texto que pueda extraerse. Los PDF compuestos únicamente por imágenes escaneadas podrían no ser procesados correctamente.',
} as const;

export function pdfExtractErrorCopy(code?: string): {
  title: string;
  description: string;
  recommendation: string;
} {
  if (code === 'SCANNED_PDF') {
    return {
      title: 'Este PDF no tiene texto utilizable',
      description:
        'El archivo parece estar compuesto por imágenes escaneadas. LegalMev necesita texto extraíble para identificar la prueba ofrecida.',
      recommendation:
        'Exportá el expediente desde MEV o PJN en un PDF con texto seleccionable, o usá un archivo que no sea únicamente una digitalización de imágenes.',
    };
  }
  return {
    title: 'No se pudo leer el PDF',
    description:
      'El archivo no contiene texto extraíble, o podría estar dañado o protegido con contraseña.',
    recommendation:
      'Verificá que el PDF se abra correctamente y que las actuaciones tengan texto, no solo imágenes.',
  };
}

export type ControlPruebaQuotaView = {
  remaining: number;
  limit: number;
  used: number;
  canCreate: boolean;
  monthlyResetAt?: string | null;
};

export function formatControlPruebaQuotaCopy(quota: ControlPruebaQuotaView): {
  usedLine: string;
  renewalLine: string | null;
  exhausted: boolean;
} {
  const exhausted = quota.remaining <= 0;
  const usedLine = exhausted
    ? `Usaste ${quota.used} de ${quota.limit} controles disponibles.`
    : `Usaste ${quota.used} de ${quota.limit} controles · te quedan ${quota.remaining}.`;

  const resetAt = quota.monthlyResetAt ? new Date(quota.monthlyResetAt) : null;
  const hasRenewal = resetAt != null && !Number.isNaN(resetAt.getTime());
  const renewalLine = hasRenewal
    ? `Se renueva el ${resetAt.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}.`
    : null;

  return { usedLine, renewalLine, exhausted };
}

export function countItemsByTipo(items: { tipo?: string | null }[]): { tipo: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const tipo = item.tipo?.trim() || 'otra';
    counts.set(tipo, (counts.get(tipo) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count || a.tipo.localeCompare(b.tipo));
}

export function countItemsByParte(
  items: { ofrecidaPor?: string | null }[],
): { parte: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const parte = item.ofrecidaPor?.trim() || 'actor';
    counts.set(parte, (counts.get(parte) ?? 0) + 1);
  }
  const order = ['actor', 'demandado', 'tercero', 'tribunal'];
  return [...counts.entries()]
    .map(([parte, count]) => ({ parte, count }))
    .sort((a, b) => {
      const ia = order.indexOf(a.parte);
      const ib = order.indexOf(b.parte);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
}
