'use client';

// app/p/[slug]/product-detail.tsx
// Client wrapper for the product body. Renders a photo gallery (main image + a
// thumbnail strip for stores with several product photos, e.g. a Shopify import),
// and swaps the main image when either a thumbnail is clicked or a variant with its
// own image is selected. AddToCartButton owns the variant selection and reports the
// active variant image up; we fall back to the browsed / first image.
import * as React from 'react';
import AddToCartButton from './add-to-cart';

type Variant = { id: string; label: string; priceCents: number; options?: Record<string, string> | null; stock?: number | null; image?: string | null };
type Axis = { name: string; values: string[] };

type Props = {
  id: string;
  title: string;
  description: string | null;
  productType: string | null;
  priceCents: number;
  fromPrice: number;
  compareAtCents?: number | null;
  hasVariants: boolean;
  mainImage: string | null;
  images?: string[];
  variants: Variant[];
  axes: Axis[];
  itemStock: number | null;
  merchantId: string | null;
};

const fmtPrice = (cents: number) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;

export default function ProductDetail(props: Props) {
  const { id, title, description, productType, priceCents, fromPrice, compareAtCents, hasVariants, mainImage, variants, axes, itemStock, merchantId } = props;
  const onSale = !!compareAtCents && compareAtCents > fromPrice;
  const gallery = props.images && props.images.length ? props.images : mainImage ? [mainImage] : [];
  // Selecting a variant with its own image wins; otherwise show the browsed thumbnail.
  const [variantImage, setVariantImage] = React.useState<string | null>(null);
  const [browsedImage, setBrowsedImage] = React.useState<string | null>(null);
  const img = variantImage || browsedImage || gallery[0] || mainImage;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">No image</div>
          )}
        </div>

        {gallery.length > 1 && (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Product images">
            {gallery.map((src, i) => {
              const active = src === img;
              return (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  role="listitem"
                  aria-label={`View image ${i + 1}`}
                  aria-current={active}
                  onClick={() => { setVariantImage(null); setBrowsedImage(src); }}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition ${active ? 'border-primary ring-2 ring-primary' : 'border-muted hover:border-foreground/40'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${title} thumbnail ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {productType && productType !== 'product' && (
          <span className="w-fit rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">{productType}</span>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <div className="flex items-baseline gap-2 text-2xl font-semibold">
          {hasVariants && <span className="mr-1 text-sm font-normal text-muted-foreground">from</span>}
          <span className={onSale ? 'text-red-600 dark:text-red-400' : undefined}>{fmtPrice(fromPrice)}</span>
          {onSale && (
            <span className="text-lg font-normal text-muted-foreground line-through">{fmtPrice(compareAtCents!)}</span>
          )}
        </div>
        {description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
        <div className="pt-2">
          <AddToCartButton
            id={id}
            title={title}
            priceCents={priceCents}
            variants={variants}
            axes={axes}
            itemStock={itemStock}
            imageUrl={mainImage}
            productType={productType}
            merchantId={merchantId}
            onActiveImage={setVariantImage}
          />
        </div>
      </div>
    </div>
  );
}
