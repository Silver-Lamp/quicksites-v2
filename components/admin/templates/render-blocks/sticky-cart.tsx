'use client';

// components/admin/templates/render-blocks/sticky-cart.tsx
//
// Product-page sticky add-to-cart — the commerce sibling of order_bar (same
// mobile-first fixed-bottom pattern, same spacer trick). Wired to the shared
// qs:cart:add event (checkout reprices server-side from the id). Live title/price
// are fetched from the public products API so the bar never shows a stale price;
// config label/price_cents are only the pre-fetch fallback. Renders nothing
// without a productId.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = { block?: Block; content?: Block['content']; previewOnly?: boolean };

type CartAddPayload = {
  id: string;
  qty: number;
  price_cents: number;
  title: string;
  image_url?: string | null;
  product_type?: string | null;
  merchantId?: string | null;
};

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

export default function RenderStickyCart({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const productId: string = typeof c.productId === 'string' ? c.productId.trim() : '';
  const ctaText: string = c.cta_text || 'Add to cart';
  const showOnDesktop: boolean = c.show_on_desktop === true;
  const enabled: boolean = c.enabled !== false;

  const [live, setLive] = React.useState<{ title: string; price_cents: number; image_url: string | null } | null>(null);
  const [added, setAdded] = React.useState(false);

  React.useEffect(() => {
    if (!productId) return;
    let active = true;
    fetch(`/api/public/products?ids=${encodeURIComponent(productId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const p = Array.isArray(j?.products) ? j.products[0] : null;
        if (active && p) {
          setLive({ title: p.title, price_cents: Number(p.price_cents || 0), image_url: p.image_url ?? null });
        }
      })
      .catch(() => { /* fallback to config */ });
    return () => { active = false; };
  }, [productId]);

  if (!enabled || !productId) return null;

  const title = live?.title || c.label || 'This item';
  const priceCents = live?.price_cents ?? (Number(c.price_cents) || 0);

  const addToCart = () => {
    const merchantId: string | null =
      (typeof window !== 'undefined' && (window as any).__QS_ECOM__?.merchantId) || null;
    const detail: CartAddPayload = {
      id: productId,
      qty: 1,
      price_cents: priceCents,
      title,
      image_url: live?.image_url ?? null,
      product_type: null,
      merchantId,
    };
    try {
      window.dispatchEvent(new CustomEvent('qs:cart:add', { detail }));
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    } catch { /* noop */ }
  };

  const visibility = showOnDesktop ? '' : 'md:hidden';

  return (
    <>
      {/* spacer so the fixed bar never hides the last bit of content */}
      <div className={`h-16 ${visibility}`} aria-hidden />
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 text-foreground backdrop-blur ${visibility}`}>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          {live?.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={live.image_url} alt="" className="h-10 w-10 rounded-md border border-border object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{title}</div>
            {priceCents > 0 && <div className="text-xs text-muted-foreground tabular-nums">{money(priceCents)}</div>}
          </div>
          <button
            type="button"
            onClick={addToCart}
            className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
          >
            {added ? 'Added ✓' : ctaText}
          </button>
        </div>
      </div>
    </>
  );
}
