
'use server';
import * as admin from 'firebase-admin';

// --- INSTRUCCIÓN IMPORTANTE ---
// PEGA TU CLAVE DE CUENTA DE SERVICIO DE FIREBASE AQUÍ
// Reemplaza el objeto `null` de abajo con el contenido completo de tu archivo JSON de clave de servicio.
const serviceAccount = null;
// Ejemplo:
// const serviceAccount = {
//   "type": "service_account",
//   "project_id": "tu-project-id",
//   ...
// };
// --------------------------

let db: admin.firestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;

if (process.env.NODE_ENV === 'development' && !admin.apps.length) {
    console.log("Initializing Firebase Admin SDK for DEVELOPMENT...");
}

if (!admin.apps.length) {
  if (serviceAccount && serviceAccount.project_id) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK inicializado correctamente.');
      db = admin.firestore();
      auth = admin.auth();
    } catch (error: any) {
      console.error('ERROR CRÍTICO: Fallo al inicializar Firebase Admin SDK.', error.message);
      // Dejar db y auth como null si falla.
    }
  } else {
    console.error('ERROR CRÍTICO: La clave de servicio (serviceAccount) no está configurada en src/lib/firebase-admin.ts.');
  }
} else {
    // Si ya está inicializado, simplemente obtén las instancias.
    db = admin.firestore();
    auth = admin.auth();
}

function getDb() {
  if (!db) {
    throw new Error('La base de datos de Firebase Admin no está disponible. Revisa los registros del servidor para ver el error de inicialización.');
  }
  return db;
}

function getAuth() {
  if (!auth) {
    throw new Error('El servicio de autenticación de Firebase Admin no está disponible. Revisa los registros del servidor para ver el error de inicialización.');
  }
  return auth;
}

export { getDb, getAuth };
