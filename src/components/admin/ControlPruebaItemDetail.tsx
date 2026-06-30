'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ControlPruebaItem, ControlPruebaExpediente } from '@/types/control-prueba';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { progresoSubtareas } from '@/lib/control-prueba-subtareas';
import {
  generarPlantillaDiligencia,
  inferirFueroPlantilla,
  checklistInicialAudiencia,
} from '@/lib/control-prueba-plantillas';
import { resolveCategoria, esAudienciaOfrecida } from '@/lib/control-prueba';
import {
  esCedulaNotificacionAudiencia,
  esCedulaIntimacionDocumental,
  getMedioCedulaNotificacion,
  patchMedioCedulaNotificacion,
} from '@/lib/control-prueba-cedula-notif';
import { esOficio, oficioRelacionadoLabel } from '@/lib/control-prueba-oficio';
import { requiereAudienciaPrueba } from '@/lib/control-prueba-audiencia-prueba';
import { requiereFlujoDocumentalEnPoder, esOficioInformativaAutenticidad } from '@/lib/control-prueba-documental-poder';
import { requiereFlujoAutenticidadDocumental } from '@/lib/control-prueba-documental-autenticidad';
import type { CedulaNotifMedio } from '@/types/control-prueba';
import { ControlPruebaAudienciaPruebaBlock } from '@/components/admin/ControlPruebaAudienciaPruebaBlock';
import { ControlPruebaDocumentalEnPoderBlock } from '@/components/admin/ControlPruebaDocumentalEnPoderBlock';
import { ControlPruebaDocumentalAutenticidadBlock } from '@/components/admin/ControlPruebaDocumentalAutenticidadBlock';
import { ControlPruebaPericialMovimientosBlock } from '@/components/admin/ControlPruebaPericialMovimientosBlock';
import { ControlPruebaResultadosForm } from '@/components/admin/ControlPruebaResultadosDialog';
import type { TipoTramitePericial } from '@/types/control-prueba';
import { ExternalLink, FileText, History, Link2, Plus, Trash2, ClipboardCheck } from 'lucide-react';

type Props = {
  item: ControlPruebaItem;
  expediente: Partial<ControlPruebaExpediente>;
  allItems?: ControlPruebaItem[];
  pruebaItems?: ControlPruebaItem[];
  diligenciaItems?: ControlPruebaItem[];
  onUpdate: (patch: Partial<ControlPruebaItem>) => void;
  onAddCedulaVinculada?: (parentId: string, destinatario?: string) => void;
  onReintentarCedulaTestigo?: (parentId: string, destinatario: string) => void;
  onCrearMandamientoTestigo?: (parentId: string, testigoNombre: string) => void;
  onCrearOficioAclaracion?: (parentId: string) => void;
  onCrearOficioReiteracion?: (parentId: string) => void;
  onAddMovimientoPericial?: (parentId: string, rol: TipoTramitePericial) => void;
  onUpdateMovimientoPericial?: (movimientoId: string, patch: Partial<ControlPruebaItem>) => void;
  onRemoveMovimientoPericial?: (movimientoId: string) => void;
  onFocusItem?: (itemId: string) => void;
  compact?: boolean;
};

export function ControlPruebaItemDetail({
  item,
  expediente,
  allItems = [],
  pruebaItems = [],
  diligenciaItems = [],
  onUpdate,
  onAddCedulaVinculada,
  onReintentarCedulaTestigo,
  onCrearMandamientoTestigo,
  onCrearOficioAclaracion,
  onCrearOficioReiteracion,
  onAddMovimientoPericial,
  onUpdateMovimientoPericial,
  onRemoveMovimientoPericial,
  onFocusItem,
  compact,
}: Props) {
  const cat = resolveCategoria(item);
  const prog = progresoSubtareas(item);
  const [showResultadosForm, setShowResultadosForm] = useState(false);

  const updateSubtarea = (subId: string, patch: { completada?: boolean; observaciones?: string | null }) => {
    const subs = (item.subtareas ?? []).map((s) => (s.id === subId ? { ...s, ...patch } : s));
    onUpdate({ subtareas: subs });
  };

  const addAdjunto = () => {
    const adjuntos = [
      ...(item.adjuntos ?? []),
      { id: crypto.randomUUID(), nombre: 'Documento MEV', url: '', tipo: 'link' as const },
    ];
    onUpdate({ adjuntos });
  };

  const updateAdjunto = (adjId: string, patch: { nombre?: string; url?: string }) => {
    onUpdate({
      adjuntos: (item.adjuntos ?? []).map((a) => (a.id === adjId ? { ...a, ...patch } : a)),
    });
  };

  const removeAdjunto = (adjId: string) => {
    onUpdate({ adjuntos: (item.adjuntos ?? []).filter((a) => a.id !== adjId) });
  };

  const generarPlantilla = () => {
    const fuero = inferirFueroPlantilla(expediente.fuero);
    const texto = generarPlantillaDiligencia(item.tipo, fuero, {
      juzgado: expediente.juzgado,
      numeroExpediente: expediente.numeroExpediente,
      caratula: expediente.caratula,
      destinatario: item.diligencia?.destinatario,
      objeto: item.diligencia?.objeto ?? item.descripcion,
    });
    onUpdate({
      diligencia: { ...item.diligencia, plantillaTexto: texto },
    });
  };

  const ensureChecklist = () => {
    if (item.audiencia?.checklist?.length) return;
    onUpdate({
      audiencia: { ...item.audiencia, checklist: checklistInicialAudiencia(item.tipo) },
    });
  };

  return (
    <div className={cn('border-t bg-muted/20 px-4 py-3 space-y-4', compact && 'px-2 py-2')}>
      <div>
        <Label className="text-xs text-muted-foreground">Observaciones internas</Label>
        <Textarea
          value={item.observaciones ?? ''}
          onChange={(e) => onUpdate({ observaciones: e.target.value || null })}
          rows={2}
          className="mt-1 text-xs min-h-[48px]"
          placeholder="Notas privadas del estudio..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Resultado
          </Label>
          {!showResultadosForm && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setShowResultadosForm(true)}
            >
              Cargar resultado
            </Button>
          )}
        </div>
        {showResultadosForm ? (
          <ControlPruebaResultadosForm
            item={item}
            onSave={(patch) => {
              onUpdate(patch);
              setShowResultadosForm(false);
            }}
            onCancel={() => setShowResultadosForm(false)}
          />
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Usá el formulario para registrar contestación de oficios, acta de audiencia, dictamen pericial, etc.
          </p>
        )}
      </div>

      {(cat === 'prueba' || esAudienciaOfrecida(item)) && (item.subtareas?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Subtareas ({prog.completadas}/{prog.total})
            </Label>
            {prog.total > 0 && (
              <Badge variant="outline" className="text-[10px]">{prog.pct}%</Badge>
            )}
          </div>
          <ul className="space-y-1.5">
            {(item.subtareas ?? []).map((sub) => (
              <li key={sub.id} className="flex items-start gap-2 rounded border bg-background px-2 py-1.5">
                <Checkbox
                  checked={sub.completada}
                  onCheckedChange={(v) => updateSubtarea(sub.id, { completada: v === true })}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs', sub.completada && 'line-through text-muted-foreground')}>
                    {sub.titulo}
                  </p>
                  <Input
                    value={sub.observaciones ?? ''}
                    onChange={(e) => updateSubtarea(sub.id, { observaciones: e.target.value || null })}
                    placeholder="Notas..."
                    className="mt-1 h-7 text-[10px]"
                  />
                </div>
              </li>
            ))}
          </ul>
          {cat === 'prueba' && item.tipo === 'pericial' && (
            <div className="mt-2 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px]">Plazo designación perito</Label>
                  <Input
                    type="date"
                    value={item.fechaLimite ?? ''}
                    onChange={(e) => onUpdate({ fechaLimite: e.target.value || null })}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Plazo presentación informe</Label>
                  <Input
                    type="date"
                    value={item.fechaLimiteSecundaria ?? ''}
                    onChange={(e) => onUpdate({ fechaLimiteSecundaria: e.target.value || null })}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={item.pericial?.extrañaJurisdiccion ?? false}
                  onChange={(e) =>
                    onUpdate({
                      pericial: { ...item.pericial, extrañaJurisdiccion: e.target.checked },
                    })
                  }
                  className="rounded border-input"
                />
                Pericia en extraña jurisdicción (rogatoria)
              </label>
              {(item.pericial?.extrañaJurisdiccion || item.pericial?.expedienteRogatoria) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-[10px]">Expte. formado (rogatoria)</Label>
                    <Input
                      value={item.pericial?.expedienteRogatoria ?? ''}
                      onChange={(e) =>
                        onUpdate({
                          pericial: { ...item.pericial, expedienteRogatoria: e.target.value || null },
                        })
                      }
                      placeholder="Ej: SN-XXXX-2022 San Isidro"
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Juzgado oficiado</Label>
                    <Input
                      value={item.pericial?.juzgadoOficiado ?? ''}
                      onChange={(e) =>
                        onUpdate({ pericial: { ...item.pericial, juzgadoOficiado: e.target.value } })
                      }
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-[10px]">Perito designado</Label>
                    <Input
                      value={item.pericial?.peritoDesignado ?? ''}
                      onChange={(e) =>
                        onUpdate({ pericial: { ...item.pericial, peritoDesignado: e.target.value } })
                      }
                      className="h-8 text-xs mt-0.5"
                    />
                  </div>
                </div>
              )}
              {!item.pericial?.extrañaJurisdiccion && (
                <div>
                  <Label className="text-[10px]">Perito designado</Label>
                  <Input
                    value={item.pericial?.peritoDesignado ?? ''}
                    onChange={(e) =>
                      onUpdate({ pericial: { ...item.pericial, peritoDesignado: e.target.value } })
                    }
                    className="h-8 text-xs mt-0.5"
                    placeholder="Nombre del perito..."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {cat === 'prueba' && item.tipo === 'pericial' && (
        <ControlPruebaPericialMovimientosBlock
          item={item}
          allItems={allItems}
          onUpdate={onUpdate}
          onAddMovimiento={
            onAddMovimientoPericial ? (rol) => onAddMovimientoPericial(item.id, rol) : undefined
          }
          onUpdateMovimiento={onUpdateMovimientoPericial}
          onRemoveMovimiento={onRemoveMovimientoPericial}
          compact={compact}
        />
      )}

      {esAudienciaOfrecida(item) && (
        <ControlPruebaAudienciaPruebaBlock
          item={item}
          allItems={allItems}
          onUpdate={onUpdate}
          onAddCedula={
            onAddCedulaVinculada ? (destinatario) => onAddCedulaVinculada(item.id, destinatario) : undefined
          }
          onReintentarCedula={
            onReintentarCedulaTestigo ? (destinatario) => onReintentarCedulaTestigo(item.id, destinatario) : undefined
          }
          onCrearMandamiento={
            onCrearMandamientoTestigo ? (testigoNombre) => onCrearMandamientoTestigo(item.id, testigoNombre) : undefined
          }
          onFocusSubproceso={onFocusItem}
          compact={compact}
        />
      )}

      {cat === 'prueba' && requiereFlujoDocumentalEnPoder(item.tipo) && (
        <ControlPruebaDocumentalEnPoderBlock
          item={item}
          allItems={allItems}
          onUpdate={onUpdate}
          onAddCedula={
            onAddCedulaVinculada ? (destinatario) => onAddCedulaVinculada(item.id, destinatario) : undefined
          }
          onFocusSubproceso={onFocusItem}
          compact={compact}
        />
      )}

      {cat === 'prueba' && requiereFlujoAutenticidadDocumental(item.tipo) && (
        <ControlPruebaDocumentalAutenticidadBlock
          item={item}
          allItems={allItems}
          onUpdate={onUpdate}
          onFocusSubproceso={onFocusItem}
          compact={compact}
        />
      )}

      {cat === 'diligencia' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {esCedulaNotificacionAudiencia(item) && item.tipo === 'cedula' && (
            <div className="sm:col-span-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Cédula de notificación de audiencia (papel)
              </Label>
              <div className="flex flex-wrap gap-2">
                {(['papel', 'electronica'] as CedulaNotifMedio[]).map((medio) => (
                  <Button
                    key={medio}
                    type="button"
                    size="sm"
                    variant={getMedioCedulaNotificacion(item) === medio ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => onUpdate(patchMedioCedulaNotificacion(item, medio))}
                  >
                    {medio === 'papel' ? 'Papel' : 'Electrónica'}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {getMedioCedulaNotificacion(item) === 'papel'
                  ? 'Flujo completo: presentación, libramiento, retiro, diligenciamiento y resultado.'
                  : 'Flujo reducido: pendiente → observada → librada y notificada.'}
              </p>
              {item.vinculo?.vinculoLabel && (
                <p className="text-[10px] text-muted-foreground">Vinculada a: {item.vinculo.vinculoLabel}</p>
              )}
            </div>
          )}
          {esOficioInformativaAutenticidad(item) && (
            <div className="sm:col-span-2 rounded-lg border border-fuchsia-300 bg-fuchsia-50/60 p-3 space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Oficio informativa — autenticidad documental
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Oficio para que el oficiado informe sobre la autenticidad de la documentación impugnada.
              </p>
              {item.vinculo?.vinculoLabel && (
                <p className="text-[10px] text-muted-foreground">Vinculado a: {item.vinculo.vinculoLabel}</p>
              )}
            </div>
          )}
          {esCedulaIntimacionDocumental(item) && (
            <div className="sm:col-span-2 rounded-lg border border-violet-300 bg-violet-50/60 p-3 space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Cédula de intimación documental
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Intima a la contraparte para acompañar documentación en su poder.
                {item.diligencia?.plazoContestacion && (
                  <> Plazo de exhibición: <strong>{item.diligencia.plazoContestacion}</strong>.</>
                )}
              </p>
              {item.vinculo?.vinculoLabel && (
                <p className="text-[10px] text-muted-foreground">Vinculada a: {item.vinculo.vinculoLabel}</p>
              )}
            </div>
          )}
          {(item.tipo === 'cedula_electronica' || item.tipo === 'oficio_electronico') && (
            <div className="sm:col-span-2 rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-2">
              <p className="text-[10px] text-sky-900">
                {item.tipo === 'oficio_electronico' ? (
                  <>
                    <strong>Oficio electrónico:</strong> Pendiente de realización → Observada → Contestación parcial →
                    Librada y notificada
                  </>
                ) : (
                  <>
                    <strong>Flujo electrónico:</strong> Pendiente de realización → Observada → Librada y notificada
                  </>
                )}
              </p>
            </div>
          )}
          {esOficio(item) && (
            <div className="sm:col-span-2 space-y-2">
              {item.diligencia?.oficioOrigenId && (
                <p className="text-[10px] text-muted-foreground">
                  Reiteración de{' '}
                  {onFocusItem ? (
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => onFocusItem(item.diligencia!.oficioOrigenId!)}
                    >
                      {oficioRelacionadoLabel(
                        item,
                        allItems.find((i) => i.id === item.diligencia?.oficioOrigenId) ?? item,
                      )}
                    </button>
                  ) : (
                    'oficio anterior'
                  )}
                </p>
              )}
              {item.estado === 'contestacion_parcial' && (
                <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-3 space-y-2">
                  <p className="text-[10px] text-fuchsia-900">
                    Contestación parcial registrada.
                    {item.diligencia?.oficioSucesorId
                      ? ' El oficio de aclaración vinculado está en Comunicaciones.'
                      : ' Al marcar este estado se crea el oficio de aclaración automáticamente.'}
                  </p>
                  {item.diligencia?.oficioSucesorId ? (
                    <p className="text-[10px]">
                      Oficio de aclaración:{' '}
                      {onFocusItem && (
                        <button
                          type="button"
                          className="text-primary underline font-medium"
                          onClick={() => onFocusItem(item.diligencia!.oficioSucesorId!)}
                        >
                          {oficioRelacionadoLabel(
                            item,
                            allItems.find((i) => i.id === item.diligencia?.oficioSucesorId) ?? item,
                          )}
                        </button>
                      )}
                    </p>
                  ) : onCrearOficioAclaracion ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-fuchsia-300"
                      onClick={() => onCrearOficioAclaracion(item.id)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Crear oficio con aclaraciones
                    </Button>
                  ) : null}
                </div>
              )}
              {item.estado === 'vencido' && (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-2">
                  <p className="text-[10px] text-red-900">
                    Sin respuesta dentro del plazo.
                    {item.diligencia?.oficioSucesorId
                      ? ' El oficio de reiteración vinculado está en Comunicaciones.'
                      : ' Al marcar este estado se crea el oficio de reiteración automáticamente.'}
                  </p>
                  {item.diligencia?.oficioSucesorId ? (
                    <p className="text-[10px]">
                      Oficio de reiteración:{' '}
                      {onFocusItem && (
                        <button
                          type="button"
                          className="text-primary underline font-medium"
                          onClick={() => onFocusItem(item.diligencia!.oficioSucesorId!)}
                        >
                          {oficioRelacionadoLabel(
                            item,
                            allItems.find((i) => i.id === item.diligencia?.oficioSucesorId) ?? item,
                          )}
                        </button>
                      )}
                    </p>
                  ) : onCrearOficioReiteracion ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-red-300"
                      onClick={() => onCrearOficioReiteracion(item.id)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Crear oficio de reiteración
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          )}
          {item.tipo === 'cedula' && !esCedulaNotificacionAudiencia(item) && (
            <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2">
              <p className="text-[10px] text-amber-900">
                <strong>Cédula papel:</strong> flujo completo (presentada, librada, retirada, diligenciamiento, etc.)
              </p>
            </div>
          )}
          <div>
            <Label className="text-xs">Destinatario</Label>
            <Input
              value={item.diligencia?.destinatario ?? ''}
              onChange={(e) =>
                onUpdate({ diligencia: { ...item.diligencia, destinatario: e.target.value } })
              }
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div>
            <Label className="text-xs">Prueba vinculada</Label>
            <select
              value={item.diligencia?.pruebaVinculadaId ?? ''}
              onChange={(e) =>
                onUpdate({
                  diligencia: { ...item.diligencia, pruebaVinculadaId: e.target.value || null },
                })
              }
              className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">— Ninguna —</option>
              {pruebaItems.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.orden} {p.descripcion.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Objeto</Label>
            <Textarea
              value={item.diligencia?.objeto ?? ''}
              onChange={(e) => onUpdate({ diligencia: { ...item.diligencia, objeto: e.target.value } })}
              rows={2}
              className="text-xs mt-0.5"
            />
          </div>
          <div>
            <Label className="text-xs">Fecha presentación</Label>
            <Input
              type="date"
              value={item.diligencia?.fechaPresentacion ?? ''}
              onChange={(e) =>
                onUpdate({
                  diligencia: { ...item.diligencia, fechaPresentacion: e.target.value || null },
                })
              }
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div>
            <Label className="text-xs">Fecha libramiento</Label>
            <Input
              type="date"
              value={item.diligencia?.fechaLibramiento ?? ''}
              onChange={(e) =>
                onUpdate({ diligencia: { ...item.diligencia, fechaLibramiento: e.target.value || null } })
              }
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div>
            <Label className="text-xs">Fecha diligenciamiento</Label>
            <Input
              type="date"
              value={item.diligencia?.fechaDiligenciamiento ?? ''}
              onChange={(e) =>
                onUpdate({
                  diligencia: { ...item.diligencia, fechaDiligenciamiento: e.target.value || null },
                })
              }
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div>
            <Label className="text-xs">Plazo contestación</Label>
            <Input
              type="date"
              value={item.diligencia?.plazoContestacion ?? ''}
              onChange={(e) =>
                onUpdate({
                  diligencia: { ...item.diligencia, plazoContestacion: e.target.value || null },
                })
              }
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Resultado</Label>
            <Input
              value={item.diligencia?.resultado ?? ''}
              onChange={(e) => onUpdate({ diligencia: { ...item.diligencia, resultado: e.target.value } })}
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={generarPlantilla}>
              Generar plantilla
            </Button>
          </div>
          {item.diligencia?.plantillaTexto && (
            <div className="sm:col-span-2">
              <Textarea
                value={item.diligencia.plantillaTexto}
                onChange={(e) =>
                  onUpdate({ diligencia: { ...item.diligencia, plantillaTexto: e.target.value } })
                }
                rows={6}
                className="text-xs font-mono"
              />
            </div>
          )}
        </div>
      )}

      {cat === 'audiencia' && !esAudienciaOfrecida(item) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Hora</Label>
            <Input
              type="time"
              value={item.audiencia?.hora ?? ''}
              onChange={(e) => onUpdate({ audiencia: { ...item.audiencia, hora: e.target.value } })}
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div>
            <Label className="text-xs">Sala / Juzgado</Label>
            <Input
              value={item.audiencia?.sala ?? expediente.juzgado ?? ''}
              onChange={(e) => onUpdate({ audiencia: { ...item.audiencia, sala: e.target.value } })}
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div>
            <Label className="text-xs">Abogado asistente</Label>
            <Input
              value={item.audiencia?.abogadoAsistente ?? ''}
              onChange={(e) =>
                onUpdate({ audiencia: { ...item.audiencia, abogadoAsistente: e.target.value } })
              }
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div className="sm:col-span-3">
            <Label className="text-xs">Cédula de notificación vinculada</Label>
            <select
              value={item.audiencia?.cedulaVinculadaId ?? ''}
              onChange={(e) =>
                onUpdate({
                  audiencia: { ...item.audiencia, cedulaVinculadaId: e.target.value || null },
                })
              }
              className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">— Seleccionar cédula —</option>
              {diligenciaItems
                .filter((d) => d.tipo === 'cedula' || d.descripcion.toLowerCase().includes('cédula'))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.orden} {d.descripcion.slice(0, 50)}
                  </option>
                ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={item.audiencia?.cedulaNotificada ?? false}
                onChange={(e) =>
                  onUpdate({
                    audiencia: { ...item.audiencia, cedulaNotificada: e.target.checked },
                  })
                }
                className="rounded border-input"
              />
              Cédula librada y notificada antes de la audiencia
            </label>
          </div>
          <div className="sm:col-span-3">
            <Label className="text-xs">Resultado</Label>
            <Input
              value={item.audiencia?.resultado ?? ''}
              onChange={(e) => onUpdate({ audiencia: { ...item.audiencia, resultado: e.target.value } })}
              className="h-8 text-xs mt-0.5"
            />
          </div>
          <div className="sm:col-span-3">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Checklist pre-audiencia</Label>
              {!item.audiencia?.checklist?.length && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={ensureChecklist}>
                  Inicializar
                </Button>
              )}
            </div>
            <ul className="space-y-1">
              {(item.audiencia?.checklist ?? []).map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={c.completada}
                    onCheckedChange={(v) =>
                      onUpdate({
                        audiencia: {
                          ...item.audiencia,
                          checklist: (item.audiencia?.checklist ?? []).map((x) =>
                            x.id === c.id ? { ...x, completada: v === true } : x,
                          ),
                        },
                      })
                    }
                  />
                  <span className={cn(c.completada && 'line-through text-muted-foreground')}>{c.titulo}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="sm:col-span-3">
            <Label className="text-xs">Acta (texto)</Label>
            <Textarea
              value={item.audiencia?.actaTexto ?? ''}
              onChange={(e) => onUpdate({ audiencia: { ...item.audiencia, actaTexto: e.target.value } })}
              rows={3}
              className="text-xs mt-0.5"
            />
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Adjuntos / links MEV
          </Label>
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={addAdjunto}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
          </Button>
        </div>
        {(item.adjuntos ?? []).length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Sin adjuntos.</p>
        ) : (
          <ul className="space-y-1.5">
            {(item.adjuntos ?? []).map((adj) => (
              <li key={adj.id} className="flex gap-1.5">
                <Input
                  value={adj.nombre}
                  onChange={(e) => updateAdjunto(adj.id, { nombre: e.target.value })}
                  className="h-8 text-xs w-28 shrink-0"
                  placeholder="Nombre"
                />
                <Input
                  value={adj.url}
                  onChange={(e) => updateAdjunto(adj.id, { url: e.target.value })}
                  className="h-8 text-xs flex-1"
                  placeholder="URL documento MEV"
                />
                {adj.url && (
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
                    <a href={adj.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeAdjunto(adj.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(item.historial?.length ?? 0) > 0 && (
        <div>
          <Label className="text-xs font-medium flex items-center gap-1.5 mb-2">
            <History className="h-3.5 w-3.5" />
            Historial de cambios
          </Label>
          <ul className="max-h-32 overflow-y-auto space-y-1 text-[10px] text-muted-foreground">
            {[...(item.historial ?? [])].reverse().slice(0, 8).map((h) => (
              <li key={h.id} className="border-l-2 border-primary/30 pl-2">
                <span className="font-medium text-foreground">{h.campo}</span>
                {' · '}
                {new Date(h.timestamp).toLocaleString('es-AR')}
                {h.usuario && ` · ${h.usuario}`}
                <br />
                {h.valorAnterior && <span className="line-through">{h.valorAnterior}</span>}
                {h.valorAnterior && ' → '}
                <span>{h.valorNuevo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
