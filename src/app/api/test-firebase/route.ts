import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getDb();
    const auth = getAuth();
    return NextResponse.json({
      ok: true,
      message: 'Firebase Admin SDK conectado correctamente',
      firestore: !!db,
      auth: !!auth,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
