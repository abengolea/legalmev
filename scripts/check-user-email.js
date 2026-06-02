/**
 * Diagnóstico: Auth + Firestore para un email.
 * Uso: node scripts/check-user-email.js abengolea1@gmail.com
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const email = (process.argv[2] || 'abengolea1@gmail.com').toLowerCase();

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
  console.error('No credentials');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(credPath)) });
}

async function main() {
  try {
    const u = await admin.auth().getUserByEmail(email);
    console.log('--- Firebase Auth (getUserByEmail) ---');
    console.log({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      providers: u.providerData.map((p) => p.providerId),
    });
    const doc = await admin.firestore().collection('users').doc(u.uid).get();
    console.log('--- Firestore users/{auth.uid} ---');
    console.log({
      exists: doc.exists,
      role: doc.data()?.role,
      name: doc.data()?.name,
      tier: doc.data()?.tier,
      premiumForever: doc.data()?.premiumForever,
    });
  } catch (e) {
    console.log('getUserByEmail:', e.code, e.message);
  }

  const snap = await admin.firestore().collection('users').where('email', '==', email).get();
  console.log('--- Firestore docs con email (puede haber >1 si UIDs distintos) ---');
  console.log('count:', snap.size);
  snap.forEach((d) => {
    const data = d.data();
    console.log({
      docId: d.id,
      role: data.role,
      name: data.name,
      tier: data.tier,
      premiumForever: data.premiumForever,
      premiumSource: data.premiumSource,
    });
  });
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
