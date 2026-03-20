/**
 * Agrega "Colegio de Abogados de San Nicolás" como colegio con convenio activo.
 *
 * Uso:
 *   node scripts/seed-colegio-san-nicolas.js
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS o el archivo de credenciales en la raíz.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const COLEGIO_NAME = 'Colegio de Abogados de San Nicolás';

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
    // Verificar si ya existe
    const existing = await db
      .collection('colegios')
      .where('name', '==', COLEGIO_NAME)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log('OK: El colegio ya existe en la base de datos.');
      process.exit(0);
      return;
    }

    const now = new Date().toISOString();
    await db.collection('colegios').add({
      name: COLEGIO_NAME,
      convenioActivo: true,
      members: [],
      cuotaMensual: null,
      montoConvenio: null,
      moneda: 'ARS',
      periodoFacturacion: 'mensual',
      notas: '',
      contactoFacturacion: '',
      createdAt: now,
      updatedAt: now,
    });

    console.log('OK: Colegio de Abogados de San Nicolás creado correctamente.');
    console.log('  Recordá subir el Excel de miembros desde Admin > Colegios para habilitar el acceso premium.');
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }

  process.exit(0);
}

main();
