import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithDevice } from '@/lib/require-auth-device';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id',
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
    const authResult = await requireAuthWithDevice(request);
    if (!authResult.ok) {
      return NextResponse.json(
        { ok: false, error: authResult.error },
        { status: authResult.status, headers: corsHeaders }
      );
    }

    const { uid, userData } = authResult;
    const plan = userData.tier ?? 'free';
    const email = (userData.email as string) ?? '';
    const displayName = (userData.displayName as string) ?? '';
    const nombre = displayName?.trim()
      ? displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase()
      : email?.split('@')[0]
        ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1).toLowerCase()
        : 'usuario';

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: uid,
          email,
          plan,
          nombre,
        },
      },
      { headers: corsHeaders }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 401, headers: corsHeaders });
  }
}
