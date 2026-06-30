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

  // Print-on-demand (Lulu book / Gelato merch)
  const [pod, setPod] = useState<'none' | 'lulu' | 'gelato'>('none');
  const [interiorUrl, setInteriorUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [pageCount, setPageCount] = useState<number>(0);
  const [productUid, setProductUid] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  async function submit() {
    setSaving(true);
    const podSpec =
      pod === 'lulu'
        ? { interiorUrl, coverUrl, pageCount: Number(pageCount) || 0 }
        : pod === 'gelato'
        ? { productUid, fileUrl }
        : undefined;
    const res = await fetch('/api/catalog/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchantId, siteSlug,
        type, title, slug, description: desc,
        priceCents: Math.round((price || 0) * 100),
        availability: { kind: 'always' },
        ...(pod !== 'none' ? { fulfillmentProvider: pod, podSpec } : {}),
      })
    });
    setSaving(false);
    if (res.ok) {
      const { id } = await res.json();
      setOpen(false);
      setTitle(''); setSlug(''); setDesc(''); setPrice(0);
      setPod('none'); setInteriorUrl(''); setCoverUrl(''); setPageCount(0); setProductUid(''); setFileUrl('');
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

              <label className="mt-2 text-xs text-neutral-400">Fulfillment (print-on-demand)</label>
              <select value={pod} onChange={(e)=>setPod(e.target.value as 'none'|'lulu'|'gelato')}
                className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
                <option value="none">None (digital / handled yourself)</option>
                <option value="lulu">Lulu — book / paperback</option>
                <option value="gelato">Gelato — poster / apparel</option>
              </select>

              {pod === 'lulu' && (
                <div className="grid grid-cols-1 gap-2 rounded-lg bg-neutral-900/60 p-3 ring-1 ring-neutral-800">
                  <input value={interiorUrl} onChange={(e)=>setInteriorUrl(e.target.value)} placeholder="Interior PDF URL"
                    className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                  <input value={coverUrl} onChange={(e)=>setCoverUrl(e.target.value)} placeholder="Cover PDF URL"
                    className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                  <input type="number" min={1} value={pageCount} onChange={(e)=>setPageCount(Number(e.target.value))} placeholder="Page count"
                    className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                </div>
              )}
              {pod === 'gelato' && (
                <div className="grid grid-cols-1 gap-2 rounded-lg bg-neutral-900/60 p-3 ring-1 ring-neutral-800">
                  <input value={productUid} onChange={(e)=>setProductUid(e.target.value)} placeholder="Gelato product UID"
                    className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                  <input value={fileUrl} onChange={(e)=>setFileUrl(e.target.value)} placeholder="Print file URL"
                    className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                </div>
              )}
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
