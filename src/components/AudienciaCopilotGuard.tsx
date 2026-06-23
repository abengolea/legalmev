'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Permite acceso al copiloto de audiencias (beta ilimitada o prueba otorgada). */
export function AudienciaCopilotGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace('/login');
        setChecking(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.ok && json.user?.audienciaCopilot?.hasAccess) {
          setAllowed(true);
        } else {
          router.replace('/dashboard');
        }
      } catch {
        router.replace('/dashboard');
      } finally {
        setChecking(false);
      }
    });

    return () => unsubAuth();
  }, [router]);

  if (checking || !allowed) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
