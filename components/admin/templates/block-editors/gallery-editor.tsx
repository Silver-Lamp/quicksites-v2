'use client';

// Editor for the gallery block: manage photos (URL + caption) and the column count.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type Img = { url: string; caption: string; alt: string };

const str = (v: any) => (v == null ? '' : String(v));
const norm = (arr: any): Img[] =>
  (Array.isArray(arr) ? arr : []).map((i: any) => ({ url: str(i?.url), caption: str(i?.caption), alt: str(i?.alt) }));

export default function GalleryEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [title, setTitle] = React.useState<string>(typeof c.title === 'string' ? c.title : 'Gallery');
  const [columns, setColumns] = React.useState<number>(Math.min(4, Math.max(2, Number(c.columns) || 3)));
  const [items, setItems] = React.useState<Img[]>(() => norm(c.images));
  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setTitle(typeof cc.title === 'string' ? cc.title : 'Gallery');
    setColumns(Math.min(4, Math.max(2, Number(cc.columns) || 3)));
    setItems(norm(cc.images));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  const toContent = (t: string, cols: number, list: Img[]) => ({ ...(block.content as any), title: t.trim(), columns: cols, images: list });
  function apply(next: { t?: string; cols?: number; list?: Img[] }) {
    const t = next.t ?? title, cols = next.cols ?? columns, list = next.list ?? items;
    setTitle(t); setColumns(cols); setItems(list);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(t, cols, list) } as any }));
  }
  const setItem = (i: number, patch: Partial<Img>) => apply({ list: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const add = () => apply({ list: [...items, { url: '', caption: '', alt: '' }] });
  const remove = (i: number) => apply({ list: items.filter((_, idx) => idx !== i) });

  if (block.type !== 'gallery') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={title} onChange={(e) => apply({ t: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label>Columns</Label>
        <div className="flex gap-2">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => apply({ cols: n })}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${columns === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Photo {i + 1}</Label>
            <button type="button" onClick={() => remove(i)} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
          </div>
          <Input value={it.url} onChange={(e) => setItem(i, { url: e.target.value })} placeholder="Image URL" />
          <Input value={it.caption} onChange={(e) => setItem(i, { caption: e.target.value })} placeholder="Caption (optional)" />
        </div>
      ))}

      <Button variant="secondary" onClick={add}>+ Add photo</Button>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(title, columns, items) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
