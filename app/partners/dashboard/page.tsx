// app/partners/dashboard/page.tsx
// Partner-scoped dashboard: the logged-in partner's referral code, shareable
// signup link, referred merchants, and residual commissions (their codes only).
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import SiteHeader from '@/components/site/site-header';
import { PARTNER_FEE_SHARE, MAX_PLATFORM_FEE_PERCENT, RESIDUAL_MONTHS } from '@/lib/commerce/partner-terms';
import { JoinButton, CopyLink } from './client';

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

  const [{ data: attrs }, { data: ledger }] = await Promise.all([
    admin.from('attributions').select('merchant_id').in('referral_code', myCodes),
    admin.from('commission_ledger').select('amount_cents, status, currency').in('referral_code', myCodes),
  ]);

  const totals = { pending: 0, approved: 0, paid: 0 };
  let cur = 'USD';
  for (const r of ledger ?? []) {
    cur = r.currency || cur;
    if (r.status === 'pending') totals.pending += r.amount_cents;
    else if (r.status === 'approved') totals.approved += r.amount_cents;
    else if (r.status === 'paid') totals.paid += r.amount_cents;
  }
  const lifetime = totals.pending + totals.approved + totals.paid;
  const primaryCode = myCodes[0];
  const shareLink = `${base}/?ref=${encodeURIComponent(primaryCode)}`;

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
          <Stat label="Referred merchants" value={String((attrs ?? []).length)} />
          <Stat label="Lifetime earned" value={usd(lifetime, cur)} highlight />
          <Stat label="Pending" value={usd(totals.pending, cur)} />
          <Stat label="Paid out" value={usd(totals.paid, cur)} />
        </div>

        <p className="mt-6 text-sm text-zinc-400">
          You keep {Math.round(PARTNER_FEE_SHARE * 100)}% of every order fee (set up to{' '}
          {Math.round(MAX_PLATFORM_FEE_PERCENT * 100)}% per order). Payouts are processed from approved commissions.
        </p>
      </main>
    </>
  );
}
