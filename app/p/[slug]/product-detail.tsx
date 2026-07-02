'use client';

// app/p/[slug]/product-detail.tsx
// Client wrapper for the product body so the image can swap when a variant with
// its own image is selected. AddToCartButton owns the selection and reports the
// active variant image up; we fall back to the item's main image.
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
  hasVariants: boolean;
  mainImage: string | null;
  variants: Variant[];
  axes: Axis[];
  itemStock: number | null;
  merchantId: string | null;
};

const fmtPrice = (cents: number) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;

export default function ProductDetail(props: Props) {
  const { id, title, description, productType, priceCents, fromPrice, hasVariants, mainImage, variants, axes, itemStock, merchantId } = props;
  const [variantImage, setVariantImage] = React.useState<string | null>(null);
  const img = variantImage || mainImage;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">No image</div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {productType && productType !== 'product' && (
          <span className="w-fit rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">{productType}</span>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <div className="text-2xl font-semibold">
          {hasVariants && <span className="mr-1 text-sm font-normal text-muted-foreground">from</span>}
          {fmtPrice(fromPrice)}
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
