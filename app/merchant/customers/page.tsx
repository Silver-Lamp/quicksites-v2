// app/merchant/customers/page.tsx
//
// Merchant customer list (CRM_PLAN.md Phase 1). Lists per-merchant customers built
// by the identity spine — deduped by normalized email, with orders/LTV/last-order.
// RLS-scoped: getServerSupabase() runs as the signed-in user, and the
// `customers_owner_read` policy returns only the owner's rows.
import { getServerSupabase } from '@/lib/supabase/server';
import CustomersListClient, { type CustomerRow } from '@/components/merchant/CustomersListClient';

export const dynamic = 'force-dynamic';

export default async function MerchantCustomersPage({ searchParams }: { searchParams: { merchant?: string } }) {
  const supabase = await getServerSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return <div className="p-8">Please sign in.</div>;

  const { data: merchants } = await supabase
    .from('merchants').select('id, display_name, site_slug').order('created_at');
  const merchant = merchants?.find((m) => m.id === (searchParams.merchant || merchants?.[0]?.id));
  if (!merchant) return <div className="p-8">No merchant found.</div>;

  // Cast: types/supabase.ts is stale (no `customers`). See CLAUDE.md §8.
  const { data: customers } = await (supabase as any)
    .from('customers')
    .select('id, email, name, phone, orders_count, lifetime_cents, first_order_at, last_order_at, marketing_consent, tags')
    .eq('merchant_id', merchant.id)
    .order('last_order_at', { ascending: false, nullsFirst: false })
    .limit(1000);

  const rows: CustomerRow[] = ((customers ?? []) as any[]).map((c) => ({
    ...c,
    tags: Array.isArray(c.tags) ? c.tags : [],
  })) as CustomerRow[];
  const totalLtv = rows.reduce((s, r) => s + (r.lifetime_cents || 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <p className="mt-1 text-sm text-neutral-400">{merchant.display_name} • {merchant.site_slug}</p>

      <div className="mt-6">
        <CustomersListClient rows={rows} merchantId={merchant.id} totalLtv={totalLtv} />
      </div>
    </div>
  );
}
