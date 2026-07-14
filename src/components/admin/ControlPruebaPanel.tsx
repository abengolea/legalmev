'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { cn, safeResJson } from '@/lib/utils';
import { ControlPruebaItemsTable } from '@/components/admin/ControlPruebaItemsTable';
import { ControlPruebaImportPreviewDialog } from '@/components/admin/ControlPruebaImportPreviewDialog';
import { downloadBlob, exportControlPruebaExcel, exportControlPruebaJson, exportControlPruebaPdf, exportControlPruebaRevisionText, exportFilename } from '@/lib/control-prueba-export';
import { patchItemConHistorial } from '@/lib/control-prueba-item-utils';
import { progresoExpedienteHeader } from '@/lib/control-prueba-metricas';
import { ensureSubtareas } from '@/lib/control-prueba-subtareas';
import { ensurePericialMeta } from '@/lib/control-prueba-pericial';
import {
  ensureDocumentalEnPoderMeta,
  syncFechaLimiteDocumentalEnPoder,
} from '@/lib/control-prueba-documental-poder';
import { ensureDocumentalMeta } from '@/lib/control-prueba-documental-autenticidad';
import {
  collectOficiosAutenticidadFromItems,
  consolidarAutenticidadDocumentalExpediente,
  itemsVisiblesControlExpediente,
} from '@/lib/control-prueba-documental-autenticidad-consolidate';
import {
  crearCedulaManualVinculada,
  crearCedulaReintentoVinculada,
  crearEventoAudienciaManual,
  crearMandamientoConduccionTestigo,
  crearOficioAutenticidadManual,
  evaluarSubProcesosAutomaticos,
  hydrateAutenticidadDocumentalVinculos,
  marcarHijosSinEfectoPorPadreEliminado,
} from '@/lib/control-prueba-subprocesos';
import { migrateExpedienteInformativaAOficio } from '@/lib/control-prueba-informativa-migrate';
import { migrateModeloAudienciaPrueba } from '@/lib/control-prueba-audiencia-migrate';
import {
  crearOficioAclaracion,
  crearOficioReiteracion,
  evaluarOficioAclaracionAutomatico,
  evaluarOficioReiteracionAutomatico,
} from '@/lib/control-prueba-oficio';
import { crearMovimientoPericial, estadoAgregadoPruebaChip, itemVisibleConFiltroEstado } from '@/lib/control-prueba-pericial-movimientos';
import { patchEstadoPruebaOfrecida, esCierrePrueba } from '@/lib/control-prueba-cierre';
import type { TipoTramitePericial } from '@/types/control-prueba';
import {
  CATEGORIA_CONFIG,
  countByEstado,
  defaultEstadoForItem,
  defaultTipoForCategoria,
  ESTADO_CONFIG,
  GRUPOS_PRUEBA,
  inferCategoriaFromTipo,
  itemsOfrecidasProduccion,
  pasaFiltroEstadoProduccion,
  resolveCategoria,
  sistemaLabel,
  usaEstadosProduccionPrueba,
  TIPO_LABELS,
  extractMetadataFromExpedienteText,
  extractMetadataFromFilename,
  mergeMetadataLocal,
  truncateTextoForAnalysis,
  sanitizeForFirestore,
} from '@/lib/control-prueba';
import {
  FILTRO_TIPO_GRUPO_LABELS,
  itemPasaFiltroTipo,
  opcionesFiltroTipoExpediente,
} from '@/lib/control-prueba-filtros';
import { resumenParaParteRepresentada } from '@/lib/control-prueba-resumen';
import {
  TERCERO_SIN_IDENTIFICAR,
  agruparItemsPorTercero,
  listaTercerosExpediente,
  ordenGruposTercero,
} from '@/lib/control-prueba-terceros';
import { extractTextFromPdfFile, PdfExtractError } from '@/lib/pdf-text-extract-client';
import type {
  ControlPruebaExpediente,
  ControlPruebaItem,
  ExpedienteHito,
  ItemCategoria,
  OficioAutenticidadPendiente,
  PruebaEstado,
  PruebaParte,
  ResumenEjecutivoImport,
  ParteRepresentadaPrueba,
} from '@/types/control-prueba';
import { PRUEBA_ESTADOS as ESTADOS } from '@/types/control-prueba';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Check,
  ChevronDown,
  CloudOff,
  Download,
  ExternalLink,
  FileDown,
  FileJson,
  FileSearch,
  FileSpreadsheet,
  FileUp,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Search,
  Sparkles,
  Trash2,
  Calendar,
  Gavel,
  Mail,
} from 'lucide-react';

const CONTROL_PRUEBA_PATH = '/dashboard/control-prueba';

function expedienteDeepLink(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${CONTROL_PRUEBA_PATH}?id=${encodeURIComponent(id)}`;
}

const EMPTY_FORM = {
  caratula: '',
  numeroExpediente: '',
  juzgado: '',
  fuero: '',
  expedienteUrl: '',
  notas: '',
};

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

function persistSnapshotFrom(
  header: Partial<ControlPruebaExpediente>,
  items: ControlPruebaItem[],
  hitos: ExpedienteHito[],
  oficios: OficioAutenticidadPendiente[] = [],
  resumen?: ResumenEjecutivoImport,
): string {
  return JSON.stringify({
    caratula: header.caratula ?? '',
    numeroExpediente: header.numeroExpediente ?? '',
    juzgado: header.juzgado ?? '',
    fuero: header.fuero ?? '',
    expedienteUrl: header.expedienteUrl ?? '',
    notas: header.notas ?? '',
    parteRepresentada: header.parteRepresentada ?? '',
    actor: header.actor ?? '',
    demandado: header.demandado ?? '',
    terceros: header.terceros ?? [],
    items,
    hitos,
    oficiosAutenticidadPendientes: oficios,
    resumenEjecutivo: resumen ?? null,
  });
}

function syncDraftFromExpediente(exp: ControlPruebaExpediente) {
  const header = {
    caratula: exp.caratula,
    numeroExpediente: exp.numeroExpediente,
    juzgado: exp.juzgado,
    fuero: exp.fuero,
    expedienteUrl: exp.expedienteUrl,
    notas: exp.notas,
    parteRepresentada: exp.parteRepresentada ?? '',
    actor: exp.actor ?? '',
    demandado: exp.demandado ?? '',
    terceros: exp.terceros ?? [],
  };
  const { items } = consolidarAutenticidadDocumentalExpediente(
    migrateModeloAudienciaPrueba(
      migrateExpedienteInformativaAOficio(
        hydrateAutenticidadDocumentalVinculos(exp.items.map((item) => ({ ...item }))),
      ).map((item) => sanitizeForFirestore(item)),
    ).map((item) => sanitizeForFirestore(item)),
    exp.oficiosAutenticidadPendientes ?? [],
  );
  const oficios = collectOficiosAutenticidadFromItems(items);
  return {
    header,
    items,
    hitos: exp.hitos ?? [],
    oficios,
    resumen: exp.resumenEjecutivo,
    snapshot: persistSnapshotFrom(header, items, exp.hitos ?? [], oficios, exp.resumenEjecutivo),
  };
}

type ParteTabId = 'actor' | 'demandado' | 'otros' | 'mejor_proveer';

function parteTabDeItem(ofrecidaPor?: PruebaParte): ParteTabId {
  if (ofrecidaPor === 'demandado') return 'demandado';
  if (ofrecidaPor === 'tercero' || ofrecidaPor === 'tribunal') return 'otros';
  return 'actor';
}

function tabDeItem(item: ControlPruebaItem): ParteTabId {
  if (resolveCategoria(item) === 'mejor_proveer') return 'mejor_proveer';
  return parteTabDeItem(item.ofrecidaPor as PruebaParte | undefined);
}

function newItem(
  orden: number,
  opts: { categoria?: ItemCategoria; parte?: PruebaParte; terceroNombre?: string | null } = {},
): ControlPruebaItem {
  const categoria = opts.categoria ?? 'prueba';
  const parte =
    opts.parte ??
    (categoria === 'mejor_proveer'
      ? 'actor'
      : categoria === 'prueba' || categoria === 'audiencia'
        ? 'actor'
        : 'tribunal');
  const tipo = defaultTipoForCategoria(categoria);
  return ensureSubtareas({
    id: crypto.randomUUID(),
    orden,
    categoria,
    tipo,
    descripcion: '',
    ofrecidaPor: parte,
    terceroNombre: parte === 'tercero' ? opts.terceroNombre?.trim() || null : null,
    estado: defaultEstadoForItem(categoria, tipo),
    fechaLimite: null,
    fechaProduccion: null,
    actuacionUrl: null,
    observaciones: null,
  });
}

async function adminFetch(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  const token = await user.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

async function adminFetchForm(path: string, formData: FormData) {
  const user = auth.currentUser;
  if (!user) throw new Error('No autenticado');
  const token = await user.getIdToken();
  return fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

type ImportExtractState = {
  texto: string;
  pdfFileName: string;
  numPages: number;
  textoLength: number;
  textoPreview: string;
};

function resetImportWizard() {
  return {
    importFile: null as File | null,
    importExtract: null as ImportExtractState | null,
    importCaratula: '',
    importNumeroExpediente: '',
    importFuero: '',
    importJuzgado: '',
    importExpedienteUrl: '',
    importMergeMode: 'replace' as 'append' | 'replace' | 'reconcile',
    importParteRepresentada: '' as ParteRepresentadaPrueba | '',
    importStep: '',
    extracting: false,
    analyzing: false,
  };
}

export function ControlPruebaPanel() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expedientes, setExpedientes] = useState<ControlPruebaExpediente[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<PruebaEstado | 'all'>('pendiente_produccion');
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('all');
  const [filtroParte, setFiltroParte] = useState<string>('all');
  const [busquedaItem, setBusquedaItem] = useState('');
  const [parteTab, setParteTab] = useState<ParteTabId>('actor');
  const [modoCompacto, setModoCompacto] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nuevoTerceroNombre, setNuevoTerceroNombre] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const [hitosDraft, setHitosDraft] = useState<ExpedienteHito[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [importOpen, setImportOpen] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importExtract, setImportExtract] = useState<ImportExtractState | null>(null);
  const [importCaratula, setImportCaratula] = useState('');
  const [importNumeroExpediente, setImportNumeroExpediente] = useState('');
  const [importFuero, setImportFuero] = useState('');
  const [importJuzgado, setImportJuzgado] = useState('');
  const [importMergeMode, setImportMergeMode] = useState<'append' | 'replace' | 'reconcile'>('reconcile');
  const [importParteRepresentada, setImportParteRepresentada] = useState<ParteRepresentadaPrueba | ''>('');
  const [importExpedienteUrl, setImportExpedienteUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewPayload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importStep, setImportStep] = useState('');
  const [importAnalysisError, setImportAnalysisError] = useState<string | null>(null);
  const [lastImportSummary, setLastImportSummary] = useState<{
    itemsAdded: number;
    pdfFileName: string;
    resumen?: string;
    byParte?: Record<string, number>;
    byCategoria?: Record<string, number>;
    filter?: { descartados: number; reclasificados?: number };
  } | null>(null);
  const [draftItems, setDraftItems] = useState<ControlPruebaItem[]>([]);
  const [headerDraft, setHeaderDraft] = useState<Partial<ControlPruebaExpediente>>({});
  const [resumenDraft, setResumenDraft] = useState<ResumenEjecutivoImport | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [quota, setQuota] = useState<{
    remaining: number;
    limit: number;
    used: number;
    canCreate: boolean;
    monthlyResetAt?: string | null;
  } | null>(null);
  const lastSavedSnapshotRef = useRef('');
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const selected = useMemo(
    () => expedientes.find((e) => e.id === selectedId) ?? null,
    [expedientes, selectedId],
  );

  const oficiosDraft = useMemo(() => collectOficiosAutenticidadFromItems(draftItems), [draftItems]);

  const buildPersistSnapshot = useCallback(
    () => persistSnapshotFrom(headerDraft, draftItems, hitosDraft, oficiosDraft, resumenDraft),
    [headerDraft, draftItems, hitosDraft, oficiosDraft, resumenDraft],
  );

  const isDirty = useMemo(
    () => selectedId != null && buildPersistSnapshot() !== lastSavedSnapshotRef.current,
    [selectedId, buildPersistSnapshot],
  );

  const loadExpedientes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/control-prueba');
      const json = await safeResJson<{
        ok?: boolean;
        expedientes?: ControlPruebaExpediente[];
        quota?: {
          remaining: number;
          limit: number;
          used: number;
          canCreate: boolean;
          monthlyResetAt?: string | null;
        } | null;
        error?: string;
      }>(res);
      if (json.ok && json.expedientes) {
        setExpedientes(json.expedientes);
        setQuota(json.quota ?? null);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error ?? 'No se pudo cargar' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error al cargar control de prueba' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadExpedientes();
  }, [loadExpedientes]);

  const syncExpedienteInUrl = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set('id', id);
      else params.delete('id');
      const qs = params.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      router.replace(next, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const selectExpediente = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSearch('');
      setPickerOpen(false);
      syncExpedienteInUrl(id);
    },
    [syncExpedienteInUrl],
  );

  const clearExpedienteSelection = useCallback(() => {
    setSelectedId(null);
    syncExpedienteInUrl(null);
  }, [syncExpedienteInUrl]);

  /** Abre el expediente del query ?id=… cuando la lista ya cargó. */
  useEffect(() => {
    if (loading) return;
    const urlId = searchParams.get('id')?.trim() || null;
    if (!urlId) return;
    if (selectedId === urlId) return;
    if (expedientes.some((e) => e.id === urlId)) {
      setSelectedId(urlId);
      return;
    }
    toast({
      variant: 'destructive',
      title: 'Expediente no encontrado',
      description: 'El link no corresponde a un control tuyo o fue eliminado.',
    });
    syncExpedienteInUrl(null);
  }, [loading, expedientes, searchParams, selectedId, syncExpedienteInUrl, toast]);

  const handleCopyExpedienteLink = useCallback(async () => {
    if (!selectedId) return;
    const url = expedienteDeepLink(selectedId);
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copiado',
        description: 'Pegalo para abrir este expediente directo.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'No se pudo copiar',
        description: url,
      });
    }
  }, [selectedId, toast]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pickerOpen]);

  useEffect(() => {
    if (!selectedId) {
      setDraftItems([]);
      setHeaderDraft({});
      setHitosDraft([]);
      setResumenDraft(undefined);
      setParteTab('actor');
      lastSavedSnapshotRef.current = '';
      return;
    }
    const exp = expedientes.find((e) => e.id === selectedId);
    if (!exp) return;

    const synced = syncDraftFromExpediente(exp);
    setDraftItems(synced.items);
    setHeaderDraft(synced.header);
    setHitosDraft(synced.hitos);
    setResumenDraft(synced.resumen);
    setParteTab('actor');
    lastSavedSnapshotRef.current = synced.snapshot;
    setSaveStatus('idle');
  }, [selectedId]);

  useEffect(() => {
    setEstadoFilter('pendiente_produccion');
    setFiltroTipo('all');
    setFiltroParte('all');
    setBusquedaItem('');
  }, [selectedId]);

  useEffect(() => {
    if (!highlightItemId) return;
    const el = document.getElementById(`control-item-${highlightItemId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => setHighlightItemId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightItemId]);

  const handleFocusItem = useCallback(
    (itemId: string) => {
      setEstadoFilter('all');
      setHighlightItemId(itemId);
      const item = draftItems.find((i) => i.id === itemId);
      if (item) setParteTab(tabDeItem(item));
    },
    [draftItems],
  );

  const opcionesFiltroTipo = useMemo(() => opcionesFiltroTipoExpediente(), []);
  const gruposFiltroTipo = useMemo(
    () => (['prueba', 'diligencia', 'audiencia'] as const).filter((g) => opcionesFiltroTipo.some((o) => o.grupo === g)),
    [opcionesFiltroTipo],
  );

  const baseFilteredItems = useMemo(() => {
    let list = itemsVisiblesControlExpediente(draftItems);
    const q = busquedaItem.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.descripcion.toLowerCase().includes(q) ||
          (item.observaciones ?? '').toLowerCase().includes(q) ||
          String(item.estado).includes(q),
      );
    }
    if (filtroTipo !== 'all') list = list.filter((item) => itemPasaFiltroTipo(item, filtroTipo));
    if (filtroParte !== 'all') list = list.filter((item) => (item.ofrecidaPor ?? 'actor') === filtroParte);
    if (estadoFilter !== 'all') {
      list = list.filter((item) => pasaFiltroEstadoProduccion(item, estadoFilter));
    }
    return list;
  }, [draftItems, filtroTipo, filtroParte, busquedaItem, estadoFilter]);

  const pruebaItems = useMemo(
    () => baseFilteredItems.filter((i) => resolveCategoria(i) === 'prueba'),
    [baseFilteredItems],
  );

  const itemsDiligencia = useMemo(
    () => baseFilteredItems.filter((i) => resolveCategoria(i) === 'diligencia'),
    [baseFilteredItems],
  );

  const itemsAudiencia = useMemo(
    () => baseFilteredItems.filter((i) => resolveCategoria(i) === 'audiencia'),
    [baseFilteredItems],
  );

  const itemsTerceroByCat = useMemo(
    () => ({
      prueba: pruebaItems.filter((i) => i.ofrecidaPor === 'tercero'),
      diligencia: itemsDiligencia.filter((i) => i.ofrecidaPor === 'tercero'),
      audiencia: itemsAudiencia.filter((i) => i.ofrecidaPor === 'tercero'),
    }),
    [pruebaItems, itemsDiligencia, itemsAudiencia],
  );

  const itemsTribunalByCat = useMemo(
    () => ({
      prueba: pruebaItems.filter((i) => i.ofrecidaPor === 'tribunal'),
      diligencia: itemsDiligencia.filter((i) => i.ofrecidaPor === 'tribunal'),
      audiencia: itemsAudiencia.filter((i) => i.ofrecidaPor === 'tribunal'),
    }),
    [pruebaItems, itemsDiligencia, itemsAudiencia],
  );

  const tercerosConocidos = useMemo(
    () => listaTercerosExpediente(headerDraft.terceros ?? selected?.terceros, draftItems),
    [headerDraft.terceros, selected?.terceros, draftItems],
  );

  const itemsByGrupo = useMemo(
    () => ({
      actor: pruebaItems.filter((i) => (i.ofrecidaPor ?? 'actor') === 'actor'),
      demandado: pruebaItems.filter((i) => i.ofrecidaPor === 'demandado'),
      otros: itemsTerceroByCat.prueba,
    }),
    [pruebaItems, itemsTerceroByCat.prueba],
  );

  const diligenciaByGrupo = useMemo(
    () => ({
      actor: itemsDiligencia.filter((i) => (i.ofrecidaPor ?? 'tribunal') === 'actor'),
      demandado: itemsDiligencia.filter((i) => i.ofrecidaPor === 'demandado'),
      otros: itemsTerceroByCat.diligencia,
    }),
    [itemsDiligencia, itemsTerceroByCat.diligencia],
  );

  const audienciaByGrupo = useMemo(
    () => ({
      actor: itemsAudiencia.filter((i) => (i.ofrecidaPor ?? 'actor') === 'actor'),
      demandado: itemsAudiencia.filter((i) => i.ofrecidaPor === 'demandado'),
      otros: itemsTerceroByCat.audiencia,
    }),
    [itemsAudiencia, itemsTerceroByCat.audiencia],
  );

  const itemsMejorProveer = useMemo(
    () => baseFilteredItems.filter((i) => resolveCategoria(i) === 'mejor_proveer'),
    [baseFilteredItems],
  );

  const conteoPorParteTab = useMemo(
    () => ({
      actor:
        itemsByGrupo.actor.length + diligenciaByGrupo.actor.length + audienciaByGrupo.actor.length,
      demandado:
        itemsByGrupo.demandado.length +
        diligenciaByGrupo.demandado.length +
        audienciaByGrupo.demandado.length,
      otros:
        itemsTerceroByCat.prueba.length +
        itemsTerceroByCat.diligencia.length +
        itemsTerceroByCat.audiencia.length,
      mejor_proveer: itemsMejorProveer.length,
    }),
    [itemsByGrupo, diligenciaByGrupo, audienciaByGrupo, itemsMejorProveer, itemsTerceroByCat],
  );

  const allPruebaItems = useMemo(
    () => itemsOfrecidasProduccion(draftItems),
    [draftItems],
  );

  const matchingEstadoCount = useMemo(() => {
    if (estadoFilter === 'all') return allPruebaItems.length;
    return allPruebaItems.filter((i) => itemVisibleConFiltroEstado(i, estadoFilter)).length;
  }, [allPruebaItems, estadoFilter]);

  const counts = useMemo(() => countByEstado(allPruebaItems), [allPruebaItems]);
  const progresoPct = useMemo(() => progresoExpedienteHeader(draftItems), [draftItems]);

  const parteRepresentada = (headerDraft.parteRepresentada ?? selected?.parteRepresentada ?? '') as
    | ParteRepresentadaPrueba
    | '';

  const resumenVisible = useMemo(
    () =>
      resumenParaParteRepresentada(
        draftItems,
        oficiosDraft,
        parteRepresentada,
        resumenDraft,
        headerDraft.actor ?? selected?.actor,
        headerDraft.demandado ?? selected?.demandado,
      ),
    [
      draftItems,
      oficiosDraft,
      parteRepresentada,
      resumenDraft,
      headerDraft.actor,
      headerDraft.demandado,
      selected?.actor,
      selected?.demandado,
    ],
  );

  const expedienteDraft = useMemo(
    (): ControlPruebaExpediente => ({
      id: selected?.id ?? '',
      caratula: headerDraft.caratula ?? selected?.caratula ?? '',
      numeroExpediente: headerDraft.numeroExpediente ?? selected?.numeroExpediente,
      juzgado: headerDraft.juzgado ?? selected?.juzgado,
      fuero: headerDraft.fuero ?? selected?.fuero,
      expedienteUrl: headerDraft.expedienteUrl ?? selected?.expedienteUrl ?? '',
      actor: headerDraft.actor ?? selected?.actor,
      demandado: headerDraft.demandado ?? selected?.demandado,
      parteRepresentada: headerDraft.parteRepresentada ?? selected?.parteRepresentada ?? '',
      resumenEjecutivo: resumenVisible,
      oficiosAutenticidadPendientes: [],
      items: draftItems,
      hitos: hitosDraft,
    }),
    [selected, headerDraft, draftItems, hitosDraft, oficiosDraft, resumenVisible],
  );

  const handleExport = useCallback(
    (format: 'pdf' | 'xlsx' | 'json' | 'txt') => {
      switch (format) {
        case 'json':
          downloadBlob(exportControlPruebaJson(expedienteDraft), exportFilename(expedienteDraft, 'json'));
          toast({ title: 'JSON exportado', description: 'Pegalo en el chat para revisar ítems incorrectos de la IA.' });
          break;
        case 'txt':
          downloadBlob(exportControlPruebaRevisionText(expedienteDraft), exportFilename(expedienteDraft, 'txt'));
          toast({ title: 'TXT exportado', description: 'Listado legible para marcar qué no es prueba.' });
          break;
        case 'xlsx':
          downloadBlob(exportControlPruebaExcel(expedienteDraft), exportFilename(expedienteDraft, 'xlsx'));
          break;
        case 'pdf':
          downloadBlob(exportControlPruebaPdf(expedienteDraft), exportFilename(expedienteDraft, 'pdf'));
          toast({ title: 'Informe PDF generado', description: 'Incluye resumen ejecutivo, oficios e ítems por categoría.' });
          break;
      }
    },
    [expedienteDraft, toast],
  );

  const handleCreate = async () => {
    if (!createForm.caratula.trim()) {
      toast({ variant: 'destructive', title: 'Completá la carátula' });
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/control-prueba', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      const json = await safeResJson<{ ok?: boolean; expediente?: ControlPruebaExpediente; error?: string }>(res);
      if (json.ok && json.expediente) {
        setExpedientes((prev) => [json.expediente!, ...prev]);
        selectExpediente(json.expediente.id);
        setCreateOpen(false);
        setCreateForm(EMPTY_FORM);
        toast({ title: 'Expediente creado' });
        void loadExpedientes();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error al crear' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!selected) return false;
      const snapshot = buildPersistSnapshot();
      if (snapshot === lastSavedSnapshotRef.current) return true;

      if (saveInFlightRef.current) {
        pendingSaveRef.current = true;
        return false;
      }

      saveInFlightRef.current = true;
      setSaving(true);
      setSaveStatus('saving');
      try {
        const res = await adminFetch(`/api/admin/control-prueba/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...headerDraft,
            items: draftItems,
            hitos: hitosDraft,
            oficiosAutenticidadPendientes: [],
            resumenEjecutivo: resumenVisible ?? resumenDraft,
            parteRepresentada: headerDraft.parteRepresentada ?? '',
          }),
        });
        const json = await safeResJson<{ ok?: boolean; expediente?: ControlPruebaExpediente; error?: string }>(res);
        if (json.ok && json.expediente) {
          lastSavedSnapshotRef.current = snapshot;
          setExpedientes((prev) => prev.map((e) => (e.id === json.expediente!.id ? json.expediente! : e)));
          setSaveStatus('saved');
          if (!opts?.silent) {
            toast({ title: 'Cambios guardados' });
          }
          return true;
        }
        setSaveStatus('error');
        toast({
          variant: 'destructive',
          title: opts?.silent ? 'No se pudo guardar automáticamente' : 'Error',
          description: json.error,
        });
        return false;
      } catch {
        setSaveStatus('error');
        toast({
          variant: 'destructive',
          title: opts?.silent ? 'No se pudo guardar automáticamente' : 'Error al guardar',
        });
        return false;
      } finally {
        setSaving(false);
        saveInFlightRef.current = false;
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          void handleSave({ silent: true });
        }
      }
    },
    [selected, headerDraft, draftItems, hitosDraft, oficiosDraft, resumenDraft, resumenVisible, buildPersistSnapshot, toast],
  );

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (!selectedId) return;
    if (buildPersistSnapshot() === lastSavedSnapshotRef.current) return;

    setSaveStatus('pending');
    const timer = window.setTimeout(() => {
      void handleSaveRef.current({ silent: true });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [selectedId, buildPersistSnapshot]);

  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const timer = window.setTimeout(() => setSaveStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [saveStatus]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (buildPersistSnapshot() !== lastSavedSnapshotRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [buildPersistSnapshot]);

  const closeImportDialog = () => {
    const reset = resetImportWizard();
    setImportOpen(false);
    setImportDragOver(false);
    setImportFile(reset.importFile);
    setImportExtract(reset.importExtract);
    setImportCaratula(reset.importCaratula);
    setImportNumeroExpediente(reset.importNumeroExpediente);
    setImportFuero(reset.importFuero);
    setImportJuzgado(reset.importJuzgado);
    setImportExpedienteUrl(reset.importExpedienteUrl);
    setImportMergeMode(reset.importMergeMode);
    setImportParteRepresentada(reset.importParteRepresentada);
    setImportStep(reset.importStep);
    setExtracting(reset.extracting);
    setAnalyzing(reset.analyzing);
    setImportAnalysisError(null);
  };

  const handleExtractPdf = async (file: File) => {
    setExtracting(true);
    setImportStep('Extrayendo texto del PDF (sin IA)...');
    setImportExtract(null);
    try {
      let textoCompleto: string;
      let numPages: number;
      let metadataFromServer: {
        caratula?: string;
        numeroExpediente?: string;
        juzgado?: string;
        fuero?: string;
      } | null = null;

      try {
        const local = await extractTextFromPdfFile(file);
        textoCompleto = local.texto;
        numPages = local.numPages;
      } catch (clientErr) {
        if (clientErr instanceof PdfExtractError) throw clientErr;
        setImportStep('Reintentando extracción en servidor...');
        const form = new FormData();
        form.append('file', file);
        const res = await adminFetchForm('/api/admin/control-prueba/extract-pdf', form);
        const json = await safeResJson<{
          ok?: boolean;
          texto?: string;
          numPages?: number;
          metadata?: {
            caratula?: string;
            numeroExpediente?: string;
            juzgado?: string;
            fuero?: string;
          };
          error?: string;
          code?: string;
        }>(res);
        if (!json.ok || !json.texto) {
          throw new PdfExtractError(
            json.error ?? 'No se pudo extraer texto del PDF',
            json.code === 'SCANNED_PDF' ? 'SCANNED_PDF' : 'EMPTY_PDF',
          );
        }
        textoCompleto = json.texto;
        numPages = json.numPages ?? 1;
        metadataFromServer = json.metadata ?? null;
      }

      const texto = truncateTextoForAnalysis(textoCompleto);
      const metadata =
        metadataFromServer ??
        mergeMetadataLocal(
          extractMetadataFromFilename(file.name),
          extractMetadataFromExpedienteText(textoCompleto),
        );

      setImportExtract({
        texto,
        pdfFileName: file.name,
        numPages,
        textoLength: texto.length,
        textoPreview: texto.slice(0, 600),
      });
      setImportCaratula(metadata.caratula ?? '');
      setImportNumeroExpediente(metadata.numeroExpediente ?? '');
      setImportFuero(metadata.fuero ?? '');
      setImportJuzgado(metadata.juzgado ?? '');
      toast({
        title: 'Texto extraído',
        description: `${numPages} págs · ${texto.length.toLocaleString('es-AR')} caracteres. Revisá carátula y nº antes de usar IA.`,
      });
    } catch (err) {
      const code = err instanceof PdfExtractError ? err.code : undefined;
      const message =
        err instanceof PdfExtractError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'No se pudo extraer texto';
      toast({
        variant: 'destructive',
        title: code === 'SCANNED_PDF' ? 'PDF sin texto legible' : 'Error al leer PDF',
        description: message,
      });
      setImportFile(null);
    } finally {
      setExtracting(false);
      setImportStep('');
    }
  };

  const isPdfFile = (file: File) =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!isPdfFile(file)) {
      toast({
        variant: 'destructive',
        title: 'Formato no válido',
        description: 'Subí un archivo PDF (.pdf).',
      });
      return;
    }
    setImportFile(file);
    setImportExtract(null);
    setImportCaratula('');
    setImportNumeroExpediente('');
    setImportFuero('');
    setImportJuzgado('');
    void handleExtractPdf(file);
  };

  const handleImportDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setImportDragOver(false);
    if (importBusy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleAnalyzeText = async () => {
    if (!importExtract?.texto) {
      toast({ variant: 'destructive', title: 'Primero subí y extraé el PDF' });
      return;
    }
    if (!selected && !importCaratula.trim()) {
      toast({ variant: 'destructive', title: 'Completá la carátula' });
      return;
    }
    setAnalyzing(true);
    setImportAnalysisError(null);
    setImportStep('Analizando prueba ofrecida con IA (puede tardar 1–2 min)...');
    try {
      const res = await adminFetch('/api/admin/control-prueba/analyze-text', {
        method: 'POST',
        body: JSON.stringify({
          texto: importExtract.texto,
          caratula: importCaratula,
          numeroExpediente: importNumeroExpediente,
          juzgado: importJuzgado,
          fuero: importFuero,
          expedienteUrl: importExpedienteUrl,
          pdfFileName: importExtract.pdfFileName,
          previewOnly: true,
          parteRepresentada: importParteRepresentada,
        }),
      });
      const json = await safeResJson<{
        ok?: boolean;
        step?: string;
        preview?: ImportPreviewPayload;
        import?: {
          itemsAdded: number;
          filter?: { descartados: number; reclasificados?: number };
          oficiosAutenticidad?: number;
          tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
        };
        filter?: { descartados?: number; muestra?: { descripcion: string; motivo: string }[] };
        error?: string;
      }>(res);

      if (json.ok && json.preview) {
        const preview: ImportPreviewPayload = {
          ...json.preview,
          parteRepresentada: importParteRepresentada || json.preview.parteRepresentada || '',
          tokenUsage: json.preview.tokenUsage ?? json.import?.tokenUsage,
        };
        setImportPreview(preview);
        setPreviewOpen(true);
        toast({
          title: 'Análisis listo',
          description: `${json.preview.items.length} ítems para revisar${
            json.preview.descartados.length
              ? ` · ${json.preview.descartados.length} actos descartados`
              : ''
          }.`,
        });
      } else {
        const detail = [
          json.error ?? `HTTP ${res.status}`,
          json.filter?.descartados != null ? `${json.filter.descartados} actos descartados por el filtro` : '',
          json.filter?.muestra?.[0]?.motivo ? `Ej.: ${json.filter.muestra[0].motivo}` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        setImportAnalysisError(detail);
        console.error('[control-prueba] analyze-text falló', { status: res.status, json });
        toast({ variant: 'destructive', title: 'Error en análisis IA', description: detail });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de red o timeout';
      setImportAnalysisError(message);
      console.error('[control-prueba] analyze-text excepción', err);
      toast({ variant: 'destructive', title: 'Error al analizar con IA', description: message });
    } finally {
      setAnalyzing(false);
      setImportStep('');
    }
  };

  const handleConfirmImport = async (selectedItemIds: string[]) => {
    if (!importPreview || !importExtract) return;
    const previewToSave: ImportPreviewPayload = {
      ...importPreview,
      parteRepresentada: importParteRepresentada || importPreview.parteRepresentada || '',
    };
    setConfirmingImport(true);
    try {
      const res = await adminFetch('/api/admin/control-prueba/analyze-text', {
        method: 'POST',
        body: JSON.stringify({
          confirmImport: true,
          preview: previewToSave,
          selectedItemIds,
          caratula: importCaratula,
          numeroExpediente: importNumeroExpediente,
          juzgado: importJuzgado,
          fuero: importFuero,
          expedienteUrl: importExpedienteUrl,
          expedienteId: selected?.id,
          mergeMode: importMergeMode,
          pdfFileName: importExtract.pdfFileName,
        }),
      });
      const json = await safeResJson<{
        ok?: boolean;
        expediente?: ControlPruebaExpediente;
        import?: {
          itemsAdded: number;
          pdfFileName: string;
          resumen?: string;
          byParte: Record<string, number>;
          byCategoria?: Record<string, number>;
          filter?: { descartados: number; reclasificados?: number };
          oficiosAutenticidad?: number;
        };
        error?: string;
      }>(res);

      if (json.ok && json.expediente) {
        const exp = json.expediente;
        setExpedientes((prev) => {
          const exists = prev.some((e) => e.id === exp.id);
          if (exists) {
            return prev.map((e) => (e.id === exp.id ? exp : e));
          }
          return [exp, ...prev];
        });
        selectExpediente(exp.id);
        const synced = syncDraftFromExpediente(exp);
        setDraftItems(synced.items);
        setHeaderDraft(synced.header);
        setHitosDraft(synced.hitos);
        setResumenDraft(synced.resumen);
        lastSavedSnapshotRef.current = synced.snapshot;
        setSaveStatus('saved');
        setLastImportSummary(json.import ?? null);
        setPreviewOpen(false);
        setImportPreview(null);
        closeImportDialog();
        toast({
          title: 'Control de prueba armado',
          description: `${json.import?.itemsAdded ?? 0} ítems importados${
            json.import?.filter?.descartados
              ? ` · ${json.import.filter.descartados} actos procesales descartados`
              : ''
          }${
            json.import?.oficiosAutenticidad
              ? ` · ${json.import.oficiosAutenticidad} oficios de autenticidad`
              : ''
          }.`,
        });
        void loadExpedientes();
      } else {
        toast({ variant: 'destructive', title: 'Error al confirmar import', description: json.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error al confirmar import' });
    } finally {
      setConfirmingImport(false);
    }
  };

  const importBusy = extracting || analyzing || confirmingImport;

  const handleDeleteExpediente = async () => {
    if (!selected || !confirm('¿Eliminar este control de prueba?')) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/control-prueba/${selected.id}`, { method: 'DELETE' });
      const json = await safeResJson<{ ok?: boolean; error?: string }>(res);
      if (json.ok) {
        setExpedientes((prev) => prev.filter((e) => e.id !== selected.id));
        clearExpedienteSelection();
        toast({ title: 'Expediente eliminado' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: json.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error al eliminar' });
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (id: string, patch: Partial<ControlPruebaItem>) => {
    const usuario = auth.currentUser?.email ?? auth.currentUser?.displayName ?? 'Usuario';
    let alertasSubproceso: string[] = [];
    let nuevoOficioAclaracionId: string | null = null;
    let nuevoOficioReiteracionId: string | null = null;

    setDraftItems((prev) => {
      const anterior = prev.find((i) => i.id === id);
      if (!anterior) return prev;

      const items = prev.map((item) => {
        if (item.id !== id) return item;
        let effectivePatch = patch;
        if (patch.estado !== undefined && usaEstadosProduccionPrueba(anterior)) {
          effectivePatch = {
            ...patchEstadoPruebaOfrecida(anterior, String(patch.estado)),
            ...patch,
          };
        }
        let next = patchItemConHistorial(item, effectivePatch, usuario);
        if (
          ((patch.estado !== undefined && esCierrePrueba(String(patch.estado))) ||
            patch.estado === 'cumplido' ||
            patch.estado === 'realizada' ||
            patch.estado === 'cumplida') &&
          !next.fechaProduccion
        ) {
          next = { ...next, fechaProduccion: new Date().toISOString().slice(0, 10) };
        }
        if (patch.tipo && !patch.categoria) {
          next = { ...next, categoria: inferCategoriaFromTipo(patch.tipo) };
          next = ensureSubtareas(next);
        }
        if (patch.categoria && patch.categoria !== item.categoria) {
          next = ensureSubtareas(next);
        }
        if (next.tipo === 'pericial' || patch.pericial) {
          next = ensurePericialMeta(next);
        }
        if (next.tipo === 'documental_en_poder' || patch.documentalEnPoder) {
          next = ensureDocumentalEnPoderMeta(next);
          next = syncFechaLimiteDocumentalEnPoder(next);
        }
        if (next.tipo === 'documental' || patch.documental) {
          next = ensureDocumentalMeta(next);
        }
        return next;
      });

      const resultSub = evaluarSubProcesosAutomaticos({
        items,
        itemId: id,
        itemAnterior: anterior,
        patch,
        usuario,
      });

      let resultItems = resultSub.items;
      alertasSubproceso = [...resultSub.alertas];

      const resultOficio = evaluarOficioAclaracionAutomatico(resultItems, id, anterior, patch);
      if (resultOficio.creado) {
        resultItems = resultOficio.items;
        nuevoOficioAclaracionId = resultOficio.creado.id;
        alertasSubproceso.push('Se creó oficio de aclaración en Comunicaciones.');
      }

      const resultReiteracion = evaluarOficioReiteracionAutomatico(resultItems, id, anterior, patch);
      if (resultReiteracion.creado) {
        resultItems = resultReiteracion.items;
        nuevoOficioReiteracionId = resultReiteracion.creado.id;
        alertasSubproceso.push('Se creó oficio de reiteración en Comunicaciones.');
      }

      if (resultItems.length !== prev.length) {
        return resultItems.map((item, index) => ({ ...item, orden: index + 1 }));
      }
      return resultItems;
    });

    const anterior = draftItems.find((i) => i.id === id);
    if (patch.categoria === 'prueba' && anterior?.categoria === 'diligencia') {
      queueMicrotask(() => {
        setEstadoFilter('all');
        setHighlightItemId(id);
        setParteTab(tabDeItem({ ...anterior, ...patch } as ControlPruebaItem));
        toast({
          title: 'Movido a Prueba ofrecida',
          description: 'El ítem aparece arriba en la sección de prueba de esta parte.',
        });
      });
    }

    if (alertasSubproceso.length > 0) {
      toast({
        title: alertasSubproceso[0],
        description: alertasSubproceso.length > 1 ? alertasSubproceso.slice(1).join(' · ') : undefined,
      });
    }

    if (nuevoOficioAclaracionId) {
      handleFocusItem(nuevoOficioAclaracionId);
    } else if (nuevoOficioReiteracionId) {
      handleFocusItem(nuevoOficioReiteracionId);
    }
  };

  const addCedulaVinculada = (parentId: string, destinatario?: string) => {
    let nuevoId: string | null = null;
    setDraftItems((prev) => {
      const result = crearCedulaManualVinculada(prev, parentId, destinatario);
      if (!result.creado) return prev;
      nuevoId = result.creado.id;
      return result.items.map((item, index) => ({ ...item, orden: index + 1 }));
    });
    if (nuevoId) {
      toast({ title: 'Cédula creada en Comunicaciones' });
      handleFocusItem(nuevoId);
    } else {
      toast({
        title: 'No se pudo crear la cédula',
        description: 'Seleccione una audiencia fijada vinculada o créela desde la prueba ofrecida.',
      });
    }
  };

  const addNuevaAudienciaVinculada = (pruebaId: string) => {
    let nuevoId: string | null = null;
    setDraftItems((prev) => {
      const result = crearEventoAudienciaManual(prev, pruebaId);
      if (!result.creado) return prev;
      nuevoId = result.creado.id;
      let items = result.items;
      const prueba = items.find((i) => i.id === pruebaId);
      if (prueba && prueba.estado === 'postpuesta_juez') {
        items = items.map((i) =>
          i.id === pruebaId ? { ...i, estado: 'audiencia_fijada' as const } : i,
        );
      }
      return items.map((item, index) => ({ ...item, orden: index + 1 }));
    });
    if (nuevoId) {
      toast({ title: 'Audiencia fijada creada', description: 'Aparece en Audiencias fijadas.' });
      handleFocusItem(nuevoId);
    } else {
      toast({
        title: 'No se pudo crear la audiencia',
        description: 'Ya hay una audiencia activa vinculada a esta prueba.',
      });
    }
  };

  const addOficioAutenticidad = (parentId: string, destinatario?: string) => {
    let nuevoId: string | null = null;
    setDraftItems((prev) => {
      const result = crearOficioAutenticidadManual(prev, parentId, destinatario);
      if (!result.creado) return prev;
      nuevoId = result.creado.id;
      return result.items.map((item, index) => ({ ...item, orden: index + 1 }));
    });
    if (nuevoId) {
      toast({ title: 'Oficio de autenticidad creado en Comunicaciones' });
      handleFocusItem(nuevoId);
    }
  };

  const reintentarCedulaTestigo = (parentId: string, destinatario: string) => {
    let creado = false;
    setDraftItems((prev) => {
      const result = crearCedulaReintentoVinculada(prev, parentId, destinatario);
      creado = Boolean(result.creado);
      if (!result.creado) return prev;
      return result.items.map((item, index) => ({ ...item, orden: index + 1 }));
    });
    if (creado) {
      toast({ title: 'Nueva cédula de notificación creada (reintento)' });
    }
  };

  const crearMandamientoTestigo = (parentId: string, testigoNombre: string) => {
    let nuevoId: string | null = null;
    setDraftItems((prev) => {
      const result = crearMandamientoConduccionTestigo(prev, parentId, testigoNombre);
      if (!result.creado) return prev;
      nuevoId = result.creado.id;
      return result.items.map((item, index) => ({ ...item, orden: index + 1 }));
    });
    if (nuevoId) {
      toast({ title: 'Mandamiento de conducción creado en Comunicaciones' });
      handleFocusItem(nuevoId);
    }
  };

  const addOficioAclaracion = (parentId: string) => {
    let nuevoId: string | null = null;
    setDraftItems((prev) => {
      const result = crearOficioAclaracion(prev, parentId);
      if (!result.creado) return prev;
      nuevoId = result.creado.id;
      return result.items.map((item, index) => ({ ...item, orden: index + 1 }));
    });
    if (nuevoId) {
      toast({ title: 'Oficio de aclaración creado en Comunicaciones' });
      handleFocusItem(nuevoId);
    }
  };

  const addOficioReiteracion = (parentId: string) => {
    let nuevoId: string | null = null;
    setDraftItems((prev) => {
      const result = crearOficioReiteracion(prev, parentId);
      if (!result.creado) return prev;
      nuevoId = result.creado.id;
      return result.items.map((item, index) => ({ ...item, orden: index + 1 }));
    });
    if (nuevoId) {
      toast({ title: 'Oficio de reiteración creado en Comunicaciones' });
      handleFocusItem(nuevoId);
    }
  };

  const addMovimientoPericial = (parentId: string, rol: TipoTramitePericial) => {
    let creado = false;
    setDraftItems((prev) => {
      const result = crearMovimientoPericial(prev, parentId, rol);
      if (!result.creado) return prev;
      creado = true;
      return result.items.map((item, index) => ({ ...item, orden: index + 1 }));
    });
    if (creado) {
      toast({ title: 'Movimiento pericial agregado' });
      handleFocusItem(parentId);
    }
  };

  const removeItem = (id: string) => {
    setDraftItems((prev) => {
      let next = prev.filter((item) => item.id !== id);
      next = marcarHijosSinEfectoPorPadreEliminado(next, id);
      return next.map((item, index) => ({ ...item, orden: index + 1 }));
    });
  };

  const addItem = (opts: {
    categoria?: ItemCategoria;
    parte?: PruebaParte;
    terceroNombre?: string | null;
  } = {}) => {
    const categoria = opts.categoria ?? 'prueba';
    const parte = opts.parte ?? (categoria === 'prueba' ? 'actor' : 'tribunal');
    setDraftItems((prev) => [
      ...prev,
      newItem(prev.length + 1, {
        categoria,
        parte,
        terceroNombre: parte === 'tercero' ? opts.terceroNombre ?? null : null,
      }),
    ]);
    if (categoria === 'mejor_proveer') setParteTab('mejor_proveer');
    else if (parte === 'tercero') setParteTab('otros');
  };

  const filteredExpedientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expedientes;
    return expedientes.filter((exp) => {
      const haystack = [exp.caratula, exp.numeroExpediente, exp.juzgado].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [expedientes, search]);

  const agregarTerceroAlExpediente = () => {
    const nombre = nuevoTerceroNombre.trim();
    if (!nombre) return;
    setHeaderDraft((h) => ({
      ...h,
      terceros: [...new Set([...(h.terceros ?? selected?.terceros ?? []), nombre])],
    }));
    setNuevoTerceroNombre('');
  };

  const renderSubBloque = (opts: {
    categoria: ItemCategoria;
    items: ControlPruebaItem[];
    parte: PruebaParte;
    icon: React.ReactNode;
    titulo: string;
    accentClass: string;
    bgClass?: string;
    addLabel?: string;
    terceroNombreDefault?: string | null;
    showSelectorTercero?: boolean;
  }) => {
    if (opts.items.length === 0) return null;

    return (
    <Card className={cn('border-l-4 overflow-hidden', opts.accentClass, opts.bgClass)}>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          {opts.icon}
          <CardTitle className="text-sm">{opts.titulo}</CardTitle>
          <CardDescription>
            {opts.items.length} ítem{opts.items.length === 1 ? '' : 's'}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            addItem({
              categoria: opts.categoria,
              parte: opts.parte,
              terceroNombre:
                opts.parte === 'tercero'
                  ? opts.terceroNombreDefault && opts.terceroNombreDefault !== TERCERO_SIN_IDENTIFICAR
                    ? opts.terceroNombreDefault
                    : null
                  : undefined,
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {opts.addLabel ?? 'Agregar'}
        </Button>
      </CardHeader>
        <CardContent className="p-0">
          <ControlPruebaItemsTable
            categoria={opts.categoria}
            items={opts.items}
            expediente={expedienteDraft}
            pruebaItems={allPruebaItems}
            expedienteUrl={headerDraft.expedienteUrl}
            highlightItemId={highlightItemId}
            compact={modoCompacto}
            parteGrupo={
              opts.parte === 'actor' || opts.parte === 'demandado' || opts.parte === 'tercero' || opts.parte === 'tribunal'
                ? opts.parte
                : undefined
            }
            onUpdate={updateItem}
            onRemove={removeItem}
            onAddCedulaVinculada={addCedulaVinculada}
            onNuevaAudienciaVinculada={addNuevaAudienciaVinculada}
            onAddOficioAutenticidad={addOficioAutenticidad}
            onReintentarCedulaTestigo={reintentarCedulaTestigo}
            onCrearMandamientoTestigo={crearMandamientoTestigo}
            onCrearOficioAclaracion={addOficioAclaracion}
            onCrearOficioReiteracion={addOficioReiteracion}
            onAddMovimientoPericial={addMovimientoPericial}
            onUpdateMovimientoPericial={updateItem}
            onRemoveMovimientoPericial={removeItem}
            onFocusItem={handleFocusItem}
            tercerosNombres={tercerosConocidos}
            showSelectorTercero={opts.showSelectorTercero}
          />
        </CardContent>
    </Card>
    );
  };

  const renderGrupoParte = (grupoId: 'actor' | 'demandado' | 'otros') => {
    const prueba = itemsByGrupo[grupoId];
    const diligencias = diligenciaByGrupo[grupoId];
    const audiencias = audienciaByGrupo[grupoId];
    const total = prueba.length + diligencias.length + audiencias.length;

    if (grupoId === 'otros') {
      const todosTercero = [
        ...itemsTerceroByCat.prueba,
        ...itemsTerceroByCat.diligencia,
        ...itemsTerceroByCat.audiencia,
      ];
      const grupos = agruparItemsPorTercero(todosTercero);
      const nombresGrupo = ordenGruposTercero(grupos);
      const totalTribunal =
        itemsTribunalByCat.prueba.length +
        itemsTribunalByCat.diligencia.length +
        itemsTribunalByCat.audiencia.length;

      const itemsDeGrupoTercero = (nombre: string, categoria: ItemCategoria) => {
        const lista = grupos.get(nombre) ?? [];
        return lista.filter((i) => resolveCategoria(i) === categoria);
      };

      return (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium">Terceros del expediente</p>
            <p className="text-[10px] text-muted-foreground">
              Registrá cada tercero por nombre y asigná sus ítems. Si hay varios, cada uno aparece en su propio bloque.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tercerosConocidos.map((nombre) => (
                <Badge key={nombre} variant="secondary" className="text-xs">
                  {nombre}
                </Badge>
              ))}
              {tercerosConocidos.length === 0 && (
                <span className="text-[10px] text-muted-foreground italic">Sin terceros registrados aún</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Input
                value={nuevoTerceroNombre}
                onChange={(e) => setNuevoTerceroNombre(e.target.value)}
                placeholder="Nombre del tercero (ej. Garante, Co-demandado…)"
                className="h-8 text-xs max-w-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    agregarTerceroAlExpediente();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={agregarTerceroAlExpediente}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Agregar tercero
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {total} ítem{total === 1 ? '' : 's'} de terceros
            {totalTribunal > 0 ? ` · ${totalTribunal} del tribunal (abajo)` : ''}
          </p>

          <div className="space-y-4">
            {nombresGrupo.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Sin ítems de terceros. Agregá un tercero arriba y cargá prueba u oficios vinculados.
                </CardContent>
              </Card>
            ) : (
              nombresGrupo.map((nombre) => {
                const pruebaG = itemsDeGrupoTercero(nombre, 'prueba');
                const diligG = itemsDeGrupoTercero(nombre, 'diligencia');
                const audG = itemsDeGrupoTercero(nombre, 'audiencia');
                const totalG = pruebaG.length + diligG.length + audG.length;
                if (totalG === 0) return null;
                const esSinIdentificar = nombre === TERCERO_SIN_IDENTIFICAR;
                return (
                  <div key={nombre} className="space-y-3 rounded-lg border border-[#54A6A8]/30 bg-[#54A6A8]/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#2A6A78]">
                        {esSinIdentificar ? 'Tercero sin identificar' : nombre}
                      </h4>
                      <Badge variant="outline" className="text-[10px]">
                        {totalG} ítem{totalG === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="min-w-[1024px] space-y-3">
                        {renderSubBloque({
                          categoria: 'prueba',
                          items: pruebaG,
                          parte: 'tercero',
                          icon: <Gavel className="h-4 w-4 text-primary" />,
                          titulo: CATEGORIA_CONFIG.prueba.titulo,
                          accentClass: 'border-l-muted',
                          terceroNombreDefault: esSinIdentificar ? null : nombre,
                          showSelectorTercero: esSinIdentificar,
                        })}
                        {renderSubBloque({
                          categoria: 'diligencia',
                          items: diligG,
                          parte: 'tercero',
                          icon: <Mail className="h-4 w-4 text-violet-600" />,
                          titulo: CATEGORIA_CONFIG.diligencia.titulo,
                          accentClass: CATEGORIA_CONFIG.diligencia.accent,
                          bgClass: 'bg-violet-50/20',
                          terceroNombreDefault: esSinIdentificar ? null : nombre,
                          showSelectorTercero: esSinIdentificar,
                        })}
                        {renderSubBloque({
                          categoria: 'audiencia',
                          items: audG,
                          parte: 'tercero',
                          icon: <Calendar className="h-4 w-4 text-amber-600" />,
                          titulo: CATEGORIA_CONFIG.audiencia.titulo,
                          accentClass: CATEGORIA_CONFIG.audiencia.accent,
                          bgClass: 'bg-amber-50/20',
                          terceroNombreDefault: esSinIdentificar ? null : nombre,
                          showSelectorTercero: esSinIdentificar,
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalTribunal > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">
                Tribunal — {totalTribunal} ítem{totalTribunal === 1 ? '' : 's'} (comunicaciones / actuaciones judiciales)
              </p>
              <div className="overflow-x-auto">
                <div className="min-w-[1024px] space-y-3">
                  {renderSubBloque({
                    categoria: 'prueba',
                    items: itemsTribunalByCat.prueba,
                    parte: 'tribunal',
                    icon: <Gavel className="h-4 w-4 text-primary" />,
                    titulo: CATEGORIA_CONFIG.prueba.titulo,
                    accentClass: 'border-l-muted',
                  })}
                  {renderSubBloque({
                    categoria: 'diligencia',
                    items: itemsTribunalByCat.diligencia,
                    parte: 'tribunal',
                    icon: <Mail className="h-4 w-4 text-violet-600" />,
                    titulo: CATEGORIA_CONFIG.diligencia.titulo,
                    accentClass: CATEGORIA_CONFIG.diligencia.accent,
                    bgClass: 'bg-violet-50/20',
                  })}
                  {renderSubBloque({
                    categoria: 'audiencia',
                    items: itemsTribunalByCat.audiencia,
                    parte: 'tribunal',
                    icon: <Calendar className="h-4 w-4 text-amber-600" />,
                    titulo: CATEGORIA_CONFIG.audiencia.titulo,
                    accentClass: CATEGORIA_CONFIG.audiencia.accent,
                    bgClass: 'bg-amber-50/20',
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    const grupo = GRUPOS_PRUEBA.find((g) => g.id === grupoId)!;
    const nombreParte =
      grupoId === 'actor' ? (selected?.actor || '').trim() : (selected?.demandado || '').trim();

    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {[nombreParte, `${total} ítem${total === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
        </p>
        {total === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Ningún ítem de esta parte coincide con los filtros activos.
          </p>
        ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[1024px] space-y-3">
        {renderSubBloque({
          categoria: 'prueba',
          items: prueba,
          parte: grupo.id,
          icon: <Gavel className="h-4 w-4 text-primary" />,
          titulo: CATEGORIA_CONFIG.prueba.titulo,
          accentClass: grupo.accent,
        })}
        {renderSubBloque({
          categoria: 'diligencia',
          items: diligencias,
          parte: grupo.id,
          icon: <Mail className="h-4 w-4 text-violet-600" />,
          titulo: CATEGORIA_CONFIG.diligencia.titulo,
          accentClass: CATEGORIA_CONFIG.diligencia.accent,
          bgClass: 'bg-violet-50/20',
        })}
        {renderSubBloque({
          categoria: 'audiencia',
          items: audiencias,
          parte: grupo.id,
          icon: <Calendar className="h-4 w-4 text-amber-600" />,
          titulo: CATEGORIA_CONFIG.audiencia.titulo,
          accentClass: CATEGORIA_CONFIG.audiencia.accent,
          bgClass: 'bg-amber-50/20',
        })}
        {itemsTribunalByCat.prueba.length > 0 && (
          <div className="space-y-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-3">
            <p className="text-[11px] text-muted-foreground">
              Prueba del tribunal (p. ej. pericia de oficio) — también visible en pestaña Tercero
            </p>
            {renderSubBloque({
              categoria: 'prueba',
              items: itemsTribunalByCat.prueba,
              parte: 'tribunal',
              icon: <Gavel className="h-4 w-4 text-primary" />,
              titulo: `${CATEGORIA_CONFIG.prueba.titulo} (tribunal)`,
              accentClass: 'border-l-muted',
            })}
          </div>
        )}
          </div>
        </div>
        )}
      </div>
    );
  };

  const renderMejorProveerTab = () => (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {itemsMejorProveer.length === 0
          ? 'Órdenes del juez para mejor proveer — podés cargarlas en cualquier etapa'
          : itemsMejorProveer.length === 1
            ? '1 medida ordenada por el tribunal'
            : `${itemsMejorProveer.length} medidas ordenadas por el tribunal`}
      </p>
      {renderSubBloque({
        categoria: 'mejor_proveer',
        items: itemsMejorProveer,
        parte: 'actor',
        icon: <Scale className="h-4 w-4 text-orange-600" />,
        titulo: CATEGORIA_CONFIG.mejor_proveer.titulo,
        accentClass: CATEGORIA_CONFIG.mejor_proveer.accent,
        bgClass: 'bg-orange-50/20',
        addLabel: 'Agregar medida',
      })}
    </div>
  );

  const pendientesDeExpediente = (exp: ControlPruebaExpediente) =>
    itemsOfrecidasProduccion(exp.items).filter((i) =>
      (['pendiente_produccion', 'postpuesta_juez', 'audiencia_fijada'] as const).some((f) =>
        itemVisibleConFiltroEstado(i, f),
      ),
    ).length;

  return (
    <div className="space-y-6">
      {quota && (
        <Alert>
          <AlertDescription className="text-sm">
            Prueba: {quota.used}/{quota.limit} controles este mes
            {quota.remaining > 0
              ? ` · te quedan ${quota.remaining}`
              : ' · límite alcanzado; podés seguir editando los existentes'}
            {quota.monthlyResetAt && (
              <span className="text-muted-foreground">
                {' '}
                · se renueva el{' '}
                {new Date(quota.monthlyResetAt).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold font-headline flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            Control de prueba
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Seguimiento dinámico de prueba ofrecida y producida, con links directos al expediente virtual MEV/PJN.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadExpedientes()} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            disabled={quota != null && !quota.canCreate && !selectedId}
            title={
              quota != null && !quota.canCreate && !selectedId
                ? 'Alcanzaste el límite mensual de controles'
                : undefined
            }
          >
            <FileUp className="mr-2 h-4 w-4" />
            Importar PDF
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={quota != null && !quota.canCreate}
            title={
              quota != null && !quota.canCreate ? 'Alcanzaste el límite mensual de controles' : undefined
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo expediente
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <Label htmlFor="expediente-search" className="text-sm font-medium">
            Expediente
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">
            Buscá por carátula o número y seleccioná el caso a editar
          </p>
          <div ref={pickerRef} className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="expediente-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              placeholder="Buscar carátula, número..."
              className="pl-8"
            />
            {pickerOpen && (
              <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                {loading && expedientes.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cargando...
                  </div>
                ) : filteredExpedientes.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin expedientes</p>
                ) : (
                  <div className="max-h-[min(320px,50vh)] overflow-y-auto divide-y">
                    {filteredExpedientes.map((exp) => {
                      const pend = pendientesDeExpediente(exp);
                      return (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => selectExpediente(exp.id)}
                          className={cn(
                            'w-full px-4 py-3 text-left transition-colors hover:bg-muted/60',
                            selectedId === exp.id && 'bg-primary/5 border-l-4 border-l-primary',
                          )}
                        >
                          <p className="font-medium text-sm line-clamp-2">{exp.caratula || 'Sin carátula'}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {exp.numeroExpediente && <span>{exp.numeroExpediente}</span>}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {sistemaLabel(exp.sistema)}
                            </Badge>
                            {pend > 0 && (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] px-1.5 py-0">
                                {pend} pend.
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          {selected && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium line-clamp-1 min-w-0">{selected.caratula || 'Sin carátula'}</span>
              {selected.numeroExpediente && (
                <span className="text-muted-foreground shrink-0">{selected.numeroExpediente}</span>
              )}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                {sistemaLabel(selected.sistema)}
              </Badge>
              {pendientesDeExpediente(selected) > 0 && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] px-1.5 py-0 shrink-0">
                  {pendientesDeExpediente(selected)} pend.
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-4">
          {!selected ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground space-y-4">
                <FileSearch className="mx-auto h-10 w-10 opacity-40" />
                <p>Seleccioná un expediente, creá uno nuevo o importá un PDF de la causa.</p>
                <Button onClick={() => setImportOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Importar PDF y armar control de prueba
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {lastImportSummary && selected.pdfFileName === lastImportSummary.pdfFileName && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-4 text-sm">
                    <p className="font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Importado: {lastImportSummary.pdfFileName}
                    </p>
                    {lastImportSummary.resumen && (
                      <p className="text-muted-foreground mt-1">{lastImportSummary.resumen}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(lastImportSummary.byCategoria?.prueba ?? 0) > 0 && (
                        <Badge variant="outline">Prueba: {lastImportSummary.byCategoria!.prueba}</Badge>
                      )}
                      {(lastImportSummary.byCategoria?.diligencia ?? 0) > 0 && (
                        <Badge variant="outline">Diligencias: {lastImportSummary.byCategoria!.diligencia}</Badge>
                      )}
                      {(lastImportSummary.byCategoria?.audiencia ?? 0) > 0 && (
                        <Badge variant="outline">Audiencias: {lastImportSummary.byCategoria!.audiencia}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <Label>Carátula</Label>
                        <Input
                          value={headerDraft.caratula ?? ''}
                          onChange={(e) => setHeaderDraft((h) => ({ ...h, caratula: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Nº expediente</Label>
                          <Input
                            value={headerDraft.numeroExpediente ?? ''}
                            onChange={(e) => setHeaderDraft((h) => ({ ...h, numeroExpediente: e.target.value }))}
                            placeholder="FRO 014018 / CUIJ..."
                          />
                        </div>
                        <div>
                          <Label>Fuero / Juzgado</Label>
                          <Input
                            value={headerDraft.fuero ?? ''}
                            onChange={(e) => setHeaderDraft((h) => ({ ...h, fuero: e.target.value }))}
                            placeholder="FRO / CN..."
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Link expediente virtual</Label>
                        <div className="flex gap-2">
                          <Input
                            value={headerDraft.expedienteUrl ?? ''}
                            onChange={(e) => setHeaderDraft((h) => ({ ...h, expedienteUrl: e.target.value }))}
                            placeholder="https://mev.scba.gov.ar/... o scw.pjn.gov.ar/..."
                          />
                          {headerDraft.expedienteUrl && (
                            <Button variant="outline" size="icon" asChild>
                              <a href={headerDraft.expedienteUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>Representamos a</Label>
                        <Select
                          value={parteRepresentada || '_'}
                          onValueChange={(v) => {
                            const parte = v === '_' ? '' : (v as ParteRepresentadaPrueba);
                            setHeaderDraft((h) => ({ ...h, parteRepresentada: parte }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccioná la parte…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_">Sin definir</SelectItem>
                            <SelectItem value="actor">
                              {headerDraft.actor?.trim() || selected?.actor?.trim() || 'Actor'}
                            </SelectItem>
                            <SelectItem value="demandado">
                              {headerDraft.demandado?.trim() || selected?.demandado?.trim() || 'Demandada'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          El resumen ejecutivo y el informe PDF muestran solo la prueba de tu cliente.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCopyExpedienteLink()}
                        title="Copiar link directo a este expediente"
                      >
                        <Link2 className="mr-1.5 h-3.5 w-3.5" />
                        Copiar link
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Exportar
                            <ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => handleExport('pdf')}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Informe PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Excel
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleExport('json')}>
                            <FileJson className="mr-2 h-4 w-4" />
                            JSON revisión
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport('txt')}>
                            <FileSearch className="mr-2 h-4 w-4" />
                            TXT revisión
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="outline" onClick={() => setImportOpen(true)} disabled={saving}>
                        <FileUp className="mr-2 h-4 w-4" />
                        Importar PDF
                      </Button>
                      <div className="flex items-center gap-2">
                        {saveStatus === 'saving' || saveStatus === 'pending' ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Guardando…
                          </span>
                        ) : saveStatus === 'saved' ? (
                          <span className="text-xs text-emerald-700 flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5" />
                            Guardado
                          </span>
                        ) : saveStatus === 'error' ? (
                          <span className="text-xs text-destructive flex items-center gap-1.5">
                            <CloudOff className="h-3.5 w-3.5" />
                            Error al guardar
                          </span>
                        ) : isDirty ? (
                          <span className="text-xs text-amber-700">Cambios pendientes</span>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleSave()}
                          disabled={saving || !isDirty}
                        >
                          {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Guardar ahora
                        </Button>
                      </div>
                      <Button variant="destructive" size="icon" onClick={() => void handleDeleteExpediente()} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progreso de prueba producida</span>
                      <span className="font-medium text-primary">{progresoPct}%</span>
                    </div>
                    <Progress value={progresoPct} className="h-1.5" />
                  </div>
                </CardHeader>
              </Card>

              {(resumenVisible?.aLibrar?.length ||
                resumenVisible?.pendiente?.length ||
                resumenVisible?.producida?.length ||
                resumenVisible?.recomendaciones?.length) && (
                <Card className="border-primary/15 bg-muted/20">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">
                      Resumen ejecutivo
                      {parteRepresentada ? ' — nuestra prueba' : ''}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {parteRepresentada
                        ? `Solo la prueba de ${parteRepresentada === 'actor' ? headerDraft.actor || 'actor' : headerDraft.demandado || 'demandada'}. Cambiá "Representamos a" arriba para ver otra vista.`
                        : 'Semáforo importado desde el PDF. Indicá a quién representás para filtrar a tu parte.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-2 sm:grid-cols-3 text-xs">
                      {resumenVisible?.producida?.length ? (
                        <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/80 p-2">
                          <p className="font-medium text-emerald-900 mb-1">Producida</p>
                          <ul className="text-emerald-900/90 space-y-0.5">
                            {resumenVisible.producida.map((t, i) => (
                              <li key={i} className="line-clamp-2">
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {resumenVisible?.pendiente?.length ? (
                        <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-2">
                          <p className="font-medium text-amber-900 mb-1">Pendiente</p>
                          <ul className="text-amber-900/90 space-y-0.5">
                            {resumenVisible.pendiente.map((t, i) => (
                              <li key={i} className="line-clamp-2">
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {resumenVisible?.aLibrar?.length ? (
                        <div className="rounded-lg border border-rose-300/60 bg-rose-50/80 p-2">
                          <p className="font-medium text-rose-900 mb-1">A librar</p>
                          <ul className="text-rose-900/90 space-y-0.5">
                            {resumenVisible.aLibrar.map((t, i) => (
                              <li key={i} className="line-clamp-2">
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                    {resumenVisible?.recomendaciones?.length ? (
                      <ul className="mt-3 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                        {resumenVisible.recomendaciones.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Filtrar por estado de prueba</p>
                  {estadoFilter !== 'all' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEstadoFilter('all')}>
                      Limpiar filtro
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  {ESTADOS.map((estado) => {
                    const activo = estadoFilter === estado;
                    return (
                      <button
                        key={estado}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setEstadoFilter(activo ? 'all' : estado)}
                        className={cn(
                          'rounded-lg border p-2 text-left transition-all hover:shadow-sm hover:border-primary/40',
                          activo && 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-1 shadow-sm',
                          !activo && counts[estado] > 0 && estado === 'pendiente_produccion' && 'border-amber-300 bg-amber-50/50',
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', ESTADO_CONFIG[estado].dotClass)} />
                          <span className={cn('text-[10px] leading-tight', activo ? 'text-primary font-medium' : 'text-muted-foreground')}>
                            {ESTADO_CONFIG[estado].label}
                          </span>
                        </div>
                        <p className={cn('text-lg font-semibold mt-0.5', activo && 'text-primary')}>{counts[estado]}</p>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={estadoFilter === 'all'}
                    onClick={() => setEstadoFilter('all')}
                    className={cn(
                      'rounded-lg border p-2 text-left transition-all hover:shadow-sm hover:border-primary/40',
                      estadoFilter === 'all' && 'border-primary bg-muted/40 ring-2 ring-primary ring-offset-1 shadow-sm',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                      <span className={cn('text-[10px] leading-tight', estadoFilter === 'all' ? 'text-primary font-medium' : 'text-muted-foreground')}>
                        Ver todos
                      </span>
                    </div>
                    <p className={cn('text-lg font-semibold mt-0.5', estadoFilter === 'all' && 'text-primary')}>
                      {allPruebaItems.length}
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={busquedaItem}
                        onChange={(e) => setBusquedaItem(e.target.value)}
                        placeholder="Buscar en ítems..."
                        className="h-8 w-44 pl-8 text-xs"
                      />
                    </div>
                    <Select
                      value={estadoFilter}
                      onValueChange={(v) => setEstadoFilter(v as PruebaEstado | 'all')}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue placeholder="Estado prueba" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS.map((estado) => (
                          <SelectItem key={estado} value={estado}>
                            {ESTADO_CONFIG[estado].label} ({counts[estado]})
                          </SelectItem>
                        ))}
                        <SelectItem value="all">Ver todos ({allPruebaItems.length})</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                      <SelectTrigger className="h-8 w-48 text-xs">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        {gruposFiltroTipo.map((grupo, idx) => (
                          <div key={grupo}>
                            {idx > 0 && <SelectSeparator />}
                            <SelectGroup>
                              <SelectLabel>{FILTRO_TIPO_GRUPO_LABELS[grupo]}</SelectLabel>
                              {opcionesFiltroTipo
                                .filter((o) => o.grupo === grupo)
                                .map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filtroParte} onValueChange={setFiltroParte}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Parte" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="actor">Actor</SelectItem>
                        <SelectItem value="demandado">Demandada</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={modoCompacto ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => setModoCompacto((c) => !c)}
                    >
                      Compacto
                    </Button>
                </div>

                <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">Control del expediente</h3>
                    <p className="text-sm text-muted-foreground">
                      {estadoFilter !== 'all'
                        ? `Prueba: ${ESTADO_CONFIG[estadoFilter].label} · ${matchingEstadoCount} de ${allPruebaItems.length}`
                        : `${draftItems.length} ítems en total`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(estadoFilter !== 'all' ||
                      filtroTipo !== 'all' ||
                      filtroParte !== 'all' ||
                      busquedaItem.trim()) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEstadoFilter('all');
                          setFiltroTipo('all');
                          setFiltroParte('all');
                          setBusquedaItem('');
                        }}
                      >
                        Limpiar filtros
                      </Button>
                    )}
                  </div>
                </div>

                <Tabs
                  value={parteTab}
                  onValueChange={(v) => setParteTab(v as ParteTabId)}
                  className="space-y-4"
                >
                  <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
                    {GRUPOS_PRUEBA.map((grupo) => {
                      const nombreParte =
                        grupo.id === 'actor'
                          ? (selected?.actor || '').trim()
                          : (selected?.demandado || '').trim();
                      const count = conteoPorParteTab[grupo.id];
                      return (
                        <TabsTrigger
                          key={grupo.id}
                          value={grupo.id}
                          className="gap-1.5 data-[state=active]:shadow-sm"
                        >
                          {grupo.id === 'actor' ? 'Actor' : 'Demandada'}
                          {nombreParte ? (
                            <span className="hidden max-w-[8rem] truncate text-muted-foreground sm:inline">
                              ({nombreParte})
                            </span>
                          ) : null}
                          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                            {count}
                          </Badge>
                        </TabsTrigger>
                      );
                    })}
                    <TabsTrigger value="otros" className="gap-1.5 data-[state=active]:shadow-sm">
                      Tercero
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                        {conteoPorParteTab.otros}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="mejor_proveer" className="gap-1.5 data-[state=active]:shadow-sm">
                      Mejor proveer
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                        {conteoPorParteTab.mejor_proveer}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>

                  {GRUPOS_PRUEBA.map((grupo) => (
                    <TabsContent key={grupo.id} value={grupo.id} className="mt-0">
                      {renderGrupoParte(grupo.id)}
                    </TabsContent>
                  ))}
                  <TabsContent value="otros" className="mt-0">
                    {renderGrupoParte('otros')}
                  </TabsContent>
                  <TabsContent value="mejor_proveer" className="mt-0">
                    {renderMejorProveerTab()}
                  </TabsContent>
                </Tabs>

                {draftItems.length === 0 && (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground text-sm">
                      Sin ítems cargados. Importá un PDF o agregá prueba, diligencias o audiencias.
                    </CardContent>
                  </Card>
                )}
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Notas del caso</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={headerDraft.notas ?? ''}
                    onChange={(e) => setHeaderDraft((h) => ({ ...h, notas: e.target.value }))}
                    rows={3}
                    placeholder="Plazos generales, observaciones del juzgado, próxima audiencia..."
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>

      <Dialog open={importOpen} onOpenChange={(open) => !importBusy && (open ? setImportOpen(true) : closeImportDialog())}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar PDF de la causa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              <strong>Paso 1</strong> extrae texto localmente (sin costo de IA).{' '}
              <strong>Paso 2</strong> analiza la prueba ofrecida solo cuando confirmás.
            </p>

            <div>
              <Label>Paso 1 — Archivo PDF</Label>
              <div
                role="button"
                tabIndex={importBusy ? -1 : 0}
                onClick={() => !importBusy && importFileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !importBusy) {
                    e.preventDefault();
                    importFileInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (!importBusy) setImportDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!importBusy) setImportDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setImportDragOver(false);
                }}
                onDrop={handleImportDrop}
                className={cn(
                  'mt-1 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                  importBusy && 'cursor-not-allowed opacity-60',
                  !importBusy && 'cursor-pointer hover:border-primary/50 hover:bg-muted/40',
                  importDragOver && !importBusy && 'border-primary bg-primary/5',
                  !importDragOver && 'border-muted-foreground/25',
                )}
              >
                <FileUp className={cn('h-8 w-8', importDragOver ? 'text-primary' : 'text-muted-foreground')} />
                {importFile || importExtract ? (
                  <p className="text-sm font-medium">{importFile?.name ?? importExtract?.pdfFileName}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">Arrastrá un PDF aquí</p>
                    <p className="text-xs text-muted-foreground">o hacé clic para seleccionar</p>
                  </>
                )}
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={importBusy}
                  className="hidden"
                  onChange={(e) => {
                    handleFileSelect(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </div>
              {extracting && (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {importStep}
                </p>
              )}
            </div>

            {importExtract && (
              <>
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong className="text-foreground">{importExtract.pdfFileName}</strong>
                    {' · '}
                    {importExtract.numPages} págs · {importExtract.textoLength.toLocaleString('es-AR')} caracteres
                  </p>
                  <p className="line-clamp-3">{importExtract.textoPreview}</p>
                </div>

                {!selected && (
                  <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary">Datos detectados automáticamente</p>
                    <div>
                      <Label>Carátula *</Label>
                      <Input
                        value={importCaratula}
                        onChange={(e) => setImportCaratula(e.target.value)}
                        disabled={importBusy}
                        placeholder="VERA c/ ICBC s/ HABEAS DATA"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Nº expediente</Label>
                        <Input
                          value={importNumeroExpediente}
                          onChange={(e) => setImportNumeroExpediente(e.target.value)}
                          disabled={importBusy}
                          placeholder="FRO 014018"
                        />
                      </div>
                      <div>
                        <Label>Fuero</Label>
                        <Input
                          value={importFuero}
                          onChange={(e) => setImportFuero(e.target.value)}
                          disabled={importBusy}
                          placeholder="FRO"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Link expediente virtual (opcional)</Label>
                      <Input
                        value={importExpedienteUrl}
                        onChange={(e) => setImportExpedienteUrl(e.target.value)}
                        placeholder="https://mev.scba.gov.ar/..."
                        disabled={importBusy}
                      />
                    </div>
                  </div>
                )}

                {selected && (
                  <div>
                    <Label>Paso 2 — Modo de importación</Label>
                    <Select
                      value={importMergeMode}
                      onValueChange={(v) => setImportMergeMode(v as 'append' | 'replace' | 'reconcile')}
                      disabled={importBusy}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reconcile">Reconciliar (actualizar existentes, agregar nuevos)</SelectItem>
                        <SelectItem value="replace">Reemplazar toda la prueba</SelectItem>
                        <SelectItem value="append">Agregar sin reconciliar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Representamos a (opcional, recomendado)</Label>
                  <Select
                    value={importParteRepresentada || '_'}
                    onValueChange={(v) =>
                      setImportParteRepresentada(v === '_' ? '' : (v as ParteRepresentadaPrueba))
                    }
                    disabled={importBusy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná antes del análisis IA…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Sin definir aún</SelectItem>
                      <SelectItem value="actor">
                        {importPreview?.actor?.trim() || headerDraft.actor?.trim() || selected?.actor?.trim() || 'Actor'}
                      </SelectItem>
                      <SelectItem value="demandado">
                        {importPreview?.demandado?.trim() || headerDraft.demandado?.trim() || selected?.demandado?.trim() || 'Demandada'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    El resumen del import mostrará solo la prueba de tu cliente. Podés cambiarlo en la revisión previa.
                  </p>
                </div>
              </>
            )}

            {analyzing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {importStep}
              </div>
            )}

            {importAnalysisError && !analyzing && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs leading-relaxed space-y-1">
                  <p className="font-medium">Error en el análisis IA</p>
                  <p>{importAnalysisError}</p>
                  <p className="text-muted-foreground">
                    Detalle técnico: consola del navegador (F12) y terminal donde corre{' '}
                    <code className="text-[10px]">npm run dev</code> — buscá{' '}
                    <code className="text-[10px]">[control-prueba/analyze-text]</code>.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeImportDialog} disabled={importBusy}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleAnalyzeText()}
              disabled={importBusy || !importExtract}
            >
              {analyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Paso 2 — Revisar import (IA)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ControlPruebaImportPreviewDialog
        open={previewOpen}
        preview={importPreview}
        confirming={confirmingImport}
        onOpenChange={setPreviewOpen}
        onConfirm={(ids) => void handleConfirmImport(ids)}
        onPreviewChange={setImportPreview}
        parteRepresentada={importParteRepresentada}
        onParteRepresentadaChange={setImportParteRepresentada}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo control de prueba</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Carátula *</Label>
              <Input
                value={createForm.caratula}
                onChange={(e) => setCreateForm((f) => ({ ...f, caratula: e.target.value }))}
                placeholder="VERA c/ ICBC s/ HABEAS DATA"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº expediente</Label>
                <Input
                  value={createForm.numeroExpediente}
                  onChange={(e) => setCreateForm((f) => ({ ...f, numeroExpediente: e.target.value }))}
                  placeholder="FRO 014018"
                />
              </div>
              <div>
                <Label>Fuero</Label>
                <Input
                  value={createForm.fuero}
                  onChange={(e) => setCreateForm((f) => ({ ...f, fuero: e.target.value }))}
                  placeholder="FRO"
                />
              </div>
            </div>
            <div>
              <Label>Link expediente virtual (MEV / PJN)</Label>
              <Input
                value={createForm.expedienteUrl}
                onChange={(e) => setCreateForm((f) => ({ ...f, expedienteUrl: e.target.value }))}
                placeholder="https://mev.scba.gov.ar/... (opcional, recomendado)"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Opcional. Sirve para abrir el expediente en un clic desde el control de prueba.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
