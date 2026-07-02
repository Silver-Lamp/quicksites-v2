'use client';

// app/p/[slug]/add-to-cart.tsx
// Dispatches the same qs:cart:add event the products_grid block uses, so it
// integrates with the global CartEventsWire / cart store. No new cart plumbing.
//
// Variant modes:
//   • plain        — no variants; add the base item.
//   • single-list  — a flat variant list, no axes → one dropdown.
//   • multi-axis   — axes (Size, Color…) → one selector per axis; the chosen
//                    combination resolves to a SKU (or "unavailable" if unoffered).
// Either way the SKU's id + price ride on the event; the server reprices from the DB.
import * as React from 'react';
import Link from 'next/link';
import { resolveVariantByOptions, type CatalogVariant } from '@/lib/commerce/checkoutItems';

type Variant = { id: string; label: string; priceCents: number; options?: Record<string, string> | null };
type Axis = { name: string; values: string[] };

type Props = {
  id: string;
  title: string;
  priceCents: number;
  variants?: Variant[];
  axes?: Axis[];
  imageUrl: string | null;
  productType: string | null;
  merchantId: string | null;
};

const fmt = (c: number) => `$${((Number(c) || 0) / 100).toFixed(2)}`;
const toCatalogVariant = (v: Variant): CatalogVariant => ({ id: v.id, label: v.label, price_cents: v.priceCents, options: v.options ?? null });

export default function AddToCartButton({ id, title, priceCents, variants = [], axes = [], imageUrl, productType, merchantId }: Props) {
  const multiAxis = axes.length > 0 && variants.length > 0;
  const singleList = !multiAxis && variants.length > 0;

  // Single-list state: the selected variant id.
  const [variantId, setVariantId] = React.useState<string>(singleList ? variants[0].id : '');
  // Multi-axis state: the selected value per axis (default to the first value).
  const [selected, setSelected] = React.useState<Record<string, string>>(() =>
    multiAxis ? Object.fromEntries(axes.map((a) => [a.name, a.values[0]])) : {},
  );

  const [added, setAdded] = React.useState(false);

  // Resolve the chosen SKU for whichever mode we're in. For multi-axis we resolve
  // the combination → an id, then look up our original Variant by that id.
  const resolvedId = multiAxis ? resolveVariantByOptions(variants.map(toCatalogVariant), selected)?.id : undefined;
  const sku: Variant | undefined = multiAxis
    ? variants.find((v) => v.id === resolvedId)
    : singleList
      ? variants.find((v) => v.id === variantId)
      : undefined;

  const hasVariants = multiAxis || singleList;
  const effectivePrice = sku ? sku.priceCents : hasVariants ? 0 : priceCents;
  const unavailable = hasVariants && !sku; // a combination that isn't offered

  const add = React.useCallback(() => {
    if (hasVariants && !sku) return;
    try {
      window.dispatchEvent(
        new CustomEvent('qs:cart:add', {
          detail: {
            id,
            variant_id: sku?.id ?? null,
            variant_label: sku?.label ?? null,
            qty: 1,
            price_cents: effectivePrice,
            title,
            image_url: imageUrl,
            product_type: productType,
            merchantId,
          },
        }),
      );
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1500);
    } catch {
      /* noop */
    }
  }, [hasVariants, sku, id, effectivePrice, title, imageUrl, productType, merchantId]);

  return (
    <div className="flex flex-col gap-3">
      {multiAxis &&
        axes.map((axis) => (
          <label key={axis.name} className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{axis.name}</span>
            <select
              value={selected[axis.name] ?? ''}
              onChange={(e) => setSelected((s) => ({ ...s, [axis.name]: e.target.value }))}
              className="w-fit min-w-48 rounded-md border bg-background px-3 py-2 text-sm"
            >
              {axis.values.map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </label>
        ))}

      {singleList && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Option</span>
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="w-fit min-w-48 rounded-md border bg-background px-3 py-2 text-sm"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.label} — {fmt(v.priceCents)}</option>
            ))}
          </select>
        </label>
      )}

      {unavailable && <p className="text-sm text-muted-foreground">That combination isn’t available.</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={add}
          disabled={unavailable}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {added ? 'Added ✓' : unavailable ? 'Unavailable' : `Add to cart — ${fmt(effectivePrice)}`}
        </button>
        <Link href="/cart" className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
          View cart
        </Link>
      </div>
    </div>
  );
}
