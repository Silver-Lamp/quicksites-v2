// app/for-ryan/page.tsx
// Personal, UNLISTED orientation page for Ryan: how the QuickSites business models
// fit together and the three ways he could plug in (refer businesses, refer site
// builders, or operate). Public URL, but noindex + linked from nowhere — share the
// link directly. Numbers come from lib/commerce/partner-terms so they stay honest.
// Each card expands (native <details>, no JS) into deeper mechanics + a worked example.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT, PARTNER_FEE_SHARE, QS_FEE_SHARE, RESIDUAL_MONTHS } from '@/lib/commerce/partner-terms';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const keepPct = Math.round(PARTNER_FEE_SHARE * 100);
const qsPct = Math.round(QS_FEE_SHARE * 100);
const residualLabel = RESIDUAL_MONTHS > 0 ? `for ${RESIDUAL_MONTHS} months` : 'for life';

export const metadata: Metadata = {
  title: 'QuickSites — for Ryan',
  description: 'A personal tour of the QuickSites business models.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

/** Native-details expander — server-rendered, zero JS. */
function More({ label = 'More detail + an example', children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
        {label}
      </summary>
      <div className="space-y-3 px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-400">{children}</div>
    </details>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-sm leading-relaxed text-zinc-400">
      <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">Example</span>
      {children}
    </div>
  );
}

function Model({
  n,
  title,
  money,
  children,
  more,
}: {
  n: number;
  title: string;
  money: string;
  children: React.ReactNode;
  more: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">
          <span className="mr-2 text-zinc-600">{n}.</span>
          {title}
        </h3>
        <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
          {money}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</p>
      <More>{more}</More>
    </div>
  );
}

function Path({
  title,
  tag,
  children,
  more,
}: {
  title: string;
  tag: string;
  children: React.ReactNode;
  more: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.04] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <span className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
          {tag}
        </span>
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
      <More label="How it actually works">{more}</More>
    </div>
  );
}

export default function ForRyanPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pt-16 pb-10">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
            Unlisted — just for you
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Ryan 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            This is the one-page tour of what QuickSites actually is under the hood — the different
            ways it makes money, and the ways you could plug in. No pitch deck, just the real
            mechanics. Every card expands if you want the gears.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            The one-liner: <span className="text-zinc-300">websites are the free bait; the business is a
            small cut of the commerce that flows through them.</span> Hosting costs us almost nothing, so
            we give sites away and earn on orders instead of rent-seeking on hosting.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            And the zero-effort way in — your own referral code — is set up and live right now. 👇
          </p>
        </section>

        {/* Your referral code — the no-effort option */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-white">Your referral code</h2>
              <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                lifetime residual
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              If you ever mention QuickSites to anyone, just tell them to use the code{' '}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-semibold text-emerald-200">ryan</code>{' '}
              when they sign up — or send them your link:
            </p>
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200">
              www.quicksites.ai/?ref=ryan
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Anyone who signs up under it is tied to you, and you earn a{' '}
              <span className="text-zinc-200">lifetime residual on the platform&apos;s cut of their
              commerce</span> — for as long as their account lives, not just year one. It&apos;s already
              recording signups, so there&apos;s nothing to &ldquo;turn on.&rdquo; This is the passive
              version; the models below are what you earn if you want to go deeper and operate.
            </p>

            <More label="How you get paid (and the escrow bit)">
              <p>
                You don&apos;t need Stripe set up to start — the code accrues the whole time. When you
                connect Stripe Connect, anything accrued since we started transfers to you then; if
                you&apos;re already connected when a sale happens, it transfers at that sale. Until then
                it&apos;s simply held for you, and you&apos;ll see the running total on your dashboard.
              </p>
              <p>
                Your exact cut + projections are on the dashboard and the calculator below — I&apos;d
                rather you see live numbers than trust a number on a page.
              </p>
            </More>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link href="/referrals/dashboard" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-medium text-emerald-200 hover:bg-emerald-500/20">
                Your earnings dashboard →
              </Link>
              <Link href="/partners/calculator" className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-800">
                Earnings calculator
              </Link>
            </div>
          </div>
        </section>

        {/* The models */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            The business models, stacked
          </h2>
          <div className="mt-4 space-y-4">
            <Model
              n={1}
              title="The site builder"
              money="free — the bait"
              more={
                <>
                  <p>
                    What &ldquo;free&rdquo; actually includes: drag-and-drop editing, hosting on a
                    subdomain, dark/light themes, industry starter layouts (a landscaper gets a
                    services + quote-form site; a restaurant gets a menu-forward ordering site), and
                    AI assists — headline/services/FAQ copy, generated hero images, even a menu read
                    off photos. Custom domains attach when they&apos;re ready.
                  </p>
                  <p>
                    There&apos;s no trial wall: a visitor can build a full draft site from the homepage
                    without creating an account — the account happens when they want to publish. That
                    ungated first taste is deliberate; it&apos;s the top of every funnel below.
                  </p>
                  <Example>
                    A landscaper clicks &ldquo;start building&rdquo; on the homepage, picks
                    &ldquo;Landscaping,&rdquo; and 90 seconds later is looking at a working site with
                    her services, seasonal FAQ, and a quote form — before she&apos;s typed an email
                    address. Publishing it is what creates the account.
                  </Example>
                </>
              }
            >
              A drag-and-drop website builder with AI doing the heavy lifting (copy, hero images,
              menus read straight off photos). Anyone can build and host a site for free. This is
              deliberately not the money — it&apos;s how everything else gets in the door.
            </Model>

            <Model
              n={2}
              title="Commerce take-rate"
              money="the core: % of every order"
              more={
                <>
                  <p>
                    Any site can list things to sell — meals, physical products, services, digital
                    downloads, print-on-demand books and posters. Checkout runs on Stripe Connect:
                    the customer&apos;s money goes <em>directly to the merchant&apos;s own Stripe
                    account</em>, and the platform fee is carved out automatically in the same
                    transaction. We never hold their funds.
                  </p>
                  <p>
                    The fee is honest by construction: locked in when the order is created, charged
                    on the pre-tax subtotal, and automatically reversed if the order is refunded. No
                    order, no fee — the platform only earns when the merchant does.
                  </p>
                  <Example>
                    A $48 taco order at a 5% platform fee: $2.40 to the platform, the rest lands in
                    the taqueria&apos;s Stripe account instantly. Customer refunds their order? The
                    $2.40 reverses too.
                  </Example>
                </>
              }
            >
              Any site can sell — meals, products, services, digital goods, print-on-demand books
              and posters. Checkout runs on Stripe; the platform takes a small fee on each order
              (capped at {maxFeePct}%). No order, no fee — our incentive is literally their sales.
              This is the engine every other model feeds.
            </Model>

            <Model
              n={3}
              title="Restaurants / delivered.menu"
              money="take-rate at scale"
              more={
                <>
                  <p>
                    The pipeline, start to finish: find restaurants with <em>no website at all</em>{' '}
                    from their public listings → AI reads their menu off the listing photos → a full
                    ordering site goes up as a draft at their own delivered.menu address → real
                    diners find it and try to order → those &ldquo;order intents&rdquo; are counted →
                    the claim pitch writes itself: &ldquo;5 people tried to order from you this week.
                    Claim your site and start collecting.&rdquo;
                  </p>
                  <p>
                    The city domain contest stacks scarcity on top: we put a premium apex like
                    renton-restaurant.com in play for a cohort of these restaurants. First one to
                    claim their site gets featured at the apex — which is a live directory of all of
                    them, indexed and earning rank from day one. Runners-up keep their free sites;
                    nobody loses. We earn nothing until they take orders.
                  </p>
                  <Example>
                    Renton, WA: five no-website restaurants (a pub, a bar &amp; grill, a buffet, two
                    kitchens), each with a built ordering site and a QR postcard, racing for
                    renton-restaurant.com. Whoever claims first gets the domain traffic; every order
                    any of them takes afterward carries the platform fee.
                  </Example>
                </>
              }
            >
              The flagship vertical. Tons of great local restaurants have no website at all — we
              build them a full ordering site <em>before ever talking to them</em> (menu OCR&apos;d from
              their public listing photos), park it at delivered.menu, and let real order demand
              accumulate. The claim pitch becomes &ldquo;5 people tried to order from you this week —
              claim your site.&rdquo; We also run <span className="text-zinc-300">city domain contests</span>:
              a premium apex like renton-restaurant.com becomes the prize the first restaurant to
              claim wins, and the domain fronts a live directory of all of them, earning rank while
              they decide.
            </Model>

            <Model
              n={4}
              title="Local-services geo domains"
              money="domain rent (~$99/mo)"
              more={
                <>
                  <p>
                    Exact-match domains (city + trade) still punch above their weight in local
                    search. We buy them for ~$10–15/yr, stand up a localized pitch site, connect
                    Search Console, and <em>wait for rank before outreach</em> — the sales pitch is
                    only made once we can show the domain actually ranking for &ldquo;boston
                    towing.&rdquo; Then QR postcards go to the local businesses competing for that
                    exact phrase.
                  </p>
                  <p>
                    Different economics from restaurants on purpose: a tow call doesn&apos;t flow
                    through an online checkout, so there&apos;s no order to take a fee on — the
                    ranking asset itself is the product, rented monthly. First to claim locks it;
                    everyone else in town keeps paying Google Ads.
                  </p>
                  <Example>
                    boston-towing.com costs ~$12/yr to hold. Rented at $99/mo to one towing company,
                    that&apos;s ~99% margin on a compounding asset — and the renter is still getting
                    the better end versus what a single lead costs them in ads.
                  </Example>
                </>
              }
            >
              For trades (towing, plumbing, roofing…), we buy exact-match domains like
              boston-towing.com, stand up a pitch site, and let it rank. Local businesses with no
              web presence rent the ranking asset. Different economics from restaurants — rent
              instead of take-rate — because service jobs don&apos;t flow through an online checkout.
            </Model>

            <Model
              n={5}
              title="White-label / resellers"
              money={`partner keeps ${keepPct}%`}
              more={
                <>
                  <p>
                    A reseller gets the entire platform re-skinned as theirs: their logo and name on
                    the builder, login pages, and transactional emails; their domain; their accent
                    colors. Their clients sign up under the reseller&apos;s brand and never see
                    QuickSites anywhere.
                  </p>
                  <p>
                    The money: the reseller sets the order fee for their merchants (anywhere up to{' '}
                    {maxFeePct}%) and keeps {keepPct}% of every fee {residualLabel}. We keep{' '}
                    {qsPct}% for running the rails — hosting, checkout, payouts, the AI. They own the
                    relationship; we&apos;re invisible infrastructure.
                  </p>
                  <Example>
                    A small agency white-labels for its 20 restaurant clients. If those clients do a
                    combined $60k/mo in online orders at an 8% fee, that&apos;s $4,800/mo in fees —
                    ${((4800 * PARTNER_FEE_SHARE) / 1).toLocaleString()} to the agency, every month,
                    on top of whatever they charge for their own services.
                  </Example>
                </>
              }
            >
              Agencies and community leaders resell the whole platform under their own brand — their
              logo, their domain, their client relationships. They set the order fee for their
              merchants (up to {maxFeePct}%) and keep {keepPct}% of it {residualLabel}; QuickSites
              keeps {qsPct}%. Their clients never see us.
            </Model>
          </div>
        </section>

        {/* Where Ryan fits */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Where you could plug in
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Three lanes, not mutually exclusive — plenty of people start in the first and drift right.
          </p>
          <div className="mt-4 space-y-4">
            <Path
              title="Refer businesses"
              tag={`${keepPct}% of their order fees, ${residualLabel}`}
              more={
                <>
                  <p>
                    Mechanics: you get a personal link like{' '}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      quicksites.ai/?ref=ryan
                    </code>
                    . When a business signs up through it, they&apos;re locked to your code. From then
                    on, every paid order they process writes your {keepPct}% share of the platform
                    fee to a commission ledger — automatically, at the moment the payment webhook
                    lands. Refunded orders reverse; nothing is hand-counted.
                  </p>
                  <p>
                    Getting paid: you connect a Stripe account once (two minutes), and payout runs
                    transfer your accrued balance. You can watch it all accrue live on your partner
                    dashboard — referred merchants, per-order commissions, paid vs owed.
                  </p>
                  <Example>
                    You tell your favorite food truck &ldquo;you should be taking orders online —
                    use this link, it&apos;s free.&rdquo; They do $2,500/mo at a 5% fee = $125/mo in
                    fees, ${(125 * PARTNER_FEE_SHARE).toFixed(0)}/mo of which is yours,{' '}
                    {residualLabel}. That&apos;s one conversation.
                  </Example>
                </>
              }
            >
              <p>
                Know a restaurant, a shop, an author, anyone who sells? They sign up through your
                referral link, and every order they ever process credits you {keepPct}% of the
                platform fee — automatically, from a commission ledger, paid out on real payouts.
                You don&apos;t support them; the product does. You just make the introduction.
              </p>
            </Path>

            <Path
              title="Refer site builders"
              tag="override on everything they build"
              more={
                <>
                  <p>
                    Mechanics: your recruits join through a hub-tagged link (
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      ?hub=ryan
                    </code>
                    ). Each one becomes a full partner in their own right — {keepPct}% residuals on
                    their merchants, untouched. Your override is a negotiated slice carved{' '}
                    <em>out of QuickSites&apos; {qsPct}%</em> (it can be up to that entire share), on
                    every order their whole book processes, for as long as those merchants sell.
                  </p>
                  <p>
                    Why this isn&apos;t MLM math: there are exactly two tiers, your cut never comes
                    from your recruits&apos; earnings, and nobody buys inventory. It&apos;s a
                    finder&apos;s fee that happens to recur.
                  </p>
                  <Example>
                    You recruit one hungry freelancer who signs 15 local merchants over a year.
                    Their book grows to $40k/mo in orders at an average 6% fee = $2,400/mo in fees.
                    Your override at, say, half of QuickSites&apos; share would be $240/mo — from one
                    recruit, while they do the selling.
                  </Example>
                </>
              }
            >
              <p>
                Bigger lever: recruit the people who <em>bring</em> merchants — freelancers,
                agencies, community organizers. As their &ldquo;hub,&rdquo; you earn a lifetime override on
                every order their whole book of merchants processes. The override comes out of
                QuickSites&apos; {qsPct}% share, so it never touches what your recruits earn — no MLM
                math, just a second-tier finder&apos;s fee that compounds as they grow.
              </p>
            </Path>

            <Path
              title="Operate"
              tag="the admin seat, if you want it"
              more={
                <>
                  <p>
                    A day in the cockpit looks like: sweep a city (&ldquo;Austin, TX, 10km,
                    restaurants + towing&rdquo;) and get back every business with no website; bulk-build
                    draft sites for the promising ones (AI reads the menus); launch a domain contest
                    or a geo campaign; mail QR postcards with per-prospect tracking; then watch the
                    funnel — link scans, order intents, claims — and the revenue page reconcile
                    against Stripe to the cent.
                  </p>
                  <p>
                    It&apos;s all one dashboard: discovery map, outreach pipeline, demand funnel,
                    domain costs, platform revenue. The playbook is repeatable per city, which is
                    exactly why it&apos;s built to hand to more operators than just me.
                  </p>
                  <Example>
                    The Renton contest above — discovery sweep to five built ordering sites to a
                    live renton-restaurant.com directory — is a morning&apos;s work in the cockpit,
                    most of it watching progress bars.
                  </Example>
                </>
              }
            >
              <p>
                Behind the marketing site there&apos;s a full operator cockpit: sweep any city for
                businesses with no website, auto-build their sites in bulk, run the domain contests,
                mail QR postcards, watch demand and revenue reconcile against Stripe. If this turns
                into something you want to run rather than refer into, that seat exists — it&apos;s how
                I work the funnel today, and it&apos;s built to be handed to more operators.
              </p>
            </Path>
          </div>
        </section>

        {/* Worked example */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="text-base font-semibold text-white">The math on one referred restaurant</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Say a taqueria you referred does $4,000/mo in online orders at a 5% platform fee.
              That&apos;s $200/mo in fees — <span className="text-emerald-300">${(200 * PARTNER_FEE_SHARE).toFixed(0)}/mo
              to you</span>, {residualLabel}, for one introduction. Ten of those is a car payment
              that doesn&apos;t care whether you got out of bed. The reseller/hub lanes multiply the
              same mechanic across someone else&apos;s hustle.
            </p>
          </div>
        </section>

        {/* Links + CTA */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-20">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Poke around
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                The homepage
              </Link>{' '}
              <span className="text-zinc-500">— build a site as a guest, no account, see the product in 2 minutes</span>
            </li>
            <li>
              <Link href="/partners" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                /partners
              </Link>{' '}
              <span className="text-zinc-500">— the reseller program in full</span>
            </li>
            <li>
              <Link href="/partners/calculator" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                /partners/calculator
              </Link>{' '}
              <span className="text-zinc-500">— drag the sliders, see the earnings curves</span>
            </li>
            <li>
              <Link href="/restaurants" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                /restaurants
              </Link>{' '}
              <span className="text-zinc-500">— the restaurant owner offer</span>
            </li>
            <li>
              <Link href="/compare" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                /compare
              </Link>{' '}
              <span className="text-zinc-500">— honest feature chart vs Duda / GoHighLevel</span>
            </li>
          </ul>

          <div className="mt-10 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">Want your referral link right now?</p>
            <p className="mt-1 text-sm text-zinc-400">
              It&apos;s self-serve — create an account and the partner dashboard mints your code, gives
              you the shareable link, and connects payouts (Stripe). Takes about two minutes.
            </p>
            <Link
              href="/partners/dashboard"
              className="mt-4 inline-block rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
            >
              Get my referral link →
            </Link>
            <p className="mt-4 text-sm text-zinc-400">
              Or just text me — for the hub lane (overrides on people you recruit) or an operator
              login, I flip those on for you manually anyway.
            </p>
            <p className="mt-3 text-sm font-medium text-emerald-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
