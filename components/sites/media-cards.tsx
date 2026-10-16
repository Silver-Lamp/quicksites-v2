'use client';

// components/sites/media-cards.tsx
//
// Up to three phone-shaped cards (videos or images) laid like phones on a table: tilted a few
// degrees each until a video plays, straight again when it ends. Shared by the hero's
// `media_split` layout and the `video_showcase` block, so the two cannot drift.
//
// ⚠️ Posters are load-bearing: `preload="none"` with a poster means nothing downloads until a
// tap; without a poster we fall back to `metadata` so the card is not a black rectangle.
// `playsInline` so iOS does not take the screen over. An image card is just the image.

import * as React from 'react';
import type { HeroMediaItem } from '@/lib/sites/heroMedia';

/** Tailwind class names must appear literally for the JIT scan — keep this array spelled out. */
const TILTS = ['-rotate-3', 'rotate-2', '-rotate-2'] as const;

export function MediaCards({ items, tilt = true, maxWidth = 300 }: { items: HeroMediaItem[]; tilt?: boolean; maxWidth?: number }) {
  const [playing, setPlaying] = React.useState<Record<number, boolean>>({});
  if (!items.length) return null;
  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
      {items.map((v, i) => {
        const tilted = tilt && !playing[i];
        return (
          <figure key={`${v.url}-${i}`} className="w-full" style={{ maxWidth }}>
            <div
              data-tilted={tilted ? '1' : '0'}
              className={`overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-border transition-transform duration-500 ease-out ${tilted ? TILTS[i % TILTS.length] : 'rotate-0'}`}
            >
              {v.kind === 'image' ? (
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
