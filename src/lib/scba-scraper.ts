/**
 * Scraper de novedades SCBA (Suprema Corte de Justicia de Buenos Aires).
 * Obtiene las sentencias destacadas desde novedades.asp
 */

import * as cheerio from 'cheerio';

const SCBA_NOVEDADES_URL = 'https://scba.gov.ar/novedades.asp?id=1&clase=2';

export interface ScbaSentencia {
  /** Número/tipo de causa (ej. "I. 75.873", "A. 79.012") */
  causa: string;
  /** Título completo tal como aparece en la web */
  titulo: string;
  /** Resumen/extracto del fallo */
  resumen: string;
  /** Materias/temas extraídos del título (ej. Inconstitucionalidad, Amparo) */
  materias: string[];
  /** Enlace al PDF si existe */
  pdfUrl?: string;
}

function normalizarTexto(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[\u00a0]/g, ' ').trim();
}

/**
 * Extrae palabras clave/materias del título de la causa.
 * Ej: "Acción Originaria de Inconstitucionalidad" -> ["inconstitucionalidad"]
 *     "Recurso de Inaplicabilidad de Ley" -> ["inaplicabilidad"]
 *     "Amparo Sindical" -> ["amparo", "sindical"]
 */
function extraerMaterias(titulo: string): string[] {
  const materiasConocidas = [
    'inconstitucionalidad',
    'inaplicabilidad',
    'amparo',
    'sindical',
    'laboral',
    'contencioso administrativo',
    'previsión',
    'discapacidad',
    'homicidio',
    'culposo',
    'dolo eventual',
    'ambiente',
    'ambiental',
    'competencia',
    'acceso a la información',
    'información pública',
    'autodeterminación',
    'derecho a la vida',
    'demanda colectiva',
  ];
  const t = titulo.toLowerCase();
  const encontradas: string[] = [];
  for (const m of materiasConocidas) {
    if (t.includes(m) && !encontradas.includes(m)) {
      encontradas.push(m);
    }
  }
  return encontradas;
}

/**
 * Parsea el HTML de la página de novedades SCBA y extrae las sentencias.
 */
function parsearHtml(html: string): ScbaSentencia[] {
  const $ = cheerio.load(html, { decodeEntities: true });
  const sentencias: ScbaSentencia[] = [];

  // La página SCBA usa h6 para cada bloque de causa
  const h6Elements = $('h6').toArray();
  let i = 0;
  while (i < h6Elements.length) {
    const h6 = $(h6Elements[i]);
    const texto = normalizarTexto(h6.text());
    if (texto.startsWith('Causa ') && !texto.startsWith('Causa Ver ') && !texto.includes('Archivos asociados')) {
      const titulo = texto;
      // Extraer número de causa (ej. "I. 75.873", "A. 79.012")
      const match = titulo.match(/Causa\s+([A-Z]\.\s*\d[\d.]*)/i);
      const causa = match ? match[1].trim() : titulo.slice(0, 80);

      let resumen = '';
      let pdfUrl: string | undefined;

      // Buscar el contenido hasta el próximo h6
      let next = h6.next();
      while (next.length) {
        const tag = next.prop('tagName')?.toLowerCase();
        if (tag === 'h6') {
          const nextText = normalizarTexto(next.text());
          if (nextText.includes('Archivos asociados')) {
            const href = next.find('a').attr('href');
            if (href && href.toLowerCase().endsWith('.pdf')) {
              pdfUrl = href.startsWith('http') ? href : `https://scba.gov.ar/${href.replace(/^\//, '')}`;
            }
          }
          break;
        }
        if (tag === 'p' || tag === 'td' || tag === 'div') {
          const txt = normalizarTexto(next.text());
          if (txt && !txt.includes('Archivos asociados') && !txt.includes('En pantalla')) {
            resumen = resumen ? `${resumen} ${txt}` : txt;
          }
        }
        next = next.next();
      }

      if (resumen || titulo) {
        sentencias.push({
          causa,
          titulo,
          resumen: resumen || titulo,
          materias: extraerMaterias(titulo),
          pdfUrl,
        });
      }
    }
    i++;
  }

  // Fallback: si no hay h6, usar regex sobre el texto del body
  if (sentencias.length === 0) {
    const bodyText = $('body').text();
    const bloqueRegex = /Causa\s+([A-Z]\.\s*[\d.]+)\s*[("](.*?)[")]\.\s*([^.]+(?:\.[^.]+)*)/gi;
    let m: RegExpExecArray | null;
    while ((m = bloqueRegex.exec(bodyText)) !== null) {
      const causa = m[1].trim();
      const titulo = `Causa ${m[1]} (${m[2]}). ${m[3]}`;
      const hastaProximo = bodyText.slice(m.index + m[0].length);
      const finResumen = hastaProximo.search(/\n\s*Causa\s+[A-Z]\.\s*\d|\n\s*Archivos asociados/i);
      const resumen = (finResumen >= 0 ? hastaProximo.slice(0, finResumen) : hastaProximo.slice(0, 1500))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2000);

      if (resumen.length > 50) {
        sentencias.push({
          causa,
          titulo: titulo.slice(0, 500),
          resumen,
          materias: extraerMaterias(titulo),
        });
      }
    }
  }

  return sentencias;
}

/**
 * Obtiene las novedades (sentencias destacadas) de la SCBA.
 */
export async function fetchScbaNovedades(limite = 20): Promise<ScbaSentencia[]> {
  const res = await fetch(SCBA_NOVEDADES_URL, {
    headers: {
      'User-Agent': 'LegalMEV/1.0 (bot; contacto@legalmev.com)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) {
    throw new Error(`SCBA: HTTP ${res.status}`);
  }

  const html = await res.text();
  const sentencias = parsearHtml(html);
  return sentencias.slice(0, limite);
}

/**
 * Filtra sentencias según las materias o palabras clave de interés del usuario.
 */
export function filtrarPorPreferencias(
  sentencias: ScbaSentencia[],
  preferencias: { materias?: string[]; keywords?: string[] }
): ScbaSentencia[] {
  const materias = (preferencias.materias ?? []).map((m) => m.toLowerCase());
  const keywords = (preferencias.keywords ?? []).map((k) => k.toLowerCase());

  if (materias.length === 0 && keywords.length === 0) {
    return sentencias;
  }

  return sentencias.filter((s) => {
    const texto = `${s.titulo} ${s.resumen}`.toLowerCase();
    const matchMateria = materias.some((m) => s.materias.some((sm) => sm.includes(m) || m.includes(sm)));
    const matchKeyword = keywords.some((k) => texto.includes(k));
    return matchMateria || matchKeyword;
  });
}
