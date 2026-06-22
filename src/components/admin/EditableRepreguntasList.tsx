'use client';

import { useRef, useState } from 'react';
import { Check, GripVertical, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DestinatarioPregunta, RepreguntaItem } from '@/lib/audiencia-session-types';
import { cn } from '@/lib/utils';

function moveItem(arr: RepreguntaItem[], from: number, to: number): RepreguntaItem[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const DESTINATARIO_LABEL: Record<DestinatarioPregunta, string> = {
  testigo: 'Al testigo',
  todos: 'A todos',
};

type EditableRepreguntasListProps = {
  items: RepreguntaItem[];
  onChange: (items: RepreguntaItem[]) => void;
  itemClassName?: string;
  addPlaceholder?: string;
  emptyMessage?: string;
};

export function EditableRepreguntasList({
  items,
  onChange,
  itemClassName,
  addPlaceholder = 'Agregar pregunta manual...',
  emptyMessage = 'Sin preguntas. Agregá una manualmente o esperá sugerencias de la IA.',
}: EditableRepreguntasListProps) {
  const [nueva, setNueva] = useState('');
  const [destinatarioNuevo, setDestinatarioNuevo] = useState<DestinatarioPregunta>('testigo');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editDestinatario, setEditDestinatario] = useState<DestinatarioPregunta>('testigo');
  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const agregar = () => {
    const text = nueva.trim();
    if (!text) return;
    onChange([...items, { texto: text, destinatario: destinatarioNuevo }]);
    setNueva('');
  };

  const eliminar = (index: number) => {
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditText('');
    }
    onChange(items.filter((_, i) => i !== index));
  };

  const iniciarEdicion = (index: number) => {
    setEditingIndex(index);
    setEditText(items[index]?.texto ?? '');
    setEditDestinatario(items[index]?.destinatario ?? 'testigo');
  };

  const cancelarEdicion = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const guardarEdicion = (index: number) => {
    const text = editText.trim();
    if (!text) {
      eliminar(index);
      return;
    }
    onChange(
      items.map((item, i) =>
        i === index ? { texto: text, destinatario: editDestinatario } : item
      )
    );
    setEditingIndex(null);
    setEditText('');
  };

  const finalizarDrag = () => {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDropIndex(null);
  };

  const reordenar = (toIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === toIndex) {
      finalizarDrag();
      return;
    }
    onChange(moveItem(items, fromIndex, toIndex));
    finalizarDrag();
  };

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((pregunta, index) => {
            const isEditing = editingIndex === index;
            return (
              <li
                key={`${index}-${pregunta.texto.slice(0, 24)}-${pregunta.destinatario}`}
                draggable={!isEditing}
                onDragStart={() => {
                  if (isEditing) return;
                  dragIndexRef.current = index;
                  setDraggingIndex(index);
                }}
                onDragEnd={finalizarDrag}
                onDragOver={(e) => {
                  if (isEditing) return;
                  e.preventDefault();
                  setDropIndex(index);
                }}
                onDrop={(e) => {
                  if (isEditing) return;
                  e.preventDefault();
                  reordenar(index);
                }}
                className={cn(
                  'group flex items-start gap-2 rounded-lg border px-2 py-2 text-sm transition-shadow',
                  !isEditing && 'cursor-grab active:cursor-grabbing',
                  itemClassName,
                  draggingIndex === index && 'opacity-40',
                  dropIndex === index && draggingIndex !== null && 'ring-2 ring-primary/50',
                  isEditing && 'ring-2 ring-primary/40'
                )}
              >
                <GripVertical
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60',
                    isEditing && 'opacity-30'
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {isEditing ? (
                    <>
                      <Tabs
                        value={editDestinatario}
                        onValueChange={(v) => setEditDestinatario(v as DestinatarioPregunta)}
                      >
                        <TabsList className="h-8 w-full grid grid-cols-2">
                          <TabsTrigger value="testigo" className="text-xs">
                            Al testigo
                          </TabsTrigger>
                          <TabsTrigger value="todos" className="text-xs">
                            A todos
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[72px] resize-y text-sm bg-background"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            guardarEdicion(index);
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelarEdicion();
                          }
                        }}
                      />
                    </>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => iniciarEdicion(index)}
                      title="Clic para editar"
                    >
                      <Badge
                        variant={pregunta.destinatario === 'todos' ? 'secondary' : 'outline'}
                        className="mb-1.5 text-[10px] font-normal"
                      >
                        {DESTINATARIO_LABEL[pregunta.destinatario]}
                      </Badge>
                      <p className="font-medium leading-snug hover:text-primary">{pregunta.texto}</p>
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary"
                        aria-label="Guardar edición"
                        onClick={() => guardarEdicion(index)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        aria-label="Cancelar edición"
                        onClick={cancelarEdicion}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground opacity-70 hover:text-primary hover:opacity-100"
                        aria-label="Editar pregunta"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => iniciarEdicion(index)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground opacity-70 hover:text-destructive hover:opacity-100"
                        aria-label="Eliminar pregunta"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => eliminar(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-2">
        <Tabs
          value={destinatarioNuevo}
          onValueChange={(v) => setDestinatarioNuevo(v as DestinatarioPregunta)}
        >
          <TabsList className="h-8 w-full grid grid-cols-2">
            <TabsTrigger value="testigo" className="text-xs">
              Al testigo
            </TabsTrigger>
            <TabsTrigger value="todos" className="text-xs">
              A todos
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder={addPlaceholder}
            className="text-sm bg-background"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                agregar();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={!nueva.trim()}
            aria-label="Agregar pregunta"
            onClick={agregar}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {items.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Clic en una pregunta o en ✎ para editarla.
          {items.length > 1 ? ' Arrastrá con ≡ para reordenar.' : ''}
        </p>
      )}
    </div>
  );
}
