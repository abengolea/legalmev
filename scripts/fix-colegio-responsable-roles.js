/**
 * Corrige responsables de colegio que tengan role=admin por error.
 * Los responsables (adminEmails) deben tener role=abogado.
 *
 * Uso:
 *   node scripts/fix-colegio-responsable-roles.js
 *   node scripts/fix-colegio-responsable-roles.js secretaria@colegiosn.com.ar
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function main() {
  const targetEmail = (process.argv[2] || '').trim().toLowerCase();

  const credPath = path.join(process.cwd(), 'caseclarity-hij0x-firebase-adminsdk-fbsvc-18fc24b926.json');
  if (!fs.existsSync(credPath)) {
    console.error('ERROR: No se encontró credenciales Firebase.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
  }

  const db = admin.firestore();
  const colegiosSnap = await db.collection('colegios').get();
  const responsableEmails = new Set();

  for (const doc of colegiosSnap.docs) {
    const emails = (doc.data().adminEmails || []).map((e) => String(e).trim().toLowerCase());
    for (const email of emails) {
      if (email) responsableEmails.add(email);
    }
  }

  if (targetEmail) {
    if (!responsableEmails.has(targetEmail)) {
      console.warn(`AVISO: ${targetEmail} no figura en adminEmails de ningún colegio.`);
    }
    responsableEmails.clear();
    responsableEmails.add(targetEmail);
  }

  const platformAdminEmails = new Set(
    (process.env.PLATFORM_ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'abengolea1@gmail.com')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );

  console.log(`Responsables de colegio a revisar: ${responsableEmails.size}`);

  let fixed = 0;
  for (const email of responsableEmails) {
    if (platformAdminEmails.has(email)) {
      console.log(`  - ${email}: superadmin de plataforma (omitido)`);
      continue;
    }
    const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (usersSnap.empty) {
      console.log(`  - ${email}: sin cuenta en users`);
      continue;
    }
    const userDoc = usersSnap.docs[0];
    const data = userDoc.data();
    if (data.role === 'admin') {
      await userDoc.ref.update({ role: 'abogado', updatedAt: new Date().toISOString() });
      console.log(`  OK ${email}: role admin → abogado (uid ${userDoc.id})`);
      fixed++;
    } else {
      console.log(`  - ${email}: role=${data.role ?? 'abogado'} (sin cambios)`);
    }
  }

  console.log(`\nListo. ${fixed} usuario(s) corregido(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
