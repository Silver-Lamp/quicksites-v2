'use client';

// components/home/in-your-voice.tsx
//
// Homepage "In Your Voice" section — the owner-voice narration moat, made tangible:
// a REAL, tappable About That player that narrates this very homepage. Visitors press
// play and hear the pitch spoken aloud, which is the whole promise.
//
// Honesty: the demo embed is a real, consented voice clone (voice: self), so it
// genuinely demonstrates "in your voice" — never presented as a synthetic default.
// The copy is explicit that a site starts with a house narrator and upgrades to the
// owner's own voice once they set up a consented clone.
//
// Default embed is the dedicated "QuickSites — In Your Voice (homepage)" embed HJ
// minted for this (own_clone / Sandon's consented clone, warm+founder tone, kinds
// summary+pitch_panel, quicksites.ai + www allowed) — so the realtors demo stays
// single-purpose and homepage analytics/domain scope stays clean. Env-overridable
// (NEXT_PUBLIC_IN_YOUR_VOICE_EMBED_ID) with no redeploy. A public embed id is not a
// secret (it ships in the client <script data-embed=…> anyway).

import Link from 'next/link';
import SectionBackdrop from '@/components/home/section-backdrop';
import { AboutThatEmbed } from '@/components/admin/templates/render-blocks/about-that';

const EMBED_ID =
  process.env.NEXT_PUBLIC_IN_YOUR_VOICE_EMBED_ID || '4f90e68e-5057-4eab-8355-628ddbdb5af2';
const HOMEPAGE_URL = 'https://www.quicksites.ai/';

export default function InYourVoice() {
  return (
    // id is a deep-link target: the /features card links here with "See it live".
    <section id="in-your-voice" className="relative z-10 w-full overflow-hidden border-t border-zinc-800/70 bg-gradient-to-b from-fuchsia-950/25 to-transparent">
      <SectionBackdrop image="bokeh" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2">
        {/* Copy */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
            <span aria-hidden>🎙️</span> In Your Voice
          </span>
          <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
            Your site can talk — in your own voice.
          </h2>
          <p className="mt-4 max-w-xl text-sm md:text-base text-zinc-300">
            Every QuickSites page can narrate itself: a quick summary, your pitch, even{' '}
            <span className="text-fuchsia-200">what&apos;s changed since a visitor&apos;s last stop</span>.
            Start with our house narrator, then set up a consented voice clone so it&apos;s{' '}
            <span className="font-semibold text-white">literally you</span> reading the page.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-zinc-400">
            <li className="flex gap-2"><span aria-hidden className="text-fuchsia-300">▸</span> One tap on any page — a warm, human read of your story.</li>
            <li className="flex gap-2"><span aria-hidden className="text-fuchsia-300">▸</span> A restaurant&apos;s menu, an agent&apos;s listing, a founder&apos;s story — spoken.</li>
            <li className="flex gap-2"><span aria-hidden className="text-fuchsia-300">▸</span> Add it in the builder in one block. No recording booth required.</li>
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="#start"
              className="inline-block rounded-lg bg-fuchsia-500 px-5 py-2.5 text-sm font-medium text-zinc-950 shadow-lg transition hover:bg-fuchsia-400"
            >
              Build a site that talks
            </Link>
            <Link
              href="/realtors/sample-listing"
              className="inline-block rounded-lg border border-fuchsia-500/60 px-5 py-2.5 text-sm font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/10 hover:text-fuchsia-100"
            >
              Hear it on a real site →
            </Link>
          </div>
        </div>

        {/* Live player */}
        <div className="rounded-2xl border border-fuchsia-500/25 bg-zinc-900/60 p-5 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Press play — hear this page</span>
            <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-medium text-fuchsia-200">live demo</span>
          </div>
          <AboutThatEmbed embedId={EMBED_ID} url={HOMEPAGE_URL} width="100%" />
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            This demo is narrated by a real, consented voice clone — not a synthetic default.
            Your site starts with our house narrator and upgrades to your own voice whenever
            you&apos;re ready.
          </p>
        </div>
      </div>
    </section>
  );
}
