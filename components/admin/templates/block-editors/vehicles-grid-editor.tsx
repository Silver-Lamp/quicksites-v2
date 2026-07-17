'use client';

// Editor for vehicles_grid: add/remove cars with year/make/model/trim/price/mileage/
// photo + a per-vehicle About That embed id for the "hear the walkaround" audio.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type V = { year: string; make: string; model: string; trim: string; price: string; mileage: string; status: string; image_url: string; cta_link: string; about_that_embed_id: string };

const str = (v: any) => (v == null ? '' : String(v));
const norm = (arr: any): V[] =>
  (Array.isArray(arr) ? arr : []).map((v: any) => ({
    year: str(v?.year), make: str(v?.make), model: str(v?.model), trim: str(v?.trim), price: str(v?.price),
    mileage: str(v?.mileage), status: str(v?.status) || 'Available', image_url: str(v?.image_url),
    cta_link: str(v?.cta_link) || '#contact', about_that_embed_id: str(v?.about_that_embed_id),
  }));

export default function VehiclesGridEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [title, setTitle] = React.useState<string>(typeof c.title === 'string' ? c.title : 'Current Inventory');
  const [items, setItems] = React.useState<V[]>(() => norm(c.vehicles));
  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setTitle(typeof cc.title === 'string' ? cc.title : 'Current Inventory');
    setItems(norm(cc.vehicles));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  const toContent = (t: string, list: V[]) => ({ ...(block.content as any), title: t.trim(), vehicles: list });
  function apply(t: string, list: V[]) {
    setTitle(t); setItems(list);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(t, list) } as any }));
  }
  const setItem = (i: number, patch: Partial<V>) => apply(title, items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => apply(title, [...items, { year: '', make: '', model: '', trim: '', price: '', mileage: '', status: 'Available', image_url: '', cta_link: '#contact', about_that_embed_id: '' }]);
  const remove = (i: number) => apply(title, items.filter((_, idx) => idx !== i));

  if (block.type !== 'vehicles_grid') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={title} onChange={(e) => apply(e.target.value, items)} />
      </div>

      {items.map((v, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Vehicle {i + 1}</Label>
            <button type="button" onClick={() => remove(i)} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Input value={v.year} onChange={(e) => setItem(i, { year: e.target.value })} placeholder="Year" />
            <Input value={v.make} onChange={(e) => setItem(i, { make: e.target.value })} placeholder="Make" />
            <Input value={v.model} onChange={(e) => setItem(i, { model: e.target.value })} placeholder="Model" />
            <Input value={v.trim} onChange={(e) => setItem(i, { trim: e.target.value })} placeholder="Trim" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input value={v.price} onChange={(e) => setItem(i, { price: e.target.value })} placeholder="$18,995" />
            <Input value={v.mileage} onChange={(e) => setItem(i, { mileage: e.target.value })} placeholder="42,150 mi" />
            <Input value={v.status} onChange={(e) => setItem(i, { status: e.target.value })} placeholder="Available" />
          </div>
          <Input value={v.image_url} onChange={(e) => setItem(i, { image_url: e.target.value })} placeholder="Photo URL" />
          <Input value={v.about_that_embed_id} onChange={(e) => setItem(i, { about_that_embed_id: e.target.value })} placeholder="About That embed id — “hear the walkaround” (optional)" />
        </div>
      ))}

      <Button variant="secondary" onClick={add}>+ Add vehicle</Button>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(title, items) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
