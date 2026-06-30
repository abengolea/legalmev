import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { authorizeControlPrueba } from '@/lib/control-prueba-api-auth';
import {
  extractMetadataFromExpedienteText,
  mergeMetadataLocal,
} from '@/lib/control-prueba';

/** POST /api/admin/control-prueba/scrape-url — extrae texto del expediente virtual */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeControlPrueba(request);
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ ok: false, error: 'URL requerida' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ ok: false, error: 'URL inválida' }, { status: 400 });
    }

    const host = parsed.hostname.toLowerCase();
    const ALLOWED_HOSTS = ['mev.scba.gov.ar', 'pjn.gov.ar', 'scw.pjn.gov.ar'];
    const hostAllowed = ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    if (parsed.protocol !== 'https:' || !hostAllowed) {
      return NextResponse.json(
        { ok: false, error: 'Solo se admiten URLs https de MEV SCBA o PJN/SCW' },
        { status: 400 },
      );
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `El servidor respondió ${res.status}. Puede requerir sesión activa en MEV.` },
        { status: 502 },
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();
    const texto = $('body').text().replace(/\s+/g, ' ').trim();

    if (texto.length < 100) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Contenido insuficiente. Probablemente requiere login en el expediente virtual.',
          code: 'AUTH_REQUIRED',
        },
        { status: 422 },
      );
    }

    const metadata = mergeMetadataLocal({}, extractMetadataFromExpedienteText(texto));

    return NextResponse.json({
      ok: true,
      texto: texto.slice(0, 500_000),
      textoLength: texto.length,
      textoPreview: texto.slice(0, 800),
      metadata,
      url,
    });
  } catch (err) {
    console.error('[control-prueba/scrape-url]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error al obtener URL' },
      { status: 500 },
    );
  }
}
