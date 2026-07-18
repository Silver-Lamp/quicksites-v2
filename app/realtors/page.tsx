// app/realtors/page.tsx
// Public realtor-vertical landing (agent-facing). Sibling of /restaurants, but the hook is
// different: real-estate agents don't take online orders — the differentiator is the HiveJournal
// "About That" agent-VOICE listing audio (scan the yard-sign QR, hear the agent talk about THIS
// home) plus a free pro site, lead capture, and one-day showing-tour route planning. Emerald
// identity to distinguish from restaurants (amber) and partner/compare (sky).
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'Real-estate agent websites — with a voice | QuickSites',
  description:
    'A free professional real-estate site, plus agent-voice listing audio: buyers scan the QR on your yard sign and hear YOU talk about the home. Lead capture, listing pages, and one-day tour planning included.',
  path: '/realtors',
  ogEyebrow: 'For real-estate agents',
  ogTitle: 'Your listings, in your own voice.',
  ogSubtitle: 'A free agent site + “About That” listing audio buyers hear at the curb.',
});

const MAILTO = 'mailto:realtors@quicksites.ai?subject=My%20real-estate%20website';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

export default function RealtorsPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="relative mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
          </div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            For real-estate agents
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            Your listings,
            <span className="block bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
              in your own voice.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            A polished agent website — free to host — with something no template gives you: a buyer scans the QR on
            your yard sign and <span className="font-semibold text-zinc-200">hears you</span> talk about the home.
            Real voice, real warmth, 24/7.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/rebuild"
              className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
            >
              See your site — free
            </Link>
            <a
              href="#voice"
              className="rounded-lg border border-emerald-500 px-6 py-3 text-base font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              Hear how it works
            </a>
          </div>
          <p className="mt-4 text-sm text-zinc-500">Takes about a minute. No credit card. Nothing to install.</p>
        </section>

        {/* About That — the HJ audio moat, the star of this page */}
        <section id="voice" className="scroll-mt-24 border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              🔊 “About That” — agent-voice listing audio
            </span>
            <h2 className="mt-4 text-2xl font-semibold md:text-3xl">The photos show the house. Your voice sells it.</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Every listing carries a short audio clip of you describing the home — the light in the mornings, the
              renovated kitchen, the quiet street. It plays on the listing page and on a QR the buyer can scan right
              at the curb.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="Scan the sign, hear the agent">
                A QR on the yard sign opens a “listen” page — the buyer standing on the sidewalk hears you walk them
                through the home, even when you can’t be there.
              </Card>
              <Card title="Ready-to-print QR pack">
                One click makes a yard-sign insert, a flyer corner card, and open-house business cards — each with the
                QR to that listing’s audio. Print and go.
              </Card>
              <Card title="You, not stock copy">
                Buyers connect with a real voice. It’s the difference between a listing and a conversation — and it
                makes you the agent they remember.
              </Card>
            </div>
            <p className="mt-6 text-xs text-zinc-500">
              Powered by our sister product’s voice tech — the same owner-voice audio suite behind testimonials and
              welcome messages across QuickSites.
            </p>
          </div>
        </section>

        {/* Free pro site from your existing one */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">A sharp site, built for you — free to host.</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Point us at your current site (or start fresh) and our AI assembles a clean, mobile-first agent site in
              seconds. Edit anything, publish, done.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Card title="Listing pages">Beautiful listing cards with photos, details, and the audio clip built in.</Card>
              <Card title="Lead capture">Every inquiry hits your inbox through a hardened, spam-resistant form — no lead lost.</Card>
              <Card title="Your brand & domain">Your headshot, colors, and custom domain. It’s your site, not a portal profile.</Card>
              <Card title="Free hosting">No monthly hosting bill. Launch and keep it live at no cost.</Card>
            </div>
          </div>
        </section>

        {/* One-day showing tours */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">Plan a day of showings in one optimized route.</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Showing a buyer six homes in an afternoon? Drop in the addresses and get the most efficient loop —
              then share it with your client so everyone’s caravanning off the same plan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/tools/route-planner"
                className="rounded-lg border border-emerald-500 px-5 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10"
              >
                Try the route planner →
              </Link>
            </div>
          </div>
        </section>

        {/* Scheduling */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">Let buyers book you — right on your site.</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Add a booking block so prospects can grab a private showing, a buyer consult, or a listing appointment
              from your available times — no phone tag.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Card title="Your real availability">Set your slots and appointment types; buyers pick a time that actually works for you.</Card>
              <Card title="Showings & consults">Private showings, buyer/seller consults, open-house sign-ups — all bookable in a tap.</Card>
              <Card title="Straight to your calendar">Every booking is captured and confirmed, so nothing slips through the cracks.</Card>
            </div>
          </div>
        </section>

        {/* Little delights */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">The details buyers remember.</h2>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Card title="Ambient “screensaver”">
                When a visitor steps away and comes back, a warm ambient background fades in — a small, memorable touch
                you can switch on (or use your own photo/video).
              </Card>
              <Card title="A friendly guide">
                An optional tap-to-talk mascot can greet visitors with quick facts about you or your listings — a
                little personality most agent sites never have.
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">See your agent site — with your voice on it.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              Free to try, free to host. Build it in a minute, then add the audio that makes buyers remember you.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/rebuild"
                className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
              >
                Build my site — free
              </Link>
              <a
                href={MAILTO}
                className="rounded-lg border border-emerald-500 px-6 py-3 text-base font-medium text-emerald-300 transition hover:bg-emerald-500/10"
              >
                Talk to us
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
