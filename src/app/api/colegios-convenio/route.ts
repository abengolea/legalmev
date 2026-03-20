import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/colegios-convenio
 * Lista colegios de abogados con convenio activo. Público (solo nombres para el dashboard).
 */
export async function GET() {
  try {
    const adminDb = getAdminDb();
    const colegiosSnap = await adminDb
      .collection('colegios')
      .where('convenioActivo', '==', true)
      .get();

    const rawNames = colegiosSnap.docs
      .map((d) => (d.data().name ?? '').trim())
      .filter(Boolean);
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const seen = new Set<string>();
    // Ordenar por longitud descendente para mantener "San Nicolás" sobre "San Nicolá"
    const colegios = rawNames
      .sort((a, b) => b.length - a.length || a.localeCompare(b))
      .filter((name) => {
        const key = normalize(name);
        if (seen.has(key)) return false;
        // Evitar duplicados por typos: "San Nicolá" vs "San Nicolas"
        const isDuplicate = [...seen].some((k) => {
          const [short, long] = key.length <= k.length ? [key, k] : [k, key];
          return long.startsWith(short) && long.length - short.length <= 2;
        });
        if (isDuplicate) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b)); // orden final alfabético

    return NextResponse.json({ ok: true, colegios });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 }
    );
  }
}
