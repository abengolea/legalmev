'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

type Summary = {
  causa: string;
  titulo: string;
  resumenOriginal: string;
  resumenIA: string;
  pdfUrl?: string;
};

export default function ScbaTestPage() {
  const [running, setRunning] = useState(false);
  const [preferences, setPreferences] = useState<{ materias: string[]; keywords: string[] }>({
    materias: [],
    keywords: [],
  });
  const [result, setResult] = useState<{
    totalFetched?: number;
    filtered?: number;
    processed?: number;
    summaries?: Summary[];
  } | null>(null);
  const [prefMaterias, setPrefMaterias] = useState('');
  const [prefKeywords, setPrefKeywords] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadPreferences = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/scba/preferences', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.ok && json.preferences) {
      setPreferences(json.preferences);
      setPrefMaterias((json.preferences.materias ?? []).join(', '));
      setPrefKeywords((json.preferences.keywords ?? []).join(', '));
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const savePreferences = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSavingPrefs(true);
    try {
      const token = await user.getIdToken();
      const materias = prefMaterias
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const keywords = prefKeywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await fetch('/api/scba/preferences', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ materias, keywords }),
      });
      setPreferences({ materias, keywords });
    } finally {
      setSavingPrefs(false);
    }
  };

  const { toast } = useToast();

  const runScba = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setRunning(true);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/scba/run?limite=5', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: json.error ?? 'No se pudo ejecutar. Revisá que GOOGLE_GENAI_API_KEY esté en .env.local',
        });
        return;
      }
      setResult({
        totalFetched: json.totalFetched,
        filtered: json.filtered,
        processed: json.processed,
        summaries: json.summaries ?? [],
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error de red',
      });
      setResult({ summaries: [], totalFetched: 0, filtered: 0, processed: 0 });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SCBA — Resúmenes (prueba)</h1>
          <p className="text-muted-foreground text-sm">
            Novedades de la Suprema Corte con resúmenes hechos por IA. No aparece en el menú.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Volver al panel</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferencias</CardTitle>
          <CardDescription>
            Materias y palabras clave que te interesan. Dejalo vacío para ver todas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="materias">Materias (separadas por coma)</Label>
            <Input
              id="materias"
              placeholder="ej: inconstitucionalidad, amparo, laboral"
              value={prefMaterias}
              onChange={(e) => setPrefMaterias(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="keywords">Palabras clave</Label>
            <Input
              id="keywords"
              placeholder="ej: municipio, IOMA, discapacidad"
              value={prefKeywords}
              onChange={(e) => setPrefKeywords(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={savePreferences} disabled={savingPrefs}>
            {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar preferencias
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ejecutar fetch y resumen
          </CardTitle>
          <CardDescription>
            Obtiene novedades de scba.gov.ar, filtra por preferencias y genera resúmenes con IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runScba} disabled={running}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Ejecutar ahora
              </>
            )}
          </Button>

          {result && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Obtenidas: {result.totalFetched ?? 0} · Filtradas: {result.filtered ?? 0} · Procesadas: {result.processed ?? 0}
              </p>
              <div className="space-y-4">
                {(result.summaries ?? []).map((s, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{s.causa}</CardTitle>
                      <CardDescription className="line-clamp-2">{s.titulo}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm">{s.resumenIA}</p>
                      {s.pdfUrl && (
                        <a
                          href={s.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver sentencia
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
