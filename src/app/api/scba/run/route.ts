/**
 * API para ejecutar el fetch y resumen de novedades SCBA.
 * POST: dispara el proceso (solo para testing, no visible en sidebar).
 * Requiere autenticación.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';
import {
  fetchScbaNovedades,
  filtrarPorPreferencias,
  type ScbaSentencia,
} from '@/lib/scba-scraper';
import { summarizeScbaSentencia } from '@/ai/flows/scba-summarize-flow';

const MAX_SENTENCIAS_PROCESAR = 10;

async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey =
      process.env.GOOGLE_GENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Falta GOOGLE_GENAI_API_KEY en .env.local. Obtené una en https://aistudio.google.com/apikey',
        },
        { status: 503 }
      );
    }

    const uid = await requireAuth(request);
    if (!uid) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.data();
    const prefs = (userData?.scbaPreferences as { materias?: string[]; keywords?: string[] }) ?? {};
    const limite = Math.min(
      Number(request.nextUrl.searchParams.get('limite')) || MAX_SENTENCIAS_PROCESAR,
      20
    );

    const sentencias = await fetchScbaNovedades(limite);
    const filtradas = filtrarPorPreferencias(sentencias, {
      materias: prefs.materias,
      keywords: prefs.keywords,
    });

    const aProcesar =
      filtradas.length > 0
        ? filtradas.slice(0, Math.min(limite, 5))
        : sentencias.slice(0, Math.min(limite, 5));

    const resumenes: Array<{
      causa: string;
      titulo: string;
      resumenOriginal: string;
      resumenIA: string;
      pdfUrl?: string;
    }> = [];

    for (const s of aProcesar) {
      try {
        const resumenIA = await summarizeScbaSentencia(s);
        resumenes.push({
          causa: s.causa,
          titulo: s.titulo,
          resumenOriginal: s.resumen.slice(0, 500),
          resumenIA,
          pdfUrl: s.pdfUrl,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[scba/run] Error en sentencia', s.causa, errMsg);
        resumenes.push({
          causa: s.causa,
          titulo: s.titulo,
          resumenOriginal: s.resumen.slice(0, 500),
          resumenIA: `(Error: ${errMsg.slice(0, 80)})`,
          pdfUrl: s.pdfUrl,
        });
      }
    }

    const fecha = new Date().toISOString().slice(0, 10);
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('scbaSummaries')
      .doc(fecha)
      .set(
        {
          fecha,
          sentencias: resumenes,
          totalFetched: sentencias.length,
          filtered: filtradas.length,
          processed: resumenes.length,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

    return NextResponse.json({
      ok: true,
      totalFetched: sentencias.length,
      filtered: filtradas.length,
      processed: resumenes.length,
      summaries: resumenes,
    });
  } catch (err) {
    console.error('[scba/run]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Error en SCBA',
      },
      { status: 500 }
    );
  }
}
