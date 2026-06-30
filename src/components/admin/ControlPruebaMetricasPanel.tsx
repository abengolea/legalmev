'use client';

import { useMemo } from 'react';
import type { ControlPruebaExpediente, ExpedienteHito } from '@/types/control-prueba';
import { calcularMetricas, ensureHitos } from '@/lib/control-prueba-metricas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Calendar, TrendingUp } from 'lucide-react';

const PARTE_COLORS = { actor: '#2A6A78', demandada: '#54A6A8' };

type Props = {
  expediente: ControlPruebaExpediente;
  onUpdateHitos?: (hitos: ExpedienteHito[]) => void;
};

export function ControlPruebaMetricasPanel({ expediente, onUpdateHitos }: Props) {
  const metricas = useMemo(() => calcularMetricas(expediente.items), [expediente.items]);
  const hitos = useMemo(() => ensureHitos(expediente.hitos), [expediente.hitos]);

  const comparativa = [
    { parte: 'Actor', total: metricas.actor.total, producida: metricas.actor.producida, pendiente: metricas.actor.pendiente },
    { parte: 'Demandada', total: metricas.demandada.total, producida: metricas.demandada.producida, pendiente: metricas.demandada.pendiente },
  ];

  const gaugeData = [
    { name: 'Producida', value: metricas.totalProducida, fill: '#2A6A78' },
    { name: 'Pendiente', value: metricas.totalPendiente, fill: '#54A6A8' },
  ].filter((d) => d.value > 0);

  const updateHitoFecha = (hitoId: string, fecha: string) => {
    if (!onUpdateHitos) return;
    onUpdateHitos(hitos.map((h) => (h.id === hitoId ? { ...h, fecha: fecha || null } : h)));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Producción de prueba
          </CardTitle>
          <CardDescription>
            {metricas.totalProducida} de {metricas.totalOfrecida} ítems producidos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-28 w-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gaugeData.length ? gaugeData : [{ name: 'Vacío', value: 1, fill: '#e2e8f0' }]}
                    innerRadius={32}
                    outerRadius={48}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {gaugeData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">{metricas.pctProducida}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Producida</span>
                <span className="font-medium">{metricas.totalProducida}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pendiente</span>
                <span className="font-medium">{metricas.totalPendiente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">En riesgo</span>
                <span className="font-medium text-amber-700">{metricas.enRiesgo}</span>
              </div>
              {metricas.diasEstimadosRestantes != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. días háb. restantes</span>
                  <span className="font-medium">{metricas.diasEstimadosRestantes}</span>
                </div>
              )}
            </div>
          </div>
          <Progress value={metricas.pctProducida} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actor vs Demandada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativa} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="parte" width={72} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="producida" stackId="a" fill={PARTE_COLORS.actor} name="Producida" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pendiente" stackId="a" fill="#cbd5e1" name="Pendiente" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Línea de tiempo del expediente
          </CardTitle>
          <CardDescription>Hitos procesales estimados (CPCC SCBA)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            <ul className="space-y-4 pl-10">
              {hitos.map((hito, idx) => (
                <li key={hito.id} className="relative">
                  <span
                    className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background"
                    style={{ opacity: hito.fecha ? 1 : 0.4 }}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium min-w-[140px]">
                      {hito.label ?? hito.tipo}
                    </span>
                    <Input
                      type="date"
                      value={hito.fecha ?? ''}
                      onChange={(e) => updateHitoFecha(hito.id, e.target.value)}
                      disabled={!onUpdateHitos}
                      className="h-8 w-36 text-xs"
                    />
                    {idx < hitos.length - 1 && hito.fecha && hitos[idx + 1]?.fecha && (
                      <span className="text-[10px] text-muted-foreground">
                        → siguiente hito
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
