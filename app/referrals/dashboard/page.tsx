// app/referrals/dashboard/page.tsx
//
// The referral earnings dashboard for a code OWNER — what a referrer (e.g. Daniel) sees. Shows
// each code they own with signups + held/paid earnings, plus a link to the potential-earnings
// calculator. Codes match by owner_id OR (pre-claim) by owner_email == their login email, so a
// referrer we minted a code FOR sees it the moment they sign up, before the formal claim.
// Held = accrued but not yet transferred (they connect Stripe Connect → it transfers, or it
// transfers at the next sale if already connected).

import { signInHref } from '@/lib/auth/authLinks';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { earningsForOwner } from '@/lib/referrals/codes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Referral earnings', robots: { index: false } };

const fmt = (c: number, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((c || 0) / 100);

const planLabel = (plan: any) => {
  const rate = Math.round((Number(plan?.rate) || 0) * 100);
  const months = Number(plan?.duration_months) || 0;
  return `${rate}% · ${months === 0 ? 'lifetime' : `${months} months`}`;
};

export default async function ReferralDashboardPage() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user || user.is_anonymous) {
    return (
      <div className="mx-auto min-h-screen max-w-xl px-6 py-20 text-center text-zinc-300">
        <h1 className="text-2xl font-bold text-white">Referral earnings</h1>
        <p className="mt-3 text-sm text-zinc-400">Sign in to see your referral earnings.</p>
        <Link
          href={signInHref('/referrals/dashboard')}
          className="mt-6 inline-block rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const codes = await earningsForOwner({ userId: user.id, email: user.email });
  const totalHeld = codes.reduce((s, c) => s + c.held_cents, 0);
  const totalPaid = codes.reduce((s, c) => s + c.paid_cents, 0);
  const totalSignups = codes.reduce((s, c) => s + c.signups, 0);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-12 text-zinc-100">
      <div className="mb-1 text-sm font-medium text-sky-400">🎟️ Referral earnings</div>
      <h1 className="text-3xl font-bold tracking-tight">Your referral dashboard</h1>

      {codes.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-400">
          No referral codes are linked to your account yet. If someone set one up for you,
          it&apos;ll appear here once it&apos;s linked to this email ({user.email}).
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Held (pending payout)" value={fmt(totalHeld)} tone="amber" />
            <Stat label="Paid out" value={fmt(totalPaid)} tone="emerald" />
            <Stat label="Signups" value={String(totalSignups)} tone="sky" />
          </div>

          <ul className="mt-6 space-y-2">
            {codes.map((c) => (
              <li key={c.code} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-base font-semibold text-white">{c.code}</span>
                  <span className="text-xs text-zinc-400">{planLabel(c.plan)}</span>
                  {!c.claimed_at && (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                      held — connect payouts to release
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-4 text-xs">
                    <span className="text-zinc-400">
                      {c.signups} signup{c.signups === 1 ? '' : 's'}
                    </span>
                    <span className="text-amber-300">{fmt(c.held_cents, c.currency)} held</span>
                    <span className="text-emerald-300">{fmt(c.paid_cents, c.currency)} paid</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {totalHeld > 0 && (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-zinc-300">
              You have <span className="font-semibold text-amber-300">{fmt(totalHeld)}</span>{' '}
              accrued and held. Connect Stripe Connect to release it — anything held transfers to
              you at that point, and future earnings transfer at the time of each sale.
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href="/partners/calculator"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
        >
          Potential earnings calculator →
        </Link>
        <Link
          href="/partners"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
        >
          How the program works
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'amber' | 'emerald' | 'sky';
}) {
  const color =
    tone === 'amber' ? 'text-amber-300' : tone === 'emerald' ? 'text-emerald-300' : 'text-sky-300';
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}
