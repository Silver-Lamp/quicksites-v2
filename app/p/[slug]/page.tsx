// app/p/[slug]/page.tsx
//
// Public product detail page (generic commerce — product/service/digital).
// Reads the canonical `catalog_items` table. The products_grid block links here
// via /p/{slug}. Add-to-cart integrates with the existing global cart.
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ProductDetail from './product-detail';
import { readVariants, readVariantOptions } from '@/lib/commerce/checkoutItems';
import { readItemStock } from '@/lib/commerce/inventory';

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
    .map((v) => ({ id: v.id, label: v.label, priceCents: Number(v.price_cents) || 0, options: v.options ?? null, stock: v.stock ?? null, image: v.image ?? null }));
  const axes = readVariantOptions(item.metadata);
  const itemStock = readItemStock(item.metadata);
  const hasVariants = variants.length > 0;
  const fromPrice = hasVariants ? Math.min(...variants.map((v) => v.priceCents)) : Number(item.price_cents) || 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <ProductDetail
        id={item.id}
        title={item.title}
        description={item.description ?? null}
        productType={item.type}
        priceCents={Number(item.price_cents) || 0}
        fromPrice={fromPrice}
        hasVariants={hasVariants}
        mainImage={img}
        variants={variants}
        axes={axes}
        itemStock={itemStock}
        merchantId={item.merchant_id}
      />
    </main>
  );
}
