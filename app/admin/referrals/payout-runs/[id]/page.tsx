// app/admin/referrals/payout-runs/[id]/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';

function fmt(cents = 0, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(cents / 100);
}

export const dynamic = 'force-dynamic';

export default async function PayoutRunDetail({ params }: { params: { id: string } }) {
  // Admin gate
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return <div className="p-8">Please sign in.</div>;
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) return <div className="p-8">Forbidden.</div>;

  const svc = await getServerSupabase({ serviceRole: true });
  const [{ data: run }, { data: items }] = await Promise.all([
    svc.from('payout_runs').select('*').eq('id', params.id).single(),
    svc.from('payout_run_items').select('referral_code, approved_cents_before, rows_marked, marked_paid_cents').eq('payout_run_id', params.id).order('referral_code'),
  ]);

  if (!run) return <div className="p-8">Run not found.</div>;
  const ledgerUrl = `/api/referrals/payout-runs/export-ledger?run_id=${params.id}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payout Run</h1>
        <a href={ledgerUrl} target="_blank" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800">Download Ledger CSV</a>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-800 p-4">
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div><span className="text-neutral-400">When:</span> {new Date(run.created_at).toLocaleString()}</div>
          <div><span className="text-neutral-400">Actor:</span> {run.actor_email || '—'}</div>
          <div><span className="text-neutral-400">Range:</span> <span className="font-mono">{run.range_start}</span> → <span className="font-mono">{run.range_end}</span></div>
          <div><span className="text-neutral-400">Codes:</span> {run.count_codes}</div>
          <div><span className="text-neutral-400">Approved (before):</span> {fmt(run.total_approved_cents_before)}</div>
          <div><span className="text-neutral-400">Marked Paid:</span> {fmt(run.total_marked_paid_cents)}</div>
          <div><span className="text-neutral-400">Rows Marked:</span> {run.count_rows_marked}</div>
        </div>
        {run.meta && (
          <pre className="mt-4 overflow-auto rounded bg-neutral-950 p-3 text-xs ring-1 ring-neutral-900">
            {JSON.stringify(run.meta, null, 2)}
          </pre>
        )}
      </div>

      <h2 className="mt-8 text-lg font-medium">Per-code breakdown</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>Code</th><th>Approved (before)</th><th>Rows Marked</th><th>Marked Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(items || []).map((it) => (
              <tr key={it.referral_code} className="[&>td]:px-4 [&>td]:py-3">
                <td className="font-mono">{it.referral_code}</td>
                <td>{fmt(it.approved_cents_before)}</td>
                <td>{it.rows_marked}</td>
                <td>{fmt(it.marked_paid_cents)}</td>
              </tr>
            ))}
            {(!items || items.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={4}>No items recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
