/**
 * Agrega un email a adminEmails de un colegio y muestra el link de registro.
 *
 * Uso:
 *   node scripts/invite-colegio-admin.js "Colegio de Abogados de San Nicolás" secretaria@colegiosn.com.ar
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar').replace(/\/$/, '');

async function main() {
  const colegioName = process.argv[2];
  const email = (process.argv[3] || '').trim().toLowerCase();

  if (!colegioName || !email) {
    console.error('Uso: node scripts/invite-colegio-admin.js "<nombre colegio>" <email>');
    process.exit(1);
  }

  const credPath = path.join(process.cwd(), 'caseclarity-hij0x-firebase-adminsdk-fbsvc-18fc24b926.json');
  if (!fs.existsSync(credPath)) {
    console.error('ERROR: No se encontró credenciales Firebase.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
  }

  const db = admin.firestore();
  const snap = await db.collection('colegios').where('name', '==', colegioName).limit(1).get();

  if (snap.empty) {
    console.error(`No se encontró colegio: ${colegioName}`);
    process.exit(1);
  }

  const doc = snap.docs[0];
  const data = doc.data();
  const current = (data.adminEmails || []).map((e) => String(e).toLowerCase());
  const merged = [...new Set([...current, email])];

  await doc.ref.update({
    adminEmails: merged,
    updatedAt: new Date().toISOString(),
  });

  console.log('OK adminEmails actualizado en colegio:', doc.id);
  console.log('  adminEmails:', merged.join(', '));

  try {
    await admin.auth().getUserByEmail(email);
    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: `${siteUrl}/dashboard`,
    });
    console.log('\nEl usuario YA existe. Link para configurar contraseña:');
    console.log(resetLink);
  } catch {
    const registerUrl = `${siteUrl}/register?email=${encodeURIComponent(email)}&invite=colegio`;
    console.log('\nEl usuario NO tiene cuenta. Compartí este link de registro:');
    console.log(registerUrl);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
