// app/store/[merchant]/page.tsx
//
// Standalone storefront for a single merchant — a shop without needing a built
// site. Resolve the merchant by uuid or site_slug, list active catalog_items.
// /store/<merchant-id> or /store/<site-slug>.
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import StoreGrid, { type StoreProduct } from './store-grid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

function firstImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const f = images[0];
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') return f.url ?? f.src ?? null;
  return null;
}

export default async function StorePage({ params }: { params: Promise<{ merchant: string }> }) {
  const { merchant } = await params;

  const sel = 'id, display_name, name, site_slug';
  const { data: m } = isUuid(merchant)
    ? await db.from('merchants').select(sel).eq('id', merchant).maybeSingle()
    : await db.from('merchants').select(sel).eq('site_slug', merchant).maybeSingle();

  if (!m) notFound();

  const { data: rows } = await db
    .from('catalog_items')
    .select('id,slug,title,price_cents,images,type')
    .eq('merchant_id', m.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const products: StoreProduct[] = (rows ?? []).map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    price_cents: p.price_cents,
    image_url: firstImage(p.images),
    product_type: p.type,
  }));

  const storeName = m.display_name || m.name || 'Shop';

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{storeName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <Link href="/cart" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
          Cart
        </Link>
      </header>

      <StoreGrid products={products} merchantId={m.id} />
    </main>
  );
}
