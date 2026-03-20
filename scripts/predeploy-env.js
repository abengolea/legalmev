/**
 * Predeploy: copia .env.local a .env.caseclarity-hij0x y asegura vars APP_* para Firebase.
 * El framework de Firebase Hosting busca .env.PROJECT_ID en la raíz.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_LOCAL = path.join(ROOT, '.env.local');
const ENV_PROJECT = path.join(ROOT, '.env.caseclarity-hij0x');

if (!fs.existsSync(ENV_LOCAL)) {
  console.warn('⚠ No existe .env.local. Creá uno con FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET');
  process.exit(0);
  return;
}

const content = fs.readFileSync(ENV_LOCAL, 'utf8');
const lines = content.split('\n');
const vars = {};
for (const line of lines) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) {
    const key = m[1].trim();
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    vars[key] = val;
  }
}

// Asegurar APP_* (Cloud Functions reserva FIREBASE_*, solo permiten APP_*)
if (!vars.APP_PROJECT_ID && vars.FIREBASE_PROJECT_ID) vars.APP_PROJECT_ID = vars.FIREBASE_PROJECT_ID;
if (!vars.APP_CLIENT_EMAIL && vars.FIREBASE_CLIENT_EMAIL) vars.APP_CLIENT_EMAIL = vars.FIREBASE_CLIENT_EMAIL;
if (!vars.APP_PRIVATE_KEY && vars.FIREBASE_PRIVATE_KEY) vars.APP_PRIVATE_KEY = vars.FIREBASE_PRIVATE_KEY;
if (!vars.APP_STORAGE_BUCKET && vars.FIREBASE_STORAGE_BUCKET) vars.APP_STORAGE_BUCKET = vars.FIREBASE_STORAGE_BUCKET;

// Cloud Functions reserva FIREBASE_*, X_GOOGLE_*, EXT_* - solo incluir vars permitidas
const reserved = /^(FIREBASE_|X_GOOGLE_|EXT_)/;
const allowedKeys = ['APP_PROJECT_ID', 'APP_CLIENT_EMAIL', 'APP_PRIVATE_KEY', 'APP_STORAGE_BUCKET', 'GOOGLE_GENAI_API_KEY', 'RESEND_API_KEY', 'RESEND_FROM'];
for (const k of Object.keys(vars)) {
  if (vars[k] && (allowedKeys.includes(k) || (k.startsWith('NEXT_PUBLIC_') && !reserved.test(k))))
    allowedKeys.push(k);
}
const outLines = [];
outLines.push('# Generado desde .env.local (solo vars permitidas por Cloud Functions)');
for (const k of ['APP_PROJECT_ID', 'APP_CLIENT_EMAIL', 'APP_PRIVATE_KEY', 'APP_STORAGE_BUCKET']) {
  const v = vars[k];
  if (v) outLines.push(`${k}=${v.includes('\n') || v.includes(' ') ? `"${v}"` : v}`);
}
if (vars.GOOGLE_GENAI_API_KEY) outLines.push(`GOOGLE_GENAI_API_KEY=${vars.GOOGLE_GENAI_API_KEY}`);
if (vars.RESEND_API_KEY) outLines.push(`RESEND_API_KEY=${vars.RESEND_API_KEY}`);
if (vars.RESEND_FROM) outLines.push(`RESEND_FROM=${vars.RESEND_FROM}`);
for (const k of Object.keys(vars)) {
  if (k.startsWith('NEXT_PUBLIC_') && vars[k]) outLines.push(`${k}=${vars[k]}`);
}
fs.writeFileSync(ENV_PROJECT, outLines.join('\n') + '\n');
console.log('✓ Generado .env.caseclarity-hij0x (solo APP_* y vars permitidas)');
