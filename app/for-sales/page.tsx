// app/for-sales/page.tsx
// UNLISTED brief for anyone considering commission sales on QuickSites — restaurants first, then
// the domain rental, the call sheet, and what it pays. Public URL, noindex, linked from nowhere;
// hand the link to one person at a time. Follows the /for-ryan · /for-daryle · /for-daniel pattern.
//
// Was /for-shelly, written for one named rep (Shelly Pritchard, 2026-08-24). She bowed out
// 2026-08-28 after four calls, so the page was generalised rather than deleted.
//
// ⚠️ SIMPLIFIED 2026-10-10 (owner: "simplify this page, and hide the 'straight talk' section").
// Gone from this page: the inline call script + objection cards (the call sheet at /for-sales/call
// renders the same lane spec, so nothing a rep needs was lost), the earnings chart + table, the
// "what is settled" / "what isn't proven" pair, and every "More detail" fold but one. Nothing
// here is new copy: every sentence that survives was already on the page.
// lib/sales/__tests__/forSalesBrief.test.ts pins that the straight-talk heading stays off.
//
// ⚠️ HONESTY RULES FOR THIS PAGE, AND THEY ARE THE POINT.
// A candidate is being asked to spend their time on an unproven product. Every number here is
// either measured or labelled as a proposal:
//   • 32 live domains — verified by fetching each one (32/32 HTTP 200, 2026-08-19).
//   • $99 → $399 — lib/outreach/geoPricing.ts TIER_PREMIUM, the real configured price.
// The split is 50/50 on anything they bring on, for the life of the account so long as they stay
// the rep on it — the residual follows the ROLE, not tenure (lib/commerce/rentalSplits.ts).
// Sandon's call, 2026-08-24. Two consequences are spelled out rather than left to be discovered:
// their half follows the $99 → $399 step-up (so $199.50/mo on a ranked domain), and it survives
// them stopping work.
//
// ⚠️ The "never promise" rule is load-bearing, not filler. We spent 2026-08-19 stripping invented
// promises off these exact sites. A script that re-adds them verbally puts them back where it
// counts — which is why the rule stays on the brief even though the call sheet carries it too.
import type { Metadata } from 'next';
import RestaurantsSection from '@/components/for-rep/restaurants-section';
import OtherVerticals, { OTHER_VERTICALS_COPY } from '@/components/for-rep/other-verticals';
import VerticalFlow from '@/components/for-rep/vertical-flow';
import SiteHeader from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'QuickSites — commission sales',
  description: 'What you would be selling, what a call looks like, and what it pays.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

/** Native-details expander — server-rendered, zero JS. */
function More({ label = 'More detail', children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {label}
      </summary>
      <div className="space-y-3 px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </details>
  );
}

function Card({
  title,
  tag,
  tone = 'amber',
  children,
  more,
  moreLabel,
}: {
  title: string;
  tag?: string;
  tone?: 'amber' | 'emerald' | 'rose';
  children: React.ReactNode;
  more?: React.ReactNode;
  moreLabel?: string;
}) {
  const ring =
    tone === 'emerald'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : tone === 'rose'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {tag && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${ring}`}
          >
            {tag}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
      {more && <More label={moreLabel}>{more}</More>}
    </div>
  );
}

const linkClass = 'text-emerald-400 underline underline-offset-4 hover:text-emerald-300';

export default async function ForSalesPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pb-10 pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
              Unlisted — sent to you directly
            </span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              Commission sales
            </span>
          </div>
          {/* Restaurants lead (owner, 2026-10-10) — a page cannot have two main events. The domain
              line keeps every number and sits second, where "Our other verticals" picks it up. */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">
            The fastest yes is a restaurant.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            <span className="text-zinc-200">
              A restaurant with a website and no online ordering pays nobody for orders today. You build
              its ordering page from the menu it already published, show it over lunch, and leave a card.
            </span>{' '}
            When they take it, you earn a share of every order for as long as they sell — and only then.
          </p>
          <p className="mt-4 text-base leading-relaxed text-zinc-400">
            Below that is the domain rental: I own 32 city-and-trade domains that are live right now,
            rented to the one business in that city that wants one for $99/month, with half of that to
            you every month for as long as they stay.
          </p>
        </section>

        {/* THE MAIN EVENT (owner, 2026-10-10): restaurants first — walk in, have lunch, drop a
            card. Everything else on the page sits under "Our other verticals". The divider's line
            is the short variant: this page carries no straight-talk section for it to point at. */}
        <RestaurantsSection code={null} repName="a QuickSites rep" token={null} prominent />
        <OtherVerticals line={OTHER_VERTICALS_COPY.lineBrief} />

        {/* The domain rental — three cards, the second with the one fold left on the page. */}
        <section className="mx-auto max-w-3xl space-y-4 px-6 pb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            The domain rental
          </h2>
          {/* What you do and what comes of it, as a flowchart (owner, 2026-10-10). Copy in
              lib/rep/verticalFlows.ts, held to the forbidden list there. */}
          <VerticalFlow flow="rental" />
          <Card title="An exact-match domain, rented — not a website" tag="$99/mo" tone="emerald">
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
              renton-towing.com
            </code>{' '}
            already exists, already has a site on it. You&apos;re renting it to one towing company
            in Renton for <span className="text-zinc-200">$99/month</span>, and that rate is locked
            for as long as they keep it. It&apos;s exclusive per city and trade — one renter each.
            When one reaches page one of Google, the list price becomes{' '}
            <span className="text-zinc-200">$399/month</span> for the next person. Whoever rented at
            $99 keeps paying $99.
          </Card>

          {/* ⚠️ This card exists because the page used to contradict itself: it said these domains
              "don't rank for anything" here and "several rank on page one" three cards later. Both
              were true — of different populations — and a rep reading top to bottom could not tell
              which. Naming the two tiers is the fix. The fold keeps the exact-match distinction and
              the map-results advice — the two lines that keep a true claim from becoming a complaint. */}
          <Card
            title="A few of them already rank. That is a different call."
            tag="proven"
            tone="emerald"
            more={
              <>
                <p>
                  One distinction to keep straight. What these domains win is their{' '}
                  <em>own exact-match name</em> — someone typing &ldquo;grafton towing&rdquo; finds
                  graftontowing.com. That is a real commercial search and it is worth selling. What
                  they do not win is the broad trade search: every &ldquo;towing near me&rdquo;-shaped
                  query we hold on page one has one or two impressions and zero clicks. So{' '}
                  <span className="text-zinc-200">&ldquo;type it in, that&apos;s us&rdquo;</span> is
                  true.{' '}
                  <span className="text-zinc-200">
                    &ldquo;Search for towing and you&apos;ll find us&rdquo;
                  </span>{' '}
                  is not.
                </p>
                <p>
                  If they already have a Google Business Profile — the listing that shows on the map
                  — pointing its website field at the rented domain is the most useful thing they can
                  do with it, and it costs you nothing to offer. We don&apos;t make those and never
                  will: a profile belongs to a real business at a real address. That is also why the
                  map results are not ours to promise.{' '}
                  <span className="text-zinc-200">Say the trade-off out loud</span> — if they point
                  their profile here and later stop renting, it points at a domain they don&apos;t
                  control.
                </p>
              </>
            }
          >
            Most of the inventory is new and ranks for nothing yet. A handful already hold page one
            for the exact phrase their customers type —{' '}
            <code className="rounded bg-zinc-800 px-1 text-zinc-200">grafton towing</code>,{' '}
            <code className="rounded bg-zinc-800 px-1 text-zinc-200">arab towing</code>,{' '}
            <code className="rounded bg-zinc-800 px-1 text-zinc-200">south hill towing</code>. Those
            sell in the present tense:{' '}
            <span className="text-zinc-200">
              &ldquo;Search it right now — go ahead, I&apos;ll wait.&rdquo;
            </span>{' '}
            Never in the future tense, which is a promise you cannot keep.
            {/* ⚠️ New tabs on purpose: both are references checked mid-read, and navigating away
                loses the reader's place. The rate card is admin-gated today — a known gap, not a
                decision; it is FOR reps. */}
            <p className="mt-3">
              Which domains are provable right now:{' '}
              <a href="/for-sales/rate-card" target="_blank" rel="noopener noreferrer" className={linkClass}>
                the rate card ↗
              </a>{' '}
              (reads Search Console when you open it; admin sign-in required for now) and{' '}
              <a href="/proof/rankings" target="_blank" rel="noopener noreferrer" className={linkClass}>
                real Google data ↗
              </a>{' '}
              for the domains we&apos;ve had up longest. Honest version: several rank on page one,
              and the traffic is small.
            </p>
          </Card>

          {/* ⚠️ This card exists to stop a rep spending calls on the wrong product. We also build
              sites for businesses that have none, and that product is deliberately NOT theirs —
              a commission on it cannot pay for a phone call, so it is self-serve or it is nothing.
              Naming it turns a "no" on the rental into somewhere to send them. No price here: the
              tiers are a proposal, and forSalesBrief.test.ts fails on a typed figure near it. */}
          <Card title="The other product — and why it isn’t a call" tag="not yours" tone="amber">
            Two different things get sold here. You sell the{' '}
            <span className="text-zinc-200">exact-match domain</span> — exclusive, one per city and
            trade, and worth a phone call. The{' '}
            <span className="text-zinc-200">build-them-a-website</span> product is self-serve on
            purpose, because a commission on it would not cover the call that sold it. The tiers are
            on{' '}
            <a href="/business-plan" target="_blank" rel="noopener noreferrer" className={linkClass}>
              the business plan
            </a>
            , written as a proposal rather than a rate, because nobody has been asked to pay one yet.
            <p className="mt-3">
              <span className="text-zinc-200">What it’s good for on your call:</span> a prospect who
              won’t rent the exact-match domain but has no website at all is not a dead lead. Send
              them the claim link and move on.
            </p>
          </Card>
          <VerticalFlow flow="website" />
        </section>

        {/* The call — the sheet is the script. It is deliberately a separate surface: nothing
            folds away there, and it works with no signal. */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            What a call looks like
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Ninety seconds to the point where they either want it or don&apos;t. The strong move is
            getting them to open the domain while you&apos;re talking — it stops being a pitch and
            starts being a thing they&apos;re looking at.
          </p>
          <a
            href="/for-sales/call"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 transition-colors hover:border-emerald-400/60"
          >
            <span>
              <span className="block text-base font-semibold text-white">The call sheet ↗</span>
              <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                The script, line by line, and every objection with its answer — the one page to keep
                open, or printed, while you&apos;re actually on the phone. No internet needed once
                it&apos;s loaded.
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-2xl text-emerald-400">
              ☎
            </span>
          </a>

          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/[0.05] p-5">
            <h3 className="text-base font-semibold text-white">
              ⚠️ The one rule I&apos;ll be strict about
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              <span className="font-semibold text-rose-300">
                Never promise a ranking, a call volume, or a result.
              </span>{' '}
              Not &ldquo;this&apos;ll get you on page one,&rdquo; not &ldquo;you&apos;ll get five
              calls a week.&rdquo; We don&apos;t know, and a promise like that is the kind of thing
              that ends up in a complaint with your name on it. Sell the domain, the exclusivity and
              the locked price. All three are true.
            </p>
          </div>
        </section>

        {/* Money */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            What it pays
          </h2>
          <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
            <p className="text-lg font-semibold text-white">
              Straight 50/50 on every rental you bring on — for as long as it stays.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {/* ⚠️ Scoped to RENTALS, not "anything you bring on": the broad wording would cover
                  the self-serve site, which is not a product anyone should be making calls about. */}
              Every <span className="font-semibold text-zinc-200">rental</span> account rents at{' '}
              <span className="font-semibold text-emerald-200">$99/month</span> and{' '}
              <span className="font-semibold text-emerald-200">$49.50 of it is yours</span>, every
              month, for the life of the account. Not a first-month bonus, not a shrinking trail —
              half, ongoing. And if one of your domains reaches page one, the rent steps to $399 —{' '}
              <span className="font-semibold text-emerald-200">$199.50/month to you</span>, on an
              account you already closed, for no extra work.
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-base font-semibold text-white">Two things to agree before you start</h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-400">
              <li>
                <span className="text-zinc-200">Who sends the checkout link.</span> Today I generate
                every one by hand, which makes me the bottleneck the moment you start closing. Say
                early whether you want your own operator login — it is a small change and a bad
                surprise in week two.
              </li>
              <li>
                <span className="text-zinc-200">What keeps the money coming?</span> You stay the rep
                on the accounts you close — the person that business calls about renewals, changes
                and questions. That&apos;s what makes &ldquo;life of the account&rdquo; work:
                you&apos;re still doing something, so it isn&apos;t a pension and I&apos;m not
                fielding their support. Hand one back whenever you want and the residual goes with
                it to whoever picks it up.
              </li>
            </ul>
          </div>
        </section>

        {/* Close */}
        <section className="mx-auto max-w-3xl px-6 pb-24 pt-8">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">If you want it</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              What we&apos;d agree first: which cities and trades you work, and the two open
              questions above. The split isn&apos;t one of them — 50/50 is the offer, and I&apos;d
              rather start there than negotiate you down to something that stops being worth your
              time in week three.
            </p>
            <p className="mt-3 text-sm font-medium text-amber-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
