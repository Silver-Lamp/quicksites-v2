// app/talking-demo/page.tsx
//
// "Talking Demo" — product landing for the auto-built-site-that-narrates-itself offering
// (QuickSites site-gen × HiveJournal About That). Tier 1: any auto-built site gets a press-play
// tour. See crosstalk 2026-07-21 for the Tier 2 (scripted/MP4 tour) scoping with HiveJournal.
//
// Prototype — noindex until the positioning is finalized; flip robots to index when it's real.

import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';

export const metadata = {
  title: 'Talking Demo — a website that walks you through itself | QuickSites',
  description:
    'Point us at your business and we build the website — then it introduces itself, out loud. An AI-built site with a press-play voice tour.',
  robots: { index: false, follow: true },
};

const STEPS: Array<[string, string, string]> = [
  ['1', 'We build the site', 'Give us your business — a URL, a Google or Yelp listing, or just a name and trade. QuickSites auto-builds a real website: your services, hours, photos, and copy, cleaned up and laid out.'],
  ['2', 'It learns to talk', 'About That reads the finished site and turns it into a short spoken tour — grounded in exactly what\'s on the page, in a natural voice (yours, if you have one).'],
  ['3', 'You get a Talking Demo', 'A shareable link (or a QR code) where anyone can press ▶ and hear the site walk them through itself in about a minute. No app, no reading.'],
];

export default function TalkingDemoPage() {
  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
        {/* Hero */}
        <header className="border-b border-zinc-800/70">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              🔊 Talking Demo
            </div>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              A website that walks you through itself.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-zinc-400 sm:text-lg">
              Point us at your business and we build the site — then it introduces itself, out loud.
              Press play and hear your whole site in about a minute.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/talking-demo/example" className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400">
                ▶ Hear a live example
              </Link>
              <Link href="/rebuild" className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500">
                Make one for my business
              </Link>
            </div>
          </div>
        </header>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(([n, title, body]) => (
              <div key={n} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-zinc-950">{n}</div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The outreach angle */}
        <section className="border-y border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 sm:p-10">
              <h2 className="text-2xl font-semibold tracking-tight">Especially good for businesses with no website</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
                We can build a business's whole site from just their public listing — so the very first thing
                they see can be: <span className="text-emerald-200">"We already built your website. Scan this and hear it."</span>
                A demo of their own business that pitches itself, produced end to end automatically.
              </p>
            </div>
          </div>
        </section>

        {/* See it live */}
        <section className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Hear it in action</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">Every one of these is an auto-built site that describes itself when you press play.</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/talking-demo/example" className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 text-left transition hover:border-emerald-500/40">
              <div className="font-semibold text-emerald-300">☕ A neighborhood coffee roaster →</div>
              <div className="mt-1 text-sm text-zinc-400">A small-business site with a press-play tour.</div>
            </Link>
            <Link href="/realtors/sample-agency" className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 text-left transition hover:border-emerald-500/40">
              <div className="font-semibold text-emerald-300">🏡 A real-estate agency →</div>
              <div className="mt-1 text-sm text-zinc-400">A brokerage where each agent + listing speaks in its own voice.</div>
            </Link>
            <Link href="/realtors/sample-listing" className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 text-left transition hover:border-emerald-500/40">
              <div className="font-semibold text-emerald-300">🏠 A single listing (+ scannable yard sign) →</div>
              <div className="mt-1 text-sm text-zinc-400">Hear the home described the way a buyer would at the curb.</div>
            </Link>
          </div>

          <div className="mt-14">
            <p className="text-sm text-zinc-400">Want a Talking Demo of your business?</p>
            <Link href="/rebuild" className="mt-2 inline-flex rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400">
              Build mine — free
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
