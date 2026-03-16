import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { Actuacion, Expediente } from '@/types/expediente';

const CM = 28.35; // puntos por cm
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const MARGIN = 2 * CM;
const LINE_HEIGHT = 12;

function inferirTipoActuacion(titulo: string): string {
  const t = (titulo || '').toUpperCase();
  if (/RESOLUCION|RESOLUCIÓN/.test(t)) return 'Resolución';
  if (/PROVEIDO|PROVEÍDO/.test(t)) return 'Proveído';
  if (/NOTIFICACION|NOTIFICACIÓN/.test(t)) return 'Notificación';
  if (/SENTENCIA/.test(t)) return 'Sentencia';
  if (/DEMANDA|ESCRITO/.test(t)) return 'Escrito';
  if (/APELACION|APELACIÓN/.test(t)) return 'Apelación';
  if (/INFORME/.test(t)) return 'Informe';
  if (/ACTA/.test(t)) return 'Acta';
  return 'Actuación';
}

function extraerFechaActuacion(titulo: string, contenido: string): string {
  const texto = `${titulo || ''} ${contenido || ''}`;
  const m = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  return '—';
}

function actuacionTipo(act: Actuacion): string {
  if (act.tipo) return act.tipo;
  return inferirTipoActuacion(act.titulo || act.title || '');
}

function actuacionFecha(act: Actuacion): string {
  if (act.fecha) return act.fecha;
  return extraerFechaActuacion(act.titulo || act.title || '', act.contenido || act.content || '');
}

/** Sanitiza para nombre de archivo: quita caracteres inválidos (/ \\ : * ? " < > |) */
function sanitizarParaArchivo(s: string): string {
  if (!s) return '';
  return s.replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function generateFilename(expediente: Expediente, actuaciones: Actuacion[]): string {
  const url = expediente.url || '';
  const m = url.match(/nidCausa=(\d+)/i);
  const nroExp = expediente.numero || (m ? m[1] : '');

  const caratula = sanitizarParaArchivo(expediente.caratula || '');

  // Formato: "Carátula - Nº Expediente.pdf" o variantes según datos disponibles
  let base: string;
  if (caratula && nroExp) {
    base = `${caratula} - ${nroExp}`;
  } else if (caratula) {
    base = caratula;
  } else if (nroExp) {
    base = `Expediente ${nroExp}`;
  } else {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    base = `Expediente_${fecha}`;
  }

  return (base.length > 200 ? base.slice(0, 200) : base) + '.pdf';
}

function limpiarTexto(html: string): string {
  if (!html) return '';
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l)
    .join('\n\n');
}

/**
 * Sanitiza texto para PDF WinAnsi (Latin-1). Reemplaza caracteres no codificables
 * (cirílicos, CJK, etc.) por '?' para evitar "WinAnsi cannot encode" (ej. U+0425).
 */
function sanitizeForPdf(text: string): string {
  if (!text) return '';
  return text
    .replace(/\uFFFD/g, '') // Reemplazo Unicode
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control chars
    .replace(/\u2014|\u2013/g, '-') // Em/en dash -> guión
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...') // Ellipsis
    .replace(/[\u2028-\u202F\u205F-\u206F]/g, ' ') // Espacios Unicode
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '?'); // Cualquier char fuera de Latin-1 -> ?
}

export async function generateExpedientePDF(params: {
  expediente: Expediente;
  actuaciones: Actuacion[];
}): Promise<Uint8Array> {
  const { expediente, actuaciones } = params;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const url = expediente.url || '';
  const nroExp = expediente.numero || url.match(/nidCausa=(\d+)/i)?.[1] || '—';
  const fechaExp = new Date().toLocaleDateString('es-AR');

  // Página 1: Índice
  let page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = A4_HEIGHT - 2 * CM;

  page.drawText('ÍNDICE DEL EXPEDIENTE', {
    x: 2 * CM,
    y,
    size: 16,
    font: fontBold,
  });
  y -= 0.6 * CM;

  page.drawText(sanitizeForPdf(`Nº expediente: ${nroExp}`), {
    x: 2 * CM,
    y,
    size: 10,
    font,
  });
  y -= 0.4 * CM;

  if (expediente.juzgado) {
    page.drawText(sanitizeForPdf(expediente.juzgado.slice(0, 80)), {
      x: 2 * CM,
      y,
      size: 10,
      font,
    });
    y -= 0.4 * CM;
  }

  page.drawText(sanitizeForPdf(`Fecha de exportación: ${fechaExp}`), {
    x: 2 * CM,
    y,
    size: 10,
    font,
  });
  y -= 1 * CM;

  const colWidths = [1.2 * CM, 2.5 * CM, 7 * CM, 2 * CM];
  const xStart = 2 * CM;
  const rowH = 0.5 * CM;
  let yTable = y;

  page.drawText('N°', { x: xStart + 0.2 * CM, y: yTable - 0.35 * CM, size: 9, font: fontBold });
  page.drawText('Fecha', {
    x: xStart + colWidths[0] + 0.2 * CM,
    y: yTable - 0.35 * CM,
    size: 9,
    font: fontBold,
  });
  page.drawText('Tipo de actuación', {
    x: xStart + colWidths[0] + colWidths[1] + 0.2 * CM,
    y: yTable - 0.35 * CM,
    size: 9,
    font: fontBold,
  });
  page.drawText('Pág.', {
    x: xStart + colWidths[0] + colWidths[1] + colWidths[2] + 0.2 * CM,
    y: yTable - 0.35 * CM,
    size: 9,
    font: fontBold,
  });
  yTable -= rowH;

  for (let i = 0; i < actuaciones.length; i++) {
    if (yTable < 2 * CM) {
      page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
      yTable = A4_HEIGHT - 2 * CM;
    }
    const act = actuaciones[i];
    const tipo = actuacionTipo(act);
    const fecha = actuacionFecha(act);
    const pagina = 2 + i + 1;
    page.drawText(String(i + 1), {
      x: xStart + 0.2 * CM,
      y: yTable - 0.15 * CM,
      size: 8,
      font,
    });
    page.drawText(sanitizeForPdf((fecha || '—').slice(0, 12)), {
      x: xStart + colWidths[0] + 0.2 * CM,
      y: yTable - 0.15 * CM,
      size: 8,
      font,
    });
    page.drawText(sanitizeForPdf((tipo || '—').slice(0, 45)), {
      x: xStart + colWidths[0] + colWidths[1] + 0.2 * CM,
      y: yTable - 0.15 * CM,
      size: 8,
      font,
    });
    page.drawText(String(pagina), {
      x: xStart + colWidths[0] + colWidths[1] + colWidths[2] + 0.2 * CM,
      y: yTable - 0.15 * CM,
      size: 8,
      font,
    });
    yTable -= rowH;
  }

  // Página 2: Portada — MEV y PJN NUNCA se mezclan; el rótulo depende del portal
  const esPJN = /^https:\/\/scw\.pjn\.gov\.ar/i.test(url);
  const tituloPortada = esPJN ? 'EXPEDIENTE COMPLETO (PJN)' : 'EXPEDIENTE COMPLETO (MEV)';
  page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawText(tituloPortada, {
    x: 2 * CM,
    y: A4_HEIGHT - 2 * CM,
    size: 14,
    font: fontBold,
  });
  page.drawText(sanitizeForPdf(`Fuente: ${url}`), {
    x: 2 * CM,
    y: A4_HEIGHT - 3 * CM,
    size: 10,
    font,
  });
  page.drawText(`Cantidad de actuaciones: ${actuaciones.length}`, {
    x: 2 * CM,
    y: A4_HEIGHT - 4 * CM,
    size: 10,
    font,
  });

  // Páginas de actuaciones
  const maxWidth = A4_WIDTH - 4 * CM;

  for (let i = 0; i < actuaciones.length; i++) {
    page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    const act = actuaciones[i];
    const contenido = limpiarTexto(act.contenido || act.content || '');
    const texto = sanitizeForPdf(contenido.trim() || '(Sin texto visible)');
    const titulo = (act.titulo || act.title || '').trim();
    const tipo = actuacionTipo(act);
    const fecha = actuacionFecha(act);
    const hora = act.hora || '';
    const firmante = (act.firmante || '').trim();

    let yAct = A4_HEIGHT - 2 * CM;

    const header = `ACTUACIÓN ${i + 1}${fecha ? ` — ${fecha}` : ''}${hora ? ` ${hora}` : ''}`;
    page.drawText(sanitizeForPdf(header.slice(0, 90)), {
      x: 2 * CM,
      y: yAct,
      size: 10,
      font: fontBold,
    });
    yAct -= 0.5 * CM;

    if (tipo) {
      page.drawText(sanitizeForPdf(tipo.slice(0, 85)), {
        x: 2 * CM,
        y: yAct,
        size: 9,
        font: fontBold,
      });
      yAct -= 0.4 * CM;
    }

    if (firmante) {
      const firmanteCorto = firmante.replace(/\d{10,}/g, '').trim().slice(0, 70);
      page.drawText(sanitizeForPdf(`Firmado por: ${firmanteCorto}`), {
        x: 2 * CM,
        y: yAct,
        size: 8,
        font,
      });
      yAct -= 0.5 * CM;
    }
    yAct -= 0.3 * CM;

    const words = texto.split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = (line + ' ' + word).trim();
      const width = font.widthOfTextAtSize(test, 10);
      if (width <= maxWidth) {
        line = test;
      } else {
        if (line) {
          page.drawText(sanitizeForPdf(line), {
            x: 2 * CM,
            y: yAct,
            size: 10,
            font,
          });
          yAct -= LINE_HEIGHT;
          line = word;
        }
        if (yAct < 2 * CM) {
          page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
          yAct = A4_HEIGHT - 2 * CM;
        }
      }
    }
    if (line) {
      page.drawText(sanitizeForPdf(line), {
        x: 2 * CM,
        y: yAct,
        size: 10,
        font,
      });
    }
  }

  return doc.save();
}
