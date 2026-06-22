'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import { safeResJson } from '@/lib/utils';
import type { AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';
import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type {
  AudienciaIntercambio,
  AudienciaSessionData,
  AudienciaSessionSummary,
  AudienciaTestigo,
  BandejaDeclarante,
  ParteRepresentada,
  RepresentacionCaso,
} from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION } from '@/lib/audiencia-session-types';
import {
  esFueroPenal,
  etiquetasBandejaDeclarante,
  formatExpedienteContexto,
  formatRepresentacionContexto,
  mensajeModoRepresentacion,
  nombreClienteSugerido,
  tipoFueroLabel,
} from '@/lib/audiencia-copilot-format';
import { GEMINI_MODEL_ID } from '@/lib/gemini-model';
import { EditablePreguntasList } from '@/components/admin/EditablePreguntasList';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Cloud,
  FileText,
  Gavel,
  Lightbulb,
  Loader2,
  Plus,
  Scale,
  User,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function sameRepresentacion(a: RepresentacionCaso, b: RepresentacionCaso): boolean {
  return a.parte === b.parte && a.clienteNombre === b.clienteNombre && a.notas === b.notas;
}

type AiStatus = {
  provider: string;
  model: string;
  keyConfigured: boolean;
  ready: boolean;
};

type Testigo = AudienciaTestigo;

function normalizeTestigos(items: Testigo[]): Testigo[] {
  return items.map((t) => ({
    ...t,
    contextoDeclarante: t.contextoDeclarante ?? '',
    bandeja: t.bandeja ?? 'indefinida',
    testimonioCerrado: t.testimonioCerrado ?? false,
  }));
}

const LAST_SESSION_KEY = 'legalmev_audiencia_last_session';

const EMPTY_ANALYSIS: AudienciaCopilotOutput = {
  alertas: [],
  repreguntas: [],
  preguntasIneludibles: [],
  contradicciones: [],
  admisiones: [],
  evasivas: [],
  conclusiones: [],
  estrategia: '',
  borradorAlegato: '',
};

const COPILOT_CAPABILITIES = [
  'Explica el expediente',
  'Sugiere preguntas',
  'Detecta contradicciones',
  'Admisiones y evasivas',
  'Conclusiones en vivo',
  'Borrador de alegatos',
] as const;

function alertBadgeClass(tipo: 'roja' | 'amarilla' | 'azul') {
  switch (tipo) {
    case 'roja':
      return 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/50 dark:text-red-200';
    case 'amarilla':
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200';
    case 'azul':
      return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-200';
  }
}

const LOAD_STEPS = [
  { key: 'extract', label: 'Extrayendo texto del PDF' },
  { key: 'analyze', label: 'Analizando expediente con Gemini' },
  { key: 'save', label: 'Guardando audiencia' },
] as const;

type LoadProgress = {
  stepIndex: number;
  label: string;
  seconds: number;
  fileName: string;
  textoLength?: number;
};

function formatIntercambios(intercambios: AudienciaIntercambio[]): string {
  if (intercambios.length === 0) return '(Aún no hay preguntas registradas.)';
  return intercambios
    .map((i, n) => `${n + 1}. P: ${i.pregunta}\n   R: ${i.respuesta}`)
    .join('\n\n');
}

function formatFecha(iso: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function AudienciaCopilot() {
  const { toast } = useToast();
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadElapsedRef = useRef(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AudienciaSessionSummary[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [representacion, setRepresentacion] = useState<RepresentacionCaso>(EMPTY_REPRESENTACION);
  const [representacionGuardada, setRepresentacionGuardada] =
    useState<RepresentacionCaso>(EMPTY_REPRESENTACION);
  const [guardandoRepresentacion, setGuardandoRepresentacion] = useState(false);
  const [expedienteAnalysis, setExpedienteAnalysis] = useState<ExpedienteAnalysisOutput | null>(null);
  const [testigos, setTestigos] = useState<Testigo[]>([]);
  const [testigoActivoId, setTestigoActivoId] = useState<string | null>(null);
  const [analysisByTestigoId, setAnalysisByTestigoId] = useState<
    Record<string, AudienciaCopilotOutput>
  >({});
  const [analysis, setAnalysis] = useState<AudienciaCopilotOutput>(EMPTY_ANALYSIS);
  const [nuevaPregunta, setNuevaPregunta] = useState('');
  const [nuevaRespuesta, setNuevaRespuesta] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoRol, setNuevoRol] = useState('');
  const [nuevaBandeja, setNuevaBandeja] = useState<BandejaDeclarante>('nuestra');
  const [alegatoGlobal, setAlegatoGlobal] = useState('');
  const [alegatoGlobalMeta, setAlegatoGlobalMeta] = useState<
    AudienciaSessionData['alegatoGlobalMeta']
  >();
  const [generandoAlegatos, setGenerandoAlegatos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipSaveRef = useRef(true);
  const sessionsLoadedRef = useRef(false);

  const testigoActivo = testigos.find((t) => t.id === testigoActivoId) ?? null;
  const tipoFuero = expedienteAnalysis?.tipoFuero ?? 'civil';
  const esPenal = esFueroPenal(tipoFuero);
  const expedienteContexto = expedienteAnalysis ? formatExpedienteContexto(expedienteAnalysis) : '';
  const representacionContexto = formatRepresentacionContexto(representacion, expedienteAnalysis);
  const representacionDirty = !sameRepresentacion(representacion, representacionGuardada);
  const bandejaLabels = etiquetasBandejaDeclarante(representacion, tipoFuero);
  const modoRepresentacion = mensajeModoRepresentacion(representacion, tipoFuero);
  const testigosNuestra = testigos.filter((t) => t.bandeja === 'nuestra');
  const testigosContraria = testigos.filter((t) => t.bandeja === 'contraria');
  const testigosIndefinidos = testigos.filter((t) => t.bandeja === 'indefinida');
  const testimoniosCerrados = testigos.filter((t) => t.testimonioCerrado).length;
  const todosTestimoniosCerrados =
    testigos.length > 0 && testigos.every((t) => t.testimonioCerrado);
  const progresoTestimonios =
    testigos.length > 0 ? Math.round((testimoniosCerrados / testigos.length) * 100) : 0;

  const resetParaNuevaAudiencia = useCallback(() => {
    skipSaveRef.current = true;
    setSessionId(null);
    setExpedienteAnalysis(null);
    setTestigos([]);
    setTestigoActivoId(null);
    setAnalysisByTestigoId({});
    setAnalysis(EMPTY_ANALYSIS);
    setRepresentacion({ ...EMPTY_REPRESENTACION });
    setRepresentacionGuardada({ ...EMPTY_REPRESENTACION });
    setAlegatoGlobal('');
    setAlegatoGlobalMeta(undefined);
    setNuevaPregunta('');
    setNuevaRespuesta('');
    setNuevoNombre('');
    setNuevoRol('');
    setSaveStatus('idle');
    localStorage.removeItem(LAST_SESSION_KEY);
  }, []);

  const handleNuevaAudiencia = () => {
    resetParaNuevaAudiencia();
    fileInputRef.current?.click();
  };

  const applySession = useCallback((session: AudienciaSessionData) => {
    skipSaveRef.current = true;
    setSessionId(session.id);
    setExpedienteAnalysis(session.expedienteAnalysis ?? null);
    setTestigos(normalizeTestigos(session.testigos));
    setTestigoActivoId(session.testigoActivoId);
    setAnalysisByTestigoId(session.analysisByTestigoId || {});
    const rep = session.representacion ?? { ...EMPTY_REPRESENTACION };
    setRepresentacion(rep);
    setRepresentacionGuardada(rep);
    setAlegatoGlobal(session.alegatoGlobal ?? '');
    setAlegatoGlobalMeta(session.alegatoGlobalMeta);
    const activeId = session.testigoActivoId;
    setAnalysis(
      activeId && session.analysisByTestigoId?.[activeId]
        ? session.analysisByTestigoId[activeId]
        : EMPTY_ANALYSIS
    );
    localStorage.setItem(LAST_SESSION_KEY, session.id);
    setSaveStatus('saved');
  }, []);

  const fetchSessions = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const token = await user.getIdToken();
    const res = await fetch('/api/admin/audiencia-copilot/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await safeResJson<{ ok: boolean; sessions?: AudienciaSessionSummary[] }>(res);
    if (json.ok && json.sessions) {
      setSessions(json.sessions);
      return json.sessions;
    }
    return [];
  }, []);

  const startLoadTimer = useCallback((fileName: string, stepIndex: number, label: string) => {
    if (loadTimerRef.current) clearInterval(loadTimerRef.current);
    const startedAt = Date.now();
    loadElapsedRef.current = 0;
    setLoadProgress({ stepIndex, label, seconds: 0, fileName });
    loadTimerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      loadElapsedRef.current = secs;
      setLoadProgress((prev) => (prev ? { ...prev, seconds: secs } : null));
    }, 1000);
  }, []);

  const stopLoadTimer = useCallback(() => {
    if (loadTimerRef.current) {
      clearInterval(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    setLoadProgress(null);
  }, []);

  useEffect(() => () => stopLoadTimer(), [stopLoadTimer]);

  const loadSessionById = useCallback(
    async (id: string) => {
      const user = auth.currentUser;
      if (!user) return;
      setIsLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/audiencia-copilot/sessions/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await safeResJson<{ ok: boolean; session?: AudienciaSessionData; error?: string }>(
          res
        );
        if (!json.ok || !json.session) throw new Error(json.error || 'No se pudo cargar la sesión');

        if (json.session.analysisStatus === 'pending' && json.session.id) {
          startLoadTimer(json.session.pdfFileName || json.session.titulo, 1, LOAD_STEPS[1].label);
          const analyzeRes = await fetch(
            `/api/admin/audiencia-copilot/sessions/${json.session.id}/analyze`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
          );
          const analyzeJson = await safeResJson<{
            ok: boolean;
            sessionId?: string;
            analysis?: ExpedienteAnalysisOutput;
            testigos?: Testigo[];
            testigoActivoId?: string | null;
            titulo?: string;
            error?: string;
          }>(analyzeRes);
          stopLoadTimer();
          if (!analyzeJson.ok || !analyzeJson.analysis) {
            throw new Error(analyzeJson.error || 'No se pudo completar el análisis');
          }
          applySession({
            ...json.session,
            expedienteAnalysis: analyzeJson.analysis,
            testigos: analyzeJson.testigos ?? [],
            testigoActivoId: analyzeJson.testigoActivoId ?? null,
            analysisStatus: 'ready',
            titulo: analyzeJson.titulo ?? json.session.titulo,
          });
        } else {
          applySession(json.session);
        }
        toast({ title: 'Audiencia restaurada', description: json.session.titulo });
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Error al cargar',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [applySession, startLoadTimer, stopLoadTimer, toast]
  );

  const saveSession = useCallback(async () => {
    if (!sessionId) return;
    const user = auth.currentUser;
    if (!user) return;
    setSaveStatus('saving');
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/audiencia-copilot/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testigos,
          testigoActivoId,
          analysisByTestigoId,
          alegatoGlobal,
          alegatoGlobalMeta,
        }),
      });
      const json = await safeResJson<{ ok: boolean; error?: string }>(res);
      if (!json.ok) throw new Error(json.error || 'Error al guardar');
      setSaveStatus('saved');
      void fetchSessions();
    } catch {
      setSaveStatus('error');
    }
  }, [sessionId, testigos, testigoActivoId, analysisByTestigoId, alegatoGlobal, alegatoGlobalMeta, fetchSessions]);

  const guardarRepresentacion = useCallback(async () => {
    if (!sessionId) return;
    if (!representacion.parte) {
      toast({
        title: 'Elegí la parte que defendés',
        description: esPenal
          ? 'Seleccioná Defensa o Fiscalía antes de guardar.'
          : 'Seleccioná actor o demandado antes de guardar.',
        variant: 'destructive',
      });
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    setGuardandoRepresentacion(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/audiencia-copilot/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ representacion }),
      });
      const json = await safeResJson<{ ok: boolean; error?: string }>(res);
      if (!json.ok) throw new Error(json.error || 'Error al guardar');
      setRepresentacionGuardada({ ...representacion });
      toast({
        title: 'Representación guardada',
        description: 'La IA usará esta posición y objetivo en las sugerencias.',
      });
    } catch (err) {
      toast({
        title: 'No se pudo guardar',
        description: err instanceof Error ? err.message : 'Error al guardar',
        variant: 'destructive',
      });
    } finally {
      setGuardandoRepresentacion(false);
    }
  }, [sessionId, representacion, esPenal, toast]);

  useEffect(() => {
    const loadStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/audiencia-copilot', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await safeResJson<{ ok: boolean } & Partial<AiStatus>>(res);
        if (json.ok) {
          setAiStatus({
            provider: json.provider ?? 'Google Gemini',
            model: json.model ?? GEMINI_MODEL_ID,
            keyConfigured: !!json.keyConfigured,
            ready: !!json.ready,
          });
        }
      } catch {
        setAiStatus(null);
      }
    };
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return;
      void loadStatus();
      if (!sessionsLoadedRef.current) {
        sessionsLoadedRef.current = true;
        const list = await fetchSessions();
        const lastId = localStorage.getItem(LAST_SESSION_KEY);
        if (lastId && list.some((s) => s.id === lastId)) {
          await loadSessionById(lastId);
        }
      }
    });
    return () => unsub();
  }, [fetchSessions, loadSessionById]);

  useEffect(() => {
    if (!sessionId) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      void saveSession();
    }, 1200);
    return () => clearTimeout(timer);
  }, [sessionId, testigos, testigoActivoId, analysisByTestigoId, alegatoGlobal, alegatoGlobalMeta, saveSession]);

  const handleLoadPdf = async (file: File) => {
    setIsLoading(true);
    startLoadTimer(file.name, 0, LOAD_STEPS[0].label);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sesión requerida');
      const token = await user.getIdToken();
      const form = new FormData();
      form.append('file', file);

      const extractRes = await fetch('/api/admin/audiencia-copilot/load-expediente', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const extractJson = await safeResJson<{
        ok: boolean;
        sessionId?: string;
        titulo?: string;
        textoLength?: number;
        error?: string;
      }>(extractRes);

      if (!extractJson.ok || !extractJson.sessionId) {
        throw new Error(extractJson.error || `Error al leer PDF (${extractRes.status})`);
      }

      startLoadTimer(file.name, 1, LOAD_STEPS[1].label);
      setLoadProgress((prev) =>
        prev ? { ...prev, stepIndex: 1, textoLength: extractJson.textoLength } : prev
      );

      const analyzeRes = await fetch(
        `/api/admin/audiencia-copilot/sessions/${extractJson.sessionId}/analyze`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const analyzeJson = await safeResJson<{
        ok: boolean;
        sessionId?: string;
        analysis?: ExpedienteAnalysisOutput;
        testigos?: Testigo[];
        testigoActivoId?: string | null;
        titulo?: string;
        error?: string;
      }>(analyzeRes);

      if (!analyzeJson.ok || !analyzeJson.analysis || !analyzeJson.sessionId) {
        throw new Error(analyzeJson.error || `Error al analizar (${analyzeRes.status})`);
      }

      startLoadTimer(file.name, 2, LOAD_STEPS[2].label);

      skipSaveRef.current = true;
      setSessionId(analyzeJson.sessionId);
      setExpedienteAnalysis(analyzeJson.analysis);
      setTestigos(normalizeTestigos(analyzeJson.testigos ?? []));
      setTestigoActivoId(analyzeJson.testigoActivoId ?? null);
      setAnalysisByTestigoId({});
      setRepresentacion({ ...EMPTY_REPRESENTACION });
      setRepresentacionGuardada({ ...EMPTY_REPRESENTACION });
      setAlegatoGlobal('');
      setAlegatoGlobalMeta(undefined);
      setAnalysis(EMPTY_ANALYSIS);
      localStorage.setItem(LAST_SESSION_KEY, analyzeJson.sessionId);
      setSaveStatus('saved');
      void fetchSessions();

      const count = analyzeJson.testigos?.length ?? 0;
      toast({
        title: 'Expediente listo',
        description: `${analyzeJson.titulo ?? 'Audiencia'} — ${count} declarante(s) en ${loadElapsedRef.current || 'unos'} segundos.`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo cargar el PDF',
        variant: 'destructive',
      });
    } finally {
      stopLoadTimer();
      setIsLoading(false);
    }
  };

  const agregarTestigo = () => {
    if (!nuevoNombre.trim()) return;
    const t: Testigo = {
      id: crypto.randomUUID(),
      nombre: nuevoNombre.trim(),
      rol: nuevoRol.trim() || 'Testigo',
      bandeja: nuevaBandeja,
      contextoDeclarante: '',
      testimonioPrevio: '',
      intercambios: [],
      testimonioCerrado: false,
    };
    setTestigos((prev) => [...prev, t]);
    setTestigoActivoId(t.id);
    setNuevoNombre('');
    setNuevoRol('');
    setAnalysis(EMPTY_ANALYSIS);
  };

  const actualizarTestimonioPrevio = (id: string, texto: string) => {
    setTestigos((prev) => prev.map((t) => (t.id === id ? { ...t, testimonioPrevio: texto } : t)));
  };

  const actualizarBandejaDeclarante = (id: string, bandeja: BandejaDeclarante) => {
    setTestigos((prev) => prev.map((t) => (t.id === id ? { ...t, bandeja } : t)));
  };

  const actualizarContextoDeclarante = (id: string, texto: string) => {
    setTestigos((prev) => prev.map((t) => (t.id === id ? { ...t, contextoDeclarante: texto } : t)));
  };

  const actualizarTestimonioCerrado = (id: string, cerrado: boolean) => {
    setTestigos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, testimonioCerrado: cerrado } : t))
    );
  };

  const seleccionarTestigo = (id: string) => {
    setTestigoActivoId(id);
    setAnalysis(analysisByTestigoId[id] ?? EMPTY_ANALYSIS);
  };

  const renderListaDeclarantes = (items: Testigo[], vacio: string) => {
    if (items.length === 0) {
      return <p className="px-2 py-1 text-xs text-muted-foreground">{vacio}</p>;
    }
    return (
      <div className="space-y-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'rounded-lg border bg-background transition-colors',
              t.id === testigoActivoId
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'hover:bg-muted/50'
            )}
          >
            <button
              type="button"
              onClick={() => seleccionarTestigo(t.id)}
              className="w-full p-3 text-left text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{t.nombre}</p>
                  <p className="text-xs text-muted-foreground">{t.rol}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.intercambios.length} pregunta(s) en audiencia
                  </p>
                </div>
                {t.testimonioCerrado && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Cerrado
                  </Badge>
                )}
              </div>
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-2 py-1.5">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={t.testimonioCerrado}
                  onCheckedChange={(v) => actualizarTestimonioCerrado(t.id, v === true)}
                />
                Testimonio cerrado
              </label>
              <Select
                value={t.bandeja}
                onValueChange={(v) => actualizarBandejaDeclarante(t.id, v as BandejaDeclarante)}
              >
                <SelectTrigger className="h-7 border-0 bg-transparent text-[10px] shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuestra">{bandejaLabels.nuestra}</SelectItem>
                  <SelectItem value="contraria">{bandejaLabels.contraria}</SelectItem>
                  <SelectItem value="indefinida">Sin clasificar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const patchAnalysis = useCallback(
    (patch: Partial<AudienciaCopilotOutput>) => {
      if (!testigoActivoId) return;
      setAnalysis((prev) => {
        const next = { ...prev, ...patch };
        setAnalysisByTestigoId((prevMap) => ({ ...prevMap, [testigoActivoId]: next }));
        return next;
      });
    },
    [testigoActivoId]
  );

  const analizarTestigo = useCallback(
    async (testigo: Testigo) => {
      if (!expedienteAnalysis) return;
      if (!representacion.parte) {
        toast({
          title: 'Falta indicar representación',
          description: esPenal
            ? 'En el paso 1, elegí si representás a la defensa o a la fiscalía.'
            : 'En el paso 1, elegí si representás al actor o al demandado.',
          variant: 'destructive',
        });
        return;
      }
      if (representacionDirty) {
        toast({
          title: 'Guardá la representación',
          description: 'Hacé clic en Guardar en el paso 1 antes de usar las sugerencias de IA.',
          variant: 'destructive',
        });
        return;
      }
      const user = auth.currentUser;
      if (!user) return;

      setIsLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/audiencia-copilot', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expedienteContexto,
            representacionContexto,
            declaranteNombre: testigo.nombre,
            declaranteRol: testigo.rol,
            contextoDeclarante:
              testigo.contextoDeclarante?.trim() || '(El abogado no agregó contexto sobre este testigo)',
            testimonioPrevio: testigo.testimonioPrevio || '(Sin testimonio previo cargado)',
            intercambiosTexto: formatIntercambios(testigo.intercambios),
          }),
        });
        const json = await safeResJson<{
          ok: boolean;
          analysis?: AudienciaCopilotOutput;
          error?: string;
        }>(res);
        if (!json.ok || !json.analysis) throw new Error(json.error || 'Error al analizar');
        setAnalysis(json.analysis);
        setAnalysisByTestigoId((prev) => ({ ...prev, [testigo.id]: json.analysis! }));
      } catch (err) {
        toast({
          title: 'Error de IA',
          description: err instanceof Error ? err.message : 'No se pudo analizar',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [expedienteAnalysis, expedienteContexto, esPenal, representacion.parte, representacionContexto, representacionDirty, toast]
  );

  const agregarIntercambio = async () => {
    if (!testigoActivo || !nuevaPregunta.trim() || !nuevaRespuesta.trim()) return;

    const intercambio: AudienciaIntercambio = {
      id: crypto.randomUUID(),
      pregunta: nuevaPregunta.trim(),
      respuesta: nuevaRespuesta.trim(),
    };

    const testigoActualizado: Testigo = {
      ...testigoActivo,
      intercambios: [...testigoActivo.intercambios, intercambio],
    };

    setTestigos((prev) =>
      prev.map((t) => (t.id === testigoActivo.id ? testigoActualizado : t))
    );
    setNuevaPregunta('');
    setNuevaRespuesta('');
    await analizarTestigo(testigoActualizado);
  };

  const generarAlegatosGlobales = useCallback(async () => {
    if (!sessionId) return;
    if (representacionDirty) {
      toast({
        title: 'Guardá la representación',
        description: 'Guardá la representación en el paso 1 antes de armar alegatos.',
        variant: 'destructive',
      });
      return;
    }
    if (!todosTestimoniosCerrados) {
      toast({
        title: 'Faltan testimonios',
        description: `Marcá como cerrados los ${testigos.length - testimoniosCerrados} testimonio(s) pendiente(s).`,
        variant: 'destructive',
      });
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setGenerandoAlegatos(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/admin/audiencia-copilot/sessions/${sessionId}/alegatos-globales`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = await safeResJson<{
        ok: boolean;
        alegatoGlobal?: string;
        alegatoGlobalMeta?: AudienciaSessionData['alegatoGlobalMeta'];
        error?: string;
      }>(res);
      if (!json.ok || !json.alegatoGlobal) {
        throw new Error(json.error || 'No se pudieron generar los alegatos');
      }
      setAlegatoGlobal(json.alegatoGlobal);
      setAlegatoGlobalMeta(json.alegatoGlobalMeta);
      toast({
        title: 'Alegatos globales listos',
        description: 'Integran todos los testimonios cerrados de la audiencia.',
      });
    } catch (err) {
      toast({
        title: 'Error al generar alegatos',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      });
    } finally {
      setGenerandoAlegatos(false);
    }
  }, [
    sessionId,
    representacionDirty,
    todosTestimoniosCerrados,
    testigos.length,
    testimoniosCerrados,
    toast,
  ]);

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Gavel className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Copiloto de Audiencias</CardTitle>
                <CardDescription className="max-w-2xl">
                  Asistente de IA para todo lo que pasa en la audiencia: explica el expediente, sugiere
                  preguntas, detecta contradicciones y admisiones, saca conclusiones y arma borradores de
                  alegatos. Anotá cada intercambio; todo se guarda en la nube para retomar días después.
                </CardDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {COPILOT_CAPABILITIES.map((cap) => (
                    <Badge key={cap} variant="secondary" className="text-[11px] font-normal">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            {aiStatus && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={aiStatus.ready ? 'default' : 'destructive'} className="gap-1">
                  {aiStatus.ready ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {aiStatus.ready ? `Gemini · ${aiStatus.model}` : 'Falta API key'}
                </Badge>
                {sessionId && (
                  <Badge variant="outline" className="gap-1">
                    <Cloud className="h-3 w-3" />
                    {saveStatus === 'saving'
                      ? 'Guardando...'
                      : saveStatus === 'saved'
                        ? 'Guardado'
                        : saveStatus === 'error'
                          ? 'Error al guardar'
                          : 'En la nube'}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            {sessions.length > 0 && (
              <div className="min-w-[240px] flex-1 space-y-1">
                <Label className="text-xs">Audiencias guardadas</Label>
                <Select
                  value={sessionId ?? ''}
                  onValueChange={(id) => {
                    if (id) void loadSessionById(id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir audiencia..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.titulo} — {formatFecha(s.updatedAt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              type="button"
              variant="default"
              disabled={isLoading}
              onClick={handleNuevaAudiencia}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Nueva audiencia
            </Button>
            <p className="text-xs text-muted-foreground pb-2">
              {sessions.length > 0
                ? `${sessions.length} audiencia(s) · se guarda automáticamente`
                : 'Cargá el PDF de una causa para empezar'}
            </p>
          </div>
        </CardHeader>
      </Card>

      {/* Paso 1: Expediente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            1. Expediente
          </CardTitle>
          <CardDescription>
            Subí el PDF exportado desde LegalMev. Gemini lee todo y entiende de qué va el caso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleLoadPdf(file);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="default"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Cargar PDF del expediente
              </>
            )}
          </Button>

          {loadProgress && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{loadProgress.label}...</span>
                <span className="tabular-nums text-muted-foreground">
                  {loadProgress.seconds}s
                </span>
              </div>
              <Progress
                value={((loadProgress.stepIndex + 1) / LOAD_STEPS.length) * 100}
                className="h-2"
              />
              <div className="space-y-1">
                {LOAD_STEPS.map((step, i) => (
                  <p
                    key={step.key}
                    className={cn(
                      'text-xs',
                      i < loadProgress.stepIndex
                        ? 'text-primary font-medium'
                        : i === loadProgress.stepIndex
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground'
                    )}
                  >
                    {i < loadProgress.stepIndex ? '✓' : i === loadProgress.stepIndex ? '→' : '○'}{' '}
                    {step.label}
                    {i === 0 && loadProgress.textoLength
                      ? ` (${Math.round(loadProgress.textoLength / 1000)}k caracteres)`
                      : ''}
                  </p>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Archivo: {loadProgress.fileName}. Los expedientes grandes pueden tardar 1–3 minutos;
                no cierres esta pestaña.
              </p>
            </div>
          )}
          {aiStatus && !aiStatus.ready && (
            <p className="text-sm text-destructive">
              Configurá GOOGLE_GENAI_API_KEY en .env.local y reiniciá el servidor.
            </p>
          )}
          {expedienteAnalysis && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-semibold">¿A quién representamos?</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Fuero {tipoFueroLabel(tipoFuero)}
                  </Badge>
                  {!representacion.parte && (
                    <Badge variant="destructive" className="text-xs">
                      Configurá esto antes de usar sugerencias
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {esPenal
                  ? 'La IA detectó una causa penal. Elegí si representás a la defensa o a la fiscalía.'
                  : 'Define tu posición procesal. La IA orientará preguntas, alertas y alegatos a favor de tu cliente, no de la contraria.'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Parte que defendemos</Label>
                  <Select
                    value={representacion.parte || '_'}
                    onValueChange={(v) =>
                      actualizarParteRepresentada(
                        v === '_' ? '' : (v as ParteRepresentada)
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegir parte..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_" disabled>
                        Elegir parte...
                      </SelectItem>
                      {esPenal ? (
                        <>
                          <SelectItem value="defensa">Defensa (imputado)</SelectItem>
                          <SelectItem value="fiscalia">Fiscalía / MP</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="actor">Actor (demandante)</SelectItem>
                          <SelectItem value="demandado">Demandado</SelectItem>
                        </>
                      )}
                      <SelectItem value="otro">Otra parte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {esPenal ? 'Cliente / imputado o fiscalía' : 'Cliente / nombre en la causa'}
                  </Label>
                  <Input
                    value={representacion.clienteNombre}
                    onChange={(e) =>
                      setRepresentacion((prev) => ({ ...prev, clienteNombre: e.target.value }))
                    }
                    placeholder={
                      nombreClienteSugerido(representacion.parte, expedienteAnalysis) ||
                      (esPenal ? 'Nombre del imputado o fiscalía' : 'Nombre del representado')
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Objetivo estratégico (opcional)</Label>
                <Textarea
                  value={representacion.notas}
                  onChange={(e) =>
                    setRepresentacion((prev) => ({ ...prev, notas: e.target.value }))
                  }
                  placeholder={
                    esPenal
                      ? 'Ej: Desvirtuar la declaración del testigo de fiscalía, reforzar coartada del imputado...'
                      : 'Ej: Desacreditar la pericia del actor, acreditar que el inmueble rural no tiene el alquiler que pretenden...'
                  }
                  className="min-h-[72px] resize-y text-sm bg-background"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  {modoRepresentacion && (
                    <p className="text-xs text-primary font-medium">{modoRepresentacion}</p>
                  )}
                  {!representacionDirty && representacion.parte && (
                    <p className="text-xs text-muted-foreground">Representación guardada.</p>
                  )}
                </div>
                {representacionDirty && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      Cambios sin guardar
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={guardandoRepresentacion || !representacion.parte}
                      onClick={() => void guardarRepresentacion()}
                    >
                      {guardandoRepresentacion ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Guardar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {expedienteAnalysis && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{expedienteAnalysis.caratula || 'Expediente analizado'}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {tipoFueroLabel(expedienteAnalysis.tipoFuero ?? 'civil')}
                </Badge>
              </div>
              <p>{expedienteAnalysis.resumen}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">OBJETO</span>
                  <p>{expedienteAnalysis.objetoLitigio}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">PUNTOS CONTROVERTIDOS</span>
                  <ul className="list-disc pl-4">
                    {expedienteAnalysis.puntosControvertidos.slice(0, 4).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {expedienteAnalysis && (
        <div className="grid gap-6 xl:grid-cols-12">
          {/* Paso 2: Declarantes */}
          <div className="space-y-4 xl:col-span-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    2. Declarantes
                  </span>
                  <Badge variant="secondary">{testigos.length}</Badge>
                </CardTitle>
                <CardDescription>Testigos detectados en el expediente o agregados manualmente</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="space-y-2 shrink-0">
                  <Label className="text-xs text-muted-foreground">Agregar declarante a</Label>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={nuevaBandeja}
                      onValueChange={(v) => setNuevaBandeja(v as BandejaDeclarante)}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nuestra">{bandejaLabels.nuestra}</SelectItem>
                        <SelectItem value="contraria">{bandejaLabels.contraria}</SelectItem>
                        <SelectItem value="indefinida">Sin clasificar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                    />
                    <Input
                      placeholder="Rol"
                      value={nuevoRol}
                      onChange={(e) => setNuevoRol(e.target.value)}
                    />
                    <Button type="button" size="icon" variant="outline" onClick={agregarTestigo}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div
                  className="min-h-[160px] max-h-[min(50vh,28rem)] overflow-y-auto rounded-lg border bg-muted/20 p-2 space-y-4"
                  role="list"
                  aria-label="Lista de declarantes"
                >
                  {testigos.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      No hay declarantes. Agregá uno manualmente o recargá el expediente.
                    </p>
                  ) : (
                    <>
                      <section>
                        <div className="mb-2 flex items-center justify-between gap-2 px-1">
                          <p className="text-xs font-semibold text-primary">{bandejaLabels.nuestra}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {testigosNuestra.length}
                          </Badge>
                        </div>
                        {renderListaDeclarantes(testigosNuestra, 'Sin declarantes de nuestra parte.')}
                      </section>

                      <section className="border-t pt-3">
                        <div className="mb-2 flex items-center justify-between gap-2 px-1">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                            {bandejaLabels.contraria}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            {testigosContraria.length}
                          </Badge>
                        </div>
                        {renderListaDeclarantes(
                          testigosContraria,
                          'Sin declarantes de la contraria.'
                        )}
                      </section>

                      {testigosIndefinidos.length > 0 && (
                        <section className="border-t pt-3">
                          <div className="mb-2 flex items-center justify-between gap-2 px-1">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Sin clasificar
                            </p>
                            <Badge variant="outline" className="text-[10px]">
                              {testigosIndefinidos.length}
                            </Badge>
                          </div>
                          {renderListaDeclarantes(
                            testigosIndefinidos,
                            'Clasificá cada declarante con el selector debajo de su nombre.'
                          )}
                        </section>
                      )}
                    </>
                  )}
                </div>

                {testigoActivo && (
                  <div className="shrink-0 space-y-2 border-t pt-3">
                    <Label className="text-sm">Testimonio previo de {testigoActivo.nombre}</Label>
                    <Textarea
                      value={testigoActivo.testimonioPrevio}
                      onChange={(e) => actualizarTestimonioPrevio(testigoActivo.id, e.target.value)}
                      placeholder="Declaración testimonial previa, indagatoria, etc."
                      className="min-h-[100px] max-h-[200px] resize-y text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Paso 3: Preguntas y respuestas */}
          <div className="space-y-4 xl:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Preguntas y respuestas</CardTitle>
                <CardDescription>
                  Anotá lo que preguntás y lo que responde el declarante; el copiloto actualiza sugerencias,
                  alertas y conclusiones al instante
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!representacion.parte && expedienteAnalysis && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    {esPenal
                      ? 'Indicá en el paso 1 si representás a la defensa o a la fiscalía.'
                      : 'Indicá en el paso 1 a quién representás (actor o demandado). Sin eso, las sugerencias pueden favorecer a la parte equivocada.'}
                  </div>
                )}
                {representacionDirty && representacion.parte && (
                  <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    Tenés cambios sin guardar en la representación. Guardalos en el paso 1 antes de
                    analizar.
                  </div>
                )}
                {!testigoActivo ? (
                  <p className="text-sm text-muted-foreground">Seleccioná un declarante.</p>
                ) : (
                  <>
                    <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                      <Label htmlFor="contexto-testigo" className="text-sm font-semibold">
                        ¿Quién es {testigoActivo.nombre}?
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Describí al testigo en tus palabras: rol en los hechos, relación con las partes,
                        qué esperás obtener de su declaración. La IA usa esto en cada análisis.
                      </p>
                      <Textarea
                        id="contexto-testigo"
                        value={testigoActivo.contextoDeclarante ?? ''}
                        onChange={(e) =>
                          actualizarContextoDeclarante(testigoActivo.id, e.target.value)
                        }
                        placeholder="Ej: Empleado despedido hace 2 años. Fue compañero del gerente acusado. Lo propuso la actora para acreditar el trato hostil en planta..."
                        className="min-h-[88px] resize-y text-sm bg-background"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoading || !testigoActivo.contextoDeclarante?.trim()}
                        onClick={() => void analizarTestigo(testigoActivo)}
                      >
                        Actualizar sugerencias con este contexto
                      </Button>
                      {representacion.parte && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => void analizarTestigo(testigoActivo)}
                        >
                          Re-analizar con posición de{' '}
                          {esPenal
                            ? representacion.parte === 'fiscalia' || representacion.parte === 'actor'
                              ? 'fiscalía'
                              : 'defensa'
                            : representacion.parte === 'demandado'
                              ? 'defensa'
                              : 'actor'}
                        </Button>
                      )}
                    </div>

                    <ScrollArea className="h-[200px] rounded-lg border p-3">
                      {testigoActivo.intercambios.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin preguntas aún.</p>
                      ) : (
                        <div className="space-y-4">
                          {testigoActivo.intercambios.map((i, n) => (
                            <div key={i.id} className="text-sm">
                              <p className="font-medium text-primary">P{n + 1}: {i.pregunta}</p>
                              <p className="mt-1 text-muted-foreground">R: {i.respuesta}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>

                    <div className="space-y-2">
                      <Label>Pregunta</Label>
                      <Textarea
                        value={nuevaPregunta}
                        onChange={(e) => setNuevaPregunta(e.target.value)}
                        placeholder="¿Qué le preguntaste?"
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Respuesta</Label>
                      <Textarea
                        value={nuevaRespuesta}
                        onChange={(e) => setNuevaRespuesta(e.target.value)}
                        placeholder="¿Qué respondió?"
                        className="min-h-[60px]"
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={isLoading || !nuevaPregunta.trim() || !nuevaRespuesta.trim()}
                      onClick={() => void agregarIntercambio()}
                    >
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Agregar y obtener sugerencias
                    </Button>

                    {testigoActivo && (
                      <label className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm cursor-pointer">
                        <Checkbox
                          checked={testigoActivo.testimonioCerrado}
                          onCheckedChange={(v) =>
                            actualizarTestimonioCerrado(testigoActivo.id, v === true)
                          }
                        />
                        <span>
                          <span className="font-medium">Testimonio de {testigoActivo.nombre} cerrado</span>
                          <span className="block text-xs text-muted-foreground">
                            Marcá esto cuando terminás de interrogar a este declarante.
                          </span>
                        </span>
                      </label>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Copiloto IA */}
          <div className="space-y-4 xl:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="h-4 w-4" />
                  Copiloto IA
                </CardTitle>
                <CardDescription>
                  Análisis en tiempo real del declarante activo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-semibold mb-2 text-primary">Preguntas sugeridas ahora</p>
                  {!testigoActivo ? (
                    <p className="text-sm text-muted-foreground">
                      Seleccioná un declarante para gestionar preguntas.
                    </p>
                  ) : (
                    <EditablePreguntasList
                      items={analysis.repreguntas}
                      onChange={(repreguntas) => patchAnalysis({ repreguntas })}
                      itemClassName="border-primary/30 bg-primary/5"
                      addPlaceholder="Agregar pregunta manual..."
                      emptyMessage="Sin preguntas aún. La IA las sugerirá al registrar P/R, o agregá una acá."
                    />
                  )}
                </div>

                {analysis.alertas.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">Alertas</p>
                    {analysis.alertas.map((a, i) => (
                      <div
                        key={i}
                        className={cn('rounded-lg border px-3 py-2 text-sm', alertBadgeClass(a.tipo))}
                      >
                        <Badge variant="outline" className="mb-1 text-[10px]">
                          {a.tipo.toUpperCase()}
                        </Badge>
                        <p>{a.mensaje}</p>
                      </div>
                    ))}
                  </div>
                )}

                {analysis.observacionUltimaRespuesta && (
                  <p className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                    {analysis.observacionUltimaRespuesta}
                  </p>
                )}

                {analysis.contradicciones.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-red-700">Contradicciones</p>
                    <ul className="space-y-1 text-sm">
                      {analysis.contradicciones.map((c, i) => (
                        <li key={i} className="rounded bg-red-50 dark:bg-red-950/30 px-2 py-1">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.admisiones.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-green-700">Admisiones</p>
                    <ul className="space-y-1 text-sm">
                      {analysis.admisiones.map((a, i) => (
                        <li key={i} className="rounded bg-green-50 dark:bg-green-950/30 px-2 py-1">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.evasivas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-amber-700">Evasivas u omisiones</p>
                    <ul className="space-y-1 text-sm">
                      {analysis.evasivas.map((e, i) => (
                        <li key={i} className="rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-1">
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(analysis.preguntasIneludibles.length > 0 || testigoActivo) && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Antes de cerrar, preguntar</p>
                    {testigoActivo ? (
                      <EditablePreguntasList
                        items={analysis.preguntasIneludibles}
                        onChange={(preguntasIneludibles) => patchAnalysis({ preguntasIneludibles })}
                        itemClassName="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                        addPlaceholder="Pregunta obligatoria antes de cerrar..."
                        emptyMessage="Sin preguntas pendientes para el cierre."
                      />
                    ) : null}
                  </div>
                )}

                {analysis.conclusiones.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <Scale className="h-3 w-3" />
                      Conclusiones provisionales
                    </p>
                    <ul className="space-y-1 text-sm">
                      {analysis.conclusiones.map((c, i) => (
                        <li key={i} className="rounded border bg-muted/40 px-2 py-1.5">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.estrategia && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Estrategia sugerida</p>
                    <p className="text-sm rounded-lg border bg-muted/30 px-3 py-2">{analysis.estrategia}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Paso 4: Alegatos globales */}
          <Card className="xl:col-span-12 border-primary/20">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Gavel className="h-4 w-4" />
                4. Alegatos globales
              </CardTitle>
              <CardDescription>
                Al cerrar todos los testimonios, la IA arma un único alegato de cierre integrando
                expediente y lo declarado por cada declarante.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    Testimonios cerrados:{' '}
                    <strong>
                      {testimoniosCerrados} de {testigos.length}
                    </strong>
                  </span>
                  {todosTestimoniosCerrados ? (
                    <Badge className="bg-primary/90">Listo para alegatos</Badge>
                  ) : (
                    <Badge variant="outline">Pendientes</Badge>
                  )}
                </div>
                <Progress value={progresoTestimonios} className="h-2" />
              </div>

              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={
                  generandoAlegatos ||
                  isLoading ||
                  !todosTestimoniosCerrados ||
                  representacionDirty ||
                  !representacion.parte
                }
                onClick={() => void generarAlegatosGlobales()}
              >
                {generandoAlegatos ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Gavel className="mr-2 h-4 w-4" />
                )}
                Armar alegatos globales
              </Button>

              {!representacion.parte && (
                <p className="text-xs text-destructive">Configurá y guardá la representación (paso 1).</p>
              )}
              {representacion.parte && !todosTestimoniosCerrados && testigos.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Marcá &quot;Testimonio cerrado&quot; en cada declarante cuando termines de interrogarlo.
                </p>
              )}

              {alegatoGlobalMeta?.puntosFuertes && alegatoGlobalMeta.puntosFuertes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 text-primary">Puntos fuertes</p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {alegatoGlobalMeta.puntosFuertes.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {alegatoGlobalMeta?.debilidadesContraria &&
                alegatoGlobalMeta.debilidadesContraria.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2 text-amber-800">Debilidades de la contraria</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {alegatoGlobalMeta.debilidadesContraria.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {alegatoGlobal ? (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Alegato de cierre (editable)</Label>
                  <Textarea
                    value={alegatoGlobal}
                    onChange={(e) => setAlegatoGlobal(e.target.value)}
                    className="min-h-[280px] resize-y text-sm leading-relaxed"
                  />
                  {alegatoGlobalMeta?.generadoAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Generado: {new Date(alegatoGlobalMeta.generadoAt).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  El alegato global aparecerá acá una vez generado.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
