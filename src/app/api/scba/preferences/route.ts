/**
 * API para preferencias SCBA del usuario.
 * GET: leer preferencias
 * PATCH: guardar preferencias (materias y keywords de interés)
 *
 * No se expone en la UI. Solo para pruebas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

export interface ScbaPreferences {
  materias: string[];
  keywords: string[];
}

async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const decoded = await getAuth().verifyIdToken(token);
  return decoded.uid;
}

export async function GET(request: NextRequest) {
  try {
    const uid = await requireAuth(request);
    if (!uid) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const data = userSnap.data();
    const prefs = (data?.scbaPreferences as ScbaPreferences) ?? {
      materias: [],
      keywords: [],
    };

    return NextResponse.json({
      ok: true,
      preferences: {
        materias: prefs.materias ?? [],
        keywords: prefs.keywords ?? [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const uid = await requireAuth(request);
    if (!uid) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const materias = Array.isArray(body.materias) ? body.materias : [];
    const keywords = Array.isArray(body.keywords) ? body.keywords : [];

    const adminDb = getAdminDb();
    await adminDb.collection('users').doc(uid).set(
      {
        scbaPreferences: { materias, keywords },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      preferences: { materias, keywords },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
