/**
 * Da de alta o repara un responsable de colegio (secretaria/admin del colegio).
 *
 * - Agrega el email a adminEmails del colegio
 * - Crea o completa el documento users/{uid} en Firestore (email, name, role=abogado)
 * - Muestra link de registro o reset de contraseña
 *
 * Uso:
 *   node scripts/setup-colegio-responsable.js "<nombre colegio>" <email> [nombre]
 *
 * Ejemplo:
 *   node scripts/setup-colegio-responsable.js "Colegio de Abogados de San Nicolás" adrianbengolea@notificas.com "Adrian Bengolea"
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.legalmev.com.ar').replace(/\/$/, '');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getPlatformAdminEmails() {
  const raw = process.env.PLATFORM_ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'abengolea1@gmail.com';
  return new Set(raw.split(',').map(normalizeEmail).filter(Boolean));
}

function initFirebase() {
  const credPath = path.join(process.cwd(), 'caseclarity-hij0x-firebase-adminsdk-fbsvc-18fc24b926.json');
  if (!fs.existsSync(credPath)) {
    console.error('ERROR: No se encontró credenciales Firebase en:', credPath);
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
  }
  return { db: admin.firestore(), auth: admin.auth() };
}

async function findColegio(db, colegioNameOrId) {
  const byId = await db.collection('colegios').doc(colegioNameOrId).get();
  if (byId.exists) return byId;

  const byName = await db.collection('colegios').where('name', '==', colegioNameOrId).limit(1).get();
  if (!byName.empty) return byName.docs[0];

  return null;
}

async function main() {
  const colegioArg = process.argv[2];
  const email = normalizeEmail(process.argv[3]);
  const displayName = (process.argv[4] || '').trim() || email.split('@')[0];

  if (!colegioArg || !email) {
    console.error('Uso: node scripts/setup-colegio-responsable.js "<nombre colegio>" <email> [nombre]');
    process.exit(1);
  }

  if (getPlatformAdminEmails().has(email)) {
    console.error('ERROR: Este email es superadmin de LegalMev. No puede ser responsable de colegio.');
    console.error('Usá otro email o quitá este de PLATFORM_ADMIN_EMAILS.');
    process.exit(1);
  }

  const { db, auth } = initFirebase();

  console.log('\n=== Setup responsable de colegio ===');
  console.log('Colegio:', colegioArg);
  console.log('Email:  ', email);
  console.log('Nombre: ', displayName);
  console.log('');

  const colegioDoc = await findColegio(db, colegioArg);
  if (!colegioDoc) {
    console.error('ERROR: No se encontró el colegio:', colegioArg);
    process.exit(1);
  }

  const colegioData = colegioDoc.data();
  const colegioId = colegioDoc.id;
  const colegioName = colegioData.name || colegioArg;

  const currentEmails = (colegioData.adminEmails || []).map(normalizeEmail);
  const mergedEmails = [...new Set([...currentEmails, email])];

  await colegioDoc.ref.update({
    adminEmails: mergedEmails,
    updatedAt: new Date().toISOString(),
  });

  console.log('✓ adminEmails actualizado');
  console.log('  Colegio ID:', colegioId);
  console.log('  Colegio:   ', colegioName);
  console.log('  Emails:    ', mergedEmails.join(', '));
  console.log('');

  let authUser = null;
  try {
    authUser = await auth.getUserByEmail(email);
    console.log('✓ Usuario existe en Firebase Auth');
    console.log('  UID:             ', authUser.uid);
    console.log('  Email verificado:', authUser.emailVerified ? 'sí' : 'NO (debe verificar o usar reset link)');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('○ Usuario NO existe en Firebase Auth (debe registrarse)');
    } else {
      throw err;
    }
  }

  if (authUser) {
    const userRef = db.collection('users').doc(authUser.uid);
    const userSnap = await userRef.get();
    const existing = userSnap.data() || {};

    const profile = {
      name: existing.name || displayName,
      email,
      role: existing.role === 'admin' ? 'abogado' : (existing.role || 'abogado'),
      status: existing.status || 'activo',
      tier: existing.tier || 'free',
      freeDownloadsUsed: existing.freeDownloadsUsed ?? 0,
      phone: existing.phone || '',
      updatedAt: new Date().toISOString(),
    };

    if (existing.role === 'admin') {
      console.log('⚠ role era admin → corregido a abogado (responsable de colegio)');
    }

    await userRef.set(profile, { merge: true });

    console.log('✓ Perfil Firestore users/{uid} creado/actualizado');
    console.log('  role:', profile.role);
    console.log('  name:', profile.name);

    const verifyColegio = await db
      .collection('colegios')
      .where('adminEmails', 'array-contains', email)
      .limit(1)
      .get();
    console.log('');
    console.log(verifyColegio.empty ? '✗ Verificación falló: no encuentra colegio por email' : '✓ Verificación OK: acceso a Mi colegio habilitado');

    try {
      const resetLink = await auth.generatePasswordResetLink(email, {
        url: `${siteUrl}/dashboard`,
      });
      console.log('\n--- Link para configurar contraseña (usuario existente) ---');
      console.log(resetLink);
    } catch (linkErr) {
      console.warn('No se pudo generar link de reset:', linkErr.message);
    }
  } else {
    const registerUrl = `${siteUrl}/register?email=${encodeURIComponent(email)}&invite=colegio`;
    console.log('\n--- Link de registro (usuario nuevo) ---');
    console.log(registerUrl);
    console.log('\nCompartí este link. Al registrarse se creará users/{uid} con role=abogado.');
  }

  console.log('\n=== Listo ===\n');
}

main().catch((err) => {
  console.error('\nERROR:', err.message || err);
  process.exit(1);
});
