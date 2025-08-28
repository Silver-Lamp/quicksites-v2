'use client';

import { useState } from 'react';

type ItemType = 'meal' | 'product' | 'service' | 'digital';

export default function CreateItemDrawer({ merchantId, siteSlug, onCreated }:{
  merchantId: string; siteSlug: string; onCreated?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ItemType>('product');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [slug, setSlug] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const res = await fetch('/api/catalog/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchantId, siteSlug,
        type, title, slug, description: desc,
        priceCents: Math.round((price || 0) * 100),
        availability: { kind: 'always' }
      })
    });
    setSaving(false);
    if (res.ok) {
      const { id } = await res.json();
      setOpen(false);
      setTitle(''); setSlug(''); setDesc(''); setPrice(0);
      onCreated?.(id);
    } else {
      const { error } = await res.json();
      alert(error || 'Failed to create item');
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">
        + New Item
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-2xl bg-neutral-950 p-6 ring-1 ring-neutral-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create item</h3>
              <button className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-900" onClick={()=>setOpen(false)}>✕</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-xs text-neutral-400">Type</label>
              <select value={type} onChange={(e)=>setType(e.target.value as ItemType)}
                className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
                <option value="product">product</option>
                <option value="service">service</option>
                <option value="digital">digital</option>
                <option value="meal">meal</option>
              </select>

              <label className="mt-2 text-xs text-neutral-400">Title</label>
              <input value={title} onChange={(e)=>setTitle(e.target.value)}
                className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />

              <label className="mt-2 text-xs text-neutral-400">Slug</label>
              <input value={slug} onChange={(e)=>setSlug(e.target.value)}
                placeholder="unique-per-merchant"
                className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />

              <label className="mt-2 text-xs text-neutral-400">Price (USD)</label>
              <input type="number" step="0.01" min="0" value={price}
                onChange={(e)=>setPrice(Number(e.target.value))}
                className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />

              <label className="mt-2 text-xs text-neutral-400">Description</label>
              <textarea value={desc} onChange={(e)=>setDesc(e.target.value)}
                className="min-h-24 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={()=>setOpen(false)} className="rounded bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800">Cancel</button>
              <button onClick={submit} disabled={saving || !title || !slug}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
