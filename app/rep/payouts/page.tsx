// app/rep/payouts/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';

function fmt(c:number, cur='USD'){ return new Intl.NumberFormat('en-US',{style:'currency',currency:cur}).format((c||0)/100); }

export const dynamic = 'force-dynamic';

export default async function MyPayouts({ searchParams }:{ searchParams: { year?: string } }) {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return <div className="p-8">Please sign in.</div>;

  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const taxYear = Number(searchParams.year || defaultYear);

  const { data: rows } = await supa
    .from('affiliate_payouts')
    .select('id, paid_at, amount_cents, currency, method, is_tpso, tx_ref')
    .eq('affiliate_user_id', u.user.id)
    .eq('tax_year', taxYear)
    .order('paid_at', { ascending: false });

  const total = (rows||[]).reduce((s,r)=>s+Number(r.amount_cents||0),0);
  const nonTpso = (rows||[]).filter(r=>!r.is_tpso).reduce((s,r)=>s+Number(r.amount_cents||0),0);
  const tpso = total - nonTpso;

  // By method
  const byMethod = new Map<string, number>();
  for (const r of (rows||[])) byMethod.set(r.method, (byMethod.get(r.method)||0) + Number(r.amount_cents || 0));

  const base = process.env.QS_PUBLIC_URL || '';

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Payouts</h1>
          <p className="mt-1 text-sm text-neutral-400">Calendar year {taxYear} (cash basis).</p>
        </div>
        <div className="flex items-center gap-2">
          <form>
            <input type="number" name="year" defaultValue={taxYear} className="w-24 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800"/>
            <button className="ml-2 rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">Go</button>
          </form>
          <a
            href={`${base}/api/rep/payouts/export?year=${taxYear}`}
            target="_blank"
            className="rounded bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800"
          >
            Download CSV
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Total received" value={fmt(total)} />
        <Card title="Non-TPSO (1099-NEC domain)" value={fmt(nonTpso)} />
        <Card title="TPSO (1099-K domain)" value={fmt(tpso)} />
      </div>

      {/* By method */}
      <div className="mt-6 rounded-2xl border border-neutral-800 p-4">
        <div className="text-sm font-medium">By Method</div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from(byMethod.entries()).map(([m,amt])=>(
            <div key={m} className="rounded border border-neutral-800 p-3 text-sm">
              <div className="text-xs text-neutral-400 uppercase">{m}</div>
              <div className="mt-1 font-semibold">{fmt(amt)}</div>
            </div>
          ))}
          {byMethod.size === 0 && <div className="text-sm text-neutral-500">No payouts yet.</div>}
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
              <th>When</th><th>Method</th><th>TPSO</th><th>Amount</th><th>Ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(rows||[]).map(r=>(
              <tr key={r.id} className="[&>td]:px-4 [&>td]:py-3">
                <td className="text-neutral-400 whitespace-nowrap">{new Date(r.paid_at).toLocaleString()}</td>
                <td className="uppercase text-xs">{r.method}</td>
                <td>{r.is_tpso ? 'yes' : 'no'}</td>
                <td>{fmt(r.amount_cents, r.currency)}</td>
                <td className="text-xs">{r.tx_ref || '—'}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr><td className="px-4 py-6 text-neutral-500" colSpan={5}>No payouts recorded for this year.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 p-4">
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
