'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

type ProductLite = {
  id: string; title: string; price_cents: number;
  image_url?: string | null; product_type?: string | null;
};

const clamp = (n: number, min = 1, max = 4) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const readIds = (c: any): string[] =>
  Array.isArray(c?.product_ids) ? c.product_ids.filter(Boolean)
  : Array.isArray(c?.productIds) ? c.productIds.filter(Boolean)
  : Array.isArray(c?.ids) ? c.ids.filter(Boolean)
  : Array.isArray(c?.items) ? c.items.map((x: any) => x?.id).filter(Boolean)
  : [];

/* --- template helpers --- */
function getTpl(): any {
  return (window as any).__QS_TPL_REF__?.current ?? (window as any).__QS_TEMPLATE__ ?? null;
}
function readMerchantFromData(data: any) {
  const metaE = data?.meta?.ecom ?? data?.meta?.ecommerce ?? {};
  const email = metaE?.merchant_email ?? data?.ecommerce?.merchant_email ?? data?.merchant_email ?? '';
  const merchantId = metaE?.merchant_id ?? data?.ecommerce?.merchant_id ?? '';
  return { email: String(email || ''), merchantId: String(merchantId || '') };
}

/* --- storage helper --- */
function hydrateFromStorage() {
  try {
    return {
      id: localStorage.getItem('qs_merchant_id') || '',
      email: localStorage.getItem('merchant_email') || '',
      label: localStorage.getItem('qs_merchant_label') || '',
    };
  } catch {
    return { id: '', email: '', label: '' };
  }
}

export default function ProductsGridEditor({ block, onSave, onClose }: Props) {
  const isProductsGrid = block?.type === 'products-grid' || block?.type === 'products_grid';

  const content: any = block?.content ?? {};
  const [local, setLocal] = React.useState({
    title: content.section_title ?? content.title ?? 'Featured Products',
    columns: clamp(Number(content.columns ?? 3)),
  });

  // Merchant source of truth (template meta → storage → events)
  const init = readMerchantFromData(getTpl()?.data ?? {});
  const [merchantEmail, setMerchantEmail] = React.useState<string>(init.email);
  const [merchantId, setMerchantId] = React.useState<string>(init.merchantId);
  const [merchantLabel, setMerchantLabel] = React.useState<string>('');
  const [lastSource, setLastSource] = React.useState<'template'|'storage'|'event'|''>('');

  // Products + selection
  const [products, setProducts] = React.useState<ProductLite[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set(readIds(content)));
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const c: any = (block as any)?.content ?? {};
    setLocal({
      title: c.section_title ?? c.title ?? 'Featured Products',
      columns: clamp(Number(c.columns ?? 3)),
    });
    setSelected(new Set(readIds(c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?._id]);

  // One-click "Set up my store" (owner-gated server-side; stamps meta.ecom.merchant_id).
  const [settingUp, setSettingUp] = React.useState(false);
  const [setupMsg, setSetupMsg] = React.useState<string | null>(null);
  const templateId: string = String(getTpl()?.id ?? '');

  const refresh = React.useCallback(async () => {
    const email = merchantEmail?.trim();
    const mId = merchantId?.trim();

    // Preferred path: resolve THIS site's store server-side (owner-or-admin gated) —
    // works for real owners, unlike the admin-only products endpoint.
    if (templateId) {
      setLoading(true); setLoadError(null);
      try {
        const res = await fetch(`/api/commerce/site-merchant?templateId=${encodeURIComponent(templateId)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.ok) {
          if (json.merchantId && json.merchantId !== mId) {
            setMerchantId(json.merchantId); setMerchantEmail(''); setLastSource('template');
            try { localStorage.setItem('qs_merchant_id', json.merchantId); } catch {}
          }
          setProducts(Array.isArray(json.products) ? json.products : []);
          return;
        }
        // fall through to the legacy path on any non-ok
      } catch {
        /* fall through */
      } finally { setLoading(false); }
    }

    if (!email && !mId) {
      setProducts([]);
      setLoadError(null); // no store yet — the setup CTA below handles it, not an error
      return;
    }
    setLoading(true); setLoadError(null);
    try {
      const url = mId
        ? `/api/admin/products?merchantId=${encodeURIComponent(mId)}`
        : `/api/admin/products?email=${encodeURIComponent(email)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `${res.status} ${res.statusText}`);
      setProducts(Array.isArray(json.products) ? json.products : []);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load products'); setProducts([]);
    } finally { setLoading(false); }
  }, [merchantEmail, merchantId, templateId]);

  // Quick add: title + price → a live catalog item, auto-selected into this grid.
  // Full editing (images, variants, stock, POD) lives in /merchant/catalog.
  const [qaTitle, setQaTitle] = React.useState('');
  const [qaPrice, setQaPrice] = React.useState('');
  const [qaBusy, setQaBusy] = React.useState(false);
  const quickAdd = React.useCallback(async () => {
    const title = qaTitle.trim();
    const priceCents = Math.round((Number.parseFloat(qaPrice.replace(/[^0-9.]/g, '')) || 0) * 100);
    if (!title || !merchantId || qaBusy) return;
    setQaBusy(true); setLoadError(null);
    try {
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'item'}-${Math.random().toString(36).slice(2, 6)}`;
      const res = await fetch('/api/catalog/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          siteSlug: String(getTpl()?.slug ?? ''),
          type: 'product',
          title,
          slug,
          priceCents,
          availability: { kind: 'always' },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) throw new Error(json?.error || 'Could not create the item.');
      setQaTitle(''); setQaPrice('');
      // Select the new item into the grid immediately.
      const next = new Set(selected); next.add(json.id);
      setSelected(next);
      const idsArr = Array.from(next);
      dispatchDraft({ product_ids: idsArr, productIds: idsArr });
      await refresh();
    } catch (e: any) {
      setLoadError(e?.message || 'Could not create the item.');
    } finally { setQaBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaTitle, qaPrice, merchantId, qaBusy, selected, refresh]);

  // "Set up my store": find-or-create the owner's merchant for this site and adopt it.
  const setupStore = React.useCallback(async () => {
    if (!templateId || settingUp) return;
    setSettingUp(true); setSetupMsg(null); setLoadError(null);
    try {
      const res = await fetch('/api/commerce/site-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.merchantId) throw new Error(json?.error || 'Could not set up the store.');
      setMerchantId(json.merchantId); setMerchantEmail(''); setLastSource('template');
      try {
        localStorage.setItem('qs_merchant_id', json.merchantId);
        localStorage.removeItem('merchant_email');
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('qs:ecom:merchant-selected', {
          detail: { merchantId: json.merchantId, label: 'Your store' },
        }));
      } catch {}
      setProducts(Array.isArray(json.products) ? json.products : []);
      setSetupMsg('Store created ✓ — now add your first items.');
    } catch (e: any) {
      setSetupMsg(null);
      setLoadError(e?.message || 'Could not set up the store.');
    } finally { setSettingUp(false); }
  }, [templateId, settingUp]);

  /* --- listen for modal broadcasts + template patches + storage signal --- */
  React.useEffect(() => {
    function onMerchantSelected(ev: any) {
      const d = ev?.detail || {};
      const id = (d.merchantId || '').trim();
      const email = (d.email || '').trim();
      if (d.label) setMerchantLabel(String(d.label));
      if (id) { setMerchantId(id); setMerchantEmail(''); try { localStorage.setItem('qs_merchant_id', id); localStorage.removeItem('merchant_email'); } catch {} }
      else if (email) { setMerchantId(''); setMerchantEmail(email); try { localStorage.setItem('merchant_email', email); localStorage.removeItem('qs_merchant_id'); } catch {} }
      setLastSource('event');
      setTimeout(() => void refresh(), 0);
    }
    function onProductsUpdated(ev: any) {
      const d = ev?.detail || {};
      const matches =
        (d.merchantId && d.merchantId === merchantId) ||
        (d.email && d.email.toLowerCase() === (merchantEmail || '').toLowerCase());
      if (matches) void refresh();
    }
    function onTplPatched(ev: any) {
      const next = ev?.detail?.data;
      if (!next) return;
      const m = readMerchantFromData(next);
      const changed = (m.merchantId && m.merchantId !== merchantId) || (m.email && m.email !== merchantEmail);
      if (changed) {
        setMerchantId(m.merchantId || ''); setMerchantEmail(m.email || ''); setLastSource('template');
        setTimeout(() => void refresh(), 0);
      }
    }
    function onMerchantStorageUpdated() {
      const s = hydrateFromStorage();
      const changed = (s.id && s.id !== merchantId) || (s.email && s.email !== merchantEmail);
      if (s.label) setMerchantLabel(s.label);
      if (changed) {
        setMerchantId(s.id || ''); setMerchantEmail(s.email || ''); setLastSource('storage');
        setTimeout(() => void refresh(), 0);
      }
    }

    window.addEventListener('qs:ecom:merchant-selected', onMerchantSelected as EventListener);
    window.addEventListener('qs:ecom:products-updated', onProductsUpdated as EventListener);
    window.addEventListener('qs:template:apply-patch', onTplPatched as EventListener);
    window.addEventListener('qs:ecom:merchant-storage-updated', onMerchantStorageUpdated as EventListener);
    return () => {
      window.removeEventListener('qs:ecom:merchant-selected', onMerchantSelected as EventListener);
      window.removeEventListener('qs:ecom:products-updated', onProductsUpdated as EventListener);
      window.removeEventListener('qs:template:apply-patch', onTplPatched as EventListener);
      window.removeEventListener('qs:ecom:merchant-storage-updated', onMerchantStorageUpdated as EventListener);
    };
  }, [merchantEmail, merchantId, refresh]);

  /* --- first mount: template → storage fallback --- */
  React.useEffect(() => {
    let id = merchantId, email = merchantEmail, label = '';
    if (!id && !email) {
      const s = hydrateFromStorage(); id = s.id; email = s.email; label = s.label;
      if (label) setMerchantLabel(label);
      if (id || email) { setMerchantId(id); setMerchantEmail(email); setLastSource('storage'); void refresh(); }
    } else if (id || email) {
      setLastSource('template'); void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- debug helpers --- */
  function rehydrateNow() {
    // try template first
    const t = readMerchantFromData(getTpl()?.data ?? {});
    let id = t.merchantId || '', email = t.email || '', source: 'template'|'storage' = 'template';
    if (!id && !email) {
      const s = hydrateFromStorage();
      id = s.id; email = s.email; if (s.label) setMerchantLabel(s.label);
      source = 'storage';
    }
    setMerchantId(id || ''); setMerchantEmail(email || ''); setLastSource(source);
    void refresh();
  }
  function clearMerchantCache() {
    try {
      localStorage.removeItem('qs_merchant_id');
      localStorage.removeItem('merchant_email');
      localStorage.removeItem('qs_merchant_label');
    } catch {}
    setMerchantId(''); setMerchantEmail(''); setMerchantLabel(''); setLastSource('');
    try { window.dispatchEvent(new CustomEvent('qs:ecom:merchant-storage-updated')); } catch {}
    setProducts([]); // make it obvious
  }

  /* --- draft patch helpers --- */
  function dispatchDraft(nextContent: any) {
    try {
      const tpl: any = getTpl();
      const pages: any[] =
        (Array.isArray(tpl?.data?.pages) && tpl.data.pages) ||
        (Array.isArray(tpl?.pages) && tpl.pages) || [];
      if (!pages.length) return;

      let pageIdx = -1, blkIdx = -1;
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const blocks: any[] =
          (Array.isArray(p?.blocks) && p.blocks) ||
          (Array.isArray(p?.content_blocks) && p.content_blocks) ||
          (Array.isArray(p?.content?.blocks) && p.content.blocks) || [];
        const idx = blocks.findIndex((b: any) => (b?._id || b?.id) === (block as any)?._id);
        if (idx >= 0) { pageIdx = i; blkIdx = idx; break; }
      }
      if (pageIdx < 0 || blkIdx < 0) return;

      const srcPage: any = pages[pageIdx];
      const srcBlocks: any[] =
        (Array.isArray(srcPage?.blocks) && srcPage.blocks) ||
        (Array.isArray(srcPage?.content_blocks) && srcPage.content_blocks) ||
        (Array.isArray(srcPage?.content?.blocks) && srcPage.content.blocks) || [];

      const nextBlock = { ...block, type: 'products_grid', content: { ...(block?.content ?? {}), ...nextContent } };
      const nextBlocks = [...srcBlocks]; nextBlocks[blkIdx] = nextBlock;

      const nextPage: any = {
        ...srcPage, blocks: nextBlocks,
        ...(Array.isArray(srcPage?.content_blocks) ? { content_blocks: nextBlocks } : {}),
        ...(srcPage?.content && typeof srcPage.content === 'object' ? { content: { ...srcPage.content, blocks: nextBlocks } } : {}),
      };

      const nextPages = [...pages]; nextPages[pageIdx] = nextPage;
      const nextData = { ...(tpl?.data ?? {}), pages: nextPages };

      window.dispatchEvent(new CustomEvent('qs:template:apply-patch', {
        detail: { data: nextData, __transient: true },
      }));
    } catch {}
  }

  function applyTitleColumns(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    dispatchDraft({ section_title: next.title, title: next.title, columns: clamp(next.columns) });
  }

  function toggleId(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    const idsArr = Array.from(next);
    dispatchDraft({ product_ids: idsArr, productIds: idsArr });
  }

  function selectAll() {
    const next = new Set(products.map(p => p.id));
    setSelected(next);
    const idsArr = Array.from(next);
    dispatchDraft({ product_ids: idsArr, productIds: idsArr });
  }

  function clearAll() {
    setSelected(new Set());
    dispatchDraft({ product_ids: [], productIds: [] });
  }

  const handleSave = () => {
    try { window.dispatchEvent(new Event('qs:toolbar:save-now')); } catch {}
    onSave?.({
      ...block,
      type: 'products_grid',
      content: {
        ...(block?.content ?? {}),
        section_title: local.title,
        title: local.title,
        columns: clamp(local.columns),
        product_ids: Array.from(selected),
        productIds: Array.from(selected),
      },
    } as any);
  };

  /* --- UI --- */
  const badge =
    merchantLabel ||
    (merchantId ? `Merchant: ${merchantId.slice(0,8)}…` :
     merchantEmail ? `Merchant: ${merchantEmail}` :
     'Merchant not set (open Manage products & services)');

  // Defensive guard runs AFTER all hooks (rules-of-hooks).
  if (!isProductsGrid) return null;

  const hasMerchant = !!(merchantId || merchantEmail);

  return (
    <div className="space-y-5">
      {/* Merchant plumbing details — useful for debugging, noise for owners. */}
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none">{badge}</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border px-2 py-0.5">id: {merchantId ? `${merchantId.slice(0,8)}…` : '—'}</span>
          <span className="rounded-full border px-2 py-0.5">email: {merchantEmail || '—'}</span>
          {lastSource && <span className="rounded-full border px-2 py-0.5">src: {lastSource}</span>}
          <Button variant="outline" size="sm" onClick={rehydrateNow}>Re-read</Button>
          <Button variant="outline" size="sm" onClick={clearMerchantCache}>Clear cache</Button>
        </div>
      </details>

      <div className="grid gap-2">
        <Label htmlFor="pg-title">Section title</Label>
        <Input id="pg-title" value={local.title} onChange={(e) => applyTitleColumns({ title: e.target.value })} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="pg-cols">Columns (1–4)</Label>
        <Input id="pg-cols" type="number" min={1} max={4} value={local.columns}
               onChange={(e) => applyTitleColumns({ columns: clamp(Number(e.target.value)) })} />
      </div>

      <div className="grid gap-2">
        <Label>Merchant products</Label>

        <div className="flex items-center gap-2">
          <Button variant="outline" type="button" onClick={refresh} disabled={loading || (!merchantEmail && !merchantId)}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
          <Button variant="outline" type="button" onClick={selectAll} disabled={!products.length}>
            Select all
          </Button>
          <Button variant="outline" type="button" onClick={clearAll} disabled={!selected.size}>
            Clear
          </Button>
        </div>

        {loadError && <div className="text-sm text-red-500">{loadError}</div>}
        {setupMsg && <div className="text-sm text-emerald-500">{setupMsg}</div>}

        {/* No store yet → one click creates it (owner's merchant, stamped on the site). */}
        {!hasMerchant && !loading && (
          templateId ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="text-sm font-medium">This site doesn't have a store yet.</div>
              <p className="mt-1 text-xs text-muted-foreground">
                One click creates it — then add your items and they'll show up here to pick from.
              </p>
              <Button className="mt-3" type="button" onClick={setupStore} disabled={settingUp}>
                {settingUp ? 'Setting up…' : '🏪 Set up my store'}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Choose a merchant in “Manage products &amp; services”.
            </div>
          )
        )}

        {/* Store exists but is empty → route to the real items surface (Catalog). */}
        {hasMerchant && !loading && products.length === 0 && merchantId && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4">
            <div className="text-sm font-medium">Your store is ready — it just needs items.</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Add products (or services, meals, digital goods) in your Catalog, then come back and hit Refresh.
            </p>
            <a
              href={`/merchant/catalog?merchant=${encodeURIComponent(merchantId)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
            >
              Open Catalog — add items ↗
            </a>
          </div>
        )}

        {/* Quick add: the fastest path from "empty store" to "product on the page".
            Title + price only — richer editing lives in the Catalog. */}
        {merchantId && !loading && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
            <div className="grid min-w-[10rem] flex-1 gap-1">
              <Label htmlFor="qa-title" className="text-xs">Quick add an item</Label>
              <Input
                id="qa-title"
                value={qaTitle}
                onChange={(e) => setQaTitle(e.target.value)}
                placeholder="e.g. Lawn mowing — front + back"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void quickAdd(); } }}
              />
            </div>
            <div className="grid w-24 gap-1">
              <Label htmlFor="qa-price" className="text-xs">Price ($)</Label>
              <Input
                id="qa-price"
                inputMode="decimal"
                value={qaPrice}
                onChange={(e) => setQaPrice(e.target.value)}
                placeholder="49"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void quickAdd(); } }}
              />
            </div>
            <Button type="button" onClick={() => void quickAdd()} disabled={qaBusy || !qaTitle.trim()}>
              {qaBusy ? 'Adding…' : '+ Add'}
            </Button>
          </div>
        )}

        {/* The picker list only renders when there's something to pick (or we're
            loading) — the setup/catalog CTAs above carry the empty states. */}
        <div className={`rounded-lg border divide-y max-h-64 overflow-auto ${!loading && products.length === 0 ? 'hidden' : ''}`}>
          {products.length === 0 ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">
              {loading ? 'Loading…' : 'No items yet.'}
            </div>
          ) : (
            products.map((p) => {
              const checked = selected.has(p.id);
              return (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40">
                  <input type="checkbox" className="accent-primary" checked={checked} onChange={() => toggleId(p.id)} />
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover border" />
                  ) : <div className="h-8 w-8 rounded bg-muted" />}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      ${(p.price_cents / 100).toFixed(2)}{p.product_type ? ` • ${p.product_type}` : ''}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {selected.size > 0 ? (<><span className="font-medium">{selected.size}</span> selected.</>) : (<>No products linked yet. Use the checkboxes above to pick items.</>)}
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={handleSave}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
