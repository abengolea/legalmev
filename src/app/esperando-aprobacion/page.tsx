'use client';

import { useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

/**
 * Página obsoleta: el flujo ya no requiere aprobación.
 * Redirige a dashboard si hay sesión, o a login.
 */
export default function EsperandoAprobacionPage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      router.replace(user ? '/dashboard' : '/login');
    });
    return () => unsub();
  }, [router]);

  return null;
}
