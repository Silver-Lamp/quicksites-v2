// app/partners/dashboard/page.tsx
// Partner-scoped dashboard: the logged-in partner's referral code, shareable
// signup link, referred merchants, and residual commissions (their codes only).
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import SiteHeader from '@/components/site/site-header';
import { PARTNER_FEE_SHARE, MAX_PLATFORM_FEE_PERCENT, RESIDUAL_MONTHS } from '@/lib/commerce/partner-terms';
import { getPartnerStats } from '@/lib/commerce/partnerStats';
import { JoinButton, CopyLink, ConnectPayouts } from './client';

export const dynamic = 'force-dynamic';

const usd = (c: number, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((Number(c) || 0) / 100);

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-zinc-800 p-5 ${highlight ? 'bg-sky-500/5' : 'bg-zinc-900/40'}`}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function PartnerDashboard() {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect('/login?next=/partners/dashboard');

  const admin = await getServerSupabase({ serviceRole: true });
  const { data: codes } = await admin
    .from('referral_codes')
    .select('code')
    .eq('owner_type', 'provider_rep')
    .eq('owner_id', user.id);

  const myCodes = (codes ?? []).map((c: any) => c.code);
  const base = process.env.QS_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Not yet a partner → show join.
  if (!myCodes.length) {
    return (
      <>
        <SiteHeader sticky />
        <main className="mx-auto max-w-2xl px-6 py-16 text-center text-white">
          <h1 className="text-3xl font-bold">Partner dashboard</h1>
          <p className="mx-auto mt-4 max-w-md text-zinc-400">
            Become a partner to get your referral link and start earning {Math.round(PARTNER_FEE_SHARE * 100)}% of
            every order your merchants process — for life.
          </p>
          <div className="mt-8 flex justify-center">
            <JoinButton />
          </div>
          <p className="mt-6 text-sm">
            <Link href="/partners" className="text-sky-400 underline underline-offset-4">← Back to the partner program</Link>
          </p>
        </main>
      </>
    );
  }

  const [stats, { data: payoutAcct }] = await Promise.all([
    getPartnerStats(admin, myCodes, user.id),
    admin.from('partner_payout_accounts').select('status').eq('user_id', user.id).eq('provider', 'stripe').maybeSingle(),
  ]);
  const payoutStatus = (payoutAcct as any)?.status ?? null;

  const { owed, totals, lifetime, referredCount, perMerchant, payouts, currency: cur } = stats;
  const primaryCode = myCodes[0];
  const shareLink = `${base}/join/${encodeURIComponent(primaryCode)}`;

  return (
    <>
      <SiteHeader sticky />
      <main className="mx-auto max-w-4xl px-6 py-12 text-white">
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-bold">Partner dashboard</h1>
          <Link href="/partners" className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200">
            Program terms
          </Link>
        </div>

        {/* Share link */}
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-sm font-medium">Your referral link</div>
          <p className="mb-3 mt-1 text-xs text-zinc-400">
            Share it. Merchants who sign up through it are attributed to your code{' '}
            <code className="rounded bg-zinc-900 px-1">{primaryCode}</code> — {RESIDUAL_MONTHS > 0 ? `${RESIDUAL_MONTHS}-month` : 'lifetime'} residual.
          </p>
          <CopyLink link={shareLink} />
        </div>

        {/* Numbers */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Referred merchants" value={String(referredCount)} />
          <Stat label="Lifetime earned" value={usd(lifetime, cur)} highlight />
          <Stat label="Pending payout" value={usd(owed, cur)} highlight />
          <Stat label="Paid out" value={usd(totals.paid, cur)} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Pending payout is everything accrued but not yet paid — {usd(totals.pending, cur)} awaiting the refund
          window plus {usd(totals.approved, cur)} approved and queued for the next payout run.
        </p>

        {/* Payouts connection */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="text-sm font-medium">Payouts</div>
          <p className="mb-3 mt-1 text-xs text-zinc-400">
            {payoutStatus === 'active'
              ? 'Your residual commissions are transferred to your connected Stripe account.'
              : 'Connect a Stripe account to receive your residuals. Until then, approved payouts are recorded for manual processing.'}
          </p>
          <ConnectPayouts status={payoutStatus} />
        </div>

        {/* Per-merchant earnings */}
        <div className="mt-8">
          <div className="mb-2 text-sm font-medium">Earnings by merchant</div>
          {perMerchant.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
              No referred merchants yet. Share your link above — you earn on every order they process.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-xs text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Merchant</th>
                    <th className="px-4 py-2 text-right font-medium">Orders</th>
                    <th className="px-4 py-2 text-right font-medium">Earned</th>
                    <th className="px-4 py-2 text-right font-medium">Unpaid</th>
                    <th className="px-4 py-2 text-right font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {perMerchant.map((m) => (
                    <tr key={m.merchantId} className="border-t border-zinc-800/80">
                      <td className="px-4 py-2">{m.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-400">{m.orderCount}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{usd(m.earned, cur)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-400">{usd(m.owed, cur)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-400">{usd(m.paid, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payout history */}
        {payouts.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 flex items-end justify-between">
              <div className="text-sm font-medium">Payout history</div>
              <Link href="/rep/payouts" className="text-xs text-zinc-400 underline underline-offset-4 hover:text-zinc-200">
                Full history &amp; tax
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-xs text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Method</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p, i) => (
                    <tr key={i} className="border-t border-zinc-800/80">
                      <td className="px-4 py-2 text-zinc-300">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-2 text-zinc-400 capitalize">{p.method ?? '—'}</td>
                      <td className="px-4 py-2 text-zinc-400 capitalize">{p.status ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{usd(p.amountCents, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="mt-6 text-sm text-zinc-400">
          You keep {Math.round(PARTNER_FEE_SHARE * 100)}% of every order fee (set up to{' '}
          {Math.round(MAX_PLATFORM_FEE_PERCENT * 100)}% per order). Payouts are processed from approved commissions.
        </p>
      </main>
    </>
  );
}
