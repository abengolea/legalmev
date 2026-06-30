import type { ControlPruebaExpediente, ControlPruebaItem, ItemCategoria } from '@/types/control-prueba';
import { getEstadoConfig, PARTE_LABELS, resolveCategoria, TIPO_LABELS } from '@/lib/control-prueba';
import { collectOficiosAutenticidadFromItems } from '@/lib/control-prueba-documental-autenticidad-consolidate';
import { labelTipoPrueba } from '@/lib/control-prueba-pericial';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

function estadoLabel(item: ControlPruebaItem): string {
  const cat = resolveCategoria(item);
  return getEstadoConfig(cat, String(item.estado), item).label;
}

const CATEGORIA_ORDEN: Record<ItemCategoria, number> = {
  prueba: 0,
  diligencia: 1,
  audiencia: 2,
  tramite: 3,
  mejor_proveer: 4,
};
const PARTE_ORDEN: Record<string, number> = { actor: 0, demandado: 1, tercero: 2, tribunal: 3 };

/** Ordena por categoría y luego por parte (actor/demandado primero) para que en los exports quede claro de quién es cada ítem. */
function sortItemsParaExport(items: ControlPruebaItem[]): ControlPruebaItem[] {
  return [...items].sort((a, b) => {
    const catDiff = CATEGORIA_ORDEN[resolveCategoria(a)] - CATEGORIA_ORDEN[resolveCategoria(b)];
    if (catDiff !== 0) return catDiff;
    const parteDiff = (PARTE_ORDEN[a.ofrecidaPor ?? ''] ?? 9) - (PARTE_ORDEN[b.ofrecidaPor ?? ''] ?? 9);
    if (parteDiff !== 0) return parteDiff;
    return a.orden - b.orden;
  });
}

function slugExpediente(exp: ControlPruebaExpediente): string {
  const raw = exp.numeroExpediente?.replace(/\s+/g, '-') || exp.id.slice(0, 8);
  return raw.replace(/[^\w.-]/g, '') || 'expediente';
}

export type ControlPruebaExportBundle = {
  exportedAt: string;
  legalmevVersion: string;
  proposito: 'revision-import-ia';
  expediente: ControlPruebaExpediente;
  resumen: {
    totalItems: number;
    porCategoria: Record<string, number>;
    porTipo: Record<string, number>;
    porParte: Record<string, number>;
    items: {
      orden: number;
      id: string;
      categoria: string;
      tipo: string;
      tipoLabel: string;
      parte: string;
      estado: string;
      descripcion: string;
    }[];
  };
};

export function buildControlPruebaExportBundle(exp: ControlPruebaExpediente): ControlPruebaExportBundle {
  const porCategoria: Record<string, number> = {};
  const porTipo: Record<string, number> = {};
  const porParte: Record<string, number> = {};

  const itemsResumen = sortItemsParaExport(exp.items).map((item) => {
    const cat = resolveCategoria(item);
    const parte = PARTE_LABELS[item.ofrecidaPor ?? ''] ?? item.ofrecidaPor ?? '';
    porCategoria[cat] = (porCategoria[cat] ?? 0) + 1;
    porTipo[labelTipoPrueba(item)] = (porTipo[labelTipoPrueba(item)] ?? 0) + 1;
    porParte[parte || 'sin-parte'] = (porParte[parte || 'sin-parte'] ?? 0) + 1;
    return {
      orden: item.orden,
      id: item.id,
      categoria: cat,
      tipo: item.tipo,
      tipoLabel: labelTipoPrueba(item),
      parte,
      estado: estadoLabel(item),
      descripcion: item.descripcion,
    };
  });

  return {
    exportedAt: new Date().toISOString(),
    legalmevVersion: 'control-prueba-1.0',
    proposito: 'revision-import-ia',
    expediente: exp,
    resumen: {
      totalItems: exp.items.length,
      porCategoria,
      porTipo,
      porParte,
      items: itemsResumen,
    },
  };
}

/** JSON completo del expediente + resumen legible — ideal para pegar en chat y revisar falsos positivos de IA. */
export function exportControlPruebaJson(exp: ControlPruebaExpediente): Blob {
  const bundle = buildControlPruebaExportBundle(exp);
  return new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
}

/** Texto plano para revisión rápida sin abrir JSON. */
export function exportControlPruebaRevisionText(exp: ControlPruebaExpediente): Blob {
  const bundle = buildControlPruebaExportBundle(exp);
  const lines: string[] = [
    '=== LEGALMEV — CONTROL DE PRUEBA (EXPORT REVISIÓN) ===',
    `Exportado: ${bundle.exportedAt}`,
    '',
    `Carátula: ${exp.caratula}`,
    `Expediente: ${exp.numeroExpediente ?? '—'}`,
    `Fuero: ${exp.fuero ?? '—'}`,
    `Juzgado: ${exp.juzgado ?? '—'}`,
    `Link: ${exp.expedienteUrl}`,
    exp.pdfFileName ? `PDF importado: ${exp.pdfFileName}` : '',
    exp.notas ? `\nNotas:\n${exp.notas}` : '',
    '',
    `Total ítems: ${bundle.resumen.totalItems}`,
    `Por categoría: ${JSON.stringify(bundle.resumen.porCategoria)}`,
    `Por tipo: ${JSON.stringify(bundle.resumen.porTipo)}`,
    `Por parte: ${JSON.stringify(bundle.resumen.porParte)}`,
    '',
    '--- LISTADO DE ÍTEMS (marcá cuáles NO son prueba) ---',
    '',
  ];

  for (const item of bundle.resumen.items) {
    lines.push(
      `[#${item.orden}] ${item.categoria.toUpperCase()} | ${item.tipoLabel} | ${item.parte} | ${item.estado}`,
      `ID: ${item.id}`,
      `Descripción: ${item.descripcion}`,
      '¿Es prueba válida? [ SÍ / NO ]',
      '',
    );
  }

  lines.push('--- FIN ---');
  return new Blob([lines.filter(Boolean).join('\n')], { type: 'text/plain;charset=utf-8' });
}

export function exportControlPruebaExcel(exp: ControlPruebaExpediente): Blob {
  const rows = sortItemsParaExport(exp.items).map((item) => ({
    '#': item.orden,
    Categoría: resolveCategoria(item),
    Tipo: labelTipoPrueba(item),
    Descripción: item.descripcion,
    Parte: PARTE_LABELS[item.ofrecidaPor ?? ''] ?? item.ofrecidaPor ?? '',
    Estado: estadoLabel(item),
    'Fecha límite': item.fechaLimite ?? '',
    Producida: item.fechaProduccion ?? '',
    Observaciones: item.observaciones ?? '',
    'Link actuación': item.actuacionUrl ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Control de prueba');

  const meta = [
    ['Carátula', exp.caratula],
    ['Expediente', exp.numeroExpediente ?? ''],
    ['Fuero', exp.fuero ?? ''],
    ['Juzgado', exp.juzgado ?? ''],
    ['Link', exp.expedienteUrl],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Expediente');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function exportControlPruebaPdf(exp: ControlPruebaExpediente): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const lineH = 4.2;
  let y = margin;

  const TEAL = [42, 106, 120] as const;
  const TEAL_LIGHT = [84, 166, 168] as const;
  const MUTED = [100, 116, 139] as const;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(10);
    doc.setFillColor(...TEAL);
    doc.rect(margin, y - 1, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, margin + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    y += 9;
  };

  const wrapText = (text: string, maxW: number, size = 8): string[] => {
    doc.setFontSize(size);
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (doc.getTextWidth(test) <= maxW) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  const drawLines = (lines: string[], size = 8, indent = 0) => {
    doc.setFontSize(size);
    for (const ln of lines) {
      ensureSpace(lineH);
      doc.text(ln, margin + indent, y);
      y += lineH;
    }
  };

  // —— Encabezado ——
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Control de Prueba', margin, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('LegalMev', pageW - margin, 10, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const caratulaLines = wrapText(exp.caratula, contentW, 11);
  drawLines(caratulaLines.slice(0, 2), 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  drawLines(
    [
      `Expediente: ${exp.numeroExpediente ?? '—'}`,
      `Fuero: ${exp.fuero ?? '—'} · Juzgado: ${exp.juzgado ?? '—'}`,
      exp.expedienteUrl ? `Link: ${exp.expedienteUrl}` : '',
      `Exportado: ${new Date().toLocaleString('es-AR')}`,
    ].filter(Boolean),
    9,
  );
  doc.setTextColor(0, 0, 0);
  y += 2;

  // —— Resumen ejecutivo ——
  const res = exp.resumenEjecutivo;
  if (res && (res.producida?.length || res.pendiente?.length || res.aLibrar?.length || res.recomendaciones?.length)) {
    drawSectionTitle('Resumen ejecutivo');
    const cols = [
      { label: 'Producida', items: res.producida ?? [], color: [16, 185, 129] as const },
      { label: 'Pendiente', items: res.pendiente ?? [], color: [245, 158, 11] as const },
      { label: 'A librar', items: res.aLibrar ?? [], color: [244, 63, 94] as const },
    ];
    const colW = contentW / 3;
    const startY = y;
    let maxColH = 0;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const x = margin + i * colW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...col.color);
      doc.text(col.label, x + 1, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      let cy = y + 5;
      for (const t of col.items.slice(0, 6)) {
        const lines = wrapText(`• ${t}`, colW - 2, 7);
        for (const ln of lines.slice(0, 2)) {
          doc.setFontSize(7);
          doc.text(ln, x + 1, cy);
          cy += 3.5;
        }
      }
      maxColH = Math.max(maxColH, cy - startY);
    }
    y = startY + maxColH + 2;
    if (res.recomendaciones?.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Recomendaciones:', margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      for (const r of res.recomendaciones.slice(0, 5)) {
        drawLines(wrapText(`• ${r}`, contentW, 7), 7);
      }
    }
    y += 2;
  }

  // —— Oficios de autenticidad (embebidos en ítems documental) ——
  const oficios = collectOficiosAutenticidadFromItems(exp.items);
  if (oficios.length > 0) {
    drawSectionTitle('Oficios de autenticidad pendientes');
    for (const o of oficios) {
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`${o.referencia ? `${o.referencia} — ` : ''}${o.descripcionDocumento.slice(0, 80)}`, margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      drawLines(
        wrapText(
          `Destinatario: ${o.destinatarioOficio} · Estado: ${o.estado}${o.objetoOficio ? ` · ${o.objetoOficio}` : ''}`,
          contentW,
          7,
        ),
        7,
      );
      y += 1;
    }
    y += 2;
  }

  // —— Ítems por categoría ——
  const CATEGORIA_LABELS: Record<ItemCategoria, string> = {
    prueba: 'PRUEBA OFRECIDA',
    diligencia: 'DILIGENCIAS Y COMUNICACIONES',
    audiencia: 'AUDIENCIAS',
    tramite: 'TRÁMITES VINCULADOS',
    mejor_proveer: 'MEDIDAS DE MEJOR PROVEER',
  };

  const CATEGORIA_COLORS: Record<ItemCategoria, readonly [number, number, number]> = {
    prueba: TEAL,
    diligencia: [59, 130, 246],
    audiencia: [139, 92, 246],
    tramite: [236, 72, 153],
    mejor_proveer: [234, 88, 12],
  };

  let seccionActual: ItemCategoria | null = null;
  for (const item of sortItemsParaExport(exp.items)) {
    const cat = resolveCategoria(item);
    if (cat !== seccionActual) {
      seccionActual = cat;
      drawSectionTitle(CATEGORIA_LABELS[cat]);
    }

    ensureSpace(16);
    const rgb = CATEGORIA_COLORS[cat];
    doc.setDrawColor(...rgb);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + 2, y + 10);
    doc.setLineWidth(0.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`#${item.orden}  ${labelTipoPrueba(item)}`, margin + 4, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(
      `${PARTE_LABELS[item.ofrecidaPor ?? ''] ?? item.ofrecidaPor ?? '—'} · ${estadoLabel(item)}`,
      margin + 4,
      y + 7,
    );
    doc.setTextColor(0, 0, 0);
    y += 9;

    drawLines(wrapText(item.descripcion, contentW - 4, 8), 8, 4);

    const extras: string[] = [];
    if (item.fechaLimite) extras.push(`Plazo: ${item.fechaLimite}`);
    if (item.fechaProduccion) extras.push(`Producida: ${item.fechaProduccion}`);
    if (item.diligencia?.resultado) extras.push(`Resultado: ${item.diligencia.resultado}`);
    if (item.audiencia?.resultado) extras.push(`Audiencia: ${item.audiencia.resultado}`);
    if (item.observaciones) extras.push(`Obs: ${item.observaciones}`);

    if (extras.length) {
      doc.setTextColor(...TEAL_LIGHT);
      for (const ex of extras) {
        drawLines(wrapText(ex, contentW - 4, 7), 7, 4);
      }
      doc.setTextColor(0, 0, 0);
    }
    y += 2;
  }

  // Pie de página en todas las páginas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      `LegalMev — Control de Prueba · Pág. ${p}/${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: 'center' },
    );
  }

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFilename(exp: ControlPruebaExpediente, ext: string): string {
  return `control-prueba-${slugExpediente(exp)}.${ext}`;
}
