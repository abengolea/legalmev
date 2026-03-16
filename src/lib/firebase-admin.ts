import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

function getCredentialFromEnv() {
  // App Hosting no permite vars que empiecen con FIREBASE_, usamos APP_*
  const projectId = process.env.APP_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.APP_CLIENT_EMAIL ?? process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.APP_PRIVATE_KEY ?? process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
  const storageBucket = process.env.APP_STORAGE_BUCKET ?? process.env.FIREBASE_STORAGE_BUCKET;
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey, storageBucket };
  }
  return null;
}

function getCredentialFromFile() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const paths = [
    envPath && path.isAbsolute(envPath) ? envPath : envPath ? path.join(process.cwd(), envPath) : null,
    path.join(process.cwd(), 'caseclarity-hij0x-firebase-adminsdk-fbsvc-18fc24b926.json'),
  ].filter(Boolean) as string[];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return {
          projectId: data.project_id,
          clientEmail: data.client_email,
          privateKey: data.private_key,
          storageBucket: data.project_id + '.firebasestorage.app',
        };
      } catch {
        continue;
      }
    }
  }
  return null;
}

const ADMIN_APP_NAME = 'caseclarity-admin';
let adminApp: ReturnType<typeof initializeApp> | null = null;

/** Inicialización diferida: solo al primer uso. Usa app con nombre para no chocar con app por defecto del framework. */
function ensureInitialized() {
  if (adminApp) return adminApp;
  const cred = getCredentialFromEnv() ?? getCredentialFromFile();
  if (!cred) {
    throw new Error('Firebase Admin no inicializado. Configurá APP_PROJECT_ID, APP_CLIENT_EMAIL, APP_PRIVATE_KEY (o FIREBASE_* en .env.local)');
  }
  // Firebase Storage: APP_STORAGE_BUCKET → FIREBASE_CONFIG (App Hosting) → projectId.firebasestorage.app
  // FIREBASE_CONFIG es auto-inyectado por App Hosting en runtime con storageBucket correcto
  const fromFirebaseConfig = ((): string | null => {
    try {
      const cfg = process.env.FIREBASE_CONFIG;
      if (cfg && typeof cfg === 'string' && cfg.trim().startsWith('{')) {
        const parsed = JSON.parse(cfg) as { storageBucket?: string };
        return parsed?.storageBucket?.trim() || null;
      }
    } catch {
      /* ignorar */
    }
    return null;
  })();
  // Prioridad: env correcto → FIREBASE_CONFIG (tiene firebasestorage.app) → fallback
  // Si apphosting.yaml tiene appspot.com (bucket inexistente), FIREBASE_CONFIG lo corrige
  let storageBucket =
    cred.storageBucket?.trim() || fromFirebaseConfig || `${cred.projectId}.firebasestorage.app`;
  if (storageBucket.endsWith('.appspot.com') && fromFirebaseConfig) {
    storageBucket = fromFirebaseConfig; // FIREBASE_CONFIG tiene el bucket real
  }
  if (!storageBucket.endsWith('.firebasestorage.app') && !storageBucket.endsWith('.appspot.com')) {
    storageBucket = `${cred.projectId}.firebasestorage.app`; // forzar formato nuevo
  }

  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
    console.log('[firebase-admin] storageBucket resolved:', storageBucket);
  }

  const firebaseAdminConfig = {
    credential: cert({
      projectId: cred.projectId,
      clientEmail: cred.clientEmail,
      privateKey: cred.privateKey,
    }),
    storageBucket,
  };
  try {
    adminApp = getApp(ADMIN_APP_NAME) as ReturnType<typeof initializeApp>;
  } catch {
    adminApp = initializeApp(firebaseAdminConfig, ADMIN_APP_NAME);
  }
  return adminApp;
}

export function getAdminApp() {
  return ensureInitialized();
}

/** Lazy: inicializa y retorna Firestore */
export function getAdminDb() {
  return getFirestore(ensureInitialized());
}

/** Lazy: inicializa y retorna Storage */
export function getAdminStorage() {
  return getStorage(ensureInitialized());
}

/** Nombre del bucket resuelto (para pasar explícitamente a bucket()) */
export function getStorageBucketName(): string {
  const app = ensureInitialized();
  return getStorage(app).bucket().name;
}

/** Wrappers para compatibilidad con settings/actions y otros que usan getDb/getAuth */
export function getDb() {
  return getAdminDb();
}
export function getAuth() {
  return getAdminAuth(getAdminApp());
}
