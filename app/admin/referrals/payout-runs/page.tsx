// app/admin/referrals/payout-runs/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import Link from 'next/link';

function fmt(cents = 0, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(cents / 100);
}

export const dynamic = 'force-dynamic';

export default async function PayoutRunsIndex({
  searchParams,
}: {
  searchParams: { start?: string; end?: string; actor_email?: string; code?: string };
}) {
  // --- Admin gate (normal session; uses your profiles.role or user_metadata.role) ---
  const userClient = await getServerSupabase();
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return <div className="p-8">Please sign in.</div>;
  const { data: profile } = await userClient.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) return <div className="p-8">Forbidden.</div>;

  const start = searchParams.start || '';
  const end = searchParams.end || '';
  const actorEmail = searchParams.actor_email || '';
  const code = searchParams.code || '';

  // --- Query (service role; payout_runs is service-only) ---
  const svc = await getServerSupabase({ serviceRole: true });
  let q = svc
    .from('payout_runs')
    .select('id, created_at, actor_email, range_start, range_end, codes, total_approved_cents_before, total_marked_paid_cents, count_codes, count_rows_marked')
    .order('created_at', { ascending: false })
    .limit(500);

  if (start) q = q.gte('range_start', start);
  if (end) q = q.lte('range_end', end);
  if (actorEmail) q = q.ilike('actor_email', `%${actorEmail}%`);
  if (code) q = q.contains('codes', [code]); // array contains code

  const { data: runs } = await q;

  const exportHref = (() => {
    const u = new URL('/api/referrals/payout-runs/export', process.env.QS_PUBLIC_URL || 'http://localhost:3000');
    if (start) u.searchParams.set('start', start);
    if (end) u.searchParams.set('end', end);
    if (actorEmail) u.searchParams.set('actor_email', actorEmail);
    if (code) u.searchParams.set('code', code);
    return u.toString();
  })();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payout Runs</h1>
          <p className="mt-1 text-sm text-neutral-400">Read-only audit of completed payout runs.</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/referrals/payout-wizard" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800">
            Open Wizard
          </a>
          <a href={exportHref} target="_blank" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800">
            Download CSV (filtered)
          </a>
        </div>
      </div>

      {/* Filters */}
      <form className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-neutral-800 p-4 md:grid-cols-5">
        <div>
          <label className="block text-xs text-neutral-400">Start</label>
          <input name="start" type="date" defaultValue={start} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">End</label>
          <input name="end" type="date" defaultValue={end} className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">Actor email</label>
          <input name="actor_email" defaultValue={actorEmail} placeholder="admin@domain" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400">Referral code</label>
          <input name="code" defaultValue={code} placeholder="REP-ABC123" className="mt-1 w-full rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800" />
        </div>
        <div className="flex items-end">
          <button className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium">Apply</button>
        </div>
      </form>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>When</th>
              <th>Actor</th>
              <th>Range</th>
              <th>Codes</th>
              <th>Approved (before)</th>
              <th>Marked Paid</th>
              <th># Rows</th>
              <th>View</th>
              <th>Ledger CSV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(runs || []).map((r) => {
              const ledgerUrl = `/api/referrals/payout-runs/export-ledger?run_id=${r.id}`;
              return (
                <tr key={r.id} className="[&>td]:px-4 [&>td]:py-3">
                  <td className="whitespace-nowrap text-neutral-400">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="text-xs">{r.actor_email || '—'}</td>
                  <td className="text-xs">
                    <span className="font-mono">{r.range_start}</span> → <span className="font-mono">{r.range_end}</span>
                  </td>
                  <td className="text-xs">{r.count_codes} <span className="text-neutral-500">({(r.codes || []).slice(0,3).join(', ')}{(r.codes || []).length > 3 ? '…' : ''})</span></td>
                  <td>{fmt(r.total_approved_cents_before)}</td>
                  <td>{fmt(r.total_marked_paid_cents)}</td>
                  <td>{r.count_rows_marked}</td>
                  <td>
                    <Link href={`/admin/referrals/payout-runs/${r.id}`} className="underline">details</Link>
                  </td>
                  <td>
                    <a className="underline" href={ledgerUrl} target="_blank">download</a>
                  </td>
                </tr>
              );
            })}
            {(!runs || runs.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={9}>No runs found for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
