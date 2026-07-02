'use client';

// app/p/[slug]/add-to-cart.tsx
// Dispatches the same qs:cart:add event the products_grid block uses, so it
// integrates with the global CartEventsWire / cart store. No new cart plumbing.
// When the item has variants (size/color, each its own price), a selector picks
// one and the chosen variant's id + price ride along on the event.
import * as React from 'react';
import Link from 'next/link';

type Variant = { id: string; label: string; priceCents: number };

type Props = {
  id: string;
  title: string;
  priceCents: number;
  variants?: Variant[];
  imageUrl: string | null;
  productType: string | null;
  merchantId: string | null;
};

const fmt = (c: number) => `$${((Number(c) || 0) / 100).toFixed(2)}`;

export default function AddToCartButton({ id, title, priceCents, variants = [], imageUrl, productType, merchantId }: Props) {
  const hasVariants = variants.length > 0;
  const [added, setAdded] = React.useState(false);
  const [variantId, setVariantId] = React.useState<string>(hasVariants ? variants[0].id : '');

  const selected = hasVariants ? variants.find((v) => v.id === variantId) : undefined;
  const effectivePrice = selected ? selected.priceCents : priceCents;

  const add = React.useCallback(() => {
    if (hasVariants && !selected) return;
    try {
      window.dispatchEvent(
        new CustomEvent('qs:cart:add', {
          detail: {
            id,
            variant_id: selected?.id ?? null,
            variant_label: selected?.label ?? null,
            qty: 1,
            price_cents: effectivePrice,
            title,
            image_url: imageUrl,
            product_type: productType,
            merchantId,
          },
        })
      );
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1500);
    } catch {
      /* noop */
    }
  }, [hasVariants, selected, id, effectivePrice, title, imageUrl, productType, merchantId]);

  return (
    <div className="flex flex-col gap-3">
      {hasVariants && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Option</span>
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="w-fit min-w-48 rounded-md border bg-background px-3 py-2 text-sm"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} — {fmt(v.priceCents)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={add}
          disabled={hasVariants && !selected}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {added ? 'Added ✓' : `Add to cart — ${fmt(effectivePrice)}`}
        </button>
        <Link href="/cart" className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
          View cart
        </Link>
      </div>
    </div>
  );
}
