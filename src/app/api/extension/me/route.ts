import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getAdminDb } from '@/lib/firebase-admin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/extension/me
 * Valida el token Bearer y devuelve datos del usuario (id, email, plan).
 * Usado por la extensión LegalMev para verificar autenticación.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ ok: false }, { status: 401, headers: corsHeaders });
    }

    const adminAuth = getAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminDb();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.data();

    if (!userSnap.exists || !userData) {
      return NextResponse.json({ ok: false }, { status: 401, headers: corsHeaders });
    }

    const plan = userData.tier ?? 'free';

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: uid,
          email: decoded.email ?? userData.email ?? '',
          plan,
        },
      },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 401, headers: corsHeaders });
  }
}
