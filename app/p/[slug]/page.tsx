// app/p/[slug]/page.tsx
//
// Public product detail page (generic commerce — product/service/digital).
// Reads the canonical `catalog_items` table. The products_grid block links here
// via /p/{slug}. Add-to-cart integrates with the existing global cart.
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AddToCartButton from './add-to-cart';
import { readVariants, readVariantOptions } from '@/lib/commerce/checkoutItems';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, {
  auth: { persistSession: false },
});

function firstImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const f = images[0];
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') return f.url ?? f.src ?? null;
  return null;
}
const fmtPrice = (cents: number) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // slug is unique per merchant (not globally) — take the most recent active match.
  const { data: rows } = await db
    .from('catalog_items')
    .select('id,slug,title,description,price_cents,images,type,status,merchant_id,metadata')
    .eq('slug', slug)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);

  const item = rows?.[0];
  if (!item) notFound();

  const img = firstImage(item.images);

  // Purchasable variants — single-axis (a flat list) or multi-axis (Size × Color).
  // Each is a SKU with its own price; price shown becomes a "from" minimum, and the
  // selector(s) + effective price live in the button.
  const variants = readVariants(item.metadata)
    .filter((v) => (v.status ?? 'active') === 'active')
    .map((v) => ({ id: v.id, label: v.label, priceCents: Number(v.price_cents) || 0, options: v.options ?? null }));
  const axes = readVariantOptions(item.metadata);
  const hasVariants = variants.length > 0;
  const fromPrice = hasVariants ? Math.min(...variants.map((v) => v.priceCents)) : Number(item.price_cents) || 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {item.type && item.type !== 'product' && (
            <span className="w-fit rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {item.type}
            </span>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{item.title}</h1>
          <div className="text-2xl font-semibold">
            {hasVariants && <span className="mr-1 text-sm font-normal text-muted-foreground">from</span>}
            {fmtPrice(fromPrice)}
          </div>
          {item.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          )}
          <div className="pt-2">
            <AddToCartButton
              id={item.id}
              title={item.title}
              priceCents={Number(item.price_cents) || 0}
              variants={variants}
              axes={axes}
              imageUrl={img}
              productType={item.type}
              merchantId={item.merchant_id}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
