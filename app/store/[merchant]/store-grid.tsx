'use client';

// app/store/[merchant]/store-grid.tsx
// Client grid for the standalone storefront. Renders products and adds to the
// global cart via the same qs:cart:add event the products_grid block uses.
import * as React from 'react';
import Link from 'next/link';

export type StoreProduct = {
  id: string;
  slug: string | null;
  title: string;
  price_cents: number;
  image_url: string | null;
  product_type: string | null;
};

const fmt = (c: number) => `$${((Number(c) || 0) / 100).toFixed(2)}`;

function addToCart(p: StoreProduct, merchantId: string) {
  try {
    window.dispatchEvent(
      new CustomEvent('qs:cart:add', {
        detail: {
          id: p.id,
          qty: 1,
          price_cents: p.price_cents,
          title: p.title,
          image_url: p.image_url,
          product_type: p.product_type,
          merchantId,
        },
      })
    );
  } catch {
    /* noop */
  }
}

export default function StoreGrid({ products, merchantId }: { products: StoreProduct[]; merchantId: string }) {
  const [addedId, setAddedId] = React.useState<string | null>(null);

  const onAdd = (p: StoreProduct) => {
    addToCart(p, merchantId);
    setAddedId(p.id);
    window.setTimeout(() => setAddedId((cur) => (cur === p.id ? null : cur)), 1200);
  };

  if (!products.length) {
    return <p className="text-sm text-muted-foreground">No products available yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const href = p.slug ? `/p/${encodeURIComponent(p.slug)}` : `/p/${encodeURIComponent(p.id)}`;
        return (
          <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border">
            <Link href={href} className="block aspect-square overflow-hidden bg-muted">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.title} className="h-full w-full object-cover transition hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
              )}
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <Link href={href} className="line-clamp-2 text-sm font-medium hover:underline">
                {p.title}
              </Link>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-sm font-semibold">{fmt(p.price_cents)}</span>
                <button
                  onClick={() => onAdd(p)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                >
                  {addedId === p.id ? 'Added ✓' : 'Add'}
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
