'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaItem, ItemTestigo } from '@/types/control-prueba';
import { audienciaEstaFijadaParaCedula } from '@/lib/control-prueba-audiencia-prueba';
import { cedulasAudienciaDePrueba } from '@/lib/control-prueba-subprocesos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarClock, Plus, RotateCcw, Trash2, UserX, Users } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  onReintentarCedula?: (destinatario: string) => void;
  onCrearMandamiento?: (testigoNombre: string) => void;
  compact?: boolean;
};

export function muestraBloqueAudienciaPrueba(item: ControlPruebaItem): boolean {
  const esTestimonial = item.tipo === 'testimonial' || item.tipo === 'audiencia_testimonial';
  if (item.estado === 'postpuesta_juez') return true;
  if (esTestimonial) return true;
  return !audienciaEstaFijadaParaCedula(item);
}

export function ControlPruebaAudienciaPruebaBlock({
  item,
  allItems,
  onUpdate,
  onReintentarCedula,
  onCrearMandamiento,
  compact,
}: Props) {
  const ap = item.audienciaPrueba ?? {};
  const postergada = item.estado === 'postpuesta_juez';
  const fijada = item.estado === 'audiencia_fijada';
  const esTestimonial = item.tipo === 'testimonial' || item.tipo === 'audiencia_testimonial';
  const testigos = item.testigos ?? [];

  const cedulasVinculadas = useMemo(
    () => cedulasAudienciaDePrueba(allItems, item.id),
    [allItems, item.id],
  );

  const cedulaDeTestigo = (nombre: string) =>
    cedulasVinculadas.find((c) => c.diligencia?.destinatario === nombre);

  const updateTestigo = (id: string, patch: Partial<ItemTestigo>) => {
    onUpdate({ testigos: testigos.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  };

  const addTestigo = () => {
    onUpdate({ testigos: [...testigos, { id: crypto.randomUUID(), nombre: '' }] });
  };

  const removeTestigo = (id: string) => {
    onUpdate({ testigos: testigos.filter((t) => t.id !== id) });
  };

  return (
    <div className={cn('rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3', compact && 'p-2')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-primary">
          <CalendarClock className="h-3.5 w-3.5" />
          Audiencia {item.tipo === 'confesional' ? 'confesional' : 'testimonial'}
        </Label>
        {postergada ? (
          <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-800 bg-orange-50">
            Postergada por el juez
          </Badge>
        ) : fijada ? (
          <Badge variant="outline" className="text-[10px] border-teal-400 text-teal-800 bg-teal-50">
            Audiencia fijada
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Sin fijar
          </Badge>
        )}
      </div>

      {esTestimonial && (
        <div className="border-t border-primary/15 pt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Testigos ofrecidos
            </Label>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addTestigo}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Agregar testigo
            </Button>
          </div>
          {testigos.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">
              Sin testigos cargados. Si declaran en días distintos, conviene una prueba testimonial por audiencia.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {testigos.map((testigo) => {
                const cedula = cedulaDeTestigo(testigo.nombre);
                return (
                  <li key={testigo.id} className="flex flex-wrap items-start gap-1.5 rounded border bg-background p-1.5">
                    <Input
                      value={testigo.nombre}
                      onChange={(e) => updateTestigo(testigo.id, { nombre: e.target.value })}
                      placeholder="Nombre del testigo"
                      className="h-7 text-xs flex-1 min-w-[140px]"
                    />
                    {fijada && testigo.nombre.trim() && cedula && String(cedula.estado) === 'resultado_negativo' && onReintentarCedula && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] shrink-0 border-red-300 text-red-800"
                        onClick={() => onReintentarCedula(testigo.nombre)}
                        title="Cédula rebotada — generar nuevo intento de notificación"
                      >
                        <RotateCcw className="h-3 w-3 mr-0.5" />
                        Reintentar
                      </Button>
                    )}
                    {fijada && testigo.nombre.trim() && onCrearMandamiento && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] shrink-0 text-muted-foreground"
                        onClick={() => onCrearMandamiento(testigo.nombre)}
                        title="El testigo, ya notificado, no se presentó a la audiencia"
                      >
                        <UserX className="h-3 w-3 mr-0.5" />
                        No compareció
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeTestigo(testigo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {postergada && (
        <div>
          <Label className="text-[10px] text-muted-foreground">Motivo / actuación de postergación</Label>
          <Textarea
            value={ap.motivoPostergacion ?? ''}
            onChange={(e) => onUpdate({ audienciaPrueba: { ...ap, motivoPostergacion: e.target.value || null } })}
            rows={2}
            className="mt-1 text-xs min-h-[48px]"
            placeholder="Ej: el juez dejó la prueba para más adelante..."
          />
        </div>
      )}

      {!postergada && !fijada && (
        <p className="text-[10px] text-muted-foreground">
          Cambiá el estado a <strong>Audiencia fijada</strong> para crear el evento en Audiencias fijadas; ahí
          cargás fecha, hora y cédulas.
        </p>
      )}
      {fijada && esTestimonial && (
        <p className="text-[10px] text-muted-foreground">
          Las cédulas se gestionan en la audiencia vinculada (Audiencias fijadas).
        </p>
      )}
    </div>
  );
}
