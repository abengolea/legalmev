/**
 * Carga explícita de .env.local para desarrollo.
 * Next.js + Turbopack a veces no carga variables server-side; este fallback las asegura.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
    const path = await import('path');
    const { config } = await import('dotenv');
    const envPath = path.join(process.cwd(), '.env.local');
    config({ path: envPath, override: true });
  }
}
