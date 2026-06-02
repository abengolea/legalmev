/**
 * Restaura login por contraseña en la cuenta admin (si se perdió tras merge-google).
 *
 * Opción A — definir nueva contraseña:
 *   ADMIN_EMAIL=abengolea1@gmail.com ADMIN_PASSWORD=TuClave node scripts/restore-admin-password.js
 *
 * Opción B — generar link de restablecimiento (sin contraseña en consola):
 *   node scripts/restore-admin-password.js --reset-link
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'abengolea1@gmail.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const RESET_LINK = process.argv.includes('--reset-link');

function initFirebase() {
  const credPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), 'caseclarity-hij0x-firebase-adminsdk-fbsvc-18fc24b926.json'),
  ].filter(Boolean);
  let credPath = null;
  for (const p of credPaths) {
    const resolved = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    if (fs.existsSync(resolved)) {
      credPath = resolved;
      break;
    }
  }
  if (!credPath) {
    console.error('ERROR: credenciales Firebase no encontradas.');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
  }
  return admin.auth();
}

async function main() {
  const auth = initFirebase();
  const user = await auth.getUserByEmail(ADMIN_EMAIL);
  console.log('UID:', user.uid);
  console.log('Proveedores:', user.providerData.map((p) => p.providerId).join(', ') || '(ninguno)');

  if (ADMIN_PASSWORD) {
    await auth.updateUser(user.uid, { password: ADMIN_PASSWORD });
    console.log('OK: contraseña actualizada. Podés iniciar sesión con email + contraseña.');
    return;
  }

  if (RESET_LINK) {
    const link = await auth.generatePasswordResetLink(ADMIN_EMAIL);
    console.log('Link de restablecimiento (abrilo en el navegador, válido ~1 hora):');
    console.log(link);
    return;
  }

  console.error('Pasá ADMIN_PASSWORD=... o usá --reset-link');
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
