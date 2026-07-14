'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '@/lib/firebase';
import { safeResJson } from '@/lib/utils';
import { formatTokenCount } from '@/lib/ai-token-usage';
import {
  buildCostByPeriod,
  formatUsdCost,
  GEMINI_FLASH_INPUT_USD_PER_1M,
  GEMINI_FLASH_OUTPUT_USD_PER_1M,
} from '@/lib/gemini-token-pricing';
import type {
  ControlPruebaReportRow,
  ControlPruebaReportSummary,
} from '@/lib/control-prueba-admin-report';
import { CostByPeriodPanels } from '@/components/admin/CostByPeriodPanels';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Coins, DollarSign, FileSearch, Loader2, RefreshCw, Search, Users } from 'lucide-react';

function formatFecha(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SummaryCards({
  summary,
  loading,
}: {
  summary: ControlPruebaReportSummary | null;
  loading: boolean;
}) {
  if (loading || !summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Cargando…
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Expedientes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{summary.totalExpedientes}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.totalItems.toLocaleString('es-AR')} ítems ·{' '}
            {summary.expedientesWithTokens} medidos
            {summary.expedientesEstimatedTokens > 0
              ? ` · ${summary.expedientesEstimatedTokens} estimados`
              : ''}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            <Users className="h-4 w-4" /> Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{summary.uniqueUsers}</p>
          <p className="text-xs text-muted-foreground mt-1">Con al menos un control creado</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            <Coins className="h-4 w-4" /> Tokens (entrada)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">
            {formatTokenCount(summary.totalInputTokens)}
          </p>
          {summary.expedientesEstimatedTokens > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Incluye estimaciones históricas</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            <Coins className="h-4 w-4" /> Tokens (salida)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">
            {formatTokenCount(summary.totalOutputTokens)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total: {formatTokenCount(summary.totalTokens)} tokens
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            <DollarSign className="h-4 w-4" /> Costo USD
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{formatUsdCost(summary.totalCostUsd)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Gemini Flash · ${GEMINI_FLASH_INPUT_USD_PER_1M}/1M in · $
            {GEMINI_FLASH_OUTPUT_USD_PER_1M}/1M out
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ControlPruebaAdminReport() {
  const [rows, setRows] = useState<ControlPruebaReportRow[]>([]);
  const [summary, setSummary] = useState<ControlPruebaReportSummary | null>(null);
  const [summaryAll, setSummaryAll] = useState<ControlPruebaReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (searchDebounced) params.set('q', searchDebounced);
      const qs = params.toString();
      const res = await fetch(`/api/admin/control-prueba/report${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await safeResJson<{
        ok: boolean;
        rows?: ControlPruebaReportRow[];
        summary?: ControlPruebaReportSummary;
        summaryAll?: ControlPruebaReportSummary;
        truncated?: boolean;
        error?: string;
      }>(res);
      if (json.ok && json.rows) {
        setRows(json.rows);
        setSummary(json.summary ?? null);
        setSummaryAll(json.summaryAll ?? null);
        setTruncated(!!json.truncated);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const filteredLabel = useMemo(() => {
    if (!searchDebounced) return null;
    return `búsqueda: “${searchDebounced}”`;
  }, [searchDebounced]);

  const costPeriods = useMemo(
    () =>
      buildCostByPeriod(
        rows.map((r) => ({
          dateIso: r.updatedAt || r.createdAt,
          costUsd: r.costUsd,
        })),
      ),
    [rows],
  );

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-x-hidden">
      <SummaryCards summary={summaryAll ?? summary} loading={loading && !summary} />

      <CostByPeriodPanels periods={costPeriods} entityLabel="expedientes" />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                Seguimiento de Control de Pruebas
              </CardTitle>
              <CardDescription>
                Expedientes creados por usuarios, con consumo de tokens de IA por importación. Sirve
                para estimar costo y precio del servicio. Los imports anteriores a la medición se
                muestran como <span className="font-medium">est.</span> (estimado por ítems).
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void fetchReport()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Actualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por usuario, email, carátula o PDF…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {filteredLabel && (
            <p className="text-xs text-muted-foreground">
              Filtro activo: {filteredLabel}
              {summary && (
                <>
                  {' '}
                  — {summary.totalExpedientes} resultado
                  {summary.totalExpedientes === 1 ? '' : 's'}
                </>
              )}
            </p>
          )}

          {truncated && (
            <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              Se muestran los últimos 500 expedientes. Contactá soporte si necesitás un reporte
              histórico completo.
            </p>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Expediente</TableHead>
                  <TableHead className="text-right">Ítems</TableHead>
                  <TableHead className="text-right">Tokens in</TableHead>
                  <TableHead className="text-right">Tokens out</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Costo USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Cargando expedientes…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No hay expedientes que coincidan con el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatFecha(row.updatedAt || row.createdAt)}
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <p className="font-medium text-sm truncate max-w-[180px]" title={row.userName}>
                          {row.userName}
                        </p>
                        <p
                          className="text-xs text-muted-foreground truncate max-w-[180px]"
                          title={row.userEmail}
                        >
                          {row.userEmail}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-[140px] max-w-[220px]">
                        <p className="text-sm truncate" title={row.caratula}>
                          {row.caratula}
                        </p>
                        {(row.numeroExpediente || row.pdfFileName) && (
                          <p
                            className="text-xs text-muted-foreground truncate"
                            title={row.numeroExpediente || row.pdfFileName}
                          >
                            {row.numeroExpediente || row.pdfFileName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.itemCount}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        <span className="inline-flex items-center justify-end gap-1">
                          {row.tokenUsage.inputTokens.toLocaleString('es-AR')}
                          {row.tokenUsageEstimated && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal">
                              est.
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row.tokenUsage.outputTokens.toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-medium">
                        {row.tokenUsage.totalTokens.toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-medium whitespace-nowrap">
                        {formatUsdCost(row.costUsd)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {rows.length > 0 && summary && (
            <p className="text-xs text-muted-foreground text-right tabular-nums">
              Subtotal filtrado: {formatTokenCount(summary.totalInputTokens)} in ·{' '}
              {formatTokenCount(summary.totalOutputTokens)} out ·{' '}
              {formatTokenCount(summary.totalTokens)} total · {formatUsdCost(summary.totalCostUsd)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
