// app/merchant/orders/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import RefundButton from './refund-button';

function fmtCents(c: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((c || 0) / 100);
}

export const dynamic = 'force-dynamic';

export default async function MerchantOrdersPage({ searchParams }: { searchParams: { merchant?: string } }) {
  const supabase = await getServerSupabase();
  const { data: merchants } = await supabase.from('merchants').select('id, display_name, default_currency').order('created_at');

  const merchantId = searchParams.merchant || merchants?.[0]?.id;
  if (!merchantId) return <div className="p-8">No merchant found.</div>;

  // Cast: types/supabase.ts is stale (no oversold_lines), which would poison the
  // whole select's return type. See CLAUDE.md §8.
  const { data: orders } = await (supabase as any)
    .from('orders')
    .select('id, created_at, site_slug, status, total_cents, currency, provider, oversold_lines')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(200);

  const oversoldCount = (orders || []).filter((o: any) => Array.isArray(o.oversold_lines) && o.oversold_lines.length).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Orders</h1>
      {oversoldCount > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
          ⚠ {oversoldCount} paid {oversoldCount === 1 ? 'order was' : 'orders were'} oversold (a stock race). Review the flagged rows below and refund or backorder.
        </div>
      )}
      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>When</th><th>Order</th><th>Site</th><th>Status</th><th>Provider</th><th>Total</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(orders || []).map((o: any) => (
              <tr key={o.id} className="[&>td]:px-4 [&>td]:py-3 align-top">
                <td className="whitespace-nowrap text-neutral-400">{new Date(o.created_at ?? '').toLocaleString()}</td>
                <td className="font-mono">{o.id.slice(0,8)}…</td>
                <td>{o.site_slug}</td>
                <td>
                  <span className="rounded bg-neutral-800 px-2 py-1 text-xs">{o.status}</span>
                  {Array.isArray((o as any).oversold_lines) && (o as any).oversold_lines.length > 0 && (
                    <div className="mt-1 text-xs text-amber-400">
                      ⚠ Oversold
                      <ul className="mt-0.5 text-[11px] text-amber-300/80">
                        {(o as any).oversold_lines.map((l: any, i: number) => (
                          <li key={i}>
                            {l.title}{l.variant_label ? ` (${l.variant_label})` : ''} — ordered {l.requested}, {l.remaining ?? 0} in stock
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </td>
                <td className="uppercase text-xs text-neutral-400">{o.provider || '-'}</td>
                <td>{fmtCents(o.total_cents, o.currency)}</td>
                <td className="text-right">{o.status === 'paid' && <RefundButton orderId={o.id} />}</td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={7}>No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
