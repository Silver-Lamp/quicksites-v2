'use client';
// components/home/site-fly-through.tsx
//
// Real sites flying out of the background toward the viewer, behind the homepage hero (owner,
// 2026-10-06): "dynamic components that float in from the background to the foreground, becoming
// larger as they become closer … the first five sites from that gallery … fading out as they get
// too large."
//
// ⚠️ PURE CSS. Five cards, one keyframe animation, GPU-composited transform + opacity only — no
// JavaScript per frame, no layout work, nothing that competes with the hero's LCP. Each card gets
// its own lane (where it starts near the vanishing point and where it drifts to), its own duration
// and a NEGATIVE delay, so the loop is already populated at first paint instead of five cards
// appearing in a row.
//
// ⚠️ DECORATION, NOT NAVIGATION. The layer is aria-hidden and pointer-events-none: it sits behind
// the hero's headline and the guest builder, and a moving card is not a target anyone can click
// on purpose. The clickable version of these sites is the "Built with QuickSites" row below.
//
// ⚠️ Honours prefers-reduced-motion: the cards hold a static, faint scatter instead of flying.
// ⚠️ Thumbnails are the showcase's generated thumbs (/api/public/showcase/<slug>/thumb) — the same
// image the row uses, so a site with no hero still shows something rather than a broken <img>.

// ⚠️ Constants live in lib/home/flyThrough.ts, NOT here: this is a 'use client' module, and a
// server component importing a value from it receives a client-reference proxy, not the value.
// That is exactly how the first deploy rendered nothing (see the lib module's header).
import { FLY_COUNT, FLY_LANES, type FlySite } from '@/lib/home/flyThrough';

const CSS = `
@keyframes qs-fly {
  0%   { transform: translate3d(var(--fx0), var(--fy0), 0) scale(0.12); opacity: 0; }
  12%  { opacity: 0.9; }
  68%  { opacity: 0.9; }
  100% { transform: translate3d(var(--fx1), var(--fy1), 0) scale(1.9); opacity: 0; }
}
.qs-fly-card {
  animation: qs-fly var(--fdur) linear infinite;
  animation-delay: var(--fdelay);
  will-change: transform, opacity;
}
@media (prefers-reduced-motion: reduce) {
  .qs-fly-card { animation: none; opacity: 0.22; transform: translate3d(var(--fx1), var(--fy1), 0) scale(0.6); }
}
@media (max-width: 768px) {
  .qs-fly-card { width: 11rem; }
}
`;

export default function SiteFlyThrough({ sites }: { sites: FlySite[] }) {
  const cards = sites.slice(0, FLY_COUNT);
  if (cards.length === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" data-qs-fly-through>
      <style>{CSS}</style>
      {cards.map((s, i) => {
        const lane = FLY_LANES[i % FLY_LANES.length];
        const style = {
          '--fx0': `${lane.x0}vw`,
          '--fy0': `${lane.y0}vh`,
          '--fx1': `${lane.x1}vw`,
          '--fy1': `${lane.y1}vh`,
          '--fdur': `${lane.seconds}s`,
          // Negative delays spread the five cards through the loop from the first frame.
          '--fdelay': `${-((lane.seconds * i) / FLY_COUNT).toFixed(2)}s`,
        } as React.CSSProperties;
        return (
          <div
            key={s.slug}
            className="qs-fly-card absolute left-1/2 top-1/2 w-56 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900 shadow-2xl shadow-black/60"
            style={style}
          >
            {/* Browser-chrome strip, so a card reads as a website at every size. */}
            <div className="flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/80 px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
              <span className="ml-2 truncate text-[8px] text-zinc-500">{s.slug}.quicksites.ai</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/public/showcase/${encodeURIComponent(s.slug)}/thumb`}
              alt=""
              loading="lazy"
              decoding="async"
              className="block aspect-[16/10] w-full object-cover object-top"
            />
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="truncate text-[11px] font-medium text-zinc-100">{s.name}</span>
              {s.industry && <span className="shrink-0 rounded bg-zinc-800 px-1 text-[9px] uppercase tracking-wide text-zinc-400">{s.industry}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
