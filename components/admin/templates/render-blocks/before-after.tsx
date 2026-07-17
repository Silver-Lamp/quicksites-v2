'use client';

// components/admin/templates/render-blocks/before-after.tsx
//
// Before / After slider — the "after" image fills the frame; the "before" image is
// clipped to the handle position, so dragging the divider wipes between them. Mouse +
// touch + keyboard (arrow keys on the focused handle). The transformation-trade
// converter (deck/fence/concrete/roofing/siding/painting/pressure-washing). Renders
// nothing until both images are set.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = { block?: Block; content?: Block['content'] };
const s = (v: any) => (typeof v === 'string' ? v.trim() : '');

export default function RenderBeforeAfter({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title = s(c.title);
  const before = s(c.before_url);
  const after = s(c.after_url);
  const beforeLabel = s(c.before_label) || 'Before';
  const afterLabel = s(c.after_label) || 'After';

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState(50); // 0..100, divider x-position
  const dragging = React.useRef(false);

  const setFromClientX = React.useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  React.useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const x = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      if (typeof x === 'number') setFromClientX(x);
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [setFromClientX]);

  if (!before || !after) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      {title && <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">{title}</h2>}
      <div
        ref={containerRef}
        className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border border-border bg-muted"
        onMouseDown={(e) => { dragging.current = true; setFromClientX(e.clientX); }}
        onTouchStart={(e) => { dragging.current = true; const x = e.touches[0]?.clientX; if (typeof x === 'number') setFromClientX(x); }}
      >
        {/* After (full) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{afterLabel}</span>

        {/* Before (clipped to the handle) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={beforeLabel} className="absolute inset-0 h-full w-full object-cover" style={{ width: containerRef.current ? containerRef.current.clientWidth : '100%', maxWidth: 'none' }} draggable={false} />
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{beforeLabel}</span>
        </div>

        {/* Divider + handle */}
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow" style={{ left: `${pos}%` }} aria-hidden />
        <button
          type="button"
          role="slider"
          aria-label="Drag to compare before and after"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 4)); else if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 4)); }}
          className="absolute top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/50 text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
          style={{ left: `${pos}%` }}
        >
          ↔
        </button>
      </div>
    </section>
  );
}
