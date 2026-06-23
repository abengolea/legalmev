import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { requirePlatformAdmin } from '@/lib/api-auth';

/**
 * GET /api/admin/users/registration-dates
 * Mapa uid → fecha de creación en Firebase Auth (ISO).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const adminAuth = getAuth();
    const dates: Record<string, string> = {};
    let nextPageToken: string | undefined;

    do {
      const result = await adminAuth.listUsers(1000, nextPageToken);
      for (const user of result.users) {
        dates[user.uid] = user.metadata.creationTime;
      }
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    return NextResponse.json({ ok: true, dates });
  } catch (err) {
    console.error('[admin/users/registration-dates] GET error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
