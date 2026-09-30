// app/admin/commission-scenarios/page.tsx
//
// "How much can my people make" — the question from the Daryle call (2026-09-30) that nobody
// could answer live. Admin-gated: this shows what real people would be paid, and
// app/admin/layout.tsx only checks "logged in and not a guest", so the gate belongs here.
//
// Sibling of /admin/splits, which is the RENTAL rail's settled policy and live ledger. This one
// is the commerce rail and is deliberately a what-if: nothing here writes anything.
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import CommissionScenarios from '@/components/admin/commission-scenarios';
import RoleLadderTool from '@/components/admin/role-ladder-tool';
import {
  MAX_PLATFORM_FEE_PERCENT,
  PARTNER_FEE_SHARE,
  QS_FEE_SHARE,
  AFFILIATE_FEE_SHARE,
  ORIGINATION_UPLINE_POOL_SHARE,
} from '@/lib/commerce/partner-terms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function CommissionScenariosPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-sm text-muted-foreground">
        Admins only.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-[11px] font-medium uppercase tracking-wide text-sky-400">Commerce rail</p>
      <h1 className="mt-1 text-2xl font-semibold">Commission scenarios</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Move the splits and see who gets paid on one order. This runs the{' '}
        <span className="text-foreground">same allocator the payment path runs</span> — what you
        see here is what would post to the ledger, not an approximation of it.
      </p>

      {/* ⚠️ The distinction the whole page turns on. Stated above the sliders because reading
          the 80% as a closing commission is the mistake that prompted this to exist. */}
      <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p>
          <span className="font-medium text-foreground">The big share is an operating margin,
          not a closing commission.</span>{' '}
          An <span className="text-foreground">operator</span> keeps{' '}
          {Math.round(PARTNER_FEE_SHARE * 100)}% because they onboard, brand and{' '}
          <em>support</em> the merchant. An <span className="text-foreground">origination</span>{' '}
          chain closes the account and moves on — QuickSites supports it — so the closer keeps{' '}
          {Math.round(AFFILIATE_FEE_SHARE * 100)}% and more of the fee stays available to the
          people above the sale.
        </p>
        <p className="mt-2 text-muted-foreground">
          Upline pool: {Math.round(QS_FEE_SHARE * 100)}% of the fee on an operator sale,{' '}
          {Math.round(ORIGINATION_UPLINE_POOL_SHARE * 100)}% on an origination sale. Never more
          than the house actually retains, so a closer&rsquo;s residual can never fund an upline.
        </p>
      </div>

      <div className="mt-6">
        <CommissionScenarios
          maxFeePercent={MAX_PLATFORM_FEE_PERCENT}
          operatorShare={PARTNER_FEE_SHARE}
          affiliateShare={AFFILIATE_FEE_SHARE}
          operatorPool={QS_FEE_SHARE}
          originationPool={ORIGINATION_UPLINE_POOL_SHARE}
        />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">The ladder — who is in the chain, and what they earn</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          How far down this can go, what each rung is called, what they are responsible for, and
          what they take home. Examples use stand-in names — <strong>Alice</strong> and{' '}
          <strong>Danny</strong> for the two real people, invented names for everyone else, because
          these diagrams get forwarded.
        </p>
        {/* ⚠️ The finding this makes visible: the ladder runs out of vocabulary before it runs out
            of rungs. Three names are real (`owner_type`, `set-hub`); above that they are
            proposals, and the person the owner most wants paid sits on an unnamed rung. */}
        <p className="mt-2 max-w-2xl text-sm text-amber-300/90">
          Rungs are marked with where their name actually comes from. Only three are real names
          the code branches on — the rest are proposed here and nowhere else.
        </p>
        <div className="mt-5">
          <RoleLadderTool maxFeePercent={MAX_PLATFORM_FEE_PERCENT} />
        </div>
      </section>

      <p className="mt-8 text-xs text-muted-foreground">
        Nothing is configured from this page — rates live on{' '}
        <code>referral_codes.override_share</code> and <code>parent_code</code>. Every one is{' '}
        <span className="text-amber-300">0 today</span>, so no override has ever been paid. See{' '}
        <Link href="/partners/terms" className="text-sky-400 underline underline-offset-4">
          the partner terms
        </Link>{' '}
        for what a partner is shown, and <code>docs/RENTAL_SPLITS.md</code> for the rental rail.
      </p>
    </div>
  );
}
