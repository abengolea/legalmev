/**
 * Vincula un usuario existente con su colegio (premium por convenio).
 *
 * Uso:
 *   node scripts/fix-user-colegio-link.js marcelafernandez356@gmail.com
 *   node scripts/fix-user-colegio-link.js marcelafernandez356@gmail.com "San Nicolás"
 *   node scripts/fix-user-colegio-link.js --sync-all "San Nicolás"
 *
 * --sync-all: re-sincroniza todos los miembros activos del colegio (útil tras subir Excel).
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const syncAll = args.includes('--sync-all');
const positional = args.filter((a) => !a.startsWith('--'));
const emailArg = (positional[0] || 'marcelafernandez356@gmail.com').toLowerCase().trim();
const colegioQuery = (positional[1] || 'San Nicolás').trim();

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
}

function normalizeMembers(members) {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => ({
      email: String(m?.email || '').toLowerCase().trim(),
      name: String(m?.name || m?.email || '').trim(),
      estado: m?.estado === 'suspendido' ? 'suspendido' : 'activo',
    }))
    .filter((m) => m.email);
}

async function findColegio(db, query) {
  const byId = await db.collection('colegios').doc(query).get();
  if (byId.exists) return { id: byId.id, data: byId.data() };

  const snap = await db.collection('colegios').get();
  const q = query.toLowerCase();
  for (const doc of snap.docs) {
    const name = String(doc.data()?.name || '').toLowerCase();
    if (name.includes(q)) return { id: doc.id, data: doc.data() };
  }
  return null;
}

const FIRESTORE_IN_LIMIT = 30;
const FIRESTORE_BATCH_LIMIT = 500;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function colegioPremiumFields(colegioId, colegioName) {
  return {
    tier: 'premium',
    colegioId,
    premiumSource: 'colegio',
    colegioName,
    colegioSuspended: null,
    premiumForever: null,
    downloadsThisMonth: 0,
    monthlyResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function syncUserTiersForColegio(db, colegioId, colegioName, members) {
  const normalized = normalizeMembers(members);
  const activoEmails = new Set(normalized.filter((m) => m.estado !== 'suspendido').map((m) => m.email));

  let activated = 0;
  let suspended = 0;

  const usersConColegio = await db.collection('users').where('colegioId', '==', colegioId).get();
  let batch = db.batch();
  let batchOps = 0;

  const commitBatch = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const doc of usersConColegio.docs) {
    const data = doc.data();
    const email = String(data?.email || '').toLowerCase().trim();
    const shouldBePremium = activoEmails.has(email);

    if (shouldBePremium) {
      batch.update(doc.ref, colegioPremiumFields(colegioId, colegioName));
      if (data?.tier !== 'premium' || data?.premiumSource !== 'colegio') activated++;
    } else {
      batch.update(doc.ref, {
        tier: 'free',
        premiumSource: null,
        colegioSuspended: true,
        updatedAt: new Date().toISOString(),
      });
      if (data?.tier === 'premium') suspended++;
    }
    batchOps++;
    if (batchOps >= FIRESTORE_BATCH_LIMIT) await commitBatch();
  }
  await commitBatch();

  const processedEmails = new Set(
    usersConColegio.docs.map((d) => String(d.data()?.email || '').toLowerCase().trim())
  );

  const pendingEmails = [...activoEmails].filter((e) => !processedEmails.has(e));
  const foundDocs = new Map();

  for (const emailChunk of chunk(pendingEmails, FIRESTORE_IN_LIMIT)) {
    const snap = await db.collection('users').where('email', 'in', emailChunk).get();
    for (const doc of snap.docs) {
      const email = String(doc.data()?.email || '').toLowerCase().trim();
      if (email) foundDocs.set(email, doc);
    }
  }

  batch = db.batch();
  batchOps = 0;

  for (const email of pendingEmails) {
    const doc = foundDocs.get(email);
    if (!doc) continue;
    const data = doc.data();
    if (data?.premiumSource === 'payment' && data?.tier === 'premium') continue;
    if (data?.colegioId === colegioId && data?.tier === 'premium' && data?.premiumSource === 'colegio') {
      continue;
    }
    const update = colegioPremiumFields(colegioId, colegioName);
    if (data?.email !== email) update.email = email;
    batch.update(doc.ref, update);
    activated++;
    batchOps++;
    if (batchOps >= FIRESTORE_BATCH_LIMIT) await commitBatch();
  }
  await commitBatch();

  return { activated, suspended };
}

async function linkSingleUser(db, auth, email, colegioQueryStr) {
  const colegio = await findColegio(db, colegioQueryStr);
  if (!colegio) {
    console.error('Colegio no encontrado:', colegioQueryStr);
    process.exit(1);
  }

  const members = normalizeMembers(colegio.data.members || []);
  const member = members.find((m) => m.email === email);
  if (!member) {
    console.error(`El email ${email} no está en la lista de "${colegio.data.name}".`);
    process.exit(1);
  }
  if (member.estado === 'suspendido') {
    console.error(`El colegiado ${email} está suspendido en "${colegio.data.name}".`);
    process.exit(1);
  }

  let uid;
  try {
    const authUser = await auth.getUserByEmail(email);
    uid = authUser.uid;
  } catch (e) {
    console.error('No hay cuenta Auth para', email, '-', e.message);
    process.exit(1);
  }

  const userRef = db.collection('users').doc(uid);
  const before = (await userRef.get()).data() || {};

  await userRef.set(
    {
      ...colegioPremiumFields(colegio.id, colegio.data.name),
      email,
    },
    { merge: true }
  );

  const after = (await userRef.get()).data();
  console.log('OK: Usuario vinculado al colegio.');
  console.log({
    uid,
    email,
    colegio: colegio.data.name,
    colegioId: colegio.id,
    antes: {
      tier: before.tier,
      premiumSource: before.premiumSource,
      colegioId: before.colegioId,
    },
    despues: {
      tier: after.tier,
      premiumSource: after.premiumSource,
      colegioId: after.colegioId,
      colegioName: after.colegioName,
    },
  });
}

async function main() {
  initFirebase();
  const db = admin.firestore();
  const auth = admin.auth();

  if (syncAll) {
    const colegio = await findColegio(db, colegioQuery);
    if (!colegio) {
      console.error('Colegio no encontrado:', colegioQuery);
      process.exit(1);
    }
    const members = normalizeMembers(colegio.data.members || []);
    console.log(`Sincronizando ${members.length} miembros de "${colegio.data.name}"...`);
    const { activated, suspended } = await syncUserTiersForColegio(
      db,
      colegio.id,
      colegio.data.name,
      members
    );
    console.log('OK:', { activated, suspended });
    return;
  }

  await linkSingleUser(db, auth, emailArg, colegioQuery);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
