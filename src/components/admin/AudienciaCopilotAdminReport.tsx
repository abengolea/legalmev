'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '@/lib/firebase';
import { safeResJson } from '@/lib/utils';
import { formatTokenCount } from '@/lib/ai-token-usage';
import type {
  AudienciaCopilotReportRow,
  AudienciaCopilotReportSummary,
} from '@/lib/audiencia-copilot-admin-report';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Coins, Gavel, Loader2, RefreshCw, Search } from 'lucide-react';

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
  summary: AudienciaCopilotReportSummary | null;
  loading: boolean;
}) {
  if (loading || !summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Audiencias registradas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{summary.totalSessions}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.pruebaSessions} prueba · {summary.pagadasSessions} pagas
          </p>
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">P/R anotadas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{summary.totalIntercambios}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Total acumulado: {formatTokenCount(summary.totalTokens)} tokens
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AudienciaCopilotAdminReport() {
  const [rows, setRows] = useState<AudienciaCopilotReportRow[]>([]);
  const [summary, setSummary] = useState<AudienciaCopilotReportSummary | null>(null);
  const [summaryAll, setSummaryAll] = useState<AudienciaCopilotReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [tipoFilter, setTipoFilter] = useState<'all' | 'prueba' | 'pagada'>('all');
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
      if (tipoFilter !== 'all') params.set('tipo', tipoFilter);
      if (searchDebounced) params.set('q', searchDebounced);
      const qs = params.toString();
      const res = await fetch(
        `/api/admin/audiencia-copilot/report${qs ? `?${qs}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await safeResJson<{
        ok: boolean;
        rows?: AudienciaCopilotReportRow[];
        summary?: AudienciaCopilotReportSummary;
        summaryAll?: AudienciaCopilotReportSummary;
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
  }, [tipoFilter, searchDebounced]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const filteredLabel = useMemo(() => {
    if (tipoFilter === 'all' && !searchDebounced) return null;
    const parts: string[] = [];
    if (tipoFilter !== 'all') parts.push(tipoFilter === 'prueba' ? 'solo prueba' : 'solo pagas');
    if (searchDebounced) parts.push(`búsqueda: “${searchDebounced}”`);
    return parts.join(' · ');
  }, [tipoFilter, searchDebounced]);

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-x-hidden">
      <SummaryCards summary={summaryAll ?? summary} loading={loading && !summary} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5 text-primary" />
                Seguimiento de audiencias
              </CardTitle>
              <CardDescription>
                Todas las sesiones del Copiloto de Audiencias: prueba gratuita y pagas, con consumo
                de tokens por sesión.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void fetchReport()}>
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
                placeholder="Buscar por usuario, email o título…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={tipoFilter}
              onValueChange={(v) => setTipoFilter(v as typeof tipoFilter)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="prueba">Solo prueba</SelectItem>
                <SelectItem value="pagada">Solo pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredLabel && (
            <p className="text-xs text-muted-foreground">
              Filtro activo: {filteredLabel}
              {summary && (
                <>
                  {' '}
                  — {summary.totalSessions} resultado{summary.totalSessions === 1 ? '' : 's'}
                </>
              )}
            </p>
          )}

          {truncated && (
            <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              Se muestran las últimas 500 audiencias. Contactá soporte si necesitás un reporte
              histórico completo.
            </p>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Audiencia</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Decl.</TableHead>
                  <TableHead className="text-right">P/R</TableHead>
                  <TableHead className="text-right">Tokens in</TableHead>
                  <TableHead className="text-right">Tokens out</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Cargando audiencias…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      No hay audiencias que coincidan con el filtro.
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
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]" title={row.userEmail}>
                          {row.userEmail}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-[140px] max-w-[220px]">
                        <p className="text-sm truncate" title={row.titulo}>
                          {row.titulo}
                        </p>
                        {row.pdfFileName && (
                          <p className="text-xs text-muted-foreground truncate" title={row.pdfFileName}>
                            {row.pdfFileName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.tipo === 'pagada' ? (
                          <Badge className="bg-primary/90">Pagada</Badge>
                        ) : (
                          <Badge variant="secondary">Prueba</Badge>
                        )}
                        {row.pagoMonto != null && (
                          <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                            ${row.pagoMonto.toLocaleString('es-AR')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.testigoCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.intercambiosTotal}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row.tokenUsage.inputTokens.toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row.tokenUsage.outputTokens.toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-medium">
                        {row.tokenUsage.totalTokens.toLocaleString('es-AR')}
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
              {formatTokenCount(summary.totalTokens)} total
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
