// app/for-amber/page.tsx
//
// Personal, UNLISTED page for Amber — an island contact Sandon wants to bring into the Vashon
// commercial-kitchen idea (PorchHearth's; crosstalk 2026-10-08). Public URL, noindex, linked
// from nowhere. First name only, no contact details for her, nothing about her she did not say.
//
// ⚠️ THERE ARE NO NUMBERS ON THIS PAGE, AND THAT IS THE DESIGN. Nobody knows whether the one
// candidate kitchen is permitted for tenants, what King County charges, what an hourly rate on
// Vashon would be, or what a cook clears. PorchHearth has completed ZERO real orders. A page
// addressed to a named neighbour on an island of eleven thousand people may not contain a
// figure, a range, a projection or a promise — the geo-domain rule ("never promise a ranking or
// a volume") pointed at a person. The test in lib/forAmber/__tests__ reads this file and fails
// on a dollar sign, a percentage, or an earnings verb.
//
// Facts here come from PorchHearth's research (WA/King County) and the Eagles' own public
// website, quoted; the only thing this page knows about Amber is her first name and that
// Sandon thinks she is the right person to open a door.
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'For Amber',
  description: 'A kitchen on the island — what it would take, and where you could fit.',
  robots: { index: false, follow: false },
};

/** Her referral code (referral_codes, minted 2026-10-08 on the island terms). The rate is deliberately NOT on this page. */
const REF_CODE = 'amber';

/** The one building. Public facts from its own site and listing; nothing inferred. */
const EAGLES = {
  name: 'Fraternal Order of Eagles Aerie 3144',
  address: '18134 Vashon Hwy SW',
  phone: '(206) 463-5477',
  email: 'eagles3144@gmail.com',
  site: 'vashoneagles3144.com',
  quote: 'We are a bar, but we are also a restaurant and social club.',
  quote2: 'We support Vashon Fresh, Fix-it Cafe, and the Vashon Tool Library by allowing them free use of our rental spaces.',
};

function Card({ title, tag, tone = 'zinc', children }: { title: string; tag?: string; tone?: 'zinc' | 'emerald' | 'sky' | 'rose' | 'amber'; children: React.ReactNode }) {
  const tones = {
    zinc: 'border-zinc-800 bg-zinc-900/40',
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.05]',
    sky: 'border-sky-500/25 bg-sky-500/[0.04]',
    rose: 'border-rose-500/25 bg-rose-500/[0.04]',
    amber: 'border-amber-500/30 bg-amber-500/[0.05]',
  } as const;
  const tagTones = {
    zinc: 'border-zinc-700 bg-zinc-800 text-zinc-300',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  } as const;
  return (
    <div className={`rounded-xl border p-5 ${tones[tone]}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {tag && <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tagTones[tone]}`}>{tag}</span>}
      </div>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

export default function ForAmberPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pb-8 pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">Unlisted — just for you</span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Amber 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            Sandon asked me to write this down so it's in one place instead of in a conversation on the ferry.
            It's an idea about a kitchen on the island, where you might fit, and what is and isn't real about it
            yet. <span className="text-zinc-200">The honest version is short, so this page is short.</span>
          </p>
        </section>

        {/* Nothing is agreed — first, not last */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <Card title="Read this part first: nothing here is agreed, and no money exists yet" tag="plain words" tone="rose">
            <p>
              Sandon has emailed the Eagles with two questions and has not heard back. Nobody knows yet whether their
              kitchen can legally host paying tenants, what King County would charge, or what cooking out of it would
              cost per hour. PorchHearth, the ordering side of this, has never completed a real order for anyone. There
              is no customer waiting.
            </p>
            <p>
              So this page can tell you what the project is and how it would be shaped. It cannot tell you what you would
              make, and it won't pretend to. If someone later quotes you a number for this, ask them where it came from.
            </p>
          </Card>
        </section>

        {/* The idea */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">The idea, and the one fact that makes it non-obvious</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            In most states a home cook can get a small permit and sell meals from their own kitchen. Washington doesn't
            allow that — the home-kitchen bills have failed, the last one this spring, and the state's cottage-food
            permit only covers shelf-stable things like jam and bread. So on Vashon, someone who cooks well and wants to
            sell dinners has <span className="text-zinc-200">no legal path at all</span> from their own stove.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            A permitted commercial kitchen changes that completely. King County lets a shared kitchen hold tenants, each
            with their own permit, and a caterer is in fact required to work out of one. One permitted kitchen on the
            island turns "no path" into an ordinary food business for every cook who rents an hour of it.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Nobody on Vashon advertises a kitchen for rent. We checked. The Grange kitchen closed years ago. Which leaves
            buildings that already have a real kitchen for another reason.
          </p>
        </section>

        {/* The building */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">The building most likely to say yes</h2>
          <div className="mt-4">
            <Card title={EAGLES.name} tag="public facts only" tone="amber">
              <p>
                {EAGLES.address} · {EAGLES.phone} · {EAGLES.email} · {EAGLES.site}
              </p>
              <p>
                In their own words: <em>“{EAGLES.quote}”</em> A lodge that runs a bar and a restaurant already holds a
                food-establishment permit, so the hardest question — is there a real, permitted kitchen — is probably
                already answered.
              </p>
              <p>
                They cook at volume for the island already (holiday dinners, meals delivered to people in need) and they
                let community groups use their rooms: <em>“{EAGLES.quote2}”</em>
              </p>
              <p className="text-zinc-500">
                What nobody has checked: whether that kitchen is permitted as a <em>commissary</em>, which is a separate
                King County permit from a restaurant's and is what lets paying tenants cook there. That is the first
                question, and it is theirs to answer.
              </p>
            </Card>
          </div>
        </section>

        {/* Two roles */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Two different ways you could be part of it</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            These are kept apart on purpose, because they are different jobs and would pay in different ways. You could do
            one, both, or neither.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card title="The introducer" tag="opens the door" tone="sky">
              <p>
                You know people at the Eagles; we mostly don't. Sandon has sent the first email, but an email is not a
                relationship. The introducer keeps the conversation going as a neighbour — who to actually talk to, how
                the hall makes decisions, being in the room — so it stays a neighbour asking rather than a company.
              </p>
              <p>
                If a kitchen arrangement ever came out of that door, the introducer would be owed a share of what
                PorchHearth earns from cooks working out of it, for as long as that arrangement runs. A share of something
                that exists — never a fee for the introduction itself, and nothing if nothing comes of it.
              </p>
            </Card>
            <Card title="The operator" tag="holds the permit and cooks" tone="emerald">
              <p>
                An operator is a cook with their own catering permit, renting kitchen time and selling meals — orders
                would come through PorchHearth, and the cook would keep what they sell less the platform's cut and the
                kitchen's rent.
              </p>
              <p>
                This one is a real business with real paperwork: a King County permit, food-handler cards, insurance.
                It's the bigger opportunity and the bigger commitment, and nobody should take it on the strength of a
                web page.
              </p>
            </Card>
          </div>
        </section>

        {/* First step */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">The first step, which is not a commitment</h2>
          <Card title="Already taken: one email, two questions" tone="zinc">
            <p>
              Sandon emailed the Eagles asking whether their kitchen is permitted for outside users and whether they'd
              ever consider renting hours to a licensed cook, at a rate they'd set. No pitch, no numbers, no promises
              — a question from a neighbour who has been to their STEM nights. ({EAGLES.phone}, {EAGLES.email}, if you
              ever want to follow up in person.)
            </p>
            <p>
              Their answer is the whole next step. A no ends it cleanly. A maybe means King County's commissary office
              is the next call, and Sandon offered to do that part. A yes is the point where something could be put in
              writing, and that writing would come before any money moved, not after.
            </p>
          </Card>
        </section>

        {/* The other thing — separate from the kitchen on purpose */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">A separate thing, because you know half the island</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            This part has nothing to do with the kitchen, and it is real today. Sandon's company, QuickSites, gives a
            local business a proper website for free — a restaurant gets online ordering, a shop gets a store, a
            service business gets a page people can find — and earns only a small cut when an order actually goes
            through it. A business that never sells anything through it pays nothing.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            A good number of Vashon businesses still have no website at all: auto shops, salons, a few trades, a couple
            of places to eat. You know many of the people who own them. That is the whole job here: when one of them
            mentions they need a website, you point them at it. You never sell anything.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card title="Your code is already live" tag="amber" tone="sky">
              <p>
                Anyone who signs up with the code <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-semibold text-sky-200">{REF_CODE}</code>{' '}
                — or through <span className="font-mono text-zinc-200">www.quicksites.ai/?ref={REF_CODE}</span> — is tied
                to you from then on.
              </p>
              <p>
                You would be owed a share of the fee on every order that business ever takes through its site, for as
                long as it keeps selling — the same terms every island referrer gets. The exact share is written on your
                own dashboard the moment you claim the code, not here, because this page is about a different question.
              </p>
            </Card>
            <Card title="What has and hasn't happened" tag="honest" tone="rose">
              <p>
                The product works and takes real money. The referral program is new, and nobody has been paid a referral
                commission yet — no referred business has taken a paid order. You would be early, which is why the
                terms are what they are.
              </p>
              <p>
                Nothing to buy, no quota, and you can stop any time. Mentioning it to someone who already wanted a
                website is the entire effort.
              </p>
            </Card>
          </div>
          <div className="mt-3">
            <Card title="And one for your own stand" tag="honey &amp; crafts" tone="amber">
              <p>
                Sandon mentioned you sell honey and other things you make. The same free site works for a maker: your
                products with photos and prices you set, checkout, pickup at the market or shipping off-island, all under
                your own name. It costs nothing to have, and the same small cut applies only when something sells.
              </p>
              <p>
                If you'd like one, say so and it gets built with you, from your own words and your own photos. Nothing
                gets set up in your name without you — that rule holds for every business on the island, and it holds for
                you first.
              </p>
            </Card>
          </div>
        </section>

        {/* What is real */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">What's real and what isn't, side by side</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card title="Real" tag="checked" tone="emerald">
              <p>Washington gives home cooks no permit for prepared meals. King County permits shared kitchens and requires caterers to use one. The Eagles describe themselves as a bar and a restaurant. Nobody on the island advertises kitchen time for rent.</p>
            </Card>
            <Card title="Not real yet" tag="honest" tone="rose">
              <p>A permitted commissary on Vashon. A rate for kitchen time. A single completed order on PorchHearth. Any agreement with the Eagles, or with you. Any number about what this pays.</p>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-20 pt-8">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <p className="text-sm leading-relaxed text-zinc-400">
              If you'd rather not be part of this, say so and that's the end of it — no awkwardness, and this page comes
              down. If you're curious, the phone call above is the only thing anyone is asking for.
            </p>
            <p className="mt-3 text-sm font-medium text-amber-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
