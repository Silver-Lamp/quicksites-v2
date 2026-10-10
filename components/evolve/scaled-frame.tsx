'use client';

// components/evolve/scaled-frame.tsx
//
// An iframe that shows a DESKTOP page whole inside a narrow column: the frame is laid out at a
// desktop width and scaled down to the container, so the restaurant sees its own site as a
// visitor on a laptop sees it, not the top-left corner of it. The first live Evolve page showed
// "THE ROCK I" — the left half of a logo — for a site whose whole point was to be recognised.
import * as React from 'react';

export default function ScaledFrame({ src, title, designWidth = 1280, aspect = 0.8, className = '' }: { src: string; title: string; designWidth?: number; aspect?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.45);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / designWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);
  const designHeight = Math.round(designWidth * aspect);
  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${className}`} style={{ height: Math.round(designHeight * scale) }}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ width: designWidth, height: designHeight, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0 }}
      />
    </div>
  );
}
