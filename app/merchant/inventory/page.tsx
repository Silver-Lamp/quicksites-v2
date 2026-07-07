// app/merchant/inventory/page.tsx
//
// Merchant inventory management (INVENTORY_PLAN.md Phase 2). Lists catalog items with
// on-hand stock, SKU, and low/out-of-stock flags, filterable, with per-item receive/
// set adjustments (→ /api/catalog/items/[id]/adjust, recorded to the ledger).
import { getServerSupabase } from '@/lib/supabase/server';
import { summarizeInventoryRow } from '@/lib/commerce/inventorySummary';
import InventoryListClient from '@/components/merchant/InventoryListClient';

export const dynamic = 'force-dynamic';

export default async function MerchantInventoryPage({ searchParams }: { searchParams: { merchant?: string; filter?: string } }) {
  const supabase = await getServerSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return <div className="p-8">Please sign in.</div>;

  const { data: merchants } = await supabase
    .from('merchants').select('id, display_name, site_slug').order('created_at');
  const merchant = merchants?.find((m) => m.id === (searchParams.merchant || merchants?.[0]?.id));
  if (!merchant) return <div className="p-8">No merchant found.</div>;

  const { data: items } = await supabase
    .from('catalog_items')
    .select('id, type, title, status, metadata')
    .eq('merchant_id', merchant.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (items ?? []).map(summarizeInventoryRow);
  const counts = {
    all: rows.length,
    low: rows.filter((r) => r.low).length,
    out: rows.filter((r) => r.out).length,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <p className="mt-1 text-sm text-neutral-400">{merchant.display_name} • {merchant.site_slug}</p>

      <div className="mt-6">
        <InventoryListClient rows={rows} counts={counts} filter={searchParams.filter ?? 'all'} />
      </div>
    </div>
  );
}
