// app/merchant/customers/[id]/page.tsx
//
// Customer profile (CRM_PLAN.md Phase 1). Contact + lifetime value + order history
// for one customer. RLS-scoped: `customers_owner_read` (and the merchant-owner
// scope on the orders join) guarantee a merchant only sees their own customer.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import CustomerAdminPanel from '@/components/merchant/CustomerAdminPanel';
import { buildCustomerActivity, type ActivityEvent } from '@/lib/crm/activity';

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
    .select('id, merchant_id, email, name, phone, stripe_customer_id, marketing_consent, orders_count, lifetime_cents, first_order_at, last_order_at, tags, notes, created_at')
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

  // Campaign receipts (RLS: crm_campaign_sends_owner_read). Embed the campaign subject.
  const { data: sends } = await (supabase as any)
    .from('crm_campaign_sends')
    .select('id, created_at, status, crm_campaigns(subject)')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const activity = buildCustomerActivity({
    orders: (orders ?? []) as any[],
    campaignSends: ((sends ?? []) as any[]).map((s) => ({
      id: s.id, created_at: s.created_at, status: s.status, subject: s.crm_campaigns?.subject ?? null,
    })),
    createdAt: customer.created_at ?? null,
    firstOrderAt: customer.first_order_at ?? null,
  });

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

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Lifetime value" value={fmtCents(customer.lifetime_cents)} />
        <Stat label="Orders" value={String(customer.orders_count)} />
        <Stat label="First order" value={customer.first_order_at ? new Date(customer.first_order_at).toLocaleDateString() : '—'} />
        <Stat label="Last order" value={customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : '—'} />
      </div>

      <CustomerAdminPanel
        customerId={customer.id}
        initialNotes={customer.notes ?? ''}
        initialTags={tags}
        initialConsent={!!customer.marketing_consent}
      />

      <h2 className="mt-8 text-lg font-semibold">Activity</h2>
      <div className="mt-3 rounded-xl border border-neutral-800 p-2">
        {activity.length === 0 ? (
          <div className="px-3 py-6 text-sm text-neutral-500">No activity yet.</div>
        ) : (
          <ol className="relative">
            {activity.map((e) => <ActivityRow key={e.id} e={e} />)}
          </ol>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ e }: { e: ActivityEvent }) {
  const when = new Date(e.at).toLocaleString();
  let icon = '•';
  let title: ReactNode = '';
  let tone = 'text-neutral-300';
  if (e.kind === 'order') {
    icon = '🧾';
    title = <>Order · <span className="tabular-nums">{fmtCents(e.totalCents, e.currency)}</span>{e.siteSlug ? <span className="text-neutral-500"> · {e.siteSlug}</span> : null}</>;
    tone = e.status === 'refunded' ? 'text-amber-300' : 'text-neutral-200';
  } else if (e.kind === 'campaign') {
    icon = '✉️';
    title = <>Received: <span className="text-neutral-200">{e.subject}</span></>;
    tone = e.status === 'failed' ? 'text-red-300' : 'text-neutral-300';
  } else {
    icon = '⭐';
    title = 'Became a customer';
  }
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="mt-0.5 w-5 shrink-0 text-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${tone}`}>{title}</div>
        <div className="text-xs text-neutral-500">{when}{e.kind === 'order' ? ` · ${e.status}` : ''}</div>
      </div>
    </li>
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
