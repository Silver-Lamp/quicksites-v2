// app/merchant/orders/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';

function fmtCents(c: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((c || 0) / 100);
}

export const dynamic = 'force-dynamic';

export default async function MerchantOrdersPage({ searchParams }: { searchParams: { merchant?: string } }) {
  const supabase = await getServerSupabase();
  const { data: merchants } = await supabase.from('merchants').select('id, display_name, default_currency').order('created_at');

  const merchantId = searchParams.merchant || merchants?.[0]?.id;
  if (!merchantId) return <div className="p-8">No merchant found.</div>;

  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, site_slug, status, total_cents, currency, provider')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>When</th><th>Order</th><th>Site</th><th>Status</th><th>Provider</th><th>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(orders || []).map(o => (
              <tr key={o.id} className="[&>td]:px-4 [&>td]:py-3">
                <td className="whitespace-nowrap text-neutral-400">{new Date(o.created_at).toLocaleString()}</td>
                <td className="font-mono">{o.id.slice(0,8)}…</td>
                <td>{o.site_slug}</td>
                <td><span className="rounded bg-neutral-800 px-2 py-1 text-xs">{o.status}</span></td>
                <td className="uppercase text-xs text-neutral-400">{o.provider || '-'}</td>
                <td>{fmtCents(o.total_cents, o.currency)}</td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={6}>No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
