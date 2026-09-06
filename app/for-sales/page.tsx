// app/for-sales/page.tsx
// UNLISTED brief for anyone considering commission sales on QuickSites — what the product is,
// what a call sounds like, what it pays, and what is not proven. Public URL, noindex, linked
// from nowhere; hand the link to one person at a time. Follows the /for-ryan · /for-daryle ·
// /for-daniel pattern.
//
// Was /for-shelly, written for one named rep (Shelly Pritchard, 2026-08-24). She bowed out
// 2026-08-28 after four calls, so the page was generalised rather than deleted: everything on
// it except her name applied to the next person too, and her four calls are now the only real
// data any candidate has. /for-shelly is gone; the outbound record moved into "what isn't
// proven", which is where it belongs.
//
// ⚠️ HONESTY RULES FOR THIS PAGE, AND THEY ARE THE POINT.
// A candidate is being asked to spend their time on an unproven product. Every number here is
// either measured or labelled as a proposal:
//   • 32 live domains — verified by fetching each one (32/32 HTTP 200, 2026-08-19).
//   • $99 → $399 — lib/outreach/geoPricing.ts TIER_PREMIUM, the real configured price.
//   • 0 rented — stated plainly in "Straight talk", not buried. One trial from four calls never
//     billed, and a trial is not a rental until it does.
//   • 0 replies of 19 on SMS — stated, because they will find out around call forty anyway and
//     it is better they hear it here first.
// The split is 50/50 on anything they bring on, for the life of the account so long as they stay
// the rep on it — the residual follows the ROLE, not tenure (lib/commerce/rentalSplits.ts).
// Sandon's call, 2026-08-24, replacing an earlier "first month 100% + 15%" proposal of mine. Two
// consequences are spelled out rather than left to be discovered: their half follows the
// $99 → $399 step-up (so $199.50/mo on a ranked domain), and it survives them stopping work.
//
// ⚠️ The "what not to say" card is load-bearing, not filler. We spent 2026-08-19 stripping
// invented promises off these exact sites ("fully licensed and insured", "we respond within the
// hour"). A script that re-adds them verbally puts them back where it counts.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import EarningsLines from '@/components/charts/earnings-lines';

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

/**
 * Section-level disclosure. Same language as <More>, but sized to wrap a whole block —
 * the call script and the objection cards are worth keeping and not worth making her
 * scroll past on a page she is reading between calls.
 */
function FoldSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="inline-block text-zinc-600 transition-transform group-open:rotate-90"
        >
          ›
        </span>
        {label}
        {hint && <span className="ml-auto text-xs font-normal text-zinc-600">{hint}</span>}
      </summary>
      <div className="border-t border-zinc-800/70 px-4 pb-5 pt-4">{children}</div>
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

/** One line of the call script. */
function Say({ who, children }: { who: 'you' | 'them'; children: React.ReactNode }) {
  const mine = who === 'you';
  return (
    <div
      className={`rounded-lg border p-3 text-sm leading-relaxed ${
        mine
          ? 'border-amber-500/25 bg-amber-500/[0.05] text-zinc-200'
          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
      }`}
    >
      <span
        className={`mr-2 text-[11px] font-semibold uppercase tracking-wide ${mine ? 'text-amber-400' : 'text-zinc-500'}`}
      >
        {mine ? 'You' : 'Them'}
      </span>
      {children}
    </div>
  );
}

const SAMPLE_DOMAINS = [
  'renton-towing.com',
  'boston-plumbing.com',
  'lynn-towing.com',
  'arlington-electrical.com',
  'huntsville-towing.com',
  'framingham-plumbing.com',
  'boston-contractor.com',
  'seatac-towing.com',
];

export default function ForSalesPage() {
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
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">
            Selling a domain, not a website
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            <span className="text-zinc-200">
              I own 32 city-and-trade domains that are live right now. The product is renting one of
              them to the one business in that city that wants it, for $99/month.
            </span>{' '}
            You get half of that, every month, for as long as they stay.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            This is the whole brief: the mechanics, the numbers, the script, and the parts that
            aren&apos;t proven. Everything is expandable, so read the headlines and open only what
            you want. If you take this on, the last section is the one that matters most —
            it&apos;s what I can&apos;t yet promise you.
          </p>
        </section>

        {/* The product */}
        <section className="mx-auto max-w-3xl space-y-4 px-6 pb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            What you&apos;d be selling
          </h2>
          <Card
            title="An exact-match domain, rented — not a website"
            tag="$99/mo"
            tone="emerald"
            more={
              <>
                <p>
                  A tow operator in Renton can buy ads, or he can <em>be</em>{' '}
                  <code className="rounded bg-zinc-800 px-1 text-zinc-200">renton-towing.com</code>.
                  The domain is the pitch; the site on it is just what makes it real on the call.
                </p>
                <p>
                  It&apos;s exclusive per city and trade — one renter each. That&apos;s the whole
                  reason it can be sold on a phone call: there is exactly one of them, and the
                  person you&apos;re talking to either takes it or a competitor down the road does.
                </p>
              </>
            }
          >
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
              renton-towing.com
            </code>{' '}
            already exists, already has a site on it. You&apos;re renting it to one towing company
            in Renton for <span className="text-zinc-200">$99/month</span>, and that rate is locked
            for as long as they keep it.
          </Card>

          <Card
            title="The price goes up. Theirs doesn't."
            tag="$99 → $399"
            tone="amber"
            more={
              <p>
                It&apos;s automatic, not a sales tactic — a job checks the domain&apos;s Google
                position and steps the list price to $399 once it reaches page one. Anyone already
                renting stays where they signed. That&apos;s the actual close: not &ldquo;it&apos;ll
                rank,&rdquo; but &ldquo;if it does, you&apos;re already in at a quarter of the
                price.&rdquo;
              </p>
            }
          >
            Today these domains don&apos;t rank for anything — they&apos;re new. When one reaches
            page one of Google, the list price becomes{' '}
            <span className="text-zinc-200">$399/month</span> for the next person. Whoever rented at
            $99 keeps paying $99.
          </Card>

          <Card
            title="Your inventory — live, right now"
            tag="32 domains"
            tone="emerald"
            more={
              <p className="text-zinc-400">
                Mostly towing, plus plumbing, electrical, HVAC and general contracting, across WA,
                MA, AL and TN. All 32 were verified serving in the last pass. Roughly 60 more
                domains are bought but not yet pointed — inventory, not stock you can sell today.
              </p>
            }
          >
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SAMPLE_DOMAINS.map((d) => (
                <a
                  key={d}
                  href={`https://${d}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
                >
                  {d} ↗
                </a>
              ))}
            </div>
            <p className="mt-3">
              Click one. That&apos;s what the person on the phone will be looking at.
            </p>
            <p className="mt-3">
              And for the &ldquo;does this actually work&rdquo; question —{' '}
              {/* ⚠️ New tab on purpose: this brief is what she works from on a call, and the
                  rankings page is a reference she checks mid-read. Navigating away loses her place
                  in the script and the objection cards. Every other outbound link here already
                  opens in a new tab; this one was the exception. */}
              <a
                href="/proof/rankings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
              >
                here&apos;s real Google data ↗
              </a>{' '}
              for the domains we&apos;ve had up longest. Honest version: several rank on page one,
              and the traffic is small. Worth reading before you quote numbers to anyone.
            </p>
            {/* ⚠️ Admin-gated today, and that is a known gap rather than a decision: the rate card
                is FOR reps, but operator access is the same open question that makes
                geo-campaign/rent `if (!operator) 403`. Settle both together. */}
            <p className="mt-3">
              Live pricing and which domains are provable right now:{' '}
              <a
                href="/for-sales/rate-card"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
              >
                the rate card ↗
              </a>{' '}
              — it reads Search Console at render and can be refreshed on the spot, so the position
              you quote is today&apos;s rather than a number someone wrote down. Admin sign-in
              required for now.
            </p>
            {/* ⚠️ Added 2026-09-05 after re-measuring. The page-one figures on /proof/rankings are
                per-QUERY positions; the GSC site averages for the same domains are 12-21. Both are
                true and they answer different questions, and a rep quoting the first as "where the
                domain ranks" is overstating by about ten positions. The distinction below is the
                one that keeps a true claim from becoming a complaint. */}
            <p className="mt-3">
              One distinction to keep straight. What these domains win is their{' '}
              <em>own exact-match name</em> — someone typing &ldquo;grafton towing&rdquo; finds
              graftontowing.com. That is a real commercial search and it is worth selling. What they
              do not win is the broad trade search: every &ldquo;towing near me&rdquo;-shaped query
              we hold on page one has one or two impressions and zero clicks, and the whole
              portfolio took three page-one clicks in twenty-eight days. So{' '}
              <span className="text-zinc-200">&ldquo;type it in, that&apos;s us&rdquo;</span> is
              true.{' '}
              <span className="text-zinc-200">
                &ldquo;Search for towing and you&apos;ll find us&rdquo;
              </span>{' '}
              is not.
            </p>
          </Card>
        </section>

        {/* The call */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            What a call looks like
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Ninety seconds to the point where they either want it or don&apos;t. The strong move is
            getting them to open the domain while you&apos;re talking — it stops being a pitch and
            starts being a thing they&apos;re looking at.
          </p>

          {/* ⚠️ New tab on purpose, same reason as the rankings link below: the call sheet is
              what she works FROM while the phone is ringing, and navigating away loses her
              place in this page. It is deliberately a separate surface — everything here folds
              away for a second read, and nothing folds away there. */}
          <a
            href="/for-sales/call"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 transition-colors hover:border-emerald-400/60"
          >
            <span>
              <span className="block text-base font-semibold text-white">
                The call sheet ↗
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                The one-page version to keep open — or printed — while you&apos;re actually on
                the phone. Every objection and its answer, visible at once, no scrolling and no
                internet needed once it&apos;s loaded.
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-2xl text-emerald-400">
              ☎
            </span>
          </a>

          <FoldSection label="The script, line by line" hint="and the four objections">
            <div className="mt-4 space-y-2">
              <Say who="you">
                &ldquo;Hi — is this the owner? My name&apos;s [your name], I&apos;m calling from
                QuickSites. This&apos;ll take a minute and it&apos;s not a website pitch. Do you
                have a browser in front of you?&rdquo;
              </Say>
              <Say who="you">
                &ldquo;Type in <span className="text-amber-200">renton-towing.com</span>.
                That&apos;s ours. We buy the city-and-trade domain and rent it to one business in
                town — and nobody has that one yet.&rdquo;
              </Say>
              <Say who="them">&ldquo;…okay, I&apos;m looking at it. What is this?&rdquo;</Say>
              <Say who="you">
                &ldquo;It&apos;s a working site on the exact name people type when they need a tow
                in Renton. Rent it and it&apos;s yours — your phone number, your name on it, and no
                other tow company in Renton can have it. Ninety-nine a month.&rdquo;
              </Say>
              <Say who="them">&ldquo;Does it come up on Google?&rdquo;</Say>
              <Say who="you">
                &ldquo;Not yet — it&apos;s new, and I&apos;m not going to promise you it will. What
                I can tell you is the price is ninety-nine now and it&apos;s three-ninety-nine once
                one of these reaches page one. If you&apos;re in at ninety-nine you stay at
                ninety-nine. That&apos;s the whole reason to do it today rather than later.&rdquo;
              </Say>
              <Say who="them">&ldquo;What do I have to do?&rdquo;</Say>
              <Say who="you">
                &ldquo;Give me the number you want calls going to and an email. I&apos;ll send a
                link, you put a card in, and I&apos;ll have your details on the site same day.
                Cancel whenever — there&apos;s no contract.&rdquo;
              </Say>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card title="&ldquo;I already have a website.&rdquo;" tone="amber">
                Good — this isn&apos;t a replacement. It&apos;s a second front door on the name
                people actually type, and it can point at the site they already have.
              </Card>
              <Card title="&ldquo;Ninety-nine for what, exactly?&rdquo;" tone="amber">
                The name, exclusively, in their town. If one call a month turns into a job, it paid
                for itself several times over — but let them do that math out loud, don&apos;t do it
                for them.
              </Card>
              <Card title="&ldquo;Call me back later.&rdquo;" tone="amber">
                Fine — but the domain is first-come. Take the callback and note it; do not invent a
                deadline that isn&apos;t real.
              </Card>
              <Card title="&ldquo;Who are you people?&rdquo;" tone="amber">
                A small studio in Seattle that builds these. Send them{' '}
                <Link href="/" className="text-amber-400 underline underline-offset-4">
                  quicksites.ai
                </Link>{' '}
                and let them look while you&apos;re on the line.
              </Card>
            </div>
          </FoldSection>

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
              that ends up in a complaint with your name on it.
            </p>
            <More label="Why I care about this more than the sale">
              <p>
                These sites shipped with invented lines on them — fake five-star reviews, &ldquo;we
                respond within the hour,&rdquo; &ldquo;fully licensed and insured&rdquo; — for
                businesses that don&apos;t exist yet. I spent a day stripping every one of them out
                before putting the domains in front of you.
              </p>
              <p>
                It would be a bad joke to clean the pages and then have the pitch put the promises
                back verbally. Sell the domain, the exclusivity and the locked price. All three are
                true.
              </p>
            </More>
          </div>
        </section>

        {/* Money */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            What it pays
          </h2>
          <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
            <p className="text-lg font-semibold text-white">
              Straight 50/50 on anything you bring on — for as long as it stays.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Every account rents at{' '}
              <span className="font-semibold text-emerald-200">$99/month</span> and{' '}
              <span className="font-semibold text-emerald-200">$49.50 of it is yours</span>, every
              month, for the life of the account. Not a first-month bonus, not a shrinking trail —
              half, ongoing.
            </p>

            {/* ⚠️ Chart AND table, not chart instead of table. The chart makes the compounding
                legible — which is the actual question she is asking — and the table keeps the
                exact figures checkable. A projection drawn as a line looks like history, so the
                caption says what it is on the chart itself, not in a footnote.
                Folded, not cut: she has read this once already, and on a second visit the
                headline (half of $99, ongoing) is the part she needs at a glance. */}
            <FoldSection label="What that adds up to" hint="chart + exact figures">
              <EarningsLines />

              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">If you close&hellip;</th>
                      <th className="px-4 py-2 text-right font-medium">Your monthly, a year in</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    <tr className="border-t border-zinc-800/70">
                      <td className="px-4 py-2">1 a week</td>
                      <td className="px-4 py-2 text-right font-mono">$2,574/mo</td>
                    </tr>
                    <tr className="border-t border-zinc-800/70">
                      <td className="px-4 py-2">2 a week</td>
                      <td className="px-4 py-2 text-right font-mono">$5,148/mo</td>
                    </tr>
                    <tr className="border-t border-zinc-800/70">
                      <td className="px-4 py-2">3 a week</td>
                      <td className="px-4 py-2 text-right font-mono">$7,722/mo</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                &#9888;&#65039; That assumes every account stays the full year. Some won&apos;t — it
                is month-to-month with no contract, which is also what makes it easy to sell. Read
                it as the shape, not a forecast.
              </p>

              <p className="mt-4 text-sm leading-relaxed text-zinc-300">
                And if one of your domains reaches page one, the rent steps to $399 —{' '}
                <span className="font-semibold text-emerald-200">$199.50/month to you</span>, on an
                account you already closed, for no extra work.
              </p>
            </FoldSection>

            <More label="Why half, rather than a smaller trail">
              <p>
                Because I&apos;d rather you owned the accounts than rented them from me. A small
                percentage makes this a side gig you drop the moment something better turns up; half
                makes it worth building. The inventory is sitting at zero occupancy — half of
                something beats all of nothing.
              </p>
              <p>
                My side still works: roughly $48.50/month per account after the domain cost, on
                domains I already own and pages already built.
              </p>
            </More>
          </div>

          <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-base font-semibold text-white">
              Two things to agree before you start
            </h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-400">
              <li>
                <span className="text-zinc-200">Does your half follow the step-up?</span> Written
                above as yes — you closed the account, and the price rising isn&apos;t your doing.
                Worth us both saying it out loud rather than discovering it later.
              </li>
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
                it to whoever picks it up. Worth agreeing out loud — it&apos;s money, but it&apos;s
                also a small ongoing job.
              </li>
            </ul>
          </div>
        </section>

        {/* Straight talk */}
        <section className="mx-auto max-w-3xl px-6 pb-2 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            What is settled
          </h2>
          <div className="mt-3">
            <Card
              title="The checkout bills, and keeps billing"
              tag="3 cycles"
              tone="emerald"
              more={
                <>
                  <p>
                    A real card, a real charge, and three consecutive automatic renewals — on a plan
                    billing daily rather than monthly, so the second cycle arrived in a day instead
                    of a month. Every one was written back to our own records, not just
                    Stripe&apos;s.
                  </p>
                  <p>
                    An earlier version of this page said the checkout worked while it had never
                    taken a live payment. That was wrong to leave standing and it was fixed on
                    2026-08-28 by running real money through it rather than by rewording the page.
                  </p>
                </>
              }
            >
              If someone says yes today, you can take their money and it will keep arriving on its
              own.
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Straight talk — what isn&apos;t proven
          </h2>
          <div className="mt-3 space-y-3">
            <Card title="Nobody has rented one of these yet" tag="0 rented" tone="rose">
              Zero paid rentals to date. The price is set and the sites are live; what has never
              happened is a stranger putting a card in. The one live subscription in our records is
              my own card, run to prove the billing works.
            </Card>
            <Card
              title="One salesperson has tried this. Four calls, no sale."
              tag="4 calls"
              tone="rose"
              more={
                <>
                  <p>
                    She made four cold calls in a week and got one business interested enough to be
                    called a trial. It never billed, and she stopped shortly after. Four calls is
                    not a close rate — it is one afternoon and one person&apos;s manner — but it is
                    the entire history of anyone selling this, and you should have it before you
                    decide.
                  </p>
                  <p>
                    What I take from it: nothing about demand yet, and one thing about me — a rep
                    who cannot send their own checkout link is waiting on me to close their deal.
                  </p>
                </>
              }
            >
              The only person to sell this before you made four calls, got one &ldquo;trial,&rdquo;
              and it never became a payment. A trial isn&apos;t a rental until it bills.
            </Card>
            <Card
              title="I texted 19 businesses a free site and got 0 replies"
              tag="0 of 19"
              tone="rose"
              more={
                <p>
                  Different offer, different channel — that was SMS giving away a free menu site to
                  restaurants. It rules out a <em>strong</em> response at that volume; it
                  doesn&apos;t say much about a phone call selling a domain. But it&apos;s the only
                  real outbound data I have and you should have it too.
                </p>
              }
            >
              Not one reply of any kind, including &ldquo;no thanks.&rdquo; That was a different
              offer on a different channel, but you&apos;d find out around call forty anyway.
            </Card>
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
