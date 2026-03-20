/**
 * Corrige el nombre "San Nicolas" a "Colegio de Abogados de San Nicolás".
 *
 * Uso: node scripts/fix-san-nicolas-name.js
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const CORRECT_NAME = 'Colegio de Abogados de San Nicolás';

async function main() {
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

  const db = admin.firestore();

  try {
    const snap = await db
      .collection('colegios')
      .where('convenioActivo', '==', true)
      .get();

    const toFix = snap.docs.find((d) => {
      const n = (d.data().name ?? '').toLowerCase();
      return n.includes('san nicolas') && !n.includes('nicolás');
    });

    if (!toFix) {
      console.log('OK: No hay colegio "San Nicolas" (sin tilde) para corregir.');
      process.exit(0);
      return;
    }

    await db.collection('colegios').doc(toFix.id).update({
      name: CORRECT_NAME,
      updatedAt: new Date().toISOString(),
    });

    console.log('OK: Nombre corregido a "Colegio de Abogados de San Nicolás".');
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }

  process.exit(0);
}

main();
