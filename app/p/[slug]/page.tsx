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

/** catalog_items.images is jsonb: array of url strings or {url|src} objects. */
function normalizeImages(images: any): string[] {
  if (!Array.isArray(images)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of images) {
    const url = typeof entry === 'string' ? entry : entry?.url ?? entry?.src ?? null;
    if (typeof url === 'string' && url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
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

  const images = normalizeImages(item.images);
  const img = images[0] ?? null;

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
  const compareAtRaw = Number((item.metadata as any)?.compare_at_cents) || 0;
  const compareAtCents = compareAtRaw > fromPrice ? compareAtRaw : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <ProductDetail
        id={item.id}
        title={item.title}
        description={item.description ?? null}
        productType={item.type}
        priceCents={Number(item.price_cents) || 0}
        fromPrice={fromPrice}
        compareAtCents={compareAtCents}
        hasVariants={hasVariants}
        mainImage={img}
        images={images}
        variants={variants}
        axes={axes}
        itemStock={itemStock}
        merchantId={item.merchant_id}
      />
    </main>
  );
}
