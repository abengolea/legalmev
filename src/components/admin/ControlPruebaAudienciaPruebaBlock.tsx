'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaItem, ItemTestigo } from '@/types/control-prueba';
import { patchAudienciaPrueba } from '@/lib/control-prueba-audiencia-prueba';
import { hijosDePadre } from '@/lib/control-prueba-subprocesos';
import { getEstadoConfig } from '@/lib/control-prueba';
import { evaluarAlertaItem, ALERTA_NIVEL_CONFIG } from '@/lib/control-prueba-alertas';
import { diasHabilesHasta, etiquetaDiasHabiles } from '@/lib/control-prueba-plazos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ControlPruebaDeferredInput } from '@/components/admin/ControlPruebaDeferredInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarClock, ChevronRight, Plus, RotateCcw, Trash2, UserX, Users } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  allItems: ControlPruebaItem[];
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  onAddCedula?: (destinatario?: string) => void;
  onReintentarCedula?: (destinatario: string) => void;
  onCrearMandamiento?: (testigoNombre: string) => void;
  onFocusSubproceso?: (itemId: string) => void;
  compact?: boolean;
};

export function ControlPruebaAudienciaPruebaBlock({
  item,
  allItems,
  onUpdate,
  onAddCedula,
  onReintentarCedula,
  onCrearMandamiento,
  onFocusSubproceso,
  compact,
}: Props) {
  const ap = item.audienciaPrueba ?? {};
  const postergada = item.estado === 'postpuesta_juez';
  const fijada = item.estado === 'audiencia_fijada';
  const esTestimonial = item.tipo === 'testimonial' || item.tipo === 'audiencia_testimonial';
  const testigos = item.testigos ?? [];

  const cedulasVinculadas = useMemo(
    () =>
      hijosDePadre(item.id, allItems).filter(
        (h) => h.vinculo?.rol === 'cedula_audiencia' && h.categoria === 'diligencia',
      ),
    [allItems, item.id],
  );

  const cedulaDeTestigo = (nombre: string) =>
    cedulasVinculadas.find((c) => c.diligencia?.destinatario === nombre);

  const cedulasHuerfanas = useMemo(
    () =>
      esTestimonial && testigos.length > 0
        ? cedulasVinculadas.filter((c) => !testigos.some((t) => t.nombre === c.diligencia?.destinatario))
        : [],
    [cedulasVinculadas, esTestimonial, testigos],
  );

  const updateAp = (patch: Parameters<typeof patchAudienciaPrueba>[1]) => {
    onUpdate(patchAudienciaPrueba(item, patch));
  };

  const updateTestigo = (id: string, patch: Partial<ItemTestigo>) => {
    onUpdate({ testigos: testigos.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  };

  const addTestigo = () => {
    onUpdate({ testigos: [...testigos, { id: crypto.randomUUID(), nombre: '', domicilio: null }] });
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
        {cedulasVinculadas.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {cedulasVinculadas.length} cédula(s) en Comunicaciones
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
                const cfg = cedula ? getEstadoConfig('diligencia', String(cedula.estado)) : null;
                return (
                  <li key={testigo.id} className="flex flex-wrap items-start gap-1.5 rounded border bg-background p-1.5">
                    <Input
                      value={testigo.nombre}
                      onChange={(e) => updateTestigo(testigo.id, { nombre: e.target.value })}
                      placeholder="Nombre del testigo"
                      className="h-7 text-xs flex-1 min-w-[140px]"
                    />
                    <Input
                      value={testigo.domicilio ?? ''}
                      onChange={(e) => updateTestigo(testigo.id, { domicilio: e.target.value || null })}
                      placeholder="Domicilio (opcional)"
                      className="h-7 text-xs flex-1 min-w-[140px]"
                    />
                    {fijada && testigo.nombre.trim() && (
                      cedula ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] shrink-0"
                            onClick={() => onFocusSubproceso?.(cedula.id)}
                          >
                            {cfg && (
                              <span className={cn('inline-flex items-center gap-1 px-1 rounded border mr-1', cfg.badgeClass)}>
                                {cfg.label}
                              </span>
                            )}
                            Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                          </Button>
                          {String(cedula.estado) === 'resultado_negativo' && onReintentarCedula && (
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
                        </>
                      ) : (
                        onAddCedula && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] shrink-0"
                            onClick={() => onAddCedula(testigo.nombre)}
                          >
                            <Plus className="h-3 w-3 mr-0.5" />
                            Cédula
                          </Button>
                        )
                      )
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
          Cambie el estado a <strong>Audiencia fijada</strong> cuando el juez confirme día y hora. Se creará la cédula
          en Comunicaciones automáticamente.
        </p>
      )}

      {fijada && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-[10px]">Fecha audiencia</Label>
              <ControlPruebaDeferredInput
                type="date"
                value={ap.fechaAudiencia ?? ''}
                onCommit={(fechaAudiencia) => updateAp({ fechaAudiencia })}
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[10px]">Hora</Label>
              <ControlPruebaDeferredInput
                type="time"
                value={ap.horaAudiencia ?? ''}
                onCommit={(horaAudiencia) => updateAp({ horaAudiencia })}
                className="h-8 text-xs mt-0.5"
              />
            </div>
            <div>
              <Label className="text-[10px]">Sala / Juzgado</Label>
              <Input
                value={ap.sala ?? ''}
                onChange={(e) => updateAp({ sala: e.target.value || null })}
                className="h-8 text-xs mt-0.5"
                placeholder="Sala, juzgado..."
              />
            </div>
          </div>

          <div className="border-t border-primary/15 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium">Comunicaciones vinculadas</Label>
              {!(esTestimonial && testigos.length > 0) && onAddCedula && ap.fechaAudiencia && ap.horaAudiencia && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAddCedula()}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Agregar cédula
                </Button>
              )}
            </div>
            {esTestimonial && testigos.length > 0 ? (
              <p className="text-[10px] text-muted-foreground">
                La cédula de cada testigo se gestiona arriba, junto a su nombre.
                {cedulasHuerfanas.length > 0 && ' Hay cédulas sin testigo asociado (nombre cambiado o eliminado):'}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Una sola cédula por ítem en Comunicaciones. Acá ves el estado actual (sin duplicar datos).
              </p>
            )}

            {(esTestimonial && testigos.length > 0 ? cedulasHuerfanas : cedulasVinculadas).length === 0 ? (
              esTestimonial && testigos.length > 0 ? null : (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  {ap.fechaAudiencia && ap.horaAudiencia
                    ? 'Al guardar con audiencia fijada se crea la cédula en Comunicaciones.'
                    : 'Complete fecha y hora para generar la cédula.'}
                </p>
              )
            ) : (
              <ul className="space-y-1.5">
                {(esTestimonial && testigos.length > 0 ? cedulasHuerfanas : cedulasVinculadas).map((ced) => {
                  const cfg = getEstadoConfig('diligencia', String(ced.estado));
                  const alerta = evaluarAlertaItem(ced);
                  const dias = ced.fechaLimite ? diasHabilesHasta(ced.fechaLimite) : null;
                  return (
                    <li
                      key={ced.id}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-xs',
                        alerta?.nivel === 'rojo' && 'border-red-300 bg-red-50/40',
                        alerta?.nivel === 'amarillo' && 'border-amber-300 bg-amber-50/40',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{ced.vinculo?.vinculoLabel ?? ced.descripcion}</p>
                        <p className="text-[10px] text-muted-foreground">
                          <span className={cn('inline-flex items-center gap-1 px-1 rounded border', cfg.badgeClass)}>
                            {cfg.label}
                          </span>
                          {ced.diligencia?.destinatario && ` · ${ced.diligencia.destinatario}`}
                          {dias !== null && (
                            <span className={cn('ml-1', alerta && ALERTA_NIVEL_CONFIG[alerta.nivel].textClass)}>
                              · {etiquetaDiasHabiles(dias)}
                            </span>
                          )}
                        </p>
                      </div>
                      {onFocusSubproceso && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] shrink-0"
                          onClick={() => onFocusSubproceso(ced.id)}
                        >
                          Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
