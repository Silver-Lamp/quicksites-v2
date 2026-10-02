'use client';

// components/features/demo-clip-row.tsx
//
// Recorded walkthroughs as a horizontal row of small cards: poster, what the clip shows, how long
// it runs. Click one and it opens full size.
//
// ⚠️ A CLIP CARD MUST STOP THE CLICK. On /features the whole feature card is wrapped in a
// `<Link href="/features/<slug>">`, so anything inside it inherits that navigation — which is why
// the inline players it replaces could not really be played: pressing play on one navigated to the
// detail page instead. Every interactive element here calls `preventDefault()` AND
// `stopPropagation()`, and the test pins it.
//
// ⚠️ POSTERS ARE NOT POLISH HERE. These recordings open on a loading page, so a <video> with no
// poster renders a WHITE first frame — the first version of this row was three blank white
// rectangles, which reads as broken rather than as video. A clip with no poster gets a labelled
// placeholder, never a bare white frame.

import * as React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Play } from 'lucide-react';

export type DemoClipView = {
  src: string;
  label?: string;
  /** One line on what the clip shows. */
  blurb?: string;
  recorded_on?: string;
  poster?: string;
  duration_seconds?: number;
};

/** `92` → `1:32`. Returns null rather than guessing when we never measured it. */
export function formatDuration(seconds: number | undefined | null): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Keep only entries that can actually render something. */
export function usableClips(input: unknown): DemoClipView[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: DemoClipView[] = [];
  for (const c of input) {
    if (!c || typeof c !== 'object') continue;
    const src = (c as DemoClipView).src;
    if (typeof src !== 'string' || !src || seen.has(src)) continue;
    seen.add(src);
    out.push(c as DemoClipView);
  }
  return out;
}

function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export default function DemoClipRow({
  clips,
  featureTitle,
}: {
  clips: DemoClipView[];
  featureTitle: string;
}) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  const items = usableClips(clips);
  if (items.length === 0) return null;

  const active = openIdx === null ? null : items[openIdx] ?? null;

  return (
    <>
      {/* Snap-scrolling row. `overflow-x-auto` rather than a carousel library: it is keyboard and
          touch scrollable for free, and degrades to a plain row when there is only one clip. */}
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
        role="list"
        aria-label={`Recorded walkthroughs for ${featureTitle}`}
      >
        {items.map((c, i) => {
          const dur = formatDuration(c.duration_seconds);
          return (
            <button
              key={c.src}
              type="button"
              role="listitem"
              onClick={(e) => {
                stop(e);
                setOpenIdx(i);
              }}
              className="group/clip w-[208px] shrink-0 snap-start overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/40 text-left transition hover:border-sky-500/50 hover:bg-zinc-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <span className="relative block aspect-video w-full overflow-hidden bg-zinc-800">
                {c.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Supabase storage URL,
                  // already sized at generation; next/image would proxy it for no benefit.
                  <img
                    src={c.poster}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-200 group-hover/clip:scale-[1.03]"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-[10px] uppercase tracking-wide text-zinc-500">
                    Walkthrough
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition group-hover/clip:opacity-100">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-zinc-900">
                    <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
                  </span>
                </span>
                {dur ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                    {dur}
                  </span>
                ) : null}
              </span>
              <span className="block space-y-0.5 p-2.5">
                <span className="block text-xs font-medium leading-snug text-zinc-100">
                  {c.label || 'Walkthrough'}
                </span>
                {c.blurb ? (
                  <span className="block text-[11px] leading-snug text-zinc-400">{c.blurb}</span>
                ) : null}
                {c.recorded_on ? (
                  <span className="block pt-0.5 text-[10px] tabular-nums text-zinc-500">
                    Recorded {c.recorded_on}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setOpenIdx(null)}>
        <DialogContent
          className="max-w-4xl border-zinc-800 bg-zinc-950 p-3 sm:p-4"
          onClick={stop}
        >
          <DialogTitle className="px-1 text-sm font-medium text-zinc-100">
            {active?.label || featureTitle}
            {active?.recorded_on ? (
              <span className="ml-2 font-normal text-zinc-500">· {active.recorded_on}</span>
            ) : null}
          </DialogTitle>
          {active ? (
            <video
              key={active.src}
              src={active.src}
              poster={active.poster}
              controls
              autoPlay
              playsInline
              className="w-full rounded-md bg-black"
            />
          ) : null}
          {/* Always rendered: Radix warns when DialogContent has no description, and a clip
              with no blurb would otherwise ship an unlabelled dialog to a screen reader. */}
          <DialogDescription className="px-1 pb-1 text-xs text-zinc-400">
            {active?.blurb || `Recorded walkthrough: ${active?.label || featureTitle}`}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
