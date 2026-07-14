'use client';

import type { CostByPeriod } from '@/lib/gemini-token-pricing';
import { formatUsdCost } from '@/lib/gemini-token-pricing';
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
import { CalendarDays } from 'lucide-react';

export function CostByPeriodPanels({
  periods,
  entityLabel,
}: {
  periods: CostByPeriod;
  entityLabel: string;
}) {
  if (periods.byMonth.length === 0 && periods.byYear.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Costo por mes
          </CardTitle>
          <CardDescription>
            Subtotal USD de {entityLabel} agrupado por mes (fecha de actualización).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto max-h-72 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Costo USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.byMonth.map((b) => (
                  <TableRow key={b.key}>
                    <TableCell className="capitalize text-sm">{b.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{b.count}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium whitespace-nowrap">
                      {formatUsdCost(b.costUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Costo por año
          </CardTitle>
          <CardDescription>
            Subtotal USD de {entityLabel} agrupado por año.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Año</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Costo USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.byYear.map((b) => (
                  <TableRow key={b.key}>
                    <TableCell className="text-sm">{b.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{b.count}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium whitespace-nowrap">
                      {formatUsdCost(b.costUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
