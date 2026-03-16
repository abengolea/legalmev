/**
 * Verifica que las credenciales de Firebase Admin funcionen correctamente.
 * Detecta el error DECODER/1E08010C y otros problemas de clave privada.
 *
 * Uso: node scripts/check-firebase-credentials.js
 *
 * Carga .env.local automáticamente. Necesita:
 *   - APP_PROJECT_ID, APP_CLIENT_EMAIL, APP_PRIVATE_KEY, APP_STORAGE_BUCKET
 *   O bien GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de la cuenta de servicio
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Cargar .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✓ .env.local cargado');
} else {
  console.log('⚠ No hay .env.local (se usarán vars de entorno actuales)');
}

function getCredential() {
  const projectId = process.env.APP_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.APP_CLIENT_EMAIL ?? process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.APP_PRIVATE_KEY ?? process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = privateKeyRaw?.replace(/\\n/g, '\n');
  const storageBucket = process.env.APP_STORAGE_BUCKET ?? process.env.FIREBASE_STORAGE_BUCKET;

  if (projectId && clientEmail && privateKey) {
    return { source: 'env', projectId, clientEmail, privateKey, storageBucket };
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const paths = [
    credPath && path.isAbsolute(credPath) ? credPath : credPath ? path.join(process.cwd(), credPath) : null,
    path.join(process.cwd(), 'caseclarity-hij0x-firebase-adminsdk-fbsvc-18fc24b926.json'),
  ].filter(Boolean);

  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return {
          source: 'file',
          path: p,
          projectId: data.project_id,
          clientEmail: data.client_email,
          privateKey: data.private_key,
          storageBucket: data.project_id + '.appspot.com',
        };
      } catch (e) {
        console.error(`  Error leyendo ${p}:`, e.message);
        continue;
      }
    }
  }

  return null;
}

async function main() {
  console.log('\n🔐 Verificando credenciales de Firebase Admin...\n');

  const cred = getCredential();
  if (!cred) {
    console.error('❌ No se encontraron credenciales.');
    console.error('   Configurá .env.local con:');
    console.error('     APP_PROJECT_ID, APP_CLIENT_EMAIL, APP_PRIVATE_KEY, APP_STORAGE_BUCKET');
    console.error('   O bien: GOOGLE_APPLICATION_CREDENTIALS=./ruta/al-json.json');
    process.exit(1);
  }

  console.log(`   Origen: ${cred.source}`);
  if (cred.path) console.log(`   Archivo: ${cred.path}`);
  console.log(`   Proyecto: ${cred.projectId}`);
  console.log(`   Email: ${cred.clientEmail}`);
  console.log(`   Clave privada: ${cred.privateKey ? cred.privateKey.slice(0, 30) + '...' : '(vacía)'}`);
  console.log('');

  // 1. Inicializar Firebase Admin
  console.log('1. Inicializando Firebase Admin...');
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: cred.projectId,
          clientEmail: cred.clientEmail,
          privateKey: cred.privateKey,
        }),
        storageBucket: cred.storageBucket,
      });
    }
    console.log('   ✓ Inicialización OK');
  } catch (e) {
    const msg = (e.message || String(e)).toLowerCase();
    console.error('   ❌ Error al inicializar:', e.message);
    if (msg.includes('decoder') || msg.includes('1e08010c') || msg.includes('unsupported')) {
      console.error('');
      console.error('   💡 Este es el error DECODER. Posibles soluciones:');
      console.error('      • Regenerá la clave en Firebase Console > Service Accounts');
      console.error('      • Usá GOOGLE_APPLICATION_CREDENTIALS con el archivo JSON');
      console.error('      • Verificá que FIREBASE_PRIVATE_KEY tenga \\n literales (no saltos reales)');
    }
    process.exit(1);
  }

  // 2. Probar Auth
  console.log('2. Probando Firebase Auth...');
  try {
    const auth = admin.auth();
    const result = await auth.listUsers(1);
    console.log('   ✓ Auth OK (usuarios:', result.users.length, ')');
  } catch (e) {
    console.error('   ❌ Auth falló:', e.message);
    if ((e.message || '').toLowerCase().includes('decoder')) process.exit(1);
  }

  // 3. Probar Firestore
  console.log('3. Probando Firestore...');
  try {
    const db = admin.firestore();
    const snap = await db.collection('users').limit(1).get();
    console.log('   ✓ Firestore OK (docs:', snap.size, ')');
  } catch (e) {
    console.error('   ❌ Firestore falló:', e.message);
  }

  // 4. Probar Storage (donde suele fallar con DECODER al exportar PDF)
  console.log('4. Probando Storage...');
  try {
    const storage = admin.storage();
    const bucket = storage.bucket();
    const [exists] = await bucket.exists();
    console.log('   ✓ Storage OK (bucket:', bucket.name, ')');
  } catch (e) {
    console.error('   ❌ Storage falló:', e.message);
    if ((e.message || '').toLowerCase().includes('decoder') ||
        (e.message || '').includes('Getting metadata from plugin')) {
      console.error('');
      console.error('   💡 El error DECODER en Storage es la causa del fallo al exportar PDF.');
      console.error('      Regenerá la clave privada en Firebase Console.');
      process.exit(1);
    }
  }

  console.log('');
  console.log('✅ Todas las credenciales funcionan correctamente.');
  console.log('');
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
