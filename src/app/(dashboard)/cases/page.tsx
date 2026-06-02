'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Case } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CaseTableRow } from '@/components/CaseTableRow';
import { Loader2 } from 'lucide-react';

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setCases([]);
        setLoading(false);
        return;
      }

      const q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'), limit(50));
      const unsubCases = onSnapshot(
        q,
        (snap) => {
          setCases(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() ?? new Date(),
                updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
              } as Case;
            }),
          );
          setLoading(false);
        },
        () => setLoading(false),
      );

      return () => unsubCases();
    });

    return () => unsubAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-headline">Casos</h1>
      {cases.length === 0 ? (
        <p className="text-muted-foreground">No hay casos todavía.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Urgencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c) => (
              <CaseTableRow key={c.id} caseItem={c} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
