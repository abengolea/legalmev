/**
 * Deploy con inyección de env: el framework de Firebase Hosting genera
 * .firebase/PROJECT/functions/.env con solo 3 vars. Este script inyecta
 * FIREBASE_* y APP_* desde .env.local en ese archivo cuando se crea.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FIREBASE_DIR = path.join(ROOT, '.firebase');

function loadEnvFrom(pathToFile) {
  if (!fs.existsSync(pathToFile)) return {};
  const content = fs.readFileSync(pathToFile, 'utf8');
  const vars = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      vars[m[1].trim()] = val;
    }
  }
  return vars;
}

function injectIntoFunctionsEnv(functionsEnvPath, ourVars) {
  const existing = fs.existsSync(functionsEnvPath)
    ? fs.readFileSync(functionsEnvPath, 'utf8')
    : '';
  const existingVars = loadEnvFrom(functionsEnvPath);
  // Cloud Functions reserva FIREBASE_*, solo inyectar APP_* (firebase-admin.ts las usa)
  const toInject = {
    APP_PROJECT_ID: ourVars.APP_PROJECT_ID ?? ourVars.FIREBASE_PROJECT_ID,
    APP_CLIENT_EMAIL: ourVars.APP_CLIENT_EMAIL ?? ourVars.FIREBASE_CLIENT_EMAIL,
    APP_PRIVATE_KEY: ourVars.APP_PRIVATE_KEY ?? ourVars.FIREBASE_PRIVATE_KEY,
    APP_STORAGE_BUCKET: ourVars.APP_STORAGE_BUCKET ?? ourVars.FIREBASE_STORAGE_BUCKET,
    GOOGLE_GENAI_API_KEY: ourVars.GOOGLE_GENAI_API_KEY,
    RESEND_API_KEY: ourVars.RESEND_API_KEY,
    RESEND_FROM: ourVars.RESEND_FROM,
  };
  let extra = '';
  for (const [k, v] of Object.entries(toInject)) {
    if (v && !existingVars[k]) {
      let val = v;
      if (val.includes('\n') || val.includes(' ')) val = `"${val}"`;
      extra += `${k}=${val}\n`;
    }
  }
  if (extra) {
    const merged = existing.trimEnd() + (existing.endsWith('\n') ? '' : '\n') + '\n# Inyectadas desde .env.local\n' + extra;
    fs.writeFileSync(functionsEnvPath, merged);
    console.log('✓ Variables inyectadas en', path.relative(ROOT, functionsEnvPath));
  }
}

function watchAndInject() {
  const ourVars = loadEnvFrom(path.join(ROOT, '.env.local'));
  if (!ourVars.FIREBASE_PROJECT_ID && !ourVars.APP_PROJECT_ID) {
    console.warn('⚠ .env.local no tiene FIREBASE_PROJECT_ID ni APP_PROJECT_ID');
    return;
  }

  const check = () => {
    if (!fs.existsSync(FIREBASE_DIR)) return;
    const projects = fs.readdirSync(FIREBASE_DIR);
    for (const proj of projects) {
      const envPath = path.join(FIREBASE_DIR, proj, 'functions', '.env');
      if (fs.existsSync(envPath)) {
        injectIntoFunctionsEnv(envPath, ourVars);
      }
    }
  };

  check(); // una vez al iniciar
  const iv = setInterval(check, 400);
  return () => clearInterval(iv);
}

// Ejecutar deploy
const deploy = spawn('firebase', ['deploy'], {
  stdio: 'inherit',
  shell: true,
  cwd: ROOT
});

const stopWatch = watchAndInject();

deploy.on('close', (code) => {
  if (stopWatch) stopWatch();
  process.exit(code ?? 0);
});
