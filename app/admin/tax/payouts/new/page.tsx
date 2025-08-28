// app/admin/tax/payouts/new/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function fmt(c:number, cur='USD'){ return new Intl.NumberFormat('en-US',{style:'currency',currency:cur}).format((c||0)/100); }

export const dynamic = 'force-dynamic';

export default async function AdminNewPayout({ searchParams }:{
  searchParams: { q?: string; ok?: string }
}) {
  // --- Admin gate (normal session) ---
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return <div className="p-8">Please sign in.</div>;
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) return <div className="p-8">Forbidden.</div>;

  const q = (searchParams.q || '').trim();
  // Search affiliates (by email or display_name)
  const svc = await getServerSupabase({ serviceRole: true });
  let users: { id: string; email: string | null; display_name: string | null }[] = [];
  if (q) {
    const { data } = await svc.from('profiles')
      .select('id,email,display_name')
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(25);
    users = data || [];
  }

  // Recent payouts (last 25)
  const { data: recent } = await svc
    .from('affiliate_payouts')
    .select('id, affiliate_user_id, paid_at, amount_cents, currency, method, is_tpso, tx_ref')
    .order('paid_at', { ascending: false })
    .limit(25);

  // Map emails
  const ids = Array.from(new Set((recent||[]).map(r => r.affiliate_user_id)));
  let emails = new Map<string,string>();
  if (ids.length) {
    const { data: profs } = await svc.from('profiles').select('id,email').in('id', ids);
    emails = new Map((profs||[]).map(p => [p.id, p.email || '']));
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Affiliate Payout</h1>
          <p className="mt-1 text-sm text-neutral-400">Creates a cash-basis payout entry (used for 1099s). TPSO methods are auto-marked as 1099-K domain.</p>
        </div>
        <a href="/app/admin/tax" className="rounded bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800">Back to Tax</a>
      </div>

      {searchParams.ok === '1' && (
        <div className="mt-4 rounded bg-emerald-900/30 p-3 text-sm text-emerald-200 ring-1 ring-emerald-800">
          Payout recorded.
        </div>
      )}

      {/* Search affiliates */}
      <form className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search affiliates by email or name"
          className="w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"
        />
        <button className="rounded bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800">Search</button>
      </form>

      {/* Entry form */}
      <div className="mt-6 rounded-2xl border border-neutral-800 p-5">
        <NewPayoutForm users={users} />
      </div>

      <h2 className="mt-10 text-lg font-medium">Recent Payouts</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>When</th><th>Affiliate</th><th>Method</th><th>TPSO</th><th>Amount</th><th>Ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(recent||[]).map(r => (
              <tr key={r.id} className="[&>td]:px-4 [&>td]:py-3">
                <td className="text-neutral-400 whitespace-nowrap">{new Date(r.paid_at).toLocaleString()}</td>
                <td className="text-xs">{emails.get(r.affiliate_user_id) || r.affiliate_user_id}</td>
                <td className="uppercase text-xs">{r.method}</td>
                <td>{r.is_tpso ? 'yes' : 'no'}</td>
                <td>{fmt(r.amount_cents, r.currency)}</td>
                <td className="text-xs">{r.tx_ref || '—'}</td>
              </tr>
            ))}
            {(!recent || recent.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={6}>No payouts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Server action component */
async function NewPayoutForm({ users }:{
  users: { id: string; email: string | null; display_name: string | null }[];
}) {
  async function create(fd: FormData) {
    'use server';
    const svc = await getServerSupabase({ serviceRole: true }); // writes are server-only per RLS

    const userId = String(fd.get('affiliate_user_id') || '').trim();
    const emailFallback = String(fd.get('affiliate_email') || '').trim();
    const amount = Number(fd.get('amount') || 0);
    const currency = String(fd.get('currency') || 'USD').toUpperCase();
    const method = String(fd.get('method') || 'ach') as any;
    const paidAt = String(fd.get('paid_at') || new Date().toISOString());
    const txRef = String(fd.get('tx_ref') || '').trim();
    const notes = String(fd.get('notes') || '').trim();

    if (!userId && !emailFallback) throw new Error('Select an affiliate or enter an email');
    if (!(amount > 0)) throw new Error('Amount must be > 0');

    // resolve by email if no id provided
    let affiliateId = userId;
    if (!affiliateId && emailFallback) {
      const { data: prof } = await svc.from('profiles').select('id').eq('email', emailFallback).maybeSingle();
      if (!prof?.id) throw new Error('Email not found');
      affiliateId = prof.id;
    }

    const tpsos = new Set(['stripe','paypal','venmo','card']);
    const is_tpso = tpsos.has(method);

    const { error } = await svc.from('affiliate_payouts').insert({
      affiliate_user_id: affiliateId,
      amount_cents: Math.round(amount * 100),
      currency,
      method,
      is_tpso,
      paid_at: new Date(paidAt).toISOString(),
      tx_ref: txRef || null,
      notes: notes || null,
    });
    if (error) throw error;

    redirect('/admin/tax/payouts/new?ok=1');
  }

  return (
    <form action={create} className="grid grid-cols-1 gap-3 md:grid-cols-6">
      <div className="md:col-span-3">
        <label className="block text-xs text-neutral-400">Affiliate</label>
        <select name="affiliate_user_id" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
          <option value="">— Select by search —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {(u.email || u.display_name) ? `${u.email || ''}${u.display_name ? ' · ' + u.display_name : ''}` : u.id}
            </option>
          ))}
        </select>
        <div className="mt-1 text-xs text-neutral-500">Or enter email below if not in the dropdown.</div>
      </div>
      <div className="md:col-span-3">
        <label className="block text-xs text-neutral-400">Affiliate email (fallback)</label>
        <input name="affiliate_email" placeholder="someone@example.com"
               className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
      </div>

      <div>
        <label className="block text-xs text-neutral-400">Amount (USD)</label>
        <input name="amount" type="number" min={0.01} step="0.01"
               className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" required />
      </div>
      <div>
        <label className="block text-xs text-neutral-400">Currency</label>
        <input name="currency" defaultValue="USD"
               className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/>
      </div>
      <div>
        <label className="block text-xs text-neutral-400">Method</label>
        <select name="method" defaultValue="ach"
                className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
          <option value="ach">ACH</option>
          <option value="wire">Wire</option>
          <option value="check">Check</option>
          <option value="stripe">Stripe</option>
          <option value="paypal">PayPal</option>
          <option value="venmo">Venmo</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
        </select>
        <div className="mt-1 text-xs text-neutral-500">Stripe/PayPal/Venmo will be counted as TPSO (1099-K domain).</div>
      </div>
      <div>
        <label className="block text-xs text-neutral-400">Paid at</label>
        <input name="paid_at" type="datetime-local"
               className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
      </div>

      <div className="md:col-span-3">
        <label className="block text-xs text-neutral-400">Transaction ref</label>
        <input name="tx_ref" placeholder="bank ref / transfer id"
               className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
      </div>
      <div className="md:col-span-3">
        <label className="block text-xs text-neutral-400">Notes</label>
        <input name="notes"
               className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
      </div>

      <div className="md:col-span-6 flex items-center justify-end">
        <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">Record payout</button>
      </div>
    </form>
  );
}
