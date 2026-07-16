'use client';

// components/admin/templates/render-blocks/service-offer.tsx
//
// The real service_offer renderer (replaces the long-standing "renderer coming
// soon" stub in renderBlockRegistry). A single featured service/offer card:
// title, description, price (+ compare-at strikethrough), optional image, and a
// CTA that is ACTUALLY wired to money:
//   - content.productId set  → "Add to cart" via the shared qs:cart:add event
//     (same payload/flow as products_grid + menu; checkout reprices server-side
//     from the id, so the display price is never trusted).
//   - no productId           → plain link CTA (href/cta_link), or a scroll to
//     #contact as the safe default.
// Tolerates both content vocabularies (editor writes description/cta/href; the
// default block content uses description_html/cta_text/cta_link).

import * as React from 'react';
import type { Block } from '@/types/blocks';

type CartAddPayload = {
  id: string;
  qty: number;
  price_cents: number;
  title: string;
  image_url?: string | null;
  product_type?: string | null;
  merchantId?: string | null;
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default function RenderServiceOffer({ block }: { block: Block }) {
  const c: any = block?.content ?? {};
  const title: string = c.title || 'Featured Service';
  const subtitle: string = c.subtitle || '';
  const descriptionHtml: string = typeof c.description_html === 'string' && c.description_html ? c.description_html : '';
  const description: string = !descriptionHtml && typeof c.description === 'string' ? c.description : '';
  const imageUrl: string = typeof c.image_url === 'string' ? c.image_url : '';
  const showPrice: boolean = c.showPrice !== false;
  const priceCents: number = typeof c.price_cents === 'number' ? c.price_cents : 0;
  const compareAt: number | null = typeof c.compare_at_cents === 'number' ? c.compare_at_cents : null;
  const productId: string = typeof c.productId === 'string' ? c.productId : '';
  const ctaText: string = c.cta || c.cta_text || (productId ? 'Add to cart' : 'Get started');
  const ctaHref: string = c.href || c.cta_link || '#contact';

  const [added, setAdded] = React.useState(false);

  const addToCart = React.useCallback(() => {
    if (!productId) return;
    const merchantId: string | null =
      (typeof window !== 'undefined' && (window as any).__QS_ECOM__?.merchantId) || null;
    const detail: CartAddPayload = {
      id: productId,
      qty: 1,
      price_cents: priceCents,
      title,
      image_url: imageUrl || null,
      product_type: 'service',
      merchantId,
    };
    try {
      window.dispatchEvent(new CustomEvent('qs:cart:add', { detail }));
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    } catch {
      /* noop */
    }
  }, [productId, priceCents, title, imageUrl]);

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm md:flex">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="h-56 w-full object-cover md:h-auto md:w-2/5"
            loading="lazy"
          />
        )}
        <div className="flex flex-1 flex-col justify-center gap-3 p-6 md:p-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {descriptionHtml ? (
            <div
              className="prose prose-sm max-w-none text-foreground/90 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          ) : description ? (
            <p className="text-sm text-foreground/90">{description}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-4">
            {showPrice && priceCents > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">{money(priceCents)}</span>
                {compareAt != null && compareAt > priceCents && (
                  <span className="text-sm text-muted-foreground line-through tabular-nums">{money(compareAt)}</span>
                )}
              </div>
            )}
            {productId ? (
              <button
                type="button"
                onClick={addToCart}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
              >
                {added ? 'Added ✓' : ctaText}
              </button>
            ) : (
              <a
                href={ctaHref}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
              >
                {ctaText}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
