// app/merchant/catalog/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import CreateItemDrawer from '@/components/merchant/CreateItemDrawer';
import CatalogListClient from '@/components/merchant/CatalogListClient';

export const dynamic = 'force-dynamic';

export default async function MerchantCatalogPage({ searchParams }: { searchParams: { merchant?: string } }) {
  const supabase = await getServerSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return <div className="p-8">Please sign in.</div>;

  const { data: merchants } = await supabase
    .from('merchants').select('id, display_name, site_slug, default_currency').order('created_at');
  const merchant = merchants?.find(m => m.id === (searchParams.merchant || merchants?.[0]?.id));
  if (!merchant) return <div className="p-8">No merchant found.</div>;

  const { data: items } = await supabase
    .from('catalog_items')
    .select('id, type, title, slug, price_cents, status, images')
    .eq('merchant_id', merchant.id)
    .neq('status','archived')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Catalog</h1>
          <p className="mt-1 text-sm text-neutral-400">{merchant.display_name} • {merchant.site_slug} • {merchant.default_currency}</p>
        </div>
        <CreateItemDrawer merchantId={merchant.id} siteSlug={merchant.site_slug} />
      </div>

      <div className="mt-6">
        <CatalogListClient
          merchantId={merchant.id}
          siteSlug={merchant.site_slug}
          currency={merchant.default_currency}
          items={(items || []).map(i => ({
            id: i.id, type: i.type, title: i.title, slug: i.slug,
            priceCents: i.price_cents, image: (Array.isArray(i.images) && i.images[0]) || ''
          }))}
        />
      </div>
    </div>
  );
}
