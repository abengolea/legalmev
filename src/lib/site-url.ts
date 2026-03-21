/**
 * URL base del sitio según el entorno.
 * Producción: https://www.legalmev.com.ar
 * Desarrollo/staging: se usa NEXT_PUBLIC_SITE_URL o fallback a localhost
 */
const PRODUCTION_URL = 'https://www.legalmev.com.ar';

export function getSiteUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.endsWith('/') ? env.slice(0, -1) : env;
  if (process.env.NODE_ENV === 'production') return PRODUCTION_URL;
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9002';
}

export const SITE_URL = typeof window === 'undefined'
  ? (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || (process.env.NODE_ENV === 'production' ? PRODUCTION_URL : 'http://localhost:9002'))
  : '';
