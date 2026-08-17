// components/backdrop/page-backdrop.tsx
//
// The ONE place that knows how to put a backdrop behind a hand-built page.
//
// ⚠️ IT EXISTS BECAUSE THE LAYERING RULE KEEPS GETTING RE-BROKEN, AND ITS FAILURE IS SILENT.
// The backdrop is an absolutely positioned layer at `z-0`; content must sit above it at `z-10`.
// Get that wrong in either direction and nothing errors:
//
//   • Content paints an opaque page background → the backdrop is hidden, and a hidden backdrop is
//     pixel-identical to a page that never had one. That shipped on the site renderer and survived
//     weeks (CLAUDE.md §5b), because the only symptom is the absence of decoration.
//   • Content is left un-positioned → the absolutely positioned layer paints OVER the text, since
//     positioned elements paint above non-positioned siblings regardless of source order.
//
// Both are invisible to `tsc` and to any test that renders a component in isolation. So the rule
// lives here once, and callers pass children rather than re-deriving it. Adding a backdrop to a
// new page should never mean copying `absolute inset-0 z-0` anywhere again.
//
// The wrapper paints the page's base colour (via `className`) and the layer sits above that base
// but below the content — so a fill on the WRAPPER is correct and required, while a fill on the
// CHILDREN hides the art. That distinction is the whole trap.
import type { ReactNode } from 'react';
import { backdropLayerStyle, backdropScrimStyle } from '@/lib/theme/backdrops';
import { resolvePoolBackdrop, type PoolBackdropOptions } from '@/lib/theme/resolvePoolBackdrop';

export default async function PageBackdrop({
  poolKey,
  fallback,
  intensity,
  className = '',
  children,
}: PoolBackdropOptions & { className?: string; children: ReactNode }) {
  const backdrop = await resolvePoolBackdrop({ poolKey, fallback, intensity });
  const layer = backdropLayerStyle(backdrop);
  // Null for every CSS style — those are already alpha-composited over `--background` and need no
  // scrim. Only a generated image gets one, because only it can come back dark (standard rule 8:
  // enforce contrast, never hope for it).
  const scrim = backdropScrimStyle(backdrop);

  return (
    <div className={`relative ${className}`} data-qs-backdrop={backdrop.style}>
      {layer && <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={layer} />}
      {scrim && <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={scrim} />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
