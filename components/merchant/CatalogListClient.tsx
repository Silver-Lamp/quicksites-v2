'use client';

import { useState } from 'react';

type Item = {
  id: string;
  type: 'meal'|'product'|'service'|'digital';
  title: string;
  slug: string;
  priceCents: number;
  image?: string;
};

export default function CatalogListClient({
  merchantId, siteSlug, currency, items
}:{
  merchantId: string; siteSlug: string; currency: string; items: Item[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});

  const fmt = (c:number) => new Intl.NumberFormat('en-US', { style:'currency', currency }).format(c/100);

  async function testCheckout(item: Item) {
    setLoadingId(item.id);
    try {
      const q = Math.max(1, qty[item.id] ?? 1);
      const res = await fetch('/api/commerce/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          merchantId, siteSlug, currency,
          items: [{ catalogItemId: item.id, title: item.title, quantity: q, unitAmount: item.priceCents }]
        })
      });
      const json = await res.json();
      if (json.checkoutUrl) window.location.href = json.checkoutUrl;
      else alert(json.error || 'Checkout failed');
    } finally {
      setLoadingId(null);
    }
  }

  if (items.length === 0) return <div className="text-sm text-neutral-500">No items yet. Click “New Item”.</div>;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map(it => (
        <div key={it.id} className="rounded-xl border border-neutral-800 p-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded bg-neutral-900 ring-1 ring-neutral-800 flex items-center justify-center text-xs text-neutral-500">
              {it.image ? <img src={it.image} alt="" className="h-16 w-16 rounded object-cover" /> : it.type}
            </div>
            <div className="flex-1">
              <div className="text-sm text-neutral-400 uppercase">{it.type}</div>
              <div className="text-base font-semibold">{it.title}</div>
              <div className="text-sm text-neutral-400">/{it.slug}</div>
            </div>
            <div className="text-base font-semibold">{fmt(it.priceCents)}</div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <label className="text-xs text-neutral-400">Qty</label>
            <input
              type="number" min={1} value={qty[it.id] ?? 1}
              onChange={(e)=>setQty(s => ({ ...s, [it.id]: Math.max(1, Number(e.target.value||1)) }))}
              className="w-20 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"
            />
            <button
              onClick={()=>testCheckout(it)}
              disabled={loadingId === it.id}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loadingId === it.id ? 'Redirecting…' : 'Test Checkout'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
