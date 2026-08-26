'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { cn, safeResJson } from '@/lib/utils';
import type { AudienciaCopilotOutput } from '@/ai/flows/audiencia-copilot';
import type { ExpedienteAnalysisOutput } from '@/ai/flows/audiencia-expediente-analysis';
import type {
  AudienciaIntercambio,
  AudienciaSessionData,
  AudienciaSessionSummary,
  AudienciaTestigo,
  BandejaDeclarante,
  DocumentoAdicionalAudiencia,
  ParteRepresentada,
  RepresentacionCaso,
} from '@/lib/audiencia-session-types';
import { EMPTY_REPRESENTACION, mergePreguntasATodos, migrateSessionRepreguntas, normalizeAudienciaAnalysis, normalizeRepreguntas, splitRepreguntas } from '@/lib/audiencia-session-types';
import type { RepreguntaItem } from '@/lib/audiencia-session-types';
import type { AudienciaCopilotLimits } from '@/lib/audiencia-copilot-limits';
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
import {
  EMPTY_TOKEN_USAGE,
  formatTokenCount,
  normalizeTokenUsage,
  type AiTokenUsageMeta,
} from '@/lib/ai-token-usage';
import { EditablePreguntasList } from '@/components/admin/EditablePreguntasList';
import { EditableRepreguntasList } from '@/components/admin/EditableRepreguntasList';
import {
  AudienciaCopilotUpgradeDialog,
  type AudienciaCopilotUpgradeReason,
} from '@/components/AudienciaCopilotUpgradeDialog';
import { useExpedienteIaConsent } from '@/components/ExpedienteIaConsentDialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Coins,
  FileText,
  Gavel,
  Lightbulb,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  Scale,
  ScanLine,
  Sparkles,
  Trash2,
  User,
  Wifi,
  WifiOff,
  Share2,
} from 'lucide-react';
import { ShareResourceDialog } from '@/components/ShareResourceDialog';
import type { ResourceAccessLevel } from '@/lib/resource-sharing';

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

const EMPTY_ANALYSIS: AudienciaCopilotOutput = normalizeAudienciaAnalysis({
  alertas: [],
  repreguntas: [],
  preguntasIneludibles: [],
  contradicciones: [],
  admisiones: [],
  evasivas: [],
  conclusiones: [],
  estrategia: '',
  borradorAlegato: '',
});

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
  { key: 'extract', label: 'Leyendo texto del PDF' },
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
  const { ensureConsent, consentDialog } = useExpedienteIaConsent('copiloto');
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [trialLimits, setTrialLimits] = useState<AudienciaCopilotLimits | null>(null);
  const [audienciaPagada, setAudienciaPagada] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<AudienciaCopilotUpgradeReason>('general');
  const [isLoading, setIsLoading] = useState(false);
  const [analyzingTestigoId, setAnalyzingTestigoId] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadElapsedRef = useRef(0);
  const analysisTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const analysisGenRef = useRef<Record<string, number>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [myAccess, setMyAccess] = useState<ResourceAccessLevel>('owner');
  const [shareOpen, setShareOpen] = useState(false);
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
  const [preguntasATodos, setPreguntasATodos] = useState<RepreguntaItem[]>([]);
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
  const [refinandoAlegato, setRefinandoAlegato] = useState(false);
  const [instruccionesAlegato, setInstruccionesAlegato] = useState('');
  const [documentosAdicionales, setDocumentosAdicionales] = useState<DocumentoAdicionalAudiencia[]>(
    []
  );
  const [descripcionDocumento, setDescripcionDocumento] = useState('');
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);
  const [pdfEscaneadoOpen, setPdfEscaneadoOpen] = useState(false);
  const [pdfEscaneadoMensaje, setPdfEscaneadoMensaje] = useState('');
  const [reanalizandoCaso, setReanalizandoCaso] = useState(false);
  const [contextoAdicionalAbogado, setContextoAdicionalAbogado] = useState('');
  const [tokenUsage, setTokenUsage] = useState<AiTokenUsageMeta>({ ...EMPTY_TOKEN_USAGE });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docAdicionalInputRef = useRef<HTMLInputElement>(null);
  const skipSaveRef = useRef(true);
  const sessionsLoadedRef = useRef(false);
  const searchParams = useSearchParams();
  const mpHandledRef = useRef(false);
  const testigosRef = useRef(testigos);
  testigosRef.current = testigos;

  const analizandoTestigoActivo = analyzingTestigoId === testigoActivoId;

  const testigoActivo = testigos.find((t) => t.id === testigoActivoId) ?? null;
  const tipoFuero = expedienteAnalysis?.tipoFuero ?? 'civil';
  const esPenal = esFueroPenal(tipoFuero);
  const expedienteContexto = expedienteAnalysis
    ? formatExpedienteContexto(expedienteAnalysis, contextoAdicionalAbogado)
    : '';
  const representacionContexto = formatRepresentacionContexto(representacion, expedienteAnalysis);
  const representacionDirty = !sameRepresentacion(representacion, representacionGuardada);
  const bandejaLabels = etiquetasBandejaDeclarante(representacion, tipoFuero);
  const modoRepresentacion = mensajeModoRepresentacion(representacion, tipoFuero);
  const testigosNuestra = testigos.filter((t) => t.bandeja === 'nuestra');
  const testigosContraria = testigos.filter((t) => t.bandeja === 'contraria');
  const testigosIndefinidos = testigos.filter((t) => t.bandeja === 'indefinida');
  const repreguntasVisibles = [...preguntasATodos, ...analysis.repreguntas];
  const testimoniosCerrados = testigos.filter((t) => t.testimonioCerrado).length;
  const todosTestimoniosCerrados =
    testigos.length > 0 && testigos.every((t) => t.testimonioCerrado);
  const progresoTestimonios =
    testigos.length > 0 ? Math.round((testimoniosCerrados / testigos.length) * 100) : 0;
  const puedeReanalizarCaso = !!expedienteAnalysis && !!representacion.parte && !!sessionId;
  const canEditSession = myAccess === 'owner' || myAccess === 'edit';
  const isOwnerSession = myAccess === 'owner';
  const intercambiosTotales = testigos.reduce((n, t) => n + t.intercambios.length, 0);
  const intercambiosTestigoActivo = testigoActivo?.intercambios.length ?? 0;
  const alcanzoLimiteTestigos =
    !!trialLimits && !audienciaPagada && testigos.length >= trialLimits.maxTestigos;
  const alcanzoLimiteIntercambiosTotal =
    !!trialLimits && !audienciaPagada && intercambiosTotales >= trialLimits.maxIntercambiosTotal;
  const alcanzoLimiteIntercambiosTestigo =
    !!trialLimits &&
    !audienciaPagada &&
    intercambiosTestigoActivo >= trialLimits.maxIntercambiosPerTestigo;
  const alcanzoLimiteDocumentos =
    !!trialLimits &&
    !audienciaPagada &&
    documentosAdicionales.length >= trialLimits.maxDocumentosAdicionales;
  const alcanzoLimitePruebaSesion =
    alcanzoLimiteTestigos ||
    alcanzoLimiteIntercambiosTotal ||
    alcanzoLimiteDocumentos;

  const abrirUpsell = useCallback((reason: AudienciaCopilotUpgradeReason) => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  }, []);

  const mostrarErrorPdfEscaneado = useCallback((error?: string, code?: string) => {
    const esEscaneado = code === 'SCANNED_PDF';
    setPdfEscaneadoMensaje(
      error ||
        (esEscaneado
          ? 'Este PDF parece ser un escaneo sin texto seleccionable.'
          : 'No se pudo leer el PDF.')
    );
    setPdfEscaneadoOpen(true);
  }, []);

  const aplicarTokenUsage = useCallback((next?: AiTokenUsageMeta | null) => {
    if (!next) return;
    setTokenUsage({
      ...normalizeTokenUsage(next),
      model: next.model ?? aiStatus?.model ?? GEMINI_MODEL_ID,
      lastUpdatedAt: next.lastUpdatedAt,
    });
  }, [aiStatus?.model]);

  const fetchAnalisisParaTestigo = useCallback(
    async (
      testigo: Testigo,
      repCtx: string
    ): Promise<{ analysis: AudienciaCopilotOutput; todos: RepreguntaItem[] }> => {
      const user = auth.currentUser;
      if (!user) throw new Error('Sesión requerida');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/audiencia-copilot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          expedienteContexto,
          representacionContexto: repCtx,
          declaranteNombre: testigo.nombre,
          declaranteRol: testigo.rol,
          contextoDeclarante:
            testigo.contextoDeclarante?.trim() ||
            '(El abogado no agregó contexto sobre este testigo)',
          testimonioPrevio: testigo.testimonioPrevio || '(Sin testimonio previo cargado)',
          intercambiosTexto: formatIntercambios(testigo.intercambios),
        }),
      });
      const json = await safeResJson<{
        ok: boolean;
        analysis?: AudienciaCopilotOutput;
        tokenUsage?: AiTokenUsageMeta;
        error?: string;
      }>(res);
      if (!json.ok || !json.analysis) throw new Error(json.error || 'Error al analizar');
      if (json.tokenUsage) aplicarTokenUsage(json.tokenUsage);
      const rawSplit = splitRepreguntas(normalizeRepreguntas(json.analysis.repreguntas));
      return {
        analysis: normalizeAudienciaAnalysis({
          ...json.analysis,
          repreguntas: rawSplit.testigo,
        }),
        todos: rawSplit.todos,
      };
    },
    [expedienteContexto, sessionId, aplicarTokenUsage]
  );

  const sincronizarYReanalizarCaso = useCallback(async (opts?: {
    generarPreguntasIniciales?: boolean;
  }) => {
    if (!sessionId || !expedienteAnalysis) return;
    if (!representacion.parte) {
      toast({
        title: 'Elegí la parte que defendés',
        description: esPenal
          ? 'Seleccioná Defensa o Fiscalía antes de reanalizar.'
          : 'Seleccioná actor o demandado antes de reanalizar.',
        variant: 'destructive',
      });
      return;
    }
    if (opts?.generarPreguntasIniciales && !contextoAdicionalAbogado.trim()) {
      toast({
        title: 'Pegá el contexto extra',
        description:
          'Escribí de qué va la causa o la lista de testigos (quiénes son y qué esperás de cada uno).',
        variant: 'destructive',
      });
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setReanalizandoCaso(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/admin/audiencia-copilot/sessions/${sessionId}/reanalizar-caso`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            representacion,
            contextoAdicionalAbogado,
            generarPreguntasIniciales: opts?.generarPreguntasIniciales === true,
          }),
        }
      );
      const json = await safeResJson<{
        ok: boolean;
        expedienteAnalysis?: ExpedienteAnalysisOutput;
        analysisByTestigoId?: Record<string, AudienciaCopilotOutput>;
        preguntasATodos?: RepreguntaItem[];
        testigos?: Testigo[];
        testigoActivoId?: string | null;
        testigosReanalizados?: number;
        testigosAgregados?: number;
        testigosActualizados?: number;
        representacion?: RepresentacionCaso;
        contextoAdicionalAbogado?: string;
        tokenUsage?: AiTokenUsageMeta;
        error?: string;
      }>(res);

      if (!json.ok || !json.expedienteAnalysis) {
        throw new Error(json.error || 'No se pudo reanalizar el caso');
      }

      if (json.tokenUsage) aplicarTokenUsage(json.tokenUsage);

      skipSaveRef.current = true;
      setExpedienteAnalysis(json.expedienteAnalysis);
      if (json.testigos) {
        setTestigos(normalizeTestigos(json.testigos));
      }
      if (json.testigoActivoId !== undefined) {
        setTestigoActivoId(json.testigoActivoId);
      }
      if (typeof json.contextoAdicionalAbogado === 'string') {
        setContextoAdicionalAbogado(json.contextoAdicionalAbogado);
      }
      if (json.analysisByTestigoId) {
        const migrated = migrateSessionRepreguntas({
          preguntasATodos: json.preguntasATodos,
          analysisByTestigoId: json.analysisByTestigoId,
        });
        setAnalysisByTestigoId(migrated.analysisByTestigoId);
        setPreguntasATodos(migrated.preguntasATodos);
        const activeId = json.testigoActivoId ?? testigoActivoId;
        if (activeId && migrated.analysisByTestigoId[activeId]) {
          setAnalysis(migrated.analysisByTestigoId[activeId]);
        }
      } else if (json.preguntasATodos) {
        setPreguntasATodos(json.preguntasATodos);
      }
      if (json.representacion) {
        setRepresentacion(json.representacion);
        setRepresentacionGuardada(json.representacion);
      }
      setAlegatoGlobal('');
      setAlegatoGlobalMeta(undefined);

      const declarantes = json.testigosReanalizados ?? 0;
      const extras = [
        json.testigosAgregados ? `${json.testigosAgregados} declarante(s) incorporado(s)` : '',
        json.testigosActualizados ? `${json.testigosActualizados} con contexto actualizado` : '',
      ].filter(Boolean);
      toast({
        title: opts?.generarPreguntasIniciales
          ? 'Contexto aplicado'
          : 'Caso reanalizado',
        description:
          opts?.generarPreguntasIniciales
            ? `Se cargaron ${json.testigos?.length ?? 0} declarante(s)${extras.length ? ` (${extras.join('; ')})` : ''} y las preguntas a realizar.`
            : declarantes > 0
              ? `Mapa del expediente actualizado y sugerencias revisadas para ${declarantes} declarante(s).`
              : 'Mapa del expediente actualizado según tu objetivo estratégico.',
      });
    } catch (err) {
      toast({
        title: 'Error al reanalizar',
        description: err instanceof Error ? err.message : 'No se pudo sincronizar el caso',
        variant: 'destructive',
      });
    } finally {
      setReanalizandoCaso(false);
    }
  }, [
    sessionId,
    expedienteAnalysis,
    representacion,
    contextoAdicionalAbogado,
    testigoActivoId,
    esPenal,
    toast,
    aplicarTokenUsage,
  ]);

  const resetParaNuevaAudiencia = useCallback(() => {
    skipSaveRef.current = true;
    setSessionId(null);
    setMyAccess('owner');
    setExpedienteAnalysis(null);
    setTestigos([]);
    setTestigoActivoId(null);
    setAnalysisByTestigoId({});
    setPreguntasATodos([]);
    setAnalysis(EMPTY_ANALYSIS);
    setRepresentacion({ ...EMPTY_REPRESENTACION });
    setRepresentacionGuardada({ ...EMPTY_REPRESENTACION });
    setAlegatoGlobal('');
    setAlegatoGlobalMeta(undefined);
    setInstruccionesAlegato('');
    setDocumentosAdicionales([]);
    setDescripcionDocumento('');
    setContextoAdicionalAbogado('');
    setTokenUsage({ ...EMPTY_TOKEN_USAGE });
    setNuevaPregunta('');
    setNuevaRespuesta('');
    setNuevoNombre('');
    setNuevoRol('');
    setSaveStatus('idle');
    setAudienciaPagada(false);
    localStorage.removeItem(LAST_SESSION_KEY);
  }, []);

  const handleNuevaAudiencia = () => {
    ensureConsent(() => {
      resetParaNuevaAudiencia();
      setAudienciaPagada(false);
      fileInputRef.current?.click();
    });
  };

  const applySession = useCallback((session: AudienciaSessionData) => {
    skipSaveRef.current = true;
    setSessionId(session.id);
    setExpedienteAnalysis(session.expedienteAnalysis ?? null);
    setTestigos(normalizeTestigos(session.testigos));
    setTestigoActivoId(session.testigoActivoId);
    const migrated = migrateSessionRepreguntas({
      preguntasATodos: session.preguntasATodos,
      analysisByTestigoId: session.analysisByTestigoId,
    });
    setAnalysisByTestigoId(migrated.analysisByTestigoId);
    setPreguntasATodos(migrated.preguntasATodos);
    const rep = session.representacion ?? { ...EMPTY_REPRESENTACION };
    setRepresentacion(rep);
    setRepresentacionGuardada(rep);
    setAlegatoGlobal(session.alegatoGlobal ?? '');
    setAlegatoGlobalMeta(session.alegatoGlobalMeta);
    setDocumentosAdicionales(session.documentosAdicionales ?? []);
    setContextoAdicionalAbogado(session.contextoAdicionalAbogado ?? '');
    setAudienciaPagada(session.audienciaPagada === true);
    setTokenUsage(
      session.tokenUsage
        ? {
            ...normalizeTokenUsage(session.tokenUsage),
            model: session.tokenUsage.model ?? GEMINI_MODEL_ID,
            lastUpdatedAt: session.tokenUsage.lastUpdatedAt,
          }
        : { ...EMPTY_TOKEN_USAGE }
    );
    const activeId = session.testigoActivoId;
    setAnalysis(
      activeId && migrated.analysisByTestigoId[activeId]
        ? migrated.analysisByTestigoId[activeId]
        : EMPTY_ANALYSIS
    );
    localStorage.setItem(LAST_SESSION_KEY, session.id);
    setSaveStatus('saved');
  }, []);

  const refreshCopilotLimits = useCallback(async (forSessionId?: string | null) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const qs = forSessionId ? `?sessionId=${encodeURIComponent(forSessionId)}` : '';
      const res = await fetch(`/api/admin/audiencia-copilot${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{
        ok: boolean;
        trialLimits?: AudienciaCopilotLimits | null;
        audienciaPagada?: boolean;
      }>(res);
      if (json.ok) {
        setTrialLimits(json.trialLimits ?? null);
        if (typeof json.audienciaPagada === 'boolean') {
          setAudienciaPagada(json.audienciaPagada);
        }
      }
    } catch {
      /* opcional */
    }
  }, []);

  useEffect(() => {
    if (sessionId) void refreshCopilotLimits(sessionId);
  }, [sessionId, refreshCopilotLimits]);

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
        const json = await safeResJson<{
          ok: boolean;
          session?: AudienciaSessionData;
          myAccess?: ResourceAccessLevel;
          error?: string;
        }>(res);
        if (!json.ok || !json.session) throw new Error(json.error || 'No se pudo cargar la sesión');
        setMyAccess(json.myAccess ?? (json.session.userId === user.uid ? 'owner' : 'view'));

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
            tokenUsage?: AiTokenUsageMeta;
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
            tokenUsage: analyzeJson.tokenUsage ?? json.session.tokenUsage,
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
    if (!sessionId || !canEditSession) return;
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
          preguntasATodos,
          alegatoGlobal,
          alegatoGlobalMeta,
          contextoAdicionalAbogado,
          tokenUsage,
        }),
      });
      const json = await safeResJson<{ ok: boolean; error?: string }>(res);
      if (!json.ok) throw new Error(json.error || 'Error al guardar');
      setSaveStatus('saved');
      void fetchSessions();
    } catch {
      setSaveStatus('error');
    }
  }, [sessionId, canEditSession, testigos, testigoActivoId, analysisByTestigoId, preguntasATodos, alegatoGlobal, alegatoGlobalMeta, contextoAdicionalAbogado, tokenUsage, fetchSessions]);

  const actualizarParteRepresentada = (parte: ParteRepresentada) => {
    setRepresentacion((prev) => ({ ...prev, parte }));
  };

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
    const mp = searchParams.get('mp');
    const returnSessionId = searchParams.get('sessionId');
    if (!mp || mpHandledRef.current) return;
    mpHandledRef.current = true;

    if (mp === 'success') {
      toast({
        title: '¡Pago acreditado!',
        description: 'Tu audiencia completa está activa. Ya podés seguir cargando preguntas.',
      });
      if (returnSessionId) {
        void loadSessionById(returnSessionId).then(() => refreshCopilotLimits(returnSessionId));
      } else {
        void refreshCopilotLimits(sessionId);
      }
      setUpgradeOpen(false);
    } else if (mp === 'pending') {
      toast({
        title: 'Pago pendiente',
        description: 'Te avisaremos cuando se acredite. Si ya pagaste, recargá en unos minutos.',
      });
    } else if (mp === 'failure') {
      toast({
        variant: 'destructive',
        title: 'Pago no completado',
        description: 'Podés intentar de nuevo cuando quieras.',
      });
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/dashboard/copiloto-audiencias');
    }
  }, [searchParams, toast, loadSessionById, refreshCopilotLimits, sessionId]);

  useEffect(() => {
    const loadStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/audiencia-copilot', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await safeResJson<{ ok: boolean } & Partial<AiStatus> & {
          trialLimits?: AudienciaCopilotLimits | null;
        }>(res);
        if (json.ok) {
          setAiStatus({
            provider: json.provider ?? 'Google Gemini',
            model: json.model ?? GEMINI_MODEL_ID,
            keyConfigured: !!json.keyConfigured,
            ready: !!json.ready,
          });
          setTrialLimits(json.trialLimits ?? null);
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
    if (!sessionId || !canEditSession) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      void saveSession();
    }, 1200);
    return () => clearTimeout(timer);
  }, [sessionId, canEditSession, testigos, testigoActivoId, analysisByTestigoId, preguntasATodos, alegatoGlobal, alegatoGlobalMeta, contextoAdicionalAbogado, tokenUsage, saveSession]);

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
        tokenUsage?: AiTokenUsageMeta;
        error?: string;
        code?: string;
      }>(extractRes);

      if (!extractJson.ok || !extractJson.sessionId) {
        if (extractJson.code === 'SCANNED_PDF' || extractJson.code === 'EMPTY_PDF') {
          mostrarErrorPdfEscaneado(extractJson.error, extractJson.code);
          return;
        }
        throw new Error(extractJson.error || `Error al leer PDF (${extractRes.status})`);
      }

      if (extractJson.tokenUsage) aplicarTokenUsage(extractJson.tokenUsage);

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
        testigosTruncados?: number;
        tokenUsage?: AiTokenUsageMeta;
        error?: string;
      }>(analyzeRes);

      if (!analyzeJson.ok || !analyzeJson.analysis || !analyzeJson.sessionId) {
        throw new Error(analyzeJson.error || `Error al analizar (${analyzeRes.status})`);
      }

      if (analyzeJson.tokenUsage) aplicarTokenUsage(analyzeJson.tokenUsage);

      startLoadTimer(file.name, 2, LOAD_STEPS[2].label);

      skipSaveRef.current = true;
      setSessionId(analyzeJson.sessionId);
      setMyAccess('owner');
      setExpedienteAnalysis(analyzeJson.analysis);
      setTestigos(normalizeTestigos(analyzeJson.testigos ?? []));
      setTestigoActivoId(analyzeJson.testigoActivoId ?? null);
      setAnalysisByTestigoId({});
      setPreguntasATodos([]);
      setRepresentacion({ ...EMPTY_REPRESENTACION });
      setRepresentacionGuardada({ ...EMPTY_REPRESENTACION });
      setAlegatoGlobal('');
      setAlegatoGlobalMeta(undefined);
      setDocumentosAdicionales([]);
      setInstruccionesAlegato('');
      setAnalysis(EMPTY_ANALYSIS);
      localStorage.setItem(LAST_SESSION_KEY, analyzeJson.sessionId);
      setSaveStatus('saved');
      void fetchSessions();

      const count = analyzeJson.testigos?.length ?? 0;
      if (analyzeJson.testigosTruncados && analyzeJson.testigosTruncados > 0) {
        toast({
          title: 'Prueba gratuita',
          description: `Se importaron ${count} declarantes (máx. ${trialLimits?.maxTestigos ?? 10} en prueba). El expediente detectó más testigos.`,
        });
      }
      toast({
        title: 'Expediente listo',
        description: `${analyzeJson.titulo ?? 'Audiencia'} — ${count} declarante(s) en ${loadElapsedRef.current || 'unos'} segundos.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar el PDF';
      if (/prueba|límite|limite|alcanzaste/i.test(msg)) {
        abrirUpsell('nueva_audiencia');
      }
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      stopLoadTimer();
      setIsLoading(false);
    }
  };

  const agregarTestigo = () => {
    if (!nuevoNombre.trim()) return;
    if (alcanzoLimiteTestigos) {
      abrirUpsell('testigos');
      return;
    }
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
    setAnalysis(normalizeAudienciaAnalysis(analysisByTestigoId[id] ?? EMPTY_ANALYSIS));
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
                    {(analysisByTestigoId[t.id]?.repreguntas?.length ?? 0) > 0
                      ? ` · ${analysisByTestigoId[t.id].repreguntas.length} sugerida(s)`
                      : ''}
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
              <label className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
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
                <SelectTrigger className="h-7 max-w-[9rem] border-0 bg-transparent text-[10px] shadow-none sm:max-w-none">
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

  const validarAntesDeAnalizar = useCallback((): boolean => {
    if (!expedienteAnalysis) return false;
    if (!representacion.parte) {
      toast({
        title: 'Falta indicar representación',
        description: esPenal
          ? 'En el paso 1, elegí si representás a la defensa o a la fiscalía.'
          : 'En el paso 1, elegí si representás al actor o al demandado.',
        variant: 'destructive',
      });
      return false;
    }
    if (representacionDirty) {
      toast({
        title: 'Guardá la representación',
        description:
          'Usá «Sincronizar y reanalizar» en el paso 1 o guardá antes de analizar.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [expedienteAnalysis, esPenal, representacion.parte, representacionDirty, toast]);

  const ejecutarAnalisisTestigo = useCallback(
    async (testigo: Testigo) => {
      if (!validarAntesDeAnalizar()) return;

      const gen = (analysisGenRef.current[testigo.id] ?? 0) + 1;
      analysisGenRef.current[testigo.id] = gen;
      setAnalyzingTestigoId(testigo.id);

      try {
        const { analysis: analysisResult, todos } = await fetchAnalisisParaTestigo(
          testigo,
          representacionContexto
        );
        if (analysisGenRef.current[testigo.id] !== gen) return;

        setPreguntasATodos((prev) => mergePreguntasATodos(prev, todos));
        setAnalysisByTestigoId((prev) => ({ ...prev, [testigo.id]: analysisResult }));
        if (testigoActivoId === testigo.id) {
          setAnalysis(analysisResult);
        }
      } catch (err) {
        if (analysisGenRef.current[testigo.id] !== gen) return;
        const msg = err instanceof Error ? err.message : 'No se pudo analizar';
        if (/prueba|límite|limite|fase/i.test(msg)) {
          abrirUpsell('general');
        }
        toast({
          title: msg.includes('prueba') ? 'Límite de prueba' : 'Error de IA',
          description: msg,
          variant: 'destructive',
        });
      } finally {
        if (analysisGenRef.current[testigo.id] === gen) {
          setAnalyzingTestigoId((prev) => (prev === testigo.id ? null : prev));
        }
      }
    },
    [
      validarAntesDeAnalizar,
      representacionContexto,
      fetchAnalisisParaTestigo,
      testigoActivoId,
      toast,
    ]
  );

  const programarAnalisisTestigo = useCallback(
    (testigoId: string, delayMs = 1200) => {
      const existing = analysisTimersRef.current[testigoId];
      if (existing) clearTimeout(existing);
      analysisTimersRef.current[testigoId] = setTimeout(() => {
        delete analysisTimersRef.current[testigoId];
        const testigo = testigosRef.current.find((t) => t.id === testigoId);
        if (testigo) void ejecutarAnalisisTestigo(testigo);
      }, delayMs);
    },
    [ejecutarAnalisisTestigo]
  );

  const analizarTestigo = useCallback(
    (testigo: Testigo, inmediato = true) => {
      if (!validarAntesDeAnalizar()) return;
      if (inmediato) {
        const pending = analysisTimersRef.current[testigo.id];
        if (pending) {
          clearTimeout(pending);
          delete analysisTimersRef.current[testigo.id];
        }
        void ejecutarAnalisisTestigo(testigo);
      } else {
        programarAnalisisTestigo(testigo.id);
      }
    },
    [validarAntesDeAnalizar, ejecutarAnalisisTestigo, programarAnalisisTestigo]
  );

  useEffect(
    () => () => {
      Object.values(analysisTimersRef.current).forEach(clearTimeout);
    },
    []
  );

  const agregarIntercambio = () => {
    if (!testigoActivo || !nuevaPregunta.trim() || !nuevaRespuesta.trim()) return;
    if (alcanzoLimiteIntercambiosTotal) {
      abrirUpsell('intercambios_total');
      return;
    }
    if (alcanzoLimiteIntercambiosTestigo) {
      abrirUpsell('intercambios_testigo');
      return;
    }

    const intercambio: AudienciaIntercambio = {
      id: crypto.randomUUID(),
      pregunta: nuevaPregunta.trim(),
      respuesta: nuevaRespuesta.trim(),
    };

    setTestigos((prev) =>
      prev.map((t) =>
        t.id === testigoActivo.id
          ? { ...t, intercambios: [...t.intercambios, intercambio] }
          : t
      )
    );
    setNuevaPregunta('');
    setNuevaRespuesta('');
    programarAnalisisTestigo(testigoActivo.id);
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
        tokenUsage?: AiTokenUsageMeta;
        error?: string;
      }>(res);
      if (!json.ok || !json.alegatoGlobal) {
        throw new Error(json.error || 'No se pudieron generar los alegatos');
      }
      if (json.tokenUsage) aplicarTokenUsage(json.tokenUsage);
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
    aplicarTokenUsage,
  ]);

  const subirDocumentoAdicional = useCallback(
    async (file: File) => {
      if (!sessionId) return;
      const user = auth.currentUser;
      if (!user) return;

      setSubiendoDocumento(true);
      try {
        const token = await user.getIdToken();
        const form = new FormData();
        form.append('file', file);
        if (descripcionDocumento.trim()) {
          form.append('descripcion', descripcionDocumento.trim());
        }

        const res = await fetch(
          `/api/admin/audiencia-copilot/sessions/${sessionId}/documentos-adicionales`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          }
        );
        const json = await safeResJson<{
          ok: boolean;
          documento?: DocumentoAdicionalAudiencia;
          documentosAdicionales?: DocumentoAdicionalAudiencia[];
          tokenUsage?: AiTokenUsageMeta;
          error?: string;
          code?: string;
        }>(res);

        if (!json.ok || !json.documentosAdicionales) {
          if (json.code === 'SCANNED_PDF' || json.code === 'EMPTY_PDF') {
            mostrarErrorPdfEscaneado(json.error, json.code);
            return;
          }
          throw new Error(json.error || 'No se pudo cargar el documento');
        }

        if (json.tokenUsage) aplicarTokenUsage(json.tokenUsage);
        setDocumentosAdicionales(json.documentosAdicionales);
        setDescripcionDocumento('');
        toast({
          title: 'Documento agregado',
          description: `${file.name} quedará disponible para los alegatos.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error';
        if (/prueba|límite|limite|fase/i.test(msg)) {
          abrirUpsell('documentos');
        }
        toast({
          title: 'Error al subir documento',
          description: msg,
          variant: 'destructive',
        });
      } finally {
        setSubiendoDocumento(false);
      }
    },
    [sessionId, descripcionDocumento, toast, aplicarTokenUsage, mostrarErrorPdfEscaneado]
  );

  const eliminarDocumentoAdicional = useCallback(
    async (docId: string) => {
      if (!sessionId) return;
      const user = auth.currentUser;
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/admin/audiencia-copilot/sessions/${sessionId}/documentos-adicionales/${docId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const json = await safeResJson<{
          ok: boolean;
          documentosAdicionales?: DocumentoAdicionalAudiencia[];
          error?: string;
        }>(res);
        if (!json.ok || !json.documentosAdicionales) {
          throw new Error(json.error || 'No se pudo eliminar');
        }
        setDocumentosAdicionales(json.documentosAdicionales);
        toast({ title: 'Documento eliminado' });
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'No se pudo eliminar',
          variant: 'destructive',
        });
      }
    },
    [sessionId, toast]
  );

  const refinarAlegatosGlobales = useCallback(async () => {
    if (!sessionId || !alegatoGlobal.trim()) return;
    if (!instruccionesAlegato.trim()) {
      toast({
        title: 'Escribí una instrucción',
        description:
          'Indicá qué querés mejorar: más énfasis en un tema, acortar, cambiar el tono, etc.',
        variant: 'destructive',
      });
      return;
    }
    if (representacionDirty) {
      toast({
        title: 'Guardá la representación',
        description: 'Guardá la representación en el paso 1 antes de refinar alegatos.',
        variant: 'destructive',
      });
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setRefinandoAlegato(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/admin/audiencia-copilot/sessions/${sessionId}/alegatos-globales/refinar`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instrucciones: instruccionesAlegato.trim(),
            alegatoActual: alegatoGlobal.trim(),
          }),
        }
      );
      const json = await safeResJson<{
        ok: boolean;
        alegatoGlobal?: string;
        alegatoGlobalMeta?: AudienciaSessionData['alegatoGlobalMeta'];
        tokenUsage?: AiTokenUsageMeta;
        error?: string;
      }>(res);
      if (!json.ok || !json.alegatoGlobal) {
        throw new Error(json.error || 'No se pudo refinar el alegato');
      }
      if (json.tokenUsage) aplicarTokenUsage(json.tokenUsage);
      setAlegatoGlobal(json.alegatoGlobal);
      setAlegatoGlobalMeta(json.alegatoGlobalMeta);
      setInstruccionesAlegato('');
      toast({
        title: 'Alegato actualizado',
        description: 'La IA aplicó tus instrucciones al borrador.',
      });
    } catch (err) {
      toast({
        title: 'Error al refinar',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      });
    } finally {
      setRefinandoAlegato(false);
    }
  }, [
    sessionId,
    alegatoGlobal,
    instruccionesAlegato,
    representacionDirty,
    toast,
    aplicarTokenUsage,
  ]);

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {trialLimits && !audienciaPagada && (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Fase de prueba — 1 audiencia gratuita</p>
          <p className="mt-1 text-xs opacity-90">
            Hasta {trialLimits.maxTestigos} declarantes · {trialLimits.maxIntercambiosTotal}{' '}
            preguntas en total · {trialLimits.maxIntercambiosPerTestigo} por declarante ·{' '}
            {trialLimits.maxDocumentosAdicionales} documento(s) extra. Estamos evaluando la
            herramienta con casos reales: nos sirve tu devolución, mejoras o detección de errores.
          </p>
          <p className="mt-2 text-xs opacity-90">
            <strong>Consejo:</strong> anotá solo las preguntas y respuestas relevantes (admisiones,
            contradicciones, hechos clave). No hace falta transcribir toda la audiencia: así la IA
            rinde mejor y aprovechás mejor los límites de la prueba.
          </p>
          {sessionId && (
            <p className="mt-2 text-xs tabular-nums">
              Uso: {testigos.length}/{trialLimits.maxTestigos} declarantes · {intercambiosTotales}/
              {trialLimits.maxIntercambiosTotal} P/R
            </p>
          )}
        </div>
      )}
      {audienciaPagada && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-semibold text-primary">Audiencia completa contratada</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sin límites de la prueba gratuita en esta audiencia.
          </p>
        </div>
      )}
      {trialLimits && !audienciaPagada && alcanzoLimitePruebaSesion && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-semibold text-destructive">Límite de la fase de prueba alcanzado</p>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {alcanzoLimiteIntercambiosTotal
              ? `Llegaste a las ${trialLimits.maxIntercambiosTotal} preguntas incluidas en la prueba.`
              : alcanzoLimiteTestigos
                ? `Llegaste al máximo de ${trialLimits.maxTestigos} declarantes en la prueba.`
                : `Llegaste al máximo de ${trialLimits.maxDocumentosAdicionales} documento(s) extra en la prueba.`}{' '}
            Podés seguir viendo lo cargado. Para seguir agregando o enviarnos sugerencias, escribinos.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() =>
              abrirUpsell(
                alcanzoLimiteIntercambiosTotal
                  ? 'intercambios_total'
                  : alcanzoLimiteTestigos
                    ? 'testigos'
                    : 'documentos'
              )
            }
          >
            Escribinos
          </Button>
        </div>
      )}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Gavel className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
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
                {aiStatus.ready && (
                  <Badge
                    variant="outline"
                    className="gap-1"
                    title={
                      tokenUsage.totalTokens > 0
                        ? `Entrada: ${tokenUsage.inputTokens.toLocaleString('es-AR')} · Salida: ${tokenUsage.outputTokens.toLocaleString('es-AR')}${
                            tokenUsage.lastUpdatedAt
                              ? ` · Actualizado: ${new Date(tokenUsage.lastUpdatedAt).toLocaleString('es-AR')}`
                              : ''
                          }`
                        : 'Se actualiza al usar la IA (cargar PDF, analizar, alegatos...)'
                    }
                  >
                    <Coins className="h-3 w-3" />
                    {formatTokenCount(tokenUsage.totalTokens)} tokens
                  </Badge>
                )}
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
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {sessions.length > 0 && (
              <div className="min-w-0 w-full flex-1 space-y-1 sm:min-w-[200px]">
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
                        {s.myAccess && s.myAccess !== 'owner'
                          ? ` · compartido (${s.myAccess === 'edit' ? 'editar' : 'ver'})`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sessionId && isOwnerSession && (
              <Button
                type="button"
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Compartir
              </Button>
            )}
            {sessionId && !canEditSession && (
              <Badge variant="secondary" className="h-9 px-3 font-normal">
                Solo lectura
              </Badge>
            )}
            <Button
              type="button"
              variant="default"
              disabled={isLoading}
              onClick={handleNuevaAudiencia}
              className="w-full shrink-0 sm:w-auto"
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
            Subí el PDF exportado desde LegalMev (con texto seleccionable, no escaneos). La IA
            analiza el contenido y entiende de qué va el caso.
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
            onClick={() => ensureConsent(() => fileInputRef.current?.click())}
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
                <p className="text-[11px] text-muted-foreground">
                  Si reformulás el objetivo, partido o cliente, sincronizá para actualizar el mapa
                  del caso (resumen, objeto, puntos clave) y las sugerencias de IA.
                </p>
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
                <div className="flex flex-wrap items-center gap-2">
                  {representacionDirty && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      Cambios sin guardar
                    </span>
                  )}
                  {representacionDirty && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={guardandoRepresentacion || !representacion.parte}
                      onClick={() => void guardarRepresentacion()}
                    >
                      {guardandoRepresentacion ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Guardar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={representacionDirty ? 'default' : 'secondary'}
                    disabled={
                      reanalizandoCaso ||
                      isLoading ||
                      !representacion.parte ||
                      !puedeReanalizarCaso
                    }
                    onClick={() => void sincronizarYReanalizarCaso()}
                    title={
                      !puedeReanalizarCaso
                        ? 'Elegí la parte que representás'
                        : representacionDirty
                          ? 'Guarda y reanaliza mapa del caso y sugerencias'
                          : 'Reanaliza mapa del caso y sugerencias con el objetivo actual'
                    }
                  >
                    {reanalizandoCaso ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sincronizar y reanalizar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {expedienteAnalysis && (
            <div
              className={cn(
                'rounded-lg border bg-muted/30 p-4 space-y-3 text-sm relative',
                reanalizandoCaso && 'opacity-60 pointer-events-none'
              )}
            >
              {reanalizandoCaso && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reencuadrando el caso y armando preguntas sugeridas...
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{expedienteAnalysis.caratula || 'Expediente analizado'}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {tipoFueroLabel(expedienteAnalysis.tipoFuero ?? 'civil')}
                </Badge>
              </div>
              {expedienteAnalysis.ejeEstrategico && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="text-xs font-semibold text-primary">EJE ESTRATÉGICO</span>
                  <p className="mt-1 text-sm">{expedienteAnalysis.ejeEstrategico}</p>
                </div>
              )}
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

          {expedienteAnalysis && (
            <div className="rounded-lg border border-dashed border-primary/40 bg-background p-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="contexto-adicional-caso" className="text-sm font-semibold">
                  Agregar más contexto
                </Label>
                <p className="text-xs text-muted-foreground">
                  No hace falta cargarlos a mano. Pegá la lista de testigos (quién es cada uno y de
                  qué va). La IA no relee el expediente: usa el eje estratégico, suma declarantes y
                  arma preguntas de ese eje, incluidas algunas poco obvias.
                </p>
              </div>
              <Textarea
                id="contexto-adicional-caso"
                value={contextoAdicionalAbogado}
                onChange={(e) => setContextoAdicionalAbogado(e.target.value)}
                disabled={!canEditSession || reanalizandoCaso}
                placeholder={
                  'Ejemplo:\n1) Juan Pérez — vecino. Vio quién estaba el día del hecho.\n2) María Gómez — empleada de la actora. Puede confirmar horarios.\n3) …'
                }
                className="min-h-[120px] resize-y text-sm"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Indicá primero a quién representás (así hay eje estratégico). Una sola lectura de
                  tu lista: no vuelve a procesar el PDF.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    reanalizandoCaso ||
                    isLoading ||
                    !canEditSession ||
                    !representacion.parte ||
                    !contextoAdicionalAbogado.trim()
                  }
                  onClick={() => void sincronizarYReanalizarCaso({ generarPreguntasIniciales: true })}
                >
                  {reanalizandoCaso ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Actualizar con este contexto
                </Button>
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
                <CardDescription>
                  Detectados en el expediente. Preferí completarlos con «Agregar más contexto» en el
                  paso 1; el alta manual es solo para un nombre suelto.
                </CardDescription>
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="Nombre"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      className="min-w-0"
                    />
                    <Input
                      placeholder="Rol"
                      value={nuevoRol}
                      onChange={(e) => setNuevoRol(e.target.value)}
                      className="min-w-0 sm:max-w-[140px]"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="shrink-0 self-end sm:self-auto"
                      disabled={!alcanzoLimiteTestigos && !nuevoNombre.trim()}
                      onClick={() => {
                        if (alcanzoLimiteTestigos) {
                          abrirUpsell('testigos');
                          return;
                        }
                        agregarTestigo();
                      }}
                    >
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
                  alertas y conclusiones al instante. Priorizá intercambios importantes (hechos clave,
                  admisiones, contradicciones): no es necesario cargar cada pregunta de rutina.
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
                        disabled={!testigoActivo.contextoDeclarante?.trim()}
                        onClick={() => analizarTestigo(testigoActivo)}
                      >
                        Actualizar sugerencias con este contexto
                      </Button>
                      {representacion.parte && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={analizandoTestigoActivo}
                          onClick={() => analizarTestigo(testigoActivo)}
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
                        analysis.repreguntas.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-primary">
                              Preguntas a realizar ({analysis.repreguntas.length})
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Cargadas por la IA. Tocá una para usarla en el recuadro de pregunta.
                            </p>
                            {analysis.repreguntas.map((item, i) => (
                              <button
                                key={`${item.texto}-${i}`}
                                type="button"
                                className="block w-full rounded-md border bg-background px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                                onClick={() => setNuevaPregunta(item.texto)}
                              >
                                {i + 1}. {item.texto}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Sin preguntas cargadas aún. Actualizá con contexto extra en el paso 1.
                          </p>
                        )
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
                      disabled={!nuevaPregunta.trim() || !nuevaRespuesta.trim()}
                      onClick={agregarIntercambio}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar pregunta y respuesta
                      {analizandoTestigoActivo && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-70" />
                      )}
                    </Button>
                    {alcanzoLimiteIntercambiosTestigo && !alcanzoLimiteIntercambiosTotal && (
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Límite de preguntas para este declarante ({trialLimits?.maxIntercambiosPerTestigo}).
                        {' '}
                        <button
                          type="button"
                          className="underline font-medium"
                          onClick={() => abrirUpsell('intercambios_testigo')}
                        >
                          Escribinos
                        </button>
                      </p>
                    )}
                    {analizandoTestigoActivo && (
                      <p className="text-xs text-muted-foreground">
                        La IA está actualizando sugerencias en segundo plano. Podés seguir cargando
                        más intercambios.
                      </p>
                    )}

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
                  {analizandoTestigoActivo && (
                    <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analizando...
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Preguntas sugeridas y alertas del declarante activo. Se arman al actualizar con
                  contexto extra o al anotar preguntas en audiencia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-semibold mb-2 text-primary">Preguntas sugeridas ahora</p>
                  {!testigoActivo && preguntasATodos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Seleccioná un declarante para gestionar preguntas al testigo.
                    </p>
                  ) : (
                    <EditableRepreguntasList
                      items={repreguntasVisibles}
                      onChange={(items) => {
                        const { testigo, todos } = splitRepreguntas(items);
                        setPreguntasATodos(todos);
                        if (testigoActivoId) {
                          patchAnalysis({ repreguntas: testigo });
                        }
                      }}
                      itemClassName="border-primary/30 bg-primary/5"
                      addPlaceholder="Agregar pregunta manual..."
                      emptyMessage="Sin preguntas aún. Actualizá con contexto extra en el paso 1 para que la IA las cargue, o agregá una acá."
                    />
                  )}
                  {preguntasATodos.length > 0 && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Las preguntas «A todos» se muestran con cualquier declarante.
                    </p>
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

              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Documentos adicionales (opcional)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF con texto seleccionable o .txt / .md: pericias, escritos, notas de
                    estrategia, etc. La IA los usa al armar y refinar el alegato. No escaneos.
                  </p>
                </div>

                <input
                  ref={docAdicionalInputRef}
                  type="file"
                  accept=".pdf,application/pdf,.txt,.md,.csv,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void subirDocumentoAdicional(file);
                    e.target.value = '';
                  }}
                />

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    value={descripcionDocumento}
                    onChange={(e) => setDescripcionDocumento(e.target.value)}
                    placeholder="Etiqueta opcional (ej. Pericia topográfica, Escrito de clausura...)"
                    className="text-sm bg-background"
                    disabled={subiendoDocumento}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={subiendoDocumento || !sessionId}
                    onClick={() => {
                      if (alcanzoLimiteDocumentos) {
                        abrirUpsell('documentos');
                        return;
                      }
                      ensureConsent(() => docAdicionalInputRef.current?.click());
                    }}
                  >
                    {subiendoDocumento ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Paperclip className="mr-2 h-4 w-4" />
                    )}
                    Adjuntar archivo
                  </Button>
                </div>

                {documentosAdicionales.length > 0 ? (
                  <ul className="space-y-2">
                    {documentosAdicionales.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-start justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {doc.descripcion.trim() || doc.fileName}
                          </p>
                          {doc.descripcion.trim() ? (
                            <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {Math.round(doc.textoLength / 1000)}k caracteres ·{' '}
                            {new Date(doc.uploadedAt).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={subiendoDocumento}
                          onClick={() => void eliminarDocumentoAdicional(doc.id)}
                          title="Quitar documento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin documentos extra. Podés armar alegatos igual; esto es opcional.
                  </p>
                )}
              </div>

              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={
                  generandoAlegatos ||
                  analyzingTestigoId !== null ||
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Alegato de cierre (editable)</Label>
                    <Textarea
                      value={alegatoGlobal}
                      onChange={(e) => setAlegatoGlobal(e.target.value)}
                      className="min-h-[280px] resize-y text-sm leading-relaxed"
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                      {alegatoGlobalMeta?.generadoAt && (
                        <span>
                          Generado:{' '}
                          {new Date(alegatoGlobalMeta.generadoAt).toLocaleString('es-AR')}
                        </span>
                      )}
                      {alegatoGlobalMeta?.refinadoAt && (
                        <span>
                          Última mejora:{' '}
                          {new Date(alegatoGlobalMeta.refinadoAt).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="instrucciones-alegato" className="text-sm font-semibold">
                        Instrucciones para mejorar el alegato
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Pedile a la IA que ajuste el borrador: más énfasis en un testigo o pericia,
                        acortar, profundizar la refutación, suavizar el tono, etc. Se usa el texto
                        actual del cuadro (incluidas tus ediciones manuales).
                      </p>
                    </div>
                    <Textarea
                      id="instrucciones-alegato"
                      value={instruccionesAlegato}
                      onChange={(e) => setInstruccionesAlegato(e.target.value)}
                      placeholder="Ej: Hacé más incapié en la pericia topográfica y en las admisiones del testigo Janin. Acortá la introducción."
                      className="min-h-[88px] resize-y text-sm bg-background"
                      disabled={refinandoAlegato}
                    />
                    {alegatoGlobalMeta?.ultimasInstrucciones && !instruccionesAlegato && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Última instrucción aplicada: «{alegatoGlobalMeta.ultimasInstrucciones}»
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      disabled={
                        refinandoAlegato ||
                        generandoAlegatos ||
                        !instruccionesAlegato.trim() ||
                        representacionDirty
                      }
                      onClick={() => void refinarAlegatosGlobales()}
                    >
                      {refinandoAlegato ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Mejorar con IA
                    </Button>
                  </div>
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

      <AlertDialog open={pdfEscaneadoOpen} onOpenChange={setPdfEscaneadoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-destructive" />
              PDF no compatible
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>{pdfEscaneadoMensaje}</p>
                <p>
                  <strong className="text-foreground">Qué usar:</strong> el PDF que exportás desde
                  LegalMev o el sistema judicial (texto seleccionable con el mouse).
                </p>
                <p>
                  <strong className="text-foreground">Qué no sirve:</strong> fotocopias escaneadas,
                  fotos del expediente o PDFs que son solo imagen.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AudienciaCopilotUpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        reason={upgradeReason}
        limits={trialLimits}
      />

      {sessionId && isOwnerSession && (
        <ShareResourceDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          shareApiPath={`/api/admin/audiencia-copilot/sessions/${sessionId}/share`}
          resourceTitle={
            sessions.find((s) => s.id === sessionId)?.titulo ||
            expedienteAnalysis?.caratula ||
            'Audiencia'
          }
          resourceKindLabel="copiloto de audiencias"
        />
      )}

      {consentDialog}
    </div>
  );
}
