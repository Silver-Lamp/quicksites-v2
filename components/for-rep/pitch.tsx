// components/for-rep/pitch.tsx
//
// The folded pitch cards shared by /for-sales (the rep brief) and /spread-the-word (the public
// referral page). Native <details>: server-rendered, zero JS. A Pitch is the sentence with its
// looping visual; a SubPitch is one vertical inside it, title + a line, opened one at a time.
import type * as React from 'react';
import PitchArt, { type PitchArtKind } from '@/components/for-rep/pitch-art';
import { BUSINESS_SUBPITCHES } from '@/lib/sales/forSalesPitches';

export function Pitch({ summary, art, children }: { summary: string; art: PitchArtKind; children: React.ReactNode }) {
  return (
    <details className="group mx-auto max-w-3xl px-6 pt-5">
      <summary className="flex cursor-pointer select-none items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-xl font-bold leading-snug text-white transition-colors hover:border-emerald-500/50 group-open:border-emerald-500/60 md:p-5 md:text-2xl [&::-webkit-details-marker]:hidden">
        <PitchArt kind={art} />
        <span className="flex-1">
          {summary}
          <span className="mt-2 block text-xs font-medium uppercase tracking-wider text-emerald-400/90">
            <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>{' '}
            <span className="group-open:hidden">Open to see how</span>
            <span className="hidden group-open:inline">Close</span>
          </span>
        </span>
      </summary>
      <div className="-mx-6 mt-2 border-l border-zinc-800/60 md:ml-0">{children}</div>
    </details>
  );
}

/** A box inside a pitch: title + one line, opens to the vertical's own section. */
export function SubPitch({ k, children }: { k: keyof typeof BUSINESS_SUBPITCHES; children: React.ReactNode }) {
  const c = BUSINESS_SUBPITCHES[k];
  return (
    <details className="group/sub mx-auto max-w-3xl px-6 pt-3">
      {/* `list-none` as well as the webkit marker rule: a block-display summary still paints the
          default ▶ triangle beside our own arrow (seen live 2026-10-11); the Pitch summary is
          display:flex, which is why it never did. */}
      <summary className="list-none cursor-pointer select-none rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-sky-500/50 group-open/sub:border-sky-500/60 [&::-webkit-details-marker]:hidden">
        <span className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 inline-block shrink-0 text-sky-400 transition-transform group-open/sub:rotate-90">›</span>
          <span>
            <span className="block text-base font-semibold text-white">{c.title}</span>
            <span className="mt-1 block text-sm leading-relaxed text-zinc-400">{c.line}</span>
          </span>
        </span>
      </summary>
      <div className="-mx-6 mt-1">{children}</div>
    </details>
  );
}
