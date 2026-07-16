// app/for-ryan/page.tsx
// Personal, UNLISTED orientation page for Ryan: how the QuickSites business models
// fit together and the three ways he could plug in (refer businesses, refer site
// builders, or operate). Public URL, but noindex + linked from nowhere — share the
// link directly. Numbers come from lib/commerce/partner-terms so they stay honest.
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

function Model({
  n,
  title,
  money,
  children,
}: {
  n: number;
  title: string;
  money: string;
  children: React.ReactNode;
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
    </div>
  );
}

function Path({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.04] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <span className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
          {tag}
        </span>
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
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
            mechanics.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            The one-liner: <span className="text-zinc-300">websites are the free bait; the business is a
            small cut of the commerce that flows through them.</span> Hosting costs us almost nothing, so
            we give sites away and earn on orders instead of rent-seeking on hosting.
          </p>
        </section>

        {/* The models */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            The business models, stacked
          </h2>
          <div className="mt-4 space-y-4">
            <Model n={1} title="The site builder" money="free — the bait">
              A drag-and-drop website builder with AI doing the heavy lifting (copy, hero images,
              menus read straight off photos). Anyone can build and host a site for free. This is
              deliberately not the money — it&apos;s how everything else gets in the door.
            </Model>

            <Model n={2} title="Commerce take-rate" money={`the core: % of every order`}>
              Any site can sell — meals, products, services, digital goods, print-on-demand books
              and posters. Checkout runs on Stripe; the platform takes a small fee on each order
              (capped at {maxFeePct}%). No order, no fee — our incentive is literally their sales.
              This is the engine every other model feeds.
            </Model>

            <Model n={3} title="Restaurants / delivered.menu" money="take-rate at scale">
              The flagship vertical. Tons of great local restaurants have no website at all — we
              build them a full ordering site <em>before ever talking to them</em> (menu OCR&apos;d from
              their public listing photos), park it at delivered.menu, and let real order demand
              accumulate. The claim pitch becomes &ldquo;5 people tried to order from you this week —
              claim your site.&rdquo; We also run <span className="text-zinc-300">city domain contests</span>:
              a premium apex like renton-restaurant.com becomes the prize the first restaurant to
              claim wins, and the domain fronts a live directory of all of them, earning rank while
              they decide.
            </Model>

            <Model n={4} title="Local-services geo domains" money="domain rent (~$99/mo)">
              For trades (towing, plumbing, roofing…), we buy exact-match domains like
              boston-towing.com, stand up a pitch site, and let it rank. Local businesses with no
              web presence rent the ranking asset. Different economics from restaurants — rent
              instead of take-rate — because service jobs don&apos;t flow through an online checkout.
            </Model>

            <Model n={5} title="White-label / resellers" money={`partner keeps ${keepPct}%`}>
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
            <Path title="Refer businesses" tag={`${keepPct}% of their order fees, ${residualLabel}`}>
              <p>
                Know a restaurant, a shop, an author, anyone who sells? They sign up through your
                referral link, and every order they ever process credits you {keepPct}% of the
                platform fee — automatically, from a commission ledger, paid out on real payouts.
                You don&apos;t support them; the product does. You just make the introduction.
              </p>
            </Path>

            <Path title="Refer site builders" tag="override on everything they build">
              <p>
                Bigger lever: recruit the people who <em>bring</em> merchants — freelancers,
                agencies, community organizers. As their &ldquo;hub,&rdquo; you earn a lifetime override on
                every order their whole book of merchants processes. The override comes out of
                QuickSites&apos; {qsPct}% share, so it never touches what your recruits earn — no MLM
                math, just a second-tier finder&apos;s fee that compounds as they grow.
              </p>
            </Path>

            <Path title="Operate" tag="the admin seat, if you want it">
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
