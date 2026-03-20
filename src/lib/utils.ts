import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Parsea respuesta como JSON. Si falla (ej. "Internal Server Error" en texto), retorna { ok: false, error }. */
export async function safeResJson<T = { ok?: boolean; error?: string }>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return { ok: false, error: text || `Error ${res.status}` } as T;
  }
}

