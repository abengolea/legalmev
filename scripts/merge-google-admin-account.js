/**
 * Une la cuenta Google huérfana con la cuenta admin (email + contraseña).
 *
 * Problema que resuelve: mismo correo en Google y en contraseña generan dos UIDs;
 * el admin queda en la cuenta password y Google entra a otra sin role=admin.
 *
 * Uso:
 *   node scripts/merge-google-admin-account.js              # detecta y fusiona
 *   node scripts/merge-google-admin-account.js --dry-run    # solo muestra qué haría
 *
 * Variables opcionales:
 *   ADMIN_EMAIL=abengolea1@gmail.com
 *   GOOGLE_UID=0CqAxjTKRUatnBP6SgcYvMsAF5r2   (si no se pasa, auto-detecta)
 *   ADMIN_PASSWORD=...  (opcional: restaura login por contraseña tras vincular Google)
 *
 * Nota: importUsers puede quitar el proveedor "password". Si tenés contraseña,
 * pasá ADMIN_PASSWORD para reestablecerla al final del script.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'abengolea1@gmail.com').toLowerCase();
const ADMIN_NAME = process.env.ADMIN_NAME || 'Adrian Bengolea';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const GOOGLE_UID_ENV = process.env.GOOGLE_UID || '';
const DRY_RUN = process.argv.includes('--dry-run');

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
    console.error('ERROR: No se encontró el archivo de credenciales de Firebase.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
  }

  return { auth: admin.auth(), db: admin.firestore() };
}

/** Campos de Firestore que conviene conservar al fusionar (no pisa role/email/name del admin). */
const MERGE_FIELDS = [
  'downloadsThisMonth',
  'freeDownloadsUsed',
  'monthlyResetAt',
  'premiumForever',
  'premiumSource',
  'premiumActivatedAt',
  'tier',
  'colegioId',
  'colegioName',
  'colegioSuspended',
  'authorizedDeviceId',
  'cuit',
  'phone',
  'status',
];

function mapProviderData(providerData) {
  return providerData.map((p) => ({
    uid: p.uid,
    email: p.email,
    displayName: p.displayName,
    photoURL: p.photoURL,
    providerId: p.providerId,
  }));
}

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function displayNameMatchesAdmin(displayName, expectedName) {
  const a = normalizeName(displayName);
  const b = normalizeName(expectedName);
  if (!a || !b) return false;
  if (a === b) return true;
  const parts = b.split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every((p) => a.includes(p));
}

/**
 * Busca cuenta Google duplicada del admin: mismo displayName, sin role admin,
 * típicamente sin email en Auth (cuenta huérfana).
 */
async function findGoogleOrphanUid(auth, db, adminUid) {
  if (GOOGLE_UID_ENV) {
    return GOOGLE_UID_ENV;
  }

  const adminDoc = await db.collection('users').doc(adminUid).get();
  const expectedName = adminDoc.data()?.name || ADMIN_NAME;

  let next;
  const candidates = [];

  do {
    const res = await auth.listUsers(1000, next);
    for (const u of res.users) {
      if (u.uid === adminUid) continue;
      const hasGoogle = u.providerData.some((p) => p.providerId === 'google.com');
      if (!hasGoogle) continue;

      const doc = await db.collection('users').doc(u.uid).get();
      const data = doc.data() || {};
      if (data.role === 'admin') continue;

      const nameOk = displayNameMatchesAdmin(u.displayName, expectedName);
      if (!nameOk) continue;

      candidates.push({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        firestoreRole: data.role,
        premiumForever: data.premiumForever,
        premiumSource: data.premiumSource,
      });
    }
    next = res.pageToken;
  } while (next);

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0].uid;
  }

  // Desempate: premium asignado por admin (caso típico de la cuenta duplicada)
  const withAdminPremium = candidates.filter((c) => c.premiumForever && c.premiumSource === 'admin');
  if (withAdminPremium.length === 1) {
    return withAdminPremium[0].uid;
  }

  console.log('Varias cuentas Google con el mismo nombre:');
  candidates.forEach((c, i) => console.log(`  [${i}]`, c));
  console.error('ERROR: Pasá GOOGLE_UID=... con el UID correcto.');
  process.exit(1);
}

function buildMergedFirestore(adminData, googleData) {
  const merged = {
    name: adminData?.name || ADMIN_NAME,
    email: ADMIN_EMAIL,
    role: 'admin',
    status: adminData?.status || googleData?.status || 'activo',
    updatedAt: new Date().toISOString(),
  };

  for (const key of MERGE_FIELDS) {
    const g = googleData?.[key];
    const a = adminData?.[key];
    if (g !== undefined && g !== null && (a === undefined || a === null)) {
      merged[key] = g;
    } else if (a !== undefined && a !== null) {
      merged[key] = a;
    } else if (g !== undefined && g !== null) {
      merged[key] = g;
    }
  }

  if (!merged.tier) merged.tier = 'premium';

  return merged;
}

async function main() {
  const { auth, db } = initFirebase();

  console.log(DRY_RUN ? '=== MODO DRY-RUN (no se aplican cambios) ===' : '=== Fusionando cuentas ===');
  console.log('Admin email:', ADMIN_EMAIL);

  let adminUser;
  try {
    adminUser = await auth.getUserByEmail(ADMIN_EMAIL);
  } catch (e) {
    console.error('ERROR: No existe usuario Auth con email', ADMIN_EMAIL, '-', e.message);
    process.exit(1);
  }

  const adminUid = adminUser.uid;
  console.log('\nCuenta admin (password):');
  console.log('  UID:', adminUid);
  console.log('  Proveedores:', adminUser.providerData.map((p) => p.providerId).join(', ') || '(ninguno)');

  const googleUid = await findGoogleOrphanUid(auth, db, adminUid);
  if (!googleUid) {
    console.log('\nNo se encontró cuenta Google huérfana para fusionar.');
    console.log('Si ya fusionaste antes, probá iniciar sesión con Google.');
    process.exit(0);
  }

  let googleUser;
  try {
    googleUser = await auth.getUser(googleUid);
  } catch (e) {
    console.error('ERROR: No se pudo leer cuenta Google', googleUid, e.message);
    process.exit(1);
  }

  console.log('\nCuenta Google a fusionar:');
  console.log('  UID:', googleUid);
  console.log('  Email en Auth:', googleUser.email || '(vacío)');
  console.log('  Display name:', googleUser.displayName);
  console.log('  Proveedores:', googleUser.providerData.map((p) => p.providerId).join(', '));

  const adminDocSnap = await db.collection('users').doc(adminUid).get();
  const googleDocSnap = await db.collection('users').doc(googleUid).get();
  const adminData = adminDocSnap.data() || {};
  const googleData = googleDocSnap.data() || {};
  const mergedFirestore = buildMergedFirestore(adminData, googleData);

  const hadPassword = adminUser.providerData.some((p) => p.providerId === 'password');
  const hasGoogleOnAdmin = adminUser.providerData.some((p) => p.providerId === 'google.com');
  const googleProviders = googleUser.providerData.filter((p) => p.providerId === 'google.com');

  const newProviderData = hasGoogleOnAdmin
    ? mapProviderData(adminUser.providerData)
    : [...mapProviderData(adminUser.providerData), ...mapProviderData(googleProviders)];

  console.log('\nFirestore admin después del merge:');
  console.log('  role:', mergedFirestore.role);
  console.log('  name:', mergedFirestore.name);
  console.log('  tier:', mergedFirestore.tier);
  console.log('  premiumForever:', mergedFirestore.premiumForever);
  console.log('  downloadsThisMonth:', mergedFirestore.downloadsThisMonth);

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Acciones que se ejecutarían:');
    if (!hasGoogleOnAdmin) {
      console.log('  1. Vincular proveedor Google al UID admin via importUsers');
    } else {
      console.log('  1. Admin ya tiene Google vinculado (omitir importUsers)');
    }
    console.log('  2. Actualizar users/' + adminUid + ' en Firestore');
    console.log('  3. Eliminar users/' + googleUid + ' en Firestore');
    console.log('  4. Eliminar usuario Auth', googleUid);
    console.log('\nEjecutá sin --dry-run para aplicar.');
    process.exit(0);
  }

  if (!hasGoogleOnAdmin && googleProviders.length > 0) {
    console.log('\nVinculando Google al UID admin...');
    await auth.importUsers([
      {
        uid: adminUid,
        email: adminUser.email,
        emailVerified: adminUser.emailVerified,
        displayName: adminUser.displayName || googleUser.displayName || ADMIN_NAME,
        disabled: false,
        providerData: newProviderData,
      },
    ]);
    console.log('  OK: proveedor Google vinculado a', adminUid);

    if (hadPassword) {
      const after = await auth.getUser(adminUid);
      const stillHasPassword = after.providerData.some((p) => p.providerId === 'password');
      if (!stillHasPassword) {
        console.warn('  AVISO: importUsers quitó el login por contraseña.');
        if (ADMIN_PASSWORD) {
          await auth.updateUser(adminUid, { password: ADMIN_PASSWORD });
          console.log('  OK: contraseña restaurada (ADMIN_PASSWORD).');
        } else {
          const resetLink = await auth.generatePasswordResetLink(ADMIN_EMAIL);
          console.log('  Generá una nueva contraseña con este link (válido ~1h):');
          console.log(' ', resetLink);
        }
      }
    }
  }

  console.log('Actualizando Firestore admin...');
  await db.collection('users').doc(adminUid).set(mergedFirestore, { merge: true });

  if (googleDocSnap.exists) {
    console.log('Eliminando documento Firestore duplicado...');
    await db.collection('users').doc(googleUid).delete();
  }

  if (googleUid !== adminUid) {
    console.log('Eliminando usuario Auth duplicado...');
    await auth.deleteUser(googleUid);
  }

  const verify = await auth.getUser(adminUid);
  console.log('\n=== Listo ===');
  console.log('UID unificado:', adminUid);
  console.log('Email:', verify.email);
  console.log('Proveedores:', verify.providerData.map((p) => p.providerId).join(', '));
  console.log('\nPróximos pasos:');
  console.log('  1. Cerrá sesión en la app (o borrá cookies de localhost).');
  console.log('  2. Iniciá sesión con Google o con email/contraseña.');
  console.log('  3. Deberías ver el menú Admin y tu nombre en el panel.');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  if (err.code) console.error('Código:', err.code);
  process.exit(1);
});
