// app/admin/partners/payouts/page.tsx — admin partner-payout console.
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { REFUND_WINDOW_DAYS } from '@/lib/commerce/partner-terms';
import PayoutsPanel from './panel';

export const dynamic = 'force-dynamic';

const usd = (c: number) => `$${((Number(c) || 0) / 100).toFixed(2)}`;

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-neutral-800 p-4 ${highlight ? 'bg-sky-500/5' : ''}`}>
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

export default async function AdminPayoutsPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-red-500">Admin access required.</div>;
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!, {
    auth: { persistSession: false },
  });

  const { data: ledger } = await db.from('commission_ledger').select('amount_cents, status');
  const totals: Record<string, number> = { pending: 0, approved: 0, paid: 0, void: 0 };
  for (const r of (ledger as any[]) ?? []) {
    if (r.status in totals) totals[r.status] += r.amount_cents;
  }

  const { data: payouts } = await db
    .from('affiliate_payouts')
    .select('amount_cents, method, tx_ref, paid_at')
    .order('paid_at', { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Partner payouts</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Approve commissions past the {REFUND_WINDOW_DAYS}-day refund window, then run payouts
        (real Stripe transfer to connected partners, else recorded for manual processing).
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Pending" value={usd(totals.pending)} />
        <Stat label="Approved (payable)" value={usd(totals.approved)} highlight />
        <Stat label="Paid" value={usd(totals.paid)} />
      </div>

      <div className="mt-6">
        <PayoutsPanel />
      </div>

      <h2 className="mt-10 text-sm font-semibold">Recent payouts</h2>
      <ul className="mt-3 divide-y divide-neutral-800 rounded-xl border border-neutral-800">
        {(payouts as any[] | null)?.length ? (
          (payouts as any[]).map((p, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-neutral-400">
                {new Date(p.paid_at).toLocaleDateString()} · {p.method}
                {p.tx_ref ? <span className="ml-2 font-mono text-xs">{p.tx_ref}</span> : null}
              </span>
              <span>{usd(p.amount_cents)}</span>
            </li>
          ))
        ) : (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">No payouts yet.</li>
        )}
      </ul>
    </div>
  );
}
