/**
 * Crea el usuario admin inicial abengolea1@gmail.com en Firebase Auth + Firestore.
 *
 * Uso:
 *   ADMIN_PASSWORD=TuContraseñaSegura node scripts/create-admin.js
 *
 * Si el usuario ya existe en Auth, solo actualiza el rol en Firestore.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'abengolea1@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Adrian Bengolea';

async function main() {
  if (!ADMIN_PASSWORD) {
    console.error('ERROR: Definí ADMIN_PASSWORD como variable de entorno.');
    console.error('Ejemplo: ADMIN_PASSWORD=MiClave123 node scripts/create-admin.js');
    process.exit(1);
  }

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
    console.error('ERROR: No se encontró el archivo de credenciales de Firebase.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    let uid;
    try {
      const existingUser = await auth.getUserByEmail(ADMIN_EMAIL);
      uid = existingUser.uid;
      console.log('Usuario existente en Auth, actualizando Firestore...');
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        const newUser = await auth.createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          displayName: ADMIN_NAME,
          emailVerified: true,
        });
        uid = newUser.uid;
        console.log('Usuario creado en Firebase Auth:', ADMIN_EMAIL);
      } else {
        throw e;
      }
    }

    await db.collection('users').doc(uid).set(
      {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        role: 'admin',
        status: 'activo',
        tier: 'premium',
        downloadsThisMonth: 0,
        monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log('OK: Usuario admin configurado correctamente.');
    console.log('  Email:', ADMIN_EMAIL);
    console.log('  UID:', uid);
    console.log('  Podés iniciar sesión en la app con este correo y contraseña.');
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }

  process.exit(0);
}

main();
