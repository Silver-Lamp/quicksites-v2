// app/partners/terms/page.tsx
//
// The page a partner FORWARDS. `/partners` sells the program; this one states its mechanics
// precisely enough that someone recruiting their own network can send it instead of paraphrasing.
//
// ⚠️ EVERY FIGURE IS READ FROM lib/commerce/partner-terms.ts — never typed into the copy. That
// module is what `createDraftOrder`, `markOrderPaid` and `runPayouts` actually use, so a number
// written here by hand could drift from the money without anything failing. `termsFigures.test.ts`
// greps this file for the literal percentages and fails on any.
//
// ⚠️ IT DESCRIBES MECHANICS, NEVER TRACTION. No partner counts, no earnings examples presented as
// typical, no "our partners make". Nothing has been paid out of this ledger yet, and a page that
// implied otherwise would be the first false claim in the program's own terms.
//
// ⚠️ PAYOUT TIMING IS STATED AS IT ACTUALLY WORKS. Commissions approve automatically after the
// refund window; the payout RUN is operator-triggered today (PARTNER_PAYOUTS_CRON_ENABLED is not
// set in production, deliberately — that cron moves real money). Promising a payment date the
// system does not keep is the one thing a terms page must not do.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import {
  MAX_PLATFORM_FEE_PERCENT,
  PARTNER_FEE_SHARE,
  QS_FEE_SHARE,
  RESIDUAL_MONTHS,
  REFUND_WINDOW_DAYS,
  DEFAULT_UPLINE_FEE_SHARE,
  AFFILIATE_FEE_SHARE,
  AFFILIATE_MAX_FEE_SHARE,
} from '@/lib/commerce/partner-terms';
import { marketingOg } from '@/lib/marketingOg';

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const maxFee = pct(MAX_PLATFORM_FEE_PERCENT);
const keep = pct(PARTNER_FEE_SHARE);
const house = pct(QS_FEE_SHARE);
const upline = pct(DEFAULT_UPLINE_FEE_SHARE);
const affiliate = pct(AFFILIATE_FEE_SHARE);
const affiliateMax = pct(AFFILIATE_MAX_FEE_SHARE);
const residual = RESIDUAL_MONTHS > 0 ? `${RESIDUAL_MONTHS} months` : 'for the life of the account';

export const metadata = marketingOg({
  title: 'Partner terms — QuickSites',
  description: `The exact mechanics: set your merchants' order fee up to ${maxFee}, keep ${keep} of it ${residual}, with overrides funded out of the QuickSites share. Written to be forwarded.`,
  path: '/partners/terms',
  ogEyebrow: 'Partner terms',
  ogTitle: 'The mechanics, in full.',
  ogSubtitle: `Keep ${keep} of every order fee, ${residual}. No setup fee, no minimum, no exclusivity.`,
});

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <tr className="border-t border-zinc-800 align-top">
      <td className="py-3 pr-4 text-zinc-400">{k}</td>
      <td className="py-3">
        <div className="font-medium text-zinc-100">{v}</div>
        {note ? <div className="mt-0.5 text-sm text-zinc-500">{note}</div> : null}
      </td>
    </tr>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-14 text-2xl font-semibold text-white">{children}</h2>;
}

export default function PartnerTermsPage() {
  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-zinc-950 text-zinc-200">
        <div className="mx-auto w-full max-w-3xl px-6 py-14">
          <p className="text-[11px] font-medium uppercase tracking-wide text-sky-400">
            Partner terms
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
            What you earn, and when.
          </h1>
          <p className="mt-4 text-lg text-zinc-400">
            The reseller program in full — the numbers the billing code actually uses, not a
            summary of them. Written so you can forward it.
          </p>

          <H>The core deal</H>
          <table className="mt-4 w-full text-[15px]">
            <tbody>
              <Row
                k="Hosting"
                v="Free"
                note="For you and for every merchant you bring. There is no per-site fee."
              />
              <Row
                k="The order fee"
                v={`You set it, up to ${maxFee}`}
                note="Charged on each order your merchants process. You choose the number per merchant; it is capped in code, not by policy."
              />
              <Row
                k="Your share"
                v={`${keep} of every fee`}
                note={`QuickSites keeps ${house}. Your share is protected in code — nothing below can reduce it.`}
              />
              <Row
                k="How long"
                v={residual}
                note="Not a first-year rate. It does not step down, and it is not tied to you staying active."
              />
              <Row
                k="Setup fee / minimum / exclusivity"
                v="None of the three"
                note="No monthly commitment, no seat count, and you may resell anything else you like."
              />
            </tbody>
          </table>

          <H>When you get paid</H>
          <p className="mt-3 text-zinc-400">
            A commission is written to the ledger the moment an order is paid, then moves through
            two steps.
          </p>
          <table className="mt-4 w-full text-[15px]">
            <tbody>
              <Row
                k="1 · Pending"
                v={`${REFUND_WINDOW_DAYS} days`}
                note="A refunded order reverses its fee, so a commission cannot be paid before the refund window closes. This step is automatic."
              />
              <Row
                k="2 · Approved → paid"
                v="On a payout run"
                note="Paid by Stripe Connect transfer to your connected account. Payout runs are started by a person, not on a fixed date — we would rather tell you that than print a schedule we do not keep."
              />
            </tbody>
          </table>
          {/* ⚠️ Do not replace the line above with a promised payout day unless
              PARTNER_PAYOUTS_CRON_ENABLED is actually true in production. */}

          <H>If you recruit other resellers</H>
          <p className="mt-3 text-zinc-400">
            You can bring in other resellers and earn an override on what they produce — a second
            tier, paid for the life of the account.
          </p>
          <table className="mt-4 w-full text-[15px]">
            <tbody>
              <Row
                k="Default override"
                v={`${upline} of the order fee`}
                note="Set per relationship; this is the figure used when no other is agreed."
              />
              <Row
                k="Who funds it"
                v={`The QuickSites ${house} — never the reseller's ${keep}`}
                note="Clamped in code. Someone above you in the chain cannot reduce what the person doing the work earns."
              />
              <Row
                k="Order of payment"
                v="Nearest the sale first"
                note={`Overrides share the ${house} house slice, so the total across all tiers cannot exceed it.`}
              />
            </tbody>
          </table>

          <H>Just referring, not operating?</H>
          <p className="mt-3 text-zinc-400">
            A reseller onboards merchants, brands the product and supports their book. If you only
            want to pass along a name, that is the affiliate tier instead.
          </p>
          <table className="mt-4 w-full text-[15px]">
            <tbody>
              <Row k="Affiliate share" v={`${affiliate} of the order fee`} note={`Up to ${affiliateMax} for founding-cohort codes.`} />
              <Row
                k="How long"
                v={residual}
                note="Same lifetime basis as the reseller tier — a smaller share of the same fee, for much less work."
              />
              <Row
                k="One safeguard"
                v="Capped so an order never goes underwater"
                note="On a very small order, card processing can exceed the fee. The affiliate cut is trimmed so that cannot happen; on ordinary orders it never binds."
              />
            </tbody>
          </table>

          <H>White-label, in practice</H>
          <ul className="mt-4 space-y-2 text-zinc-300">
            <li>• Your brand, your logo and your colours on everything your merchants see.</li>
            <li>• Your own domain for the app — merchants sign in at your address, not ours.</li>
            <li>• Transactional email from your domain once you verify it.</li>
            <li>• Merchants pay through your connected payment processor; the money is yours first.</li>
            <li>• You set each merchant&rsquo;s fee individually, not one rate across your book.</li>
          </ul>
          <p className="mt-4 text-zinc-400">
            You can turn all of this on yourself from the{' '}
            <Link href="/partners/dashboard" className="text-sky-400 underline underline-offset-4">
              partner dashboard
            </Link>{' '}
            — brand, domain, email, payouts, share.
          </p>

          <H>What we will not do</H>
          {/* The constraints are part of the terms. A partner who finds these out later
              discovers them as a broken promise instead of a known boundary. */}
          <ul className="mt-4 space-y-2 text-zinc-300">
            <li>
              • <span className="text-white">Take your merchants.</span> We do not market to them,
              and we do not contact them behind you.
            </li>
            <li>
              • <span className="text-white">Change your share retroactively.</span> A rate change
              applies to new accounts, never to a book you have already built.
            </li>
            <li>
              • <span className="text-white">Write health, income or performance claims</span> for
              a merchant, in any vertical. We will build the store; the claims are theirs to make
              and theirs to stand behind.
            </li>
            <li>
              • <span className="text-white">Onboard a business our payment processor prohibits.</span>{' '}
              Some categories cannot be supported whatever the margin — ask before you sell into
              one, not after.
            </li>
          </ul>

          <div className="mt-14 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h3 className="text-lg font-semibold text-white">Questions the page did not answer</h3>
            <p className="mt-2 text-zinc-400">
              Terms for an unusual book — a large network, an existing client base to migrate, or a
              vertical you want checked before you sell into it — are a conversation, not a form.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="mailto:partners@quicksites.ai?subject=Partner%20terms"
                className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-sky-400"
              >
                partners@quicksites.ai
              </a>
              <Link
                href="/partners/calculator"
                className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                Model your own numbers →
              </Link>
              <Link
                href="/partners"
                className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                ← Program overview
              </Link>
            </div>
          </div>

          <p className="mt-10 text-xs text-zinc-500">
            These are the operating terms of the partner program and the figures the billing system
            uses today. They are not a contract; a signed agreement governs where the two differ.
            We will tell partners in writing before changing a rate, and a change never applies
            backwards.
          </p>
        </div>
      </main>
    </>
  );
}
