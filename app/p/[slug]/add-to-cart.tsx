'use client';

// app/p/[slug]/add-to-cart.tsx
// Dispatches the same qs:cart:add event the products_grid block uses, so it
// integrates with the global CartEventsWire / cart store. No new cart plumbing.
import * as React from 'react';
import Link from 'next/link';

type Props = {
  id: string;
  title: string;
  priceCents: number;
  imageUrl: string | null;
  productType: string | null;
  merchantId: string | null;
};

export default function AddToCartButton({ id, title, priceCents, imageUrl, productType, merchantId }: Props) {
  const [added, setAdded] = React.useState(false);

  const add = React.useCallback(() => {
    try {
      window.dispatchEvent(
        new CustomEvent('qs:cart:add', {
          detail: {
            id,
            qty: 1,
            price_cents: priceCents,
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
  }, [id, title, priceCents, imageUrl, productType, merchantId]);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={add}
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        {added ? 'Added ✓' : 'Add to cart'}
      </button>
      <Link href="/cart" className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
        View cart
      </Link>
    </div>
  );
}
