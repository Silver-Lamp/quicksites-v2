'use client';

// components/site/talking-demo-bar.tsx
//
// "Talking Demo" — the prominent press-play tour bar that turns any QuickSites page into
// a site that walks you through itself out loud. It's a branded frame around the HiveJournal
// About That player (page-grounded narration): press ▶ and hear this page describe itself.
//
// Tier 1 of the Talking Demo offering (crosstalk 2026-07-21): one quicksites.ai-gated embed
// narrates whatever page it's on (data-url = the page). Tier 2 (a per-site scripted/MP4 tour
// from the site's own blocks) is being scoped with HiveJournal.

import * as React from 'react';
import { AboutThatEmbed, isValidEmbedId } from '@/components/admin/templates/render-blocks/about-that';

// Reuses the warmed, quicksites.ai-gated realtors demo embed as a stand-in until a dedicated
// "Talking Demo" embed is minted. Override per-deploy without a code change.
const DEFAULT_EMBED =
  process.env.NEXT_PUBLIC_TALKING_DEMO_EMBED_ID || '9b0a931f-5277-4de4-bc30-54e0d1e9269f';

export default function TalkingDemoBar({
  embedId = DEFAULT_EMBED,
  url = '',
  headline = 'Talking Demo',
  subline = 'Press ▶ to hear this site walk you through itself — no reading required.',
  className = '',
}: {
  embedId?: string;
  /** Ground the narration at a specific URL (defaults to this page). */
  url?: string;
  headline?: string;
  subline?: string;
  className?: string;
}) {
  if (!isValidEmbedId(embedId)) return null;
  return (
    <div
      className={`rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-950">
          🔊 {headline}
        </span>
        <span className="text-sm font-medium text-emerald-100/90">{subline}</span>
      </div>
      <div className="mt-3">
        <AboutThatEmbed embedId={embedId} url={url} width="100%" />
      </div>
    </div>
  );
}
