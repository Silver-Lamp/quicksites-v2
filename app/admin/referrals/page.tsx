// app/admin/referrals/page.tsx
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

function fmtCents(c: number, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((c || 0) / 100);
}

export const dynamic = 'force-dynamic';

export default async function AdminReferralsPage() {
  const supabase = await getServerSupabase({ serviceRole: true });

  const [{ data: codes }, { data: ledger }] = await Promise.all([
    supabase.from('referral_codes').select('code, owner_type, owner_id, plan').order('code'),
    supabase.from('commission_ledger').select('referral_code, amount_cents, status, currency'),
  ]);

  const byCode = new Map<string, { pending: number; approved: number; paid: number; currency: string }>();
  (ledger || []).forEach((row) => {
    const agg = byCode.get(row.referral_code) || { pending: 0, approved: 0, paid: 0, currency: row.currency || 'USD' };
    if (row.status === 'pending') agg.pending += row.amount_cents;
    else if (row.status === 'approved') agg.approved += row.amount_cents;
    else if (row.status === 'paid') agg.paid += row.amount_cents;
    byCode.set(row.referral_code, agg);
  });

  const base = process.env.QS_PUBLIC_URL || 'https://www.quicksites.ai';

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Referrals</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Share links like <code className="px-1 rounded bg-neutral-900">{base}/?ref=CODE</code>.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <CreateCodeForm />
        <MarkPaidPanel codes={(codes || []).map(c => c.code)} />
      </div>

      <div className="mt-4">
        <a href="/admin/referrals/payout-wizard"
            className="inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800 hover:bg-neutral-800">
            Open Payout Run Wizard
        </a>
      </div>

      <div className="mt-10 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>Code</th>
              <th>Owner Type</th>
              <th>Owner ID</th>
              <th>Plan</th>
              <th>Pending</th>
              <th>Approved</th>
              <th>Paid</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(codes || []).map((c) => {
              const a = byCode.get(c.code) || { pending: 0, approved: 0, paid: 0, currency: 'USD' };
              const plan = typeof c.plan === 'object' ? JSON.stringify(c.plan) : String(c.plan);
              const link = `${base}/?ref=${encodeURIComponent(c.code)}`;
              return (
                <tr key={c.code} className="[&>td]:px-4 [&>td]:py-3">
                  <td className="font-mono">{c.code}</td>
                  <td>{c.owner_type}</td>
                  <td className="font-mono text-xs">{c.owner_id}</td>
                  <td className="text-xs">{plan}</td>
                  <td>{fmtCents(a.pending, a.currency)}</td>
                  <td>{fmtCents(a.approved, a.currency)}</td>
                  <td>{fmtCents(a.paid, a.currency)}</td>
                  <td>
                    <a className="underline" href={link} target="_blank">open</a>
                    <button className="ml-3 rounded bg-neutral-800 px-2 py-1 text-xs"
                      onClick={async () => { await navigator.clipboard.writeText(link); }}>
                      copy
                    </button>
                  </td>
                </tr>
              );
            })}
            {(!codes || codes.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={8}>No referral codes yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateCodeForm() {
  async function create(formData: FormData) {
    'use server';
    await fetch(`${process.env.QS_PUBLIC_URL || ''}/api/referrals/create-code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: String(formData.get('code') || '').trim(),
        ownerType: String(formData.get('ownerType') || 'provider_rep'),
        ownerId: String(formData.get('ownerId') || '').trim(),
        plan: {
          type: 'percent',
          rate: Number(formData.get('rate') || 20) / 100,
          duration_months: Number(formData.get('duration') || 12),
        },
      }),
      cache: 'no-store',
    });
    redirect('/admin/referrals');
  }

  return (
    <form action={create} className="rounded-xl border border-neutral-800 p-4">
      <div className="text-sm font-medium">Create code</div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="block text-xs text-neutral-400">Code</label>
          <input name="code" required placeholder="REP-ABC123" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">Owner type</label>
          <select name="ownerType" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
            <option value="provider_rep">provider_rep</option>
            <option value="qs_affiliate">qs_affiliate</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-neutral-400">Owner ID (uuid)</label>
          <input name="ownerId" required placeholder="user uuid" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">% (default 20)</label>
          <input name="rate" type="number" min={1} max={100} defaultValue={20} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">Months (default 12)</label>
          <input name="duration" type="number" min={0} defaultValue={12} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div className="md:col-span-6">
          <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">Create code</button>
        </div>
      </div>
    </form>
  );
}

function MarkPaidPanel({ codes }: { codes: string[] }) {
  async function markPaid(fd: FormData) {
    'use server';
    const body = {
      code: String(fd.get('code') || ''),
      start: String(fd.get('start') || '') || undefined,
      end: String(fd.get('end') || '') || undefined,
    };
    await fetch(`${process.env.QS_PUBLIC_URL || ''}/api/referrals/mark-paid`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    redirect('/admin/referrals');
  }

  return (
    <form action={markPaid} className="rounded-xl border border-neutral-800 p-4">
      <div className="text-sm font-medium">Mark “approved” commissions as “paid”</div>
      <p className="mt-1 text-xs text-neutral-400">Choose a code and optional date range (UTC). Useful for month-end payout runs.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="block text-xs text-neutral-400">Referral code</label>
          <select name="code" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">
            {codes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-400">Start (YYYY-MM-DD)</label>
          <input name="start" type="date" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">End (YYYY-MM-DD)</label>
          <input name="end" type="date" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div className="md:col-span-4 flex items-center justify-end">
          <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">Mark paid</button>
        </div>
      </div>
    </form>
  );
}
