// app/for-shelly/page.tsx
// Personal, UNLISTED orientation page for Shelly Pritchard — a cold-call salesperson evaluating
// commission work on QuickSites. Public URL, noindex, linked from nowhere. Follows the
// /for-ryan · /for-daryle · /for-daniel pattern.
//
// ⚠️ HONESTY RULES FOR THIS PAGE, AND THEY ARE THE POINT.
// She is being asked to spend her time on an unproven product. Every number here is either
// measured or labelled as a proposal:
//   • 32 live domains — verified by fetching each one (32/32 HTTP 200, 2026-08-19).
//   • $99 → $399 — lib/outreach/geoPricing.ts TIER_PREMIUM, the real configured price.
//   • 0 rented, checkout never run live — stated plainly in "Straight talk", not buried.
//   • 0 replies of 19 on SMS — stated, because she will find out on call ~40 anyway and it is
//     better she hears it from us first.
// The split is 50/50 on anything she brings on, for the life of the account — Sandon's call,
// 2026-08-24, replacing an earlier "first month 100% + 15%" proposal of mine. Two consequences are
// spelled out on the page rather than left to be discovered: her half follows the $99 → $399
// step-up (so $199.50/mo on a ranked domain), and it survives her stopping work.
//
// ⚠️ The "what not to say" card is load-bearing, not filler. We spent 2026-08-19 stripping
// invented promises off these exact sites ("fully licensed and insured", "we respond within the
// hour"). A script that re-adds them verbally puts them back where it counts.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'QuickSites — for Shelly',
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

export default function ForShellyPage() {
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
              Unlisted — just for you
            </span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              Draft — for Friday
            </span>
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Shelly 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            Here&apos;s the picture before we talk Friday, so you&apos;re not hearing it cold. Short
            version:{' '}
            <span className="text-zinc-200">
              I own 32 city-and-trade domains that are live right now, and the product is renting
              one of them to the one business in that city that wants it.
            </span>{' '}
            You can click any of them below while you read this.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            I&apos;ve written the awkward parts down too — what hasn&apos;t worked yet, and what
            isn&apos;t finished. You&apos;d be spending your time on this, and you can&apos;t price
            that without the bad news.
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
          </Card>
        </section>

        {/* The call */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            What a call looks like
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Roughly ninety seconds to the point where they either want it or don&apos;t. The strong
            move is getting them to open the domain while you&apos;re talking — it stops being a
            pitch and starts being a thing they&apos;re looking at.
          </p>

          <div className="mt-4 space-y-2">
            <Say who="you">
              &ldquo;Hi — is this the owner? My name&apos;s Shelly, I&apos;m calling from
              QuickSites. This&apos;ll take a minute and it&apos;s not a website pitch. Do you have
              a browser in front of you?&rdquo;
            </Say>
            <Say who="you">
              &ldquo;Type in <span className="text-amber-200">renton-towing.com</span>. That&apos;s
              ours. We buy the city-and-trade domain and rent it to one business in town — and
              nobody has that one yet.&rdquo;
            </Say>
            <Say who="them">&ldquo;…okay, I&apos;m looking at it. What is this?&rdquo;</Say>
            <Say who="you">
              &ldquo;It&apos;s a working site on the exact name people type when they need a tow in
              Renton. Rent it and it&apos;s yours — your phone number, your name on it, and no other
              tow company in Renton can have it. Ninety-nine a month.&rdquo;
            </Say>
            <Say who="them">&ldquo;Does it come up on Google?&rdquo;</Say>
            <Say who="you">
              &ldquo;Not yet — it&apos;s new, and I&apos;m not going to promise you it will. What I
              can tell you is the price is ninety-nine now and it&apos;s three-ninety-nine once one
              of these reaches page one. If you&apos;re in at ninety-nine you stay at ninety-nine.
              That&apos;s the whole reason to do it today rather than later.&rdquo;
            </Say>
            <Say who="them">&ldquo;What do I have to do?&rdquo;</Say>
            <Say who="you">
              &ldquo;Give me the number you want calls going to and an email. I&apos;ll send a link,
              you put a card in, and I&apos;ll have your details on the site same day. Cancel
              whenever — there&apos;s no contract.&rdquo;
            </Say>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Card title="&ldquo;I already have a website.&rdquo;" tone="amber">
              Good — this isn&apos;t a replacement. It&apos;s a second front door on the name people
              actually type, and it can point at the site they already have.
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
              is month-to-month with no contract, which is also what makes it easy to sell. Read it
              as the shape, not a forecast.
            </p>

            <p className="mt-4 text-sm leading-relaxed text-zinc-300">
              And if one of your domains reaches page one, the rent steps to $399 —{' '}
              <span className="font-semibold text-emerald-200">$199.50/month to you</span>, on an
              account you already closed, for no extra work.
            </p>

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
            <h3 className="text-base font-semibold text-white">Two things to nail down Friday</h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-400">
              <li>
                <span className="text-zinc-200">Does your half follow the step-up?</span> Written
                above as yes — you closed the account, and the price rising isn&apos;t your doing.
                Worth us both saying it out loud rather than discovering it later.
              </li>
              <li>
                <span className="text-zinc-200">What if you stop calling?</span> My answer is the
                accounts you closed keep paying you — that is what &ldquo;life of the account&rdquo;
                means. Better said now than wondered about in six months.
              </li>
            </ul>
          </div>
        </section>

        {/* Straight talk */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Straight talk — what isn&apos;t proven
          </h2>
          <div className="mt-3 space-y-3">
            <Card title="Nobody has rented one of these yet" tag="0 rented" tone="rose">
              Zero. You&apos;d be the first person to try to sell it. The price is set and the sites
              are live, but no one has said yes to it.
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
            <Card title="The checkout hasn't taken a live payment" tag="in progress" tone="rose">
              The Stripe path is built but has never run end-to-end. I&apos;m fixing that before you
              make a single call — closing someone and then not being able to bill them is worse
              than not closing them.
            </Card>
          </div>
        </section>

        {/* Close */}
        <section className="mx-auto max-w-3xl px-6 pb-24 pt-8">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">Friday</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              What I&apos;d like to agree: which cities and trades you start with, and the two open
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
