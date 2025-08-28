// app/admin/billing/map/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { stripe } from '@/lib/stripe/server';

export const dynamic = 'force-dynamic';

function fmtCents(c: number | null | undefined, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((c || 0) / 100);
}
function isTestKey() {
  return (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
}
function stripeUrl(kind: 'customer' | 'subscription', id?: string | null) {
  if (!id) return '#';
  const base = isTestKey() ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com';
  return kind === 'customer' ? `${base}/customers/${id}` : `${base}/subscriptions/${id}`;
}

// -------- Admin gate --------
async function requireAdmin() {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) throw new Error('unauthorized');
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) throw new Error('forbidden');
  return { supa, user: u.user };
}

/* ===================== Server Actions ===================== */

async function updateMapping(formData: FormData) {
  'use server';
  await requireAdmin();
  const svc = await getServerSupabase({ serviceRole: true });
  const merchant_id = String(formData.get('merchant_id') || '');
  const plan = String(formData.get('plan') || '');
  const price_cents = Math.round(Number(formData.get('price') || 0) * 100);
  const stripe_customer_id = String(formData.get('stripe_customer_id') || '') || null;
  const stripe_subscription_id = String(formData.get('stripe_subscription_id') || '') || null;

  const { error } = await svc.from('merchant_billing').upsert({
    merchant_id,
    plan: plan || null,
    price_cents: isNaN(price_cents) ? 0 : price_cents,
    stripe_customer_id,
    stripe_subscription_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'merchant_id' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/billing/map');
}

async function createMapping(formData: FormData) {
  'use server';
  await requireAdmin();
  const svc = await getServerSupabase({ serviceRole: true });
  const merchant_id = String(formData.get('merchant_id') || '');
  const plan = String(formData.get('plan') || 'Pro');
  const price_cents = Math.round(Number(formData.get('price') || 0) * 100);
  const { error } = await svc.from('merchant_billing').insert({
    merchant_id,
    plan,
    price_cents: isNaN(price_cents) ? 0 : price_cents,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/billing/map');
}

async function syncFromStripeOne(formData: FormData) {
  'use server';
  await requireAdmin();

  const svc = await getServerSupabase({ serviceRole: true });
  const merchant_id = String(formData.get('merchant_id') || '');
  const cust = String(formData.get('stripe_customer_id') || '') || null;
  const subId = String(formData.get('stripe_subscription_id') || '') || null;

  let sub: Stripe.Subscription | null = null;
  if (subId) sub = await stripe.subscriptions.retrieve(subId);
  else if (cust) {
    const list = await stripe.subscriptions.list({ customer: cust, status: 'all', limit: 1 });
    sub = list.data[0] || null;
  }

  let planLabel: string | null = null;
  let priceCents: number | null = null;
  if (sub) {
    const price = sub.items.data[0]?.price;
    priceCents = typeof price?.unit_amount === 'number' ? price!.unit_amount : null;
    planLabel = price?.nickname || (price?.lookup_key as string | null) || null;
    if (!planLabel && typeof price?.product === 'string') {
      try {
        const prod = await stripe.products.retrieve(price!.product as string);
        planLabel = prod.name || null;
      } catch {}
    }
  }

  const patch: any = {
    plan: planLabel || 'Pro',
    price_cents: priceCents ?? 0,
    stripe_customer_id: cust || null,
    stripe_subscription_id: sub?.id || subId || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await svc.from('merchant_billing').upsert({ merchant_id, ...patch }, { onConflict: 'merchant_id' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/billing/map');
}

/** Bulk sync, batched to avoid long single calls. */
async function syncAllFromStripe(formData: FormData) {
  'use server';
  await requireAdmin();

  const svc = await getServerSupabase({ serviceRole: true });

  const batch = Math.max(1, Math.min(200, Number(formData.get('batch') || 100)));

  const { data: rows } = await svc
    .from('merchant_billing')
    .select('merchant_id, stripe_customer_id, stripe_subscription_id')
    .order('updated_at', { ascending: false })
    .limit(1000);

  if (!rows?.length) {
    revalidatePath('/admin/billing/map');
    return;
  }

  const nowISO = new Date().toISOString();

  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);

    // For each mapping: fetch subscription (prefer id)
    const updates: any[] = [];
    for (const r of chunk) {
      try {
        let sub: Stripe.Subscription | null = null;
        if (r.stripe_subscription_id) {
          sub = await stripe.subscriptions.retrieve(r.stripe_subscription_id);
        } else if (r.stripe_customer_id) {
          const list = await stripe.subscriptions.list({ customer: r.stripe_customer_id, status: 'all', limit: 1 });
          sub = list.data[0] || null;
        }
        if (!sub) continue;

        const price = sub.items.data[0]?.price;
        let planLabel: string | null = price?.nickname || (price?.lookup_key as string | null) || null;
        if (!planLabel && typeof price?.product === 'string') {
          try {
            const prod = await stripe.products.retrieve(price!.product as string);
            planLabel = prod.name || null;
          } catch {}
        }

        updates.push({
          merchant_id: r.merchant_id,
          plan: planLabel || 'Pro',
          price_cents: typeof price?.unit_amount === 'number' ? price.unit_amount : 0,
          stripe_customer_id: r.stripe_customer_id || null,
          stripe_subscription_id: sub.id || r.stripe_subscription_id || null,
          updated_at: nowISO,
        });
      } catch {
        // ignore bad rows; continue
      }
    }

    if (updates.length) {
      const { error } = await svc.from('merchant_billing').upsert(updates, { onConflict: 'merchant_id' });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath('/admin/billing/map');
}

/* ===================== Page ===================== */

export default async function BillingMap({ searchParams }: { searchParams: { q?: string } }) {
  await requireAdmin();
  const svc = await getServerSupabase({ serviceRole: true });

  const { data: rows } = await svc
    .from('merchant_billing')
    .select('merchant_id, stripe_customer_id, stripe_subscription_id, plan, price_cents, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1000);

  const merchantIds = Array.from(new Set((rows || []).map(r => r.merchant_id)));
  const { data: merchants } = await svc
    .from('merchants')
    .select('id, display_name, site_slug, owner_id')
    .in('id', merchantIds);

  const ownerIds = Array.from(new Set((merchants || []).map(m => m.owner_id)));
  const { data: owners } = await svc
    .from('profiles')
    .select('id, email, display_name')
    .in('id', ownerIds);

  const mById = new Map((merchants || []).map(m => [m.id, m]));
  const oById = new Map((owners || []).map(o => [o.id, o]));

  const q = (searchParams.q || '').toLowerCase();
  const filtered = (rows || []).filter(r => {
    if (!q) return true;
    const m = mById.get(r.merchant_id);
    const o = m ? oById.get(m.owner_id) : undefined;
    const hay = [
      r.merchant_id,
      r.stripe_customer_id,
      r.stripe_subscription_id,
      r.plan,
      m?.display_name,
      m?.site_slug,
      o?.email,
      o?.display_name,
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  const stripeReady = !!stripe;

  // Unmapped merchants (no merchant_billing row)
  const { data: allMerchants } = await svc
    .from('merchants')
    .select('id, display_name, site_slug, owner_id, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  const mapped = new Set(merchantIds);
  const unmapped = (allMerchants || []).filter(m => !mapped.has(m.id));

  const exportHref = '/api/admin/billing/export'; // CSV export route below

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Billing Map</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Merchant ↔ Stripe mapping. Edit plan/price/ids, sync from Stripe, and create missing mappings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form>
            <input
              name="q"
              defaultValue={searchParams.q || ''}
              placeholder="Search email, merchant, customer/subscription id…"
              className="w-80 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"
            />
            <button className="ml-2 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">Search</button>
          </form>

          <a href={exportHref} target="_blank" className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
            Download CSV
          </a>

          {stripeReady && (
            <form action={syncAllFromStripe}>
              <input type="hidden" name="batch" value="100" />
              <button className="rounded bg-purple-600 px-3 py-2 text-sm font-medium">
                Sync All from Stripe
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Create mapping */}
      <div className="mt-6 rounded-2xl border border-neutral-800 p-4">
        <div className="text-sm font-medium">Create mapping</div>
        <form action={createMapping} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-400">Merchant ID</label>
            <input name="merchant_id" required className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-400">Plan label</label>
            <input name="plan" defaultValue="Pro" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
          </div>
          <div>
            <label className="block text-xs text-neutral-400">Price ($)</label>
            <input name="price" type="number" step="0.01" min={0} defaultValue={0}
              className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
          </div>
          <div className="flex items-end">
            <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">Create</button>
          </div>
        </form>
      </div>

      {/* Table of mappings */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>Merchant</th>
              <th>Owner</th>
              <th>Plan</th>
              <th>Price</th>
              <th>Stripe Customer</th>
              <th>Stripe Subscription</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filtered.map((r) => {
              const m = mById.get(r.merchant_id);
              const o = m ? oById.get(m.owner_id) : undefined;
              return (
                <tr key={r.merchant_id} className="[&>td]:px-4 [&>td]:py-3 align-top">
                  <td className="text-xs">
                    <div className="font-mono">{r.merchant_id.slice(0,8)}…</div>
                    <div className="text-neutral-400">{m?.display_name || '—'}</div>
                    <div className="text-neutral-500 text-xs">/{m?.site_slug || '—'}</div>
                    <div className="mt-1">
                      <a className="underline text-xs" href={`/merchant/payments?merchant=${r.merchant_id}`}>payments</a>
                      <span className="mx-1 text-neutral-700">·</span>
                      <a className="underline text-xs" href={`/merchant/orders?merchant=${r.merchant_id}`}>orders</a>
                    </div>
                  </td>
                  <td className="text-xs">
                    <div>{o?.email || '—'}</div>
                    {o?.display_name && <div className="text-neutral-400">{o.display_name}</div>}
                  </td>
                  <td className="text-xs">{r.plan || '—'}</td>
                  <td className="text-xs">{fmtCents(r.price_cents)}</td>
                  <td className="text-xs">
                    {r.stripe_customer_id ? (
                      <a className="underline" href={stripeUrl('customer', r.stripe_customer_id)} target="_blank">
                        {r.stripe_customer_id}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="text-xs">
                    {r.stripe_subscription_id ? (
                      <a className="underline" href={stripeUrl('subscription', r.stripe_subscription_id)} target="_blank">
                        {r.stripe_subscription_id}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="text-xs text-neutral-400">
                    {r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}
                  </td>
                  <td className="text-xs">
                    {/* Edit */}
                    <form action={updateMapping} className="grid grid-cols-1 gap-2 md:grid-cols-6">
                      <input type="hidden" name="merchant_id" value={r.merchant_id} />
                      <div>
                        <label className="block text-[10px] text-neutral-500">Plan</label>
                        <input name="plan" defaultValue={r.plan || ''} className="mt-1 w-full rounded bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-500">Price ($)</label>
                        <input name="price" type="number" step="0.01" min={0} defaultValue={(r.price_cents || 0) / 100}
                          className="mt-1 w-28 rounded bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] text-neutral-500">Customer</label>
                        <input name="stripe_customer_id" defaultValue={r.stripe_customer_id || ''} className="mt-1 w-full rounded bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] text-neutral-500">Subscription</label>
                        <input name="stripe_subscription_id" defaultValue={r.stripe_subscription_id || ''} className="mt-1 w-full rounded bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800" />
                      </div>
                      <div className="md:col-span-6 flex items-center gap-2">
                        <button className="rounded bg-neutral-900 px-3 py-1 text-xs ring-1 ring-neutral-800">Save</button>
                        {stripeReady && (
                          <form action={syncFromStripeOne}>
                            <input type="hidden" name="merchant_id" value={r.merchant_id} />
                            <input type="hidden" name="stripe_customer_id" value={r.stripe_customer_id || ''} />
                            <input type="hidden" name="stripe_subscription_id" value={r.stripe_subscription_id || ''} />
                            <button className="rounded bg-purple-600 px-3 py-1 text-xs font-medium">Sync from Stripe</button>
                          </form>
                        )}
                      </div>
                    </form>
                    <Link href="/admin/billing/map/paste-sync" className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
                        Paste Sync
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={8}>No results.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Unmapped merchants */}
      <div className="mt-10">
        <h2 className="text-lg font-medium">Unmapped merchants</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Merchants without a <code>merchant_billing</code> row. Create a mapping to enable billing & reports.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900">
              <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
                <th>Merchant</th>
                <th>Owner</th>
                <th>Created</th>
                <th>Create Mapping</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {unmapped.map((m) => {
                const o = oById.get(m.owner_id);
                return (
                  <tr key={m.id} className="[&>td]:px-4 [&>td]:py-3">
                    <td className="text-xs">
                      <div className="font-mono">{m.id.slice(0,8)}…</div>
                      <div className="text-neutral-400">{m.display_name}</div>
                      <div className="text-neutral-500 text-xs">/{m.site_slug}</div>
                    </td>
                    <td className="text-xs">
                      <div>{o?.email || '—'}</div>
                      {o?.display_name && <div className="text-neutral-400">{o.display_name}</div>}
                    </td>
                    <td className="text-xs text-neutral-400">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="text-xs">
                      <form action={createMapping} className="flex items-end gap-2">
                        <input type="hidden" name="merchant_id" value={m.id} />
                        <div>
                          <label className="block text-[10px] text-neutral-500">Plan</label>
                          <input name="plan" defaultValue="Pro" className="mt-1 w-36 rounded bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-500">Price ($)</label>
                          <input name="price" type="number" step="0.01" min={0} defaultValue={0}
                            className="mt-1 w-28 rounded bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800" />
                        </div>
                        <button className="rounded bg-neutral-900 px-3 py-1 text-xs ring-1 ring-neutral-800">Create</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {unmapped.length === 0 && (
                <tr><td className="px-4 py-6 text-neutral-500" colSpan={4}>All merchants are mapped. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
