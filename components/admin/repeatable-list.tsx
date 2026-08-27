'use client';

import { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, Copy, ChevronUp, ChevronDown } from 'lucide-react';

type RepeatableItem = { id: string; [key: string]: any };

type RepeatableListProps = {
  items: RepeatableItem[];
  onChange: (items: RepeatableItem[]) => void;
  renderItem: (item: RepeatableItem, update: (field: string, value: any) => void) => React.ReactNode;
  addLabel: string;
  newItem: () => RepeatableItem;
  itemLabel?: (item: RepeatableItem, idx: number) => string;
};

export function RepeatableList({ items, onChange, renderItem, addLabel, newItem, itemLabel }: RepeatableListProps) {
  const dragIdx = useRef<number | null>(null);

  const add = () => onChange([...items, newItem()]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const duplicate = (idx: number) => {
    const copy = { ...items[idx], id: `new-${Date.now()}` };
    const updated = [...items];
    updated.splice(idx + 1, 0, copy);
    onChange(updated);
  };
  const move = (idx: number, dir: 'up' | 'down') => {
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const updated = [...items];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    onChange(updated);
  };
  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={item.id || idx} className="rounded-xl border border-border bg-secondary/20 p-3"
          draggable
          onDragStart={() => { dragIdx.current = idx; }}
          onDragEnd={() => { dragIdx.current = null; }}
          onDragOver={(e) => { e.preventDefault(); if (dragIdx.current !== null && dragIdx.current !== idx) {
            const updated = [...items];
            const [moved] = updated.splice(dragIdx.current, 1);
            updated.splice(idx, 0, moved);
            onChange(updated);
            dragIdx.current = idx;
          }}}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground/40" />
              {itemLabel && <span className="text-xs font-medium text-muted-foreground">{itemLabel(item, idx)}</span>}
            </div>
            <div className="flex gap-0.5">
              <button onClick={() => move(idx, 'up')} className="rounded p-1 hover:bg-background"><ChevronUp className="h-3.5 w-3.5" /></button>
              <button onClick={() => move(idx, 'down')} className="rounded p-1 hover:bg-background"><ChevronDown className="h-3.5 w-3.5" /></button>
              <button onClick={() => duplicate(idx)} className="rounded p-1 hover:bg-background"><Copy className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(idx)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          {renderItem(item, (field, value) => updateItem(idx, field, value))}
        </div>
      ))}
      <button onClick={add} className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary">
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}
