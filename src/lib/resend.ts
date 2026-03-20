import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM || 'LegalMev <onboarding@resend.dev>';

export const resend = apiKey ? new Resend(apiKey) : null;

export function canSendEmail(): boolean {
  return !!resend && !!apiKey;
}

export function getFromAddress(): string {
  return from;
}
