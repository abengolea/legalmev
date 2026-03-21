/**
 * GET /api/payments/debug-dlocal
 * Solo en desarrollo: indica si Next.js está cargando DLOCAL_* en el servidor.
 * Ayuda a diagnosticar por qué "DLocal no está configurado" en local.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ ok: false, error: 'Solo en desarrollo' }, { status: 404 });
  }

  const apiKey = process.env.DLOCAL_API_KEY;
  const secretKey = process.env.DLOCAL_SECRET_KEY;

  return NextResponse.json({
    ok: true,
    dlocal: {
      hasApiKey: !!(apiKey?.trim()),
      hasSecretKey: !!(secretKey?.trim()),
      configured: !!(apiKey?.trim() && secretKey?.trim()),
      apiKeyLength: apiKey?.length ?? 0,
      secretKeyLength: secretKey?.length ?? 0,
    },
    hint: !(apiKey?.trim() && secretKey?.trim())
      ? 'Next.js no está leyendo DLOCAL_* desde .env.local. Verificá: 1) Archivo en raíz 2) Reiniciar npm run dev 3) Sin espacios/quotes raros'
      : null,
  });
}
