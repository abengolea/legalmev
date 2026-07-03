import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function friendlyHttpError(status: number, raw: string): string {
  const trimmed = raw.trim();
  if (
    trimmed.startsWith('<') ||
    trimmed.includes('<!DOCTYPE') ||
    trimmed.includes('__NEXT_DATA__')
  ) {
    return `Error del servidor (${status}). Reintentá en unos minutos; si persiste, contactá a soporte.`;
  }
  return trimmed || `Error ${status}`;
}

/** Parsea respuesta como JSON. Si falla (ej. "Internal Server Error" en texto), retorna { ok: false, error }. */
export async function safeResJson<T = { ok?: boolean; error?: string }>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return { ok: false, error: friendlyHttpError(res.status, text) } as T;
  }
}

