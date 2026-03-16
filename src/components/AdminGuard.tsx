'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Solo permite acceso a usuarios con role=admin.
 * Redirige a /dashboard si no es admin.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace('/login');
        setChecking(false);
        return;
      }

      unsubDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          const data = snap.data();
          const role = data?.role ?? 'abogado';
          if (role === 'admin') {
            setAllowed(true);
          } else {
            router.replace('/dashboard');
          }
          setChecking(false);
        },
        () => {
          setAllowed(false);
          router.replace('/dashboard');
          setChecking(false);
        }
      );
    });

    return () => {
      unsubAuth();
      unsubDoc?.();
    };
  }, [router]);

  if (checking || !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
