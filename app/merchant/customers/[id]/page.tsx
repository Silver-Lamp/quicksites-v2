// app/merchant/customers/[id]/page.tsx
//
// Customer profile (CRM_PLAN.md Phase 1). Contact + lifetime value + order history
// for one customer. RLS-scoped: `customers_owner_read` (and the merchant-owner
// scope on the orders join) guarantee a merchant only sees their own customer.
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function fmtCents(c: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((c || 0) / 100);
}

export default async function CustomerProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { merchant?: string };
}) {
  const supabase = await getServerSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return <div className="p-8">Please sign in.</div>;

  // Cast: types/supabase.ts is stale (no `customers`). See CLAUDE.md §8.
  const { data: customer } = await (supabase as any)
    .from('customers')
    .select('id, merchant_id, email, name, phone, stripe_customer_id, marketing_consent, orders_count, lifetime_cents, first_order_at, last_order_at, tags')
    .eq('id', params.id)
    .maybeSingle();

  if (!customer) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <BackLink merchantId={searchParams.merchant} />
        <div className="mt-6 text-neutral-400">Customer not found.</div>
      </div>
    );
  }

  const { data: orders } = await (supabase as any)
    .from('orders')
    .select('id, created_at, site_slug, status, total_cents, currency, provider')
    .eq('customer_id', customer.id)
    .eq('merchant_id', customer.merchant_id)
    .order('created_at', { ascending: false })
    .limit(200);

  const tags: string[] = Array.isArray(customer.tags) ? customer.tags : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <BackLink merchantId={searchParams.merchant} />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name || customer.email.split('@')[0]}</h1>
          <div className="mt-1 text-sm text-neutral-400">{customer.email}</div>
          {customer.phone && <div className="text-sm text-neutral-400">{customer.phone}</div>}
        </div>
        <div>
          {customer.marketing_consent ? (
            <span className="rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">Marketing: opted in</span>
          ) : (
            <span className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-400">Marketing: not opted in</span>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300">{t}</span>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Lifetime value" value={fmtCents(customer.lifetime_cents)} />
        <Stat label="Orders" value={String(customer.orders_count)} />
        <Stat label="First order" value={customer.first_order_at ? new Date(customer.first_order_at).toLocaleDateString() : '—'} />
        <Stat label="Last order" value={customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : '—'} />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Order history</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>When</th><th>Order</th><th>Site</th><th>Status</th><th>Provider</th><th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(orders || []).map((o: any) => (
              <tr key={o.id} className="[&>td]:px-4 [&>td]:py-3">
                <td className="whitespace-nowrap text-neutral-400">{new Date(o.created_at ?? '').toLocaleString()}</td>
                <td className="font-mono">{o.id.slice(0, 8)}…</td>
                <td>{o.site_slug}</td>
                <td><span className="rounded bg-neutral-800 px-2 py-1 text-xs">{o.status}</span></td>
                <td className="text-xs uppercase text-neutral-400">{o.provider || '-'}</td>
                <td className="text-right tabular-nums">{fmtCents(o.total_cents, o.currency)}</td>
              </tr>
            ))}
            {(!orders || orders.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={6}>No orders linked to this customer.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function BackLink({ merchantId }: { merchantId?: string }) {
  return (
    <Link
      href={`/merchant/customers${merchantId ? `?merchant=${merchantId}` : ''}`}
      className="text-sm text-neutral-400 hover:text-white"
    >
      ← All customers
    </Link>
  );
}
