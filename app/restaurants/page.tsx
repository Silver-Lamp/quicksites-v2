// app/restaurants/page.tsx
// Public restaurant-vertical landing (owner-facing). The generic version of the
// per-restaurant claim page: same promise + proof, for anyone who didn't get a
// personal link. Hero funnels to the live /rebuild flow. Cedar/amber identity to
// distinguish the vertical from the sky-accented partner/compare pages.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'Restaurant websites that take orders — free to host | QuickSites',
  description:
    "We build your restaurant a mobile website from your Google/Yelp listing — full menu, online ordering, free hosting. You only pay a small fee when you get an order.",
  path: '/restaurants',
  ogEyebrow: 'For restaurants',
  ogTitle: 'Your restaurant’s website — already built.',
  ogSubtitle: 'Menu, online ordering, free hosting. You only pay when you sell.',
});

const MAILTO = 'mailto:restaurants@quicksites.ai?subject=My%20restaurant%20website';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

export default function RestaurantsPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            For restaurants
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            We built your restaurant
            <span className="block bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
              a website. Already.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            Your full menu, mobile-friendly, and set up to take online orders — built from your Google or Yelp
            listing. Hosting is <span className="font-semibold text-zinc-200">free</span>. You only pay a small
            fee when you actually get an order. No monthly bill, no setup cost.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/rebuild"
              className="rounded-lg bg-amber-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-amber-400"
            >
              See your site — free
            </Link>
            <a
              href="#how"
              className="rounded-lg border border-amber-500 px-6 py-3 text-base font-medium text-amber-300 transition hover:bg-amber-500/10 hover:text-amber-200"
            >
              How it works
            </a>
          </div>
          <p className="mt-4 text-sm text-zinc-500">Takes about a minute. No credit card. Nothing to install.</p>
        </section>

        {/* Built from your listing */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">No website? We build one from your listing.</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              You don’t start from a blank page. Point us at your restaurant and our AI reads your listing — even
              your menu photos — and assembles a real, working site.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="Your whole menu, read from photos">
                We pull every dish and price straight from the menu photos on your Google/Yelp listing — no typing,
                no PDF. You review and adjust anything before it goes live.
              </Card>
              <Card title="Hours, phone, map — all filled in">
                Tap-to-call, directions, an embedded map, and your real hours come over automatically. It looks
                right on a phone, where most people find you.
              </Card>
              <Card title="Yours in one tap">
                Like what you see? Claim it — it becomes your account, and you can edit and publish it. If not, no
                cost, no follow-up.
              </Card>
            </div>
          </div>
        </section>

        {/* Real ordering */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">Take orders on your own site.</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Not a menu picture — a real ordering page. Sizes, add-ons, item photos, cart, and checkout.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Card title="Sizes & options">Small/large, half/full, 6pc/12pc — priced right and easy to pick.</Card>
              <Card title="Add-ons">Extra cheese, make it a combo — priced automatically at checkout.</Card>
              <Card title="Keep more of each order">Your own ordering page means no 30% delivery-app cut. The order comes straight to you.</Card>
              <Card title="Works alongside the apps">Keep DoorDash or Uber Eats if you like — this just gives you a commission-free option too.</Card>
            </div>
          </div>
        </section>

        {/* The model */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              The honest part
            </span>
            <h2 className="mt-5 text-3xl font-bold md:text-4xl">Free to host. We only earn when you sell.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
              There’s no monthly fee and nothing to pay to turn it on. We take a small fee on each online order you
              receive — so it costs you nothing until it’s already making you money. We win when you win.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">How it works</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                ['1', 'We build it', 'From your Google/Yelp listing — menu, hours, location, ordering. Ready in about a minute.'],
                ['2', 'You claim it', 'Preview it, and if you like it, claim it in one tap. It becomes yours to edit and publish.'],
                ['3', 'You take orders', 'Turn on online ordering. Free hosting; we take a small fee only on the orders you get.'],
              ].map(([n, title, body]) => (
                <div key={n}>
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 font-bold text-zinc-950">
                    {n}
                  </div>
                  <h4 className="mt-3 font-semibold">{title}</h4>
                  <p className="mt-1 text-sm text-zinc-400">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Link
                href="/rebuild"
                className="rounded-lg bg-amber-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-amber-400"
              >
                See your site — free
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="text-center text-2xl font-semibold md:text-3xl">Straight answers</h2>
            <div className="mt-8 space-y-4">
              {[
                ['What does it cost?', 'Hosting is free — no monthly fee, no card to start. We take a small fee only when you get an online order, so it costs nothing until it’s making you money.'],
                ['I already have a website.', 'Great — take a look and compare, no pressure. Most owners find the mobile and ordering experience is where they’re losing orders. If yours is better, keep it.'],
                ['I already use DoorDash / Uber Eats.', 'Keep them. This is your own ordering page — no 30% commission, and the order comes straight to you. Run it alongside the apps and keep more of every dollar.'],
                ['Is my menu going to be right?', 'We read it from your photos, so it’s a strong start — and you review and fix anything before you publish. You’re always in control of what’s live.'],
                ['Who are you?', 'We build and host websites for local restaurants. We make money the same way you do — only when you sell — which is why there’s no cost to start.'],
              ].map(([q, a]) => (
                <div key={q} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                  <h4 className="font-semibold text-white">{q}</h4>
                  <p className="mt-2 text-sm text-zinc-400">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">See what we built for your restaurant.</h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">Free to look. Yours in one tap if you like it.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/rebuild"
                className="rounded-lg bg-amber-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-amber-400"
              >
                See your site — free
              </Link>
              <a
                href={MAILTO}
                className="rounded-lg border border-amber-500 px-7 py-3 text-base font-medium text-amber-300 transition hover:bg-amber-500/10 hover:text-amber-200"
              >
                Talk to us
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
          <Link href="/" className="underline hover:text-zinc-300">Home</Link>
          <span className="mx-1">•</span>
          <Link href="/rebuild" className="underline hover:text-zinc-300">Build your site</Link>
          <span className="mx-1">•</span>
          <Link href="/partners" className="underline hover:text-zinc-300">Partners</Link>
        </footer>
      </div>
    </>
  );
}
