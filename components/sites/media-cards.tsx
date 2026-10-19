'use client';

// components/sites/media-cards.tsx
//
// Up to three phone-shaped cards (videos or images) laid like phones on a table: tilted a few
// degrees each until a video plays, straight again when it ends. Shared by the hero's
// `media_split` layout and the `video_showcase` block, so the two cannot drift.
//
// ⚠️ Posters are load-bearing: `preload="none"` with a poster means nothing downloads until a
// tap; without a poster we fall back to `metadata` so the card is not a black rectangle.
// `playsInline` so iOS does not take the screen over. An image card is just the image — unless
// it carries `title`/`text` (lib/sites/heroMedia.ts): then it is a BUTTON that surfaces that text
// as a panel over the picture, tapped open and tapped shut, straightening while open the way a
// video card does while playing (Katie Bee's hero, 2026-10-19). Keyboard: it is a real button.

import * as React from 'react';
import type { HeroMediaItem } from '@/lib/sites/heroMedia';

/** Tailwind class names must appear literally for the JIT scan — keep this array spelled out. */
const TILTS = ['-rotate-3', 'rotate-2', '-rotate-2'] as const;

export function MediaCards({ items, tilt = true, maxWidth = 300 }: { items: HeroMediaItem[]; tilt?: boolean; maxWidth?: number }) {
  const [playing, setPlaying] = React.useState<Record<number, boolean>>({});
  const [open, setOpen] = React.useState<Record<number, boolean>>({});
  if (!items.length) return null;
  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
      {items.map((v, i) => {
        const revealable = v.kind === 'image' && !!(v.title || v.text);
        const tilted = tilt && !playing[i] && !open[i];
        return (
          <figure key={`${v.url}-${i}`} className="w-full" style={{ maxWidth }}>
            <div
              data-tilted={tilted ? '1' : '0'}
              className={`overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-border transition-transform duration-500 ease-out ${tilted ? TILTS[i % TILTS.length] : 'rotate-0'}`}
            >
              {revealable ? (
                <button
                  type="button"
                  data-media-reveal={open[i] ? 'open' : 'closed'}
                  aria-expanded={!!open[i]}
                  aria-label={v.title ? `${v.title} — ${open[i] ? 'hide' : 'read more'}` : open[i] ? 'Hide' : 'Read more'}
                  onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                  className="group relative block w-full text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.url} alt={v.caption ?? v.title ?? ''} className={`aspect-[9/16] w-full object-cover transition-transform duration-500 ${open[i] ? 'scale-105 blur-[2px]' : ''}`} loading="lazy" />
                  {/* A small cue that the card opens, until it is open. */}
                  {!open[i] ? (
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      {v.title ? v.title : 'Tap'} <span aria-hidden>→</span>
                    </span>
                  ) : null}
                  <span
                    aria-hidden={!open[i]}
                    className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/55 to-black/10 p-5 text-white transition-opacity duration-300 ${open[i] ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                  >
                    {v.title ? <span className="block text-lg font-semibold leading-snug">{v.title}</span> : null}
                    {v.text ? <span className="mt-2 block text-sm leading-relaxed text-white/90">{v.text}</span> : null}
                    <span className="mt-3 block text-xs text-white/60">Tap to close</span>
                  </span>
                </button>
              ) : v.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.url} alt={v.caption ?? ''} className="aspect-[9/16] w-full object-cover" loading="lazy" />
              ) : (
                <video
                  controls
                  playsInline
                  preload={v.poster ? 'none' : 'metadata'}
                  poster={v.poster}
                  className="aspect-[9/16] w-full bg-black object-contain"
                  onPlay={() => setPlaying((p) => ({ ...p, [i]: true }))}
                  onEnded={() => setPlaying((p) => ({ ...p, [i]: false }))}
                >
                  <source src={v.url} />
                </video>
              )}
            </div>
            {v.caption ? <figcaption className="mt-3 text-center text-sm text-muted-foreground">{v.caption}</figcaption> : null}
          </figure>
        );
      })}
    </div>
  );
}
