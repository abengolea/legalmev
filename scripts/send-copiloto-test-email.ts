import { readFileSync } from 'fs';
import { Resend } from 'resend';
import { buildCopilotoAudienciaAnnouncementHtml } from '../src/lib/email-templates';

const to = process.argv[2] || 'abengolea1@gmail.com';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  let val = trimmed.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  val = val.replace(/\\n/g, '\n');
  process.env[key] = val;
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM || 'LegalMev <onboarding@resend.dev>';
const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar').replace(/\/$/, '');

if (!apiKey) {
  console.error('RESEND_API_KEY no configurada en .env.local');
  process.exit(1);
}

const resend = new Resend(apiKey);
const html = buildCopilotoAudienciaAnnouncementHtml({
  firstName: 'Adrian',
  copilotUrl: `${site}/dashboard/copiloto-audiencias`,
});

async function main() {
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'Nuevo en LegalMev: Copiloto de Audiencias — 1 audiencia de prueba incluida',
    html,
  });

  if (error) {
    console.error('Error Resend:', error);
    process.exit(1);
  }

  console.log(`Correo de prueba enviado a ${to} (id: ${data?.id ?? '—'})`);
}

void main();
