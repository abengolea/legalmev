'use client';

import { useRef, useState } from 'react';
import { Check, GripVertical, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function moveItem(arr: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type EditablePreguntasListProps = {
  items: string[];
  onChange: (items: string[]) => void;
  itemClassName?: string;
  addPlaceholder?: string;
  emptyMessage?: string;
};

export function EditablePreguntasList({
  items,
  onChange,
  itemClassName,
  addPlaceholder = 'Escribí una pregunta para agregar...',
  emptyMessage = 'Sin preguntas. Agregá una manualmente o esperá sugerencias de la IA.',
}: EditablePreguntasListProps) {
  const [nueva, setNueva] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const agregar = () => {
    const text = nueva.trim();
    if (!text) return;
    onChange([...items, text]);
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
    setEditText(items[index] ?? '');
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
    onChange(items.map((item, i) => (i === index ? text : item)));
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
              key={`${index}-${pregunta.slice(0, 24)}`}
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
              {isEditing ? (
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[72px] flex-1 resize-y text-sm bg-background"
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
              ) : (
                <button
                  type="button"
                  className="flex-1 text-left font-medium leading-snug hover:text-primary"
                  onClick={() => iniciarEdicion(index)}
                  title="Clic para editar"
                >
                  {pregunta}
                </button>
              )}
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

      <div className="flex gap-2 pt-1">
        <Input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          placeholder={addPlaceholder}
          className="text-sm"
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
      {items.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Clic en una pregunta o en ✎ para editarla.
          {items.length > 1 ? ' Arrastrá con ≡ para reordenar.' : ''}
        </p>
      )}
    </div>
  );
}
