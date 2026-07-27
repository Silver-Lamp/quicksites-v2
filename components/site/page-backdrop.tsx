// components/site/page-backdrop.tsx
//
// A backdrop for QuickSites' OWN marketing pages.
//
// Tenant sites get theirs automatically: `TemplateThemeWrapper` reads
// `data.meta.backdrop` and paints it (lib/theme/backdrops.ts). Our marketing pages don't go
// through that wrapper — they're plain Next pages on `bg-zinc-950` — so they were the last
// flat surfaces left after the fleet rollout. This drops the same recipes onto them without
// duplicating a single gradient: it calls the exact functions the site renderer calls.
//
// Costs nothing. Every style here is pure CSS built from theme tokens, so there is no image,
// no generation, no storage and no runtime dependency. (The one paid style, `painterly`, is
// deliberately NOT reachable from this component — see the note on `style` below.)
//
// Usage — one line inside a page that already renders <SiteHeader />:
//
//   <PageBackdrop style="contour" />
//
// It positions itself absolutely, so the page needs a positioned ancestor. Every marketing
// page here already wraps its content in `relative min-h-screen`, which is why this takes no
// layout props.

import type { BackdropStyle } from '@/lib/theme/backdrops';
import { backdropLayerStyle } from '@/lib/theme/backdrops';

/** Paid/image styles are excluded by construction — this component is the free path. */
type CssBackdropStyle = Exclude<BackdropStyle, 'painterly' | 'none'>;

export default function PageBackdrop({
  style,
  intensity = 45,
}: {
  /**
   * `painterly` is intentionally not assignable. A generated image on a marketing page is a
   * different mechanism (a committed build artifact that versions with the copy — see
   * crosstalk/contracts/painterly-backdrop.md), and it spends money, so it must never be
   * reachable by changing one prop.
   */
  style: CssBackdropStyle;
  /** 0–100. Slightly under the site default of 50: marketing pages carry denser copy. */
  intensity?: number;
}) {
  const layer = backdropLayerStyle({ style, intensity });
  // Degrade to plain, same as rule 7 on the site path: nothing to paint ⇒ no element at all.
  if (!layer) return null;

  return (
    <div
      aria-hidden
      // -z-10, not z-0. CSS paint order is: parent background → NEGATIVE z-index children →
      // in-flow content. So a negative z sits above the page's bg-zinc-950 and below the copy,
      // which is exactly a backdrop. At z-0 it would paint OVER the static text instead.
      className="pointer-events-none absolute inset-0 -z-10"
      style={layer}
    />
  );
}
