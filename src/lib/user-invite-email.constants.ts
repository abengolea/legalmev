/** Constantes y helpers client-safe para invitaciones (sin Resend / Node). */

export const USER_INVITE_CONFIRM = 'ENVIAR_INVITACIONES';
export const USER_INVITE_MAX_RECIPIENTS = 100;
export const USER_INVITE_DEFAULT_SUBJECT = 'Te invitamos a LegalMev — exportá expedientes a PDF';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/** Extrae emails únicos de texto libre (coma, punto y coma, espacios, saltos de línea). */
export function parseEmailList(raw: string): { emails: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[\s,;<>]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    const cleaned = token.replace(/^(to|cc|bcc):/i, '');
    if (!cleaned.includes('@')) continue;
    if (!isValidEmail(cleaned)) {
      if (!invalid.includes(cleaned)) invalid.push(cleaned);
      continue;
    }
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    emails.push(cleaned);
  }

  return { emails, invalid };
}
