/**
 * Envía un email de prueba de verificación a un destinatario.
 * Uso: node scripts/send-test-verification-email.js
 *      node scripts/send-test-verification-email.js --debug  (diagnóstico)
 *
 * Requiere RESEND_API_KEY en .env.local
 */
const path = require('path');
const fs = require('fs');
const { Resend } = require('resend');

// Raíz del proyecto
const root = path.resolve(__dirname, '..');
const DEBUG = process.argv.includes('--debug');

// Cargar de varios archivos (.env.local, .env, .env.development)
function loadEnv() {
  const vars = {};
  const files = ['.env.local', '.env', '.env.development'];

  for (const file of files) {
    const envPath = path.join(root, file);
    if (!fs.existsSync(envPath)) continue;

    const raw = fs.readFileSync(envPath, 'utf8');
    const content = raw
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed
        .substring(eqIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!vars[key]) vars[key] = value; // no sobrescribir
    });
  }
  return vars;
}

const vars = loadEnv();

if (DEBUG) {
  console.log('📂 Raíz:', root);
  for (const f of ['.env.local', '.env', '.env.development']) {
    const p = path.join(root, f);
    console.log('📄', f + ':', fs.existsSync(p) ? 'existe' : 'no existe');
  }
  console.log('🔑 RESEND_API_KEY:', vars.RESEND_API_KEY ? 'encontrada' : 'no encontrada');
  process.exit(0);
}

const RESEND_API_KEY = vars.RESEND_API_KEY;
const RESEND_FROM = vars.RESEND_FROM || 'LegalMev <onboarding@resend.dev>';
const SITE_URL = vars.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar';
const TEST_EMAIL = 'abengolea1@gmail.com';

function buildHtml(verifyUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.6;color:#333;background-color:#f5f5f5;">
  <div style="max-width:480px;margin:32px auto;padding:32px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <p style="margin:0 0 16px;font-size:16px;">Hola,</p>
    <p style="margin:0 0 24px;">Verificá tu correo electrónico para activar tu cuenta en LegalMev.</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background-color:#2A6A78;color:#fff !important;text-decoration:none;font-weight:600;font-size:15px;border-radius:6px;">Verificar mi email</a>
    </p>
    <p style="margin:0;font-size:14px;color:#666;">Si no pediste esto, ignorá este correo.</p>
    <p style="margin:24px 0 0;font-size:14px;color:#999;">— El equipo de LegalMev</p>
  </div>
</body>
</html>
`;
}

async function main() {
  if (!RESEND_API_KEY) {
    console.error('❌ Falta RESEND_API_KEY en .env.local');
    console.error('   Revisá .env.local, .env o .env.development en:', root);
    process.exit(1);
  }

  const resend = new Resend(RESEND_API_KEY);
  const verifyUrl = `${SITE_URL.replace(/\/$/, '')}/auth/action?verified=1`;
  const html = buildHtml(verifyUrl);

  console.log('Enviando email de prueba a', TEST_EMAIL, '...');
  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: TEST_EMAIL,
    subject: 'Verificá tu email - LegalMev (prueba)',
    html,
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  console.log('✅ Email enviado. Revisá la bandeja de', TEST_EMAIL);
  console.log('   (Si no aparece, revisá spam. El link lleva a la página de éxito.)');
}

main();
