'use client';

// Editor for the Home Listings grid: title, columns, and a managed list of homes
// (each with price/address/beds/baths/photo/status/inquiry-link + an About That
// audio-tour embed id). Add / remove / reorder homes.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type Listing = {
  headline: string; address: string; price: string; status: string;
  beds: string; baths: string; sqft: string; image_url: string;
  cta_link: string; about_that_embed_id: string;
};

const BLANK: Listing = { headline: '', address: '', price: '', status: 'For sale', beds: '', baths: '', sqft: '', image_url: '', cta_link: '#contact', about_that_embed_id: '' };
const str = (v: any) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

function fromBlock(c: any) {
  return {
    title: str(c?.title) || 'Current Listings',
    columns: Number(c?.columns) === 2 ? 2 : 3,
    listings: (Array.isArray(c?.listings) ? c.listings : []).map((l: any) => ({ ...BLANK, ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, str(l?.[k]) || (BLANK as any)[k]])) })) as Listing[],
  };
}

export default function ListingsGridEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));
  React.useEffect(() => { setLocal(fromBlock(block.content)); /* eslint-disable-next-line */ }, [block._id]);

  function toContent(n: typeof local) {
    return { ...(block.content as any), title: n.title.trim(), columns: n.columns, listings: n.listings };
  }
  function apply(partial: Partial<typeof local>) {
    const n = { ...local, ...partial };
    setLocal(n);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(n) } as any }));
  }
  const setListing = (i: number, patch: Partial<Listing>) => apply({ listings: local.listings.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const addListing = () => apply({ listings: [...local.listings, { ...BLANK }] });
  const removeListing = (i: number) => apply({ listings: local.listings.filter((_, idx) => idx !== i) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= local.listings.length) return;
    const next = [...local.listings]; [next[i], next[j]] = [next[j], next[i]]; apply({ listings: next });
  };

  if (block.type !== 'listings_grid') return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="grid gap-2">
          <Label>Section title</Label>
          <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>Columns</Label>
          <select value={local.columns} onChange={(e) => apply({ columns: Number(e.target.value) === 2 ? 2 : 3 })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
      </div>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        🎧 <span className="font-medium text-foreground">Audio tours:</span> paste each home&rsquo;s
        HiveJournal embed id below. Create the embed with the <span className="font-medium">agent</span>{' '}
        preset — you pitch the home in your own voice and a skeptical AI buyer probes. Leave blank to skip.
      </p>

      <div className="space-y-3">
        {local.listings.map((l, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Home {i + 1}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="px-1 text-muted-foreground hover:text-foreground">↑</button>
                <button type="button" onClick={() => move(i, 1)} className="px-1 text-muted-foreground hover:text-foreground">↓</button>
                <button type="button" onClick={() => removeListing(i)} className="px-1 text-muted-foreground hover:text-red-500">✕</button>
              </div>
            </div>
            <Input value={l.headline} onChange={(e) => setListing(i, { headline: e.target.value })} placeholder="Headline (e.g. Sun-filled craftsman)" />
            <Input value={l.address} onChange={(e) => setListing(i, { address: e.target.value })} placeholder="Address" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={l.price} onChange={(e) => setListing(i, { price: e.target.value })} placeholder="Price ($524,900)" />
              <Input value={l.status} onChange={(e) => setListing(i, { status: e.target.value })} placeholder="Status (For sale / Pending)" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={l.beds} onChange={(e) => setListing(i, { beds: e.target.value })} placeholder="Beds" />
              <Input value={l.baths} onChange={(e) => setListing(i, { baths: e.target.value })} placeholder="Baths" />
              <Input value={l.sqft} onChange={(e) => setListing(i, { sqft: e.target.value })} placeholder="Sq ft" />
            </div>
            <Input value={l.image_url} onChange={(e) => setListing(i, { image_url: e.target.value })} placeholder="Photo URL" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={l.cta_link} onChange={(e) => setListing(i, { cta_link: e.target.value })} placeholder="Inquiry link (#contact)" />
              <Input value={l.about_that_embed_id} onChange={(e) => setListing(i, { about_that_embed_id: e.target.value })} placeholder="🎧 Audio-tour embed id (optional)" />
            </div>
          </div>
        ))}
        <button type="button" onClick={addListing} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">+ Add home</button>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
