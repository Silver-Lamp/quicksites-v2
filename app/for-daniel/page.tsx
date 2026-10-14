// app/for-daniel/page.tsx
// Personal, UNLISTED page for Daniel Russo (ScaleUp Software; majority owner of DeckSketch).
// Rewritten 2026-10-13 (owner: "make sure his for-daniel is fully updated with how it all works,
// for the UK example, and for the Italy example, so that we can simplify our understanding"):
//   1. How it works now — his white-label reseller org (`scaleup-software`), his partner code
//      (`daniel`, converted in place from the affiliate code this page used to describe), the
//      four dashboard steps, the money in order, and what DeliveredMenu is.
//   2. Example: a UK sales rep — the rep page, the build/text flow, and that the rep's code is
//      OWNED BY DANIEL so its orders land on his ledger and he pays the rep.
//   3. Example: the Italy restaurant — Option B (booking as a DeliveredMenu capability, resold
//      white-label), the steps, who pays whom, and that the subscription split is a SEPARATE term
//      from his order-fee share.
//   4. DeckSketch — the seams already running, unchanged (a separate relationship).
//
// Honesty rules: every card is tagged live / next / proposed; the two numbers about his money
// (partner share, fee cap) are read from lib/commerce/partner-terms, never typed; the Italy
// proposal's prices and split are NOT repeated here (they live on HJ's passphrase-protected
// proposal page and are Sandon's to set); no third party is named. The earlier promises this
// page made — the code `daniel`, the `?ref=daniel` link, a lifetime share, "the top rate" —
// all still hold; the rate only went up. Pinned by lib/forDaniel/__tests__/forDaniel.test.ts.
// Public URL, noindex, linked from nowhere.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
// The two numbers the page states about his money come from the module that pays them, so the
// page cannot drift from the ledger (lib/forDaniel/__tests__/forDaniel.test.ts pins it).
import { PARTNER_FEE_SHARE, MAX_PLATFORM_FEE_PERCENT, AFFILIATE_MAX_FEE_SHARE, QS_FEE_SHARE } from '@/lib/commerce/partner-terms';
// The folded cards /for-sales and /spread-the-word use: one sentence per pitch, boxes inside,
// native <details>, zero JS (owner, 2026-10-13: "simplify it as much as possible").
import { Pitch, SubBox } from '@/components/for-rep/pitch';

const partnerPct = Math.round(PARTNER_FEE_SHARE * 100);
const feeCapPct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
// The direct-pay route's two ceilings as configured today: a rep's own rate, and the override a
// hub may take on a rep's sale (clampOverrideShare caps it at the house share). Read, not typed,
// so the page cannot promise a split the ledger would refuse.
const repMaxPct = Math.round(AFFILIATE_MAX_FEE_SHARE * 100);
const overrideCapPct = Math.round(QS_FEE_SHARE * 100);
const CODE = 'rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200';
const LINK = 'text-amber-400 underline underline-offset-4 hover:text-amber-300';

/** The prose inside an opened box. */
function Body({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-3 px-6 pb-4 pt-2 text-sm leading-relaxed text-zinc-400">{children}</div>;
}

export const metadata: Metadata = {
  title: 'ScaleUp Software × QuickSites — for Daniel',
  description: 'How the reseller setup, a UK rep, and the Italy restaurant work — and the DeckSketch seams.',
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

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-sm leading-relaxed text-zinc-400">
      <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
        Example
      </span>
      {children}
    </div>
  );
}

function Card({
  title,
  tag,
  children,
  more,
  moreLabel,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
  more?: React.ReactNode;
  moreLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {tag && (
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
            {tag}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
      {more && <More label={moreLabel}>{more}</More>}
    </div>
  );
}

export default function ForDanielPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pt-16 pb-10">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
            Unlisted — just for you
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Daniel 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            Four sentences. Open any of them for the gears. Every box says whether a thing is{' '}
            <span className="text-emerald-300">live</span>, <span className="text-amber-300">next</span>{' '}
            or <span className="text-sky-300">proposed</span>.
          </p>
        </section>

        {/* ───────────── 1. How it works now ───────────── */}
        <Pitch summary={`ScaleUp Software resells DeliveredMenu under your brand. Your code daniel keeps ${partnerPct}% of every order fee, for life.`} art="business">
          <SubBox title="Your org and your dashboard" line="Live. A white-label reseller org, you as owner, four steps to finish — only the first is waiting on you.">
            <Body>
              <p>
                Your organisation on the platform is <code className={CODE}>scaleup-software</code>. On a reseller
                org the client-facing surfaces carry your name and logo instead of ours: sign-in and join pages,
                the editor chrome, and the welcome, invite and order emails. Dashboard:{' '}
                <Link href="/partners/dashboard" className={LINK}>/partners/dashboard</Link>.
              </p>
              <p>
                <span className="text-zinc-200">1. Brand</span> — name, support email, logo, accent. Waiting on you.{' '}
                <span className="text-zinc-200">2. Domain</span> — the address your restaurants sign in at, e.g.{' '}
                <code className={CODE}>app.scaleupsoftware.io</code>; one DNS record, and <code className={CODE}>/login</code>,{' '}
                <code className={CODE}>/join/daniel</code> and the editor render under your brand there with no change on our side.{' '}
                <span className="text-zinc-200">3. Email domain</span> — optional; emails go out from your domain.{' '}
                <span className="text-zinc-200">4. Payouts</span> — connect Stripe; until then approved commissions are
                recorded and paid by hand, nothing is lost by waiting.
              </p>
            </Body>
          </SubBox>
          <SubBox title="Your code and the money" line={`Live. Same code, same link as before — now a partner code at the top rate: ${partnerPct}% of the platform fee, lifetime.`}>
            <Body>
              <p>
                <code className={CODE}>daniel</code> · <code className={CODE}>www.quicksites.ai/?ref=daniel</code>. It only
                went up: an affiliate code became a partner code tied to your account. The platform fee is capped
                at {feeCapPct}% of an order; you keep {partnerPct}% of that fee on every order a merchant under your
                code processes, for as long as their account lives.
              </p>
              <p>
                In order: a customer orders from a restaurant&apos;s page → the restaurant is paid through Stripe →
                the platform fee is taken → {partnerPct}% of it is credited to your ledger the same day → paid out on
                the next run, or held for you until you connect Stripe. The restaurant pays nothing to keep the page;
                the only money is a share of orders that actually happen. Your dashboard shows signups, accrued, held
                and paid — live numbers.
              </p>
            </Body>
          </SubBox>
          <SubBox title="What DeliveredMenu is" line="Live. An ordering page built from a restaurant's own menu, at <name>.delivered.menu or their own domain.">
            <Body>
              <p>
                Built from photos, a PDF, or the menu on their current website. The owner confirms prices,
                &ldquo;Add to order&rdquo; goes through Stripe, and &ldquo;book a table&rdquo; is the next thing being
                built (the Italy story below). The builder underneath is QuickSites; what a restaurant sees is
                DeliveredMenu, and under your org it is DeliveredMenu with your name on the chrome.
              </p>
            </Body>
          </SubBox>
        </Pitch>

        {/* ───────────── 2. The UK rep ───────────── */}
        <Pitch summary="A rep in the UK walks restaurants, builds their ordering page, and every order they bring lands on your ledger." art="lunch">
          <SubBox title="What the rep does" line="Live. Their own unlisted page, a live table of restaurants that take no orders online, build and text from a row.">
            <Body>
              <p>
                The rep gets <code className={CODE}>/for-&lt;name&gt;</code>: the restaurants in their city that have a
                site but take no orders online, and a &ldquo;sweep where I am&rdquo; button that finds more. From a row
                they press <em>Build their ordering page</em> (made from the restaurant&apos;s own published menu) and{' '}
                <em>Text them</em> (a message pointing at it). They walk in, have lunch, drop a card. The owner claims
                the page from the link on it and it goes live.
              </p>
              <p>
                Every printed or prefilled sentence is held to a forbidden list — no ranking promises, no 24/7, no
                guarantee, no printed price. The rep writes the message; the page only prefills a start. A menu that
                cannot be read from the restaurant&apos;s own material is not invented.
              </p>
            </Body>
          </SubBox>
          <SubBox title="How the rep is paid — two ways, your call" line={`Live, minted by Sandon for now. Either the rep's code is owned by you and you pay them, or we pay the rep directly through Stripe; the two of you share the same ${partnerPct}% either way.`}>
            <Body>
              <p>
                <span className="text-zinc-200">Through you (the default).</span> The rep&apos;s code is a child of
                yours and owned by you. Every restaurant the rep signs up is recorded against the rep&apos;s code, and
                the {partnerPct}% it earns lands on <em>your</em> ledger, not theirs; you pay the rep from your share
                on whatever terms you agree, and we never set their rate. The dashboard shows which code brought which
                restaurant, so the arithmetic is yours and easy to check.
              </p>
              <p>
                <span className="text-zinc-200">Or we pay the rep directly.</span> The same payout engine that pays
                you can pay them: the rep gets their own code with their own rate, connects their own Stripe account,
                and their cut is transferred on the same payout run as yours — nothing for you to move by hand, and
                they see their own numbers on their own dashboard. Your cut on those orders is then an override on
                their code. As configured today the rep&apos;s own rate can be up to {repMaxPct}% of the fee and your
                override up to {overrideCapPct}% — together less than the {partnerPct}% you keep when it runs through
                you, because an override is capped so it can never be funded out of the rep&apos;s own residual.
                Raising that cap so the two of you share the full {partnerPct}% directly is a configuration decision
                Sandon would make with you, not a build. Tell him the split and which way you want it; either can be
                changed later without touching anything the rep sees.
              </p>
              <p>
                One thing neither of you sets today: the per-order platform fee itself (capped at {feeCapPct}%, default
                below that). The terms say a partner sets it; the control is{' '}
                <span className="text-amber-300">next</span> on your dashboard. Until then, ask Sandon.
              </p>
              <p>
                <span className="text-amber-300">Next:</span> an &ldquo;Add a rep&rdquo; control on your dashboard
                that mints the code and the page yourself (today: send Sandon a name, an email and a city).{' '}
                <span className="text-amber-300">Next:</span> the restaurant pages and claim pages a rep builds carry
                your brand (today only the sign-in, join and editor chrome are yours). Neither is needed for a rep to
                start.
              </p>
            </Body>
          </SubBox>
        </Pitch>

        {/* ───────────── 3. Italy ───────────── */}
        <Pitch summary="The restaurant in Italy: table booking built into DeliveredMenu, resold under your brand — proposed, nothing built yet." art="business">
          <SubBox title="The shape, and who pays whom" line="Proposed · nothing built yet. Option B recommended; Option A (he owns it, EU-hosted) stays in as the pricier alternative.">
            <Body>
              <p>
                He wants a booking page his customers use, a phone screen where he adds a booking in seconds and a
                cancellation frees the table, and later to sell it to other restaurants. Sandon chose <em>Option B</em>:
                build booking into DeliveredMenu — every restaurant site gets &ldquo;book a table&rdquo; next to
                &ldquo;order&rdquo; and &ldquo;call&rdquo; — and license it to him white-label through an org exactly
                like yours.
              </p>
              <p>
                The proposal is in steps, each priced and timed on its own: booking first, then his floor plan
                (drawing the room, placing tables, bookings on a table — a tool we build, so its own step), then a
                food-cost calculator, then the white-label SaaS to resell, with analytics and staff shifts after. The
                build steps are paid through you on Upwork. Once restaurants are on it they pay a monthly subscription,
                billed under the reseller&apos;s brand and shared with us — the larger share to the reseller. Prices and
                the exact split live on the proposal page (passphrase-protected, Sandon&apos;s to set); this page does
                not repeat them. Data is US-hosted with a GDPR data-processing agreement to be put in place before
                launch; a &ldquo;lifetime&rdquo; price for hosted software is an obligation with no end date, so we
                proposed a subscription or a one-time price plus a small yearly fee.
              </p>
            </Body>
          </SubBox>
          <SubBox title="How this differs from your order-fee share" line="Read this one. Two separate terms on two separate kinds of money.">
            <Body>
              <p>
                Your {partnerPct}% is a share of the <em>per-order platform fee</em> on DeliveredMenu orders, unchanged.
                A booking is not an order and carries no fee, so the Italy product earns through a <em>monthly
                subscription</em> with its own split. Neither changes the other.
              </p>
            </Body>
          </SubBox>
          <SubBox title="What exists today, so the quote is honest" line="Live. A scheduler with a no-overlap rule and zero bookings ever; 300 restaurant sites with a menu; no floor plan, food cost, shifts or Italian yet.">
            <Body>
              <p>
                QuickSites already has a scheduler with slot math and a database rule that two bookings cannot overlap
                on one table — used on two sites, with zero bookings ever taken, so it is a schema, not a product.
                Three hundred restaurant sites carry a menu. There is no floor plan, no food-cost model, no staff
                scheduler and no Italian-language layer; those are the steps, priced as builds. DeckSketch was asked
                whether its 2D editor could carry the floor plan and said build our own, which the quote already
                assumed.
              </p>
            </Body>
          </SubBox>
        </Pitch>

        {/* ───────────── 4. DeckSketch ───────────── */}
        <Pitch summary="DeckSketch × QuickSites: the seams already running, unchanged by any of the above." art="business">
          <section className="mx-auto max-w-3xl px-6 pb-2 pt-4">
            <p className="text-sm leading-relaxed text-zinc-500">
              A separate relationship from the reseller one: every website we build for a deck builder is a live
              front door for DeckSketch&apos;s estimating engine, and our outreach engine puts DeckSketch in front of
              builders who have never heard of it. The clean-split rules below still hold — neither product owns the
              other&apos;s customer.
            </p>
          </section>
        {/* The core seam */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            What&apos;s live between the two products
          </h2>
          <div className="mt-4 space-y-4">
            <Card
              title="Every deck-builder site is a DeckSketch demo in front of a real homeowner"
              tag="live · prod-verified"
              moreLabel="How the estimate seam works"
              more={
                <>
                  <p>
                    A deck builder&apos;s free QuickSites site carries an{' '}
                    <em>instant deck estimate</em> widget. A homeowner types a few dimensions and
                    gets a ballpark price range on the spot — and that range is computed by{' '}
                    <span className="text-zinc-300">DeckSketch&apos;s BOM engine</span> (materials
                    takeoff + per-vendor price books), not some throwaway formula. QuickSites
                    proxies your{' '}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      /api/estimate
                    </code>{' '}
                    server-to-server and renders its own UI, so your endpoint stays off the public
                    browser surface. One config value points at your host, so your move to{' '}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      app.decksketch.ai
                    </code>{' '}
                    is a single edit on our side, not a code change.
                  </p>
                  <p>
                    It went in as a stateless, PII-free contract and was prod-verified on 2026-07-17
                    (real requests returning real ranges). The point: DeckSketch&apos;s accuracy
                    gets exercised against live homeowner demand it wasn&apos;t reaching before.
                  </p>
                </>
              }
            >
              The homeowner-facing estimate on a builder&apos;s site is powered by DeckSketch&apos;s
              engine. Every one of those sites is DeckSketch&apos;s math doing real work in front of
              a buyer — with your brand as the eventual destination.
            </Card>

            <Card
              title="Those homeowner estimates are qualified leads → the natural upgrade into DeckSketch"
              tag="funnel"
              more={
                <>
                  <p>
                    The estimate is deliberately a <em>ballpark</em>. The homeowner who gets one and
                    wants to go further is a warm, high-intent lead — and the obvious next step is
                    the real thing: DeckSketch&apos;s actual canvas / itemized design (the
                    &ldquo;design it&rdquo; tier). So QuickSites isn&apos;t just showing
                    DeckSketch&apos;s number; it&apos;s manufacturing the exact demand that pulls
                    people into DeckSketch&apos;s core product.
                  </p>
                  <p>
                    Lead ownership is settled and clean: the site belongs to the deck builder (our
                    customer), so the homeowner&apos;s contact info goes to the <em>builder</em> via
                    QuickSites&apos; hardened submission rail. The estimate endpoint never touches
                    PII. Nobody&apos;s stepping on anybody&apos;s customer.
                  </p>
                </>
              }
            >
              A ballpark that lands creates a homeowner who wants a real plan — and a builder who
              wants to deliver one. That&apos;s the on-ramp into DeckSketch&apos;s paid design flow,
              generated for free by sites we&apos;re already giving builders.
            </Card>

            <Card
              title="Our discovery + outreach engine becomes a builder-acquisition channel for DeckSketch"
              tag="distribution"
              moreLabel="The acquisition machine"
              more={
                <>
                  <p>
                    QuickSites already runs a growth engine that sweeps a metro, finds every
                    business with <em>no website</em>, and pre-builds working sites for them before
                    first contact — then pitches them via exact-match geo domains (think{' '}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      &lt;city&gt;-deck-builders.com
                    </code>
                    ).{' '}
                    <span className="text-zinc-300">
                      Deck builder is a first-class vertical in that engine.
                    </span>{' '}
                    Every builder we sign gets a site with the DeckSketch estimate widget baked in
                    from day one.
                  </p>
                  <p>
                    Translation for DeckSketch: we do the cold customer acquisition — the part
                    that&apos;s expensive and slow — and each builder we land shows up already
                    running DeckSketch estimates. You get top-of-funnel distribution to a trade
                    that&apos;s notoriously hard to reach online, without spending your own
                    acquisition dollars.
                  </p>
                  <Example>
                    We sweep a metro and pre-build 40 no-website deck builders&apos; sites, each
                    with the estimate widget live. Even a fraction of those going active is that
                    many new builders putting DeckSketch&apos;s engine in front of their homeowners
                    — a distribution surface DeckSketch didn&apos;t have to build or buy.
                  </Example>
                </>
              }
            >
              QuickSites finds and onboards the deck builders; each one arrives with DeckSketch
              already wired in. It&apos;s a builder-acquisition channel for DeckSketch that runs on
              QuickSites&apos; dime.
            </Card>

            <Card
              title="The estimator now spans 9 trades — DeckSketch as the engine behind every high-ticket outdoor job"
              tag="TAM expansion"
              moreLabel="Beyond decks"
              more={
                <>
                  <p>
                    We generalized the deck seam into one multi-trade endpoint: deck plus fence,
                    concrete patio, turf, epoxy floor, paving, roofing, siding, and retaining wall —
                    nine trades, each a real DeckSketch parametric model, all merged and
                    prod-verified on 2026-07-17. Same one endpoint, one proxy, one attribution key.
                  </p>
                  <p>
                    Why it matters for DeckSketch: it reframes the company from &ldquo;a deck design
                    tool&rdquo; to{' '}
                    <span className="text-zinc-300">
                      the estimating engine for high-ticket contracting
                    </span>
                    . And QuickSites is effectively a live test harness proving demand for each new
                    trade&apos;s model — in front of real buyers — before DeckSketch invests in a
                    full UI for it. The go-to-market is deliberately fence-first behind deck; the
                    other trades are live but unforced.
                  </p>
                </>
              }
            >
              Decks were the wedge. The same DeckSketch-powered estimate now covers nine trades, so
              DeckSketch&apos;s math becomes the pricing engine behind far more than decks — with
              QuickSites validating demand for each trade before you build UI around it.
            </Card>
          </div>
        </section>

        {/* Why the shape is good for DeckSketch specifically */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Why this shape is good for DeckSketch specifically
          </h2>
          <div className="mt-4 space-y-4">
            <Card
              title="DeckSketch keeps the moat; QuickSites carries the distribution cost"
              tag="clean split"
              more={
                <>
                  <p>
                    The valuable, defensible asset stays yours — the estimating math, the price
                    books, the design canvas. QuickSites takes on the unglamorous, capital-intensive
                    half: acquiring the builders, hosting their sites, running the submission rail.
                    The integration was architected so neither product owns the other&apos;s
                    customer (builder owns the lead, PII-free estimate endpoint, per-site
                    attribution), which keeps the relationship durable instead of tangled.
                  </p>
                </>
              }
            >
              You keep the hard, high-value part. We eat the cost of getting it in front of demand.
              The seams are built so that stays true as it scales.
            </Card>

            <Card
              title="It's already running, not a slide"
              tag="shipped"
              more={
                <>
                  <p>
                    None of the above is a roadmap. The deck estimate seam is live and
                    prod-verified; the 9-trade endpoint is merged and verified; deck builder is a
                    live QuickSites vertical with geo-domain outreach and lead capture wired end to
                    end. The remaining knobs are calibration on your side (e.g.
                    installed-vs-materials pricing is a coefficient version on DeckSketch, not a
                    QuickSites change) — which is exactly the kind of thing live QuickSites traffic
                    can help you tune.
                  </p>
                </>
              }
            >
              This is in production today. The open items are DeckSketch-side calibration decisions,
              and QuickSites&apos; live homeowner traffic is a useful signal for making them.
            </Card>
          </div>
        </section>

        </Pitch>

        {/* Poke around + CTA */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-20">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Poke around
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link
                href="/"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
              >
                The homepage
              </Link>{' '}
              <span className="text-zinc-500">
                — build a site as a guest, no account, to see what a deck builder gets in ~2 minutes
              </span>
            </li>
            <li>
              <Link
                href="/partners"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
              >
                /partners
              </Link>{' '}
              <span className="text-zinc-500">
                — how QuickSites monetizes (the fee-per-order model)
              </span>
            </li>
            <li>
              <Link
                href="/compare"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
              >
                /compare
              </Link>{' '}
              <span className="text-zinc-500">
                — where QuickSites sits vs the website incumbents
              </span>
            </li>
          </ul>

          <div className="mt-10 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">Where I want your take</p>
            <p className="mt-1 text-sm text-zinc-400">
              The two big DeckSketch-side calls are (1) whether to lean into the non-deck trades as
              a real product surface, not just an API, and (2) the installed-vs-materials pricing
              default. Both change how aggressively QuickSites can push builders at DeckSketch.
              Let&apos;s pick a time and go through it.
            </p>
            <p className="mt-3 text-sm font-medium text-amber-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
