/**
 * Elimina colegios duplicados (ej. "San Nicolá" sin 's', "San Nicolas" sin tilde).
 * Mantiene "Colegio de Abogados de San Nicolás" como único.
 *
 * Uso: node scripts/remove-colegio-duplicate.js
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

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

    const colegios = snap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name ?? '').trim(),
    })).filter((c) => c.name);

    // Buscar duplicados de San Nicolás
    const sanNicolasVariants = colegios.filter((c) => {
      const n = normalize(c.name);
      return n.includes('san nicolas') || n.includes('san nicola');
    });

    if (sanNicolasVariants.length <= 1) {
      console.log('OK: No hay duplicados de San Nicolás.');
      process.exit(0);
      return;
    }

    // Ordenar: más largo primero; si empatan, preferir "Nicolás" con tilde
    sanNicolasVariants.sort((a, b) => {
      const len = b.name.length - a.name.length;
      if (len !== 0) return len;
      return a.name.includes('Nicolás') ? 1 : -1; // Nicolás va primero
    });

    const toKeep = sanNicolasVariants[0];
    const toDelete = sanNicolasVariants.slice(1);

    for (const dup of toDelete) {
      await db.collection('colegios').doc(dup.id).delete();
      console.log('Eliminado duplicado:', dup.name);
    }

    console.log('OK: Se mantuvo:', toKeep.name);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }

  process.exit(0);
}

main();
