'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void; };

function usdToCents(v: string | number | null | undefined): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100);
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
}

function getTpl(): any {
  return (window as any).__QS_TPL_REF__?.current ?? (window as any).__QS_TEMPLATE__ ?? null;
}

type ItemLite = { id: string; title: string; price_cents: number };

export default function ServiceOfferEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [local, setLocal] = React.useState({
    title: c.title ?? 'Book a Service',
    description: c.description ?? '',
    productId: c.productId ?? '',
    showPrice: typeof c.showPrice === 'boolean' ? c.showPrice : true,
    priceUsd: typeof c.price_cents === 'number' ? (c.price_cents / 100).toFixed(2) : '',
    cta: c.cta ?? 'Book now',
    href: c.href ?? '',
  });

  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setLocal({
      title: cc.title ?? 'Book a Service',
      description: cc.description ?? '',
      productId: cc.productId ?? '',
      showPrice: typeof cc.showPrice === 'boolean' ? cc.showPrice : true,
      priceUsd: typeof cc.price_cents === 'number' ? (cc.price_cents / 100).toFixed(2) : '',
      cta: cc.cta ?? 'Book now',
      href: cc.href ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  // ---- The store behind this site (same flow as products_grid): resolve it, offer
  // one-click setup, and let the offer link a real catalog item so the CTA sells. ----
  const templateId: string = String(getTpl()?.id ?? '');
  const [merchantId, setMerchantId] = React.useState<string>('');
  const [items, setItems] = React.useState<ItemLite[]>([]);
  const [settingUp, setSettingUp] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [storeMsg, setStoreMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const loadStore = React.useCallback(async () => {
    if (!templateId) return;
    try {
      const res = await fetch(`/api/commerce/site-merchant?templateId=${encodeURIComponent(templateId)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        setMerchantId(json.merchantId || '');
        setItems(Array.isArray(json.products) ? json.products : []);
      }
    } catch { /* quiet */ }
  }, [templateId]);
  React.useEffect(() => { void loadStore(); }, [loadStore]);

  const setupStore = React.useCallback(async () => {
    if (!templateId || settingUp) return;
    setSettingUp(true); setStoreMsg(null);
    try {
      const res = await fetch('/api/commerce/site-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.merchantId) throw new Error(json?.error || 'Could not set up the store.');
      setMerchantId(json.merchantId);
      setItems(Array.isArray(json.products) ? json.products : []);
      setStoreMsg({ ok: true, text: 'Store created ✓ — now link or create the item this offer sells.' });
    } catch (e: any) {
      setStoreMsg({ ok: false, text: e?.message || 'Could not set up the store.' });
    } finally { setSettingUp(false); }
  }, [templateId, settingUp]);

  // One click: mint a catalog item FROM this block (title + price already here) and
  // wire the CTA to it — the fastest path from brochure to checkout.
  const createFromBlock = React.useCallback(async () => {
    if (!merchantId || creating) return;
    const title = (local.title || '').trim();
    const priceCents = usdToCents(local.priceUsd) ?? 0;
    if (!title) { setStoreMsg({ ok: false, text: 'Give the offer a title first.' }); return; }
    setCreating(true); setStoreMsg(null);
    try {
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'service'}-${Math.random().toString(36).slice(2, 6)}`;
      const res = await fetch('/api/catalog/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          siteSlug: String(getTpl()?.slug ?? ''),
          type: 'service',
          title,
          slug,
          description: (local.description || '').slice(0, 2000),
          priceCents,
          availability: { kind: 'always' },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.id) throw new Error(json?.error || 'Could not create the item.');
      apply({ productId: json.id });
      setStoreMsg({ ok: true, text: `“${title}” is now a real item — the CTA adds it to the cart.` });
      void loadStore();
    } catch (e: any) {
      setStoreMsg({ ok: false, text: e?.message || 'Could not create the item.' });
    } finally { setCreating(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId, creating, local.title, local.priceUsd, local.description, loadStore]);

  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    const cents = next.showPrice && next.priceUsd !== '' ? usdToCents(next.priceUsd) : null;

    const patch = {
      op: 'update_block',
      blockId: block._id,
      content: {
        ...(block.content as any),
        title: next.title,
        description: next.description,
        productId: next.productId || undefined,
        showPrice: !!next.showPrice,
        ...(cents !== null && next.showPrice ? { price_cents: cents } : { price_cents: undefined }),
        cta: next.cta,
        href: next.href || undefined,
      },
    };
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  }

  // Defensive type guard runs AFTER all hooks (rules-of-hooks).
  if (block.type !== 'service_offer') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Title</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} placeholder="Book a Service" />
      </div>

      <div className="grid gap-2">
        <Label>Description</Label>
        <textarea
          value={local.description}
          onChange={(e) => apply({ description: e.target.value })}
          placeholder="Short value prop for this service…"
          className="w-full min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Sell this with checkout: link a real catalog item (or mint one from this
          block) so the CTA adds to cart instead of being a dead link. */}
      <div className="grid gap-2">
        <Label>Sell this with checkout</Label>

        {storeMsg && (
          <div className={`text-sm ${storeMsg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{storeMsg.text}</div>
        )}

        {!merchantId && templateId && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs text-muted-foreground">
              This site doesn't have a store yet — one click creates it, then this offer can take real orders.
            </p>
            <button
              type="button"
              onClick={setupStore}
              disabled={settingUp}
              className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {settingUp ? 'Setting up…' : '🏪 Set up my store'}
            </button>
          </div>
        )}

        {merchantId && (
          <div className="grid gap-2">
            <select
              value={local.productId}
              onChange={(e) => apply({ productId: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Not linked — CTA is just a link</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title} — ${(i.price_cents / 100).toFixed(2)}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createFromBlock}
                disabled={creating}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
                title="Create a catalog item from this block's title + price and wire the CTA to it"
              >
                {creating ? 'Creating…' : '✨ Create item from this block'}
              </button>
              <a
                href={`/merchant/catalog?merchant=${encodeURIComponent(merchantId)}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-sky-500 underline underline-offset-2 hover:text-sky-400"
              >
                Open Catalog ↗
              </a>
            </div>
          </div>
        )}

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Advanced: set the item id manually</summary>
          <div className="mt-2 flex gap-2">
            <Input
              value={local.productId}
              onChange={(e) => apply({ productId: e.target.value })}
              placeholder="prod_123… (or your SKU/slug)"
            />
            <button
              type="button"
              onClick={() => {
                try {
                  const last = localStorage.getItem('qs:ecom:lastProductId');
                  if (last) apply({ productId: last });
                } catch {}
              }}
              className="h-9 rounded-md border px-3 text-sm"
            >
              Use last
            </button>
            <button
              type="button"
              onClick={() => {
                try { window.dispatchEvent(new CustomEvent('qs:ecom:open')); } catch {}
              }}
              className="h-9 rounded-md border px-3 text-sm"
            >
              Pick…
            </button>
          </div>
        </details>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label className="mr-3">Show price</Label>
          <Switch checked={local.showPrice} onCheckedChange={(v) => apply({ showPrice: !!v })} />
        </div>
        {local.showPrice && (
          <>
            <Label>Price (USD)</Label>
            <Input
              inputMode="decimal"
              placeholder="e.g. 59 or 59.99"
              value={local.priceUsd}
              onChange={(e) => apply({ priceUsd: e.target.value })}
            />
          </>
        )}
      </div>

      <div className="grid gap-2">
        <Label>CTA text</Label>
        <Input value={local.cta} onChange={(e) => apply({ cta: e.target.value })} placeholder="Book now" />
      </div>

      <div className="grid gap-2">
        <Label>Optional link override</Label>
        <Input
          value={local.href}
          onChange={(e) => apply({ href: e.target.value })}
          placeholder="/checkout?product_id=prod_123"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => onSave?.(block)}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary/80"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground hover:bg-muted/80"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
