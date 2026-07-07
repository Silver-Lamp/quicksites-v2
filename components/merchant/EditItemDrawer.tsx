'use client';

// components/merchant/EditItemDrawer.tsx
// Edit an existing catalog item — title / description / price / status and its
// variants (reusing the shared VariantsEditor, seeded from the item's current
// metadata). Fetches the full item on open; PATCHes /api/catalog/items/[id].
import { useState } from 'react';
import VariantsEditor, { type VariantsPayload } from './VariantsEditor';
import ImageUploadField from './ImageUploadField';

export default function EditItemDrawer({ itemId, onSaved }: { itemId: string; onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState(0); // dollars
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [stock, setStock] = useState<string>(''); // plain-item stock; '' = unlimited
  const [sku, setSku] = useState<string>(''); // plain-item SKU
  const [barcode, setBarcode] = useState<string>(''); // plain-item UPC/EAN/ISBN
  const [image, setImage] = useState<string>(''); // main product image URL
  const [variantsPayload, setVariantsPayload] = useState<VariantsPayload>({ variantOptions: [], variants: [] });

  async function openAndLoad() {
    setOpen(true);
    setLoaded(false);
    try {
      const res = await fetch(`/api/catalog/items/${itemId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      const it = json.item;
      setItem(it);
      setTitle(it.title || '');
      setDesc(it.description || '');
      setPrice((it.price_cents || 0) / 100);
      setStatus(it.status === 'inactive' ? 'inactive' : 'active');
      const s = it.metadata?.stock;
      setStock(typeof s === 'number' ? String(s) : '');
      setSku(typeof it.metadata?.sku === 'string' ? it.metadata.sku : '');
      setBarcode(typeof it.metadata?.barcode === 'string' ? it.metadata.barcode : '');
      const first = Array.isArray(it.images) ? it.images[0] : null;
      setImage(typeof first === 'string' ? first : (first?.url ?? first?.src ?? ''));
      setVariantsPayload({ variantOptions: [], variants: [] });
      setLoaded(true);
    } catch (e: any) {
      alert(e?.message || 'Failed to load item');
      setOpen(false);
    }
  }

  const isPod = !!item?.metadata?.fulfillment_provider;
  const initialAxes = (item?.metadata?.variant_options ?? []) as Array<{ name: string; values: string[] }>;
  const initialVariants = (item?.metadata?.variants ?? []) as Array<{ price_cents: number; options?: Record<string, string> | null }>;

  async function save() {
    setSaving(true);
    try {
      const body: any = { title, description: desc, status, priceCents: Math.round((price || 0) * 100), imageUrl: image.trim() };
      // Generic items always send their full variant authoring state (replace
      // wholesale — empty clears variants). POD items don't manage variants here.
      if (!isPod) {
        body.variantOptions = variantsPayload.variantOptions;
        body.variants = variantsPayload.variants;
        if (variantsPayload.variants.length === 0) {
          body.stock = stock === '' ? null : Math.max(0, Math.floor(Number(stock) || 0));
          body.sku = sku.trim();
          body.barcode = barcode.trim();
        }
      }
      const res = await fetch(`/api/catalog/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Save failed');
      }
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      alert(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={openAndLoad} className="rounded-lg bg-neutral-800 px-3 py-2 text-sm font-medium ring-1 ring-neutral-700">
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-neutral-950 p-6 ring-1 ring-neutral-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit item</h3>
              <button className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-900" onClick={() => setOpen(false)}>✕</button>
            </div>

            {!loaded ? (
              <div className="py-10 text-center text-sm text-neutral-500">Loading…</div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <label className="text-xs text-neutral-400">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />

                  <label className="mt-2 text-xs text-neutral-400">
                    {variantsPayload.variants.length ? 'Base price (overridden by variant prices)' : 'Price (USD)'}
                  </label>
                  <input type="number" step="0.01" min="0" value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />

                  <label className="mt-2 text-xs text-neutral-400">Image</label>
                  <ImageUploadField value={image} onChange={setImage} folder="catalog/items" />

                  <label className="mt-2 text-xs text-neutral-400">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                    className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
                    <option value="active">active (visible & purchasable)</option>
                    <option value="inactive">inactive (hidden)</option>
                  </select>

                  {!isPod && variantsPayload.variants.length === 0 && (
                    <>
                      <label className="mt-2 text-xs text-neutral-400">Stock (blank = unlimited)</label>
                      <input type="number" step="1" min="0" value={stock} placeholder="∞"
                        onChange={(e) => setStock(e.target.value)}
                        className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <label className="text-xs text-neutral-400">SKU (optional)</label>
                          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)}
                            className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-xs text-neutral-400">Barcode (optional)</label>
                          <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)}
                            className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                        </div>
                      </div>
                    </>
                  )}

                  {isPod ? (
                    <p className="mt-2 text-[11px] text-neutral-500">This is a print-on-demand item; its options aren’t edited here.</p>
                  ) : (
                    <VariantsEditor
                      key={itemId}
                      defaultPriceDollars={price}
                      initialAxes={initialAxes.length ? initialAxes : undefined}
                      initialVariants={initialVariants.length ? initialVariants : undefined}
                      onChange={setVariantsPayload}
                    />
                  )}

                  <label className="mt-2 text-xs text-neutral-400">Description</label>
                  <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                    className="min-h-24 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button onClick={() => setOpen(false)} className="rounded bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800">Cancel</button>
                  <button onClick={save} disabled={saving || !title}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
