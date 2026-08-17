// components/garage-sales/yard-sale-surface.tsx
//
// The page surface for every yardsalesites.com screen: light themed, with a backdrop under the
// content. One wrapper so the directory, the sale page and the create form cannot drift apart.
//
// ⚠️ WHY A LIGHT SCOPE IS NEEDED AT ALL. `app/providers.tsx` wraps the entire app in
// `<ThemeScope mode="dark">` — the QuickSites admin chrome is always dark (CLAUDE.md §7). A
// tenant-facing surface is not the admin chrome, and a yard sale is a daylight, kerbside thing.
// Nesting a light scope inside the dark one is explicitly supported: `styles/globals.css`
// re-declares the full light palette under `[data-theme='light']` precisely so a light scope can
// reset an ancestor dark scope. Because the tokens key off that attribute, this is correct at
// SSR / first paint rather than after hydration.
//
// ⚠️ SO USE SEMANTIC TOKENS INSIDE, NEVER LITERAL LIGHT CLASSES. `bg-background`,
// `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card` all resolve light in
// here and dark everywhere else. Hard-coding `bg-white`/`text-zinc-900` would pin this surface
// light forever and silently break the moment anything reuses it — the SectionShell failure
// (#665) in the opposite direction.
//
// ⚠️ AND NOTHING INSIDE MAY PAINT A FULL-PAGE BACKGROUND. The backdrop is an absolutely
// positioned layer at z-0 with content above it at z-10, so an opaque `bg-background` on the
// content side hides it completely — and a hidden backdrop looks exactly like a page that was
// never given one, which is why that bug survived weeks on the main site renderer (CLAUDE.md
// §5b). Cards are fine and wanted: a translucent `bg-card/70` keeps text legible while letting
// the painting through. Pinned by app/garage-sales/__tests__/yardSaleSurface.test.ts.
import type { ReactNode } from 'react';
import ThemeScope from '@/components/ui/theme-scope';
import { backdropLayerStyle, backdropScrimStyle } from '@/lib/theme/backdrops';
import { resolveYardSaleBackdrop } from '@/lib/garageSales/backdrop';

export default async function YardSaleSurface({ children }: { children: ReactNode }) {
  const backdrop = await resolveYardSaleBackdrop();
  const layer = backdropLayerStyle(backdrop);
  // Null for every CSS style — those are already alpha-composited over `--background` and need
  // no scrim. Only the generated image gets one, because only it can come back dark.
  const scrim = backdropScrimStyle(backdrop);

  return (
    <ThemeScope mode="light" className="min-h-screen bg-background text-foreground">
      <div className="relative min-h-screen">
        {layer && <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={layer} />}
        {scrim && <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={scrim} />}
        <div className="relative z-10">{children}</div>
      </div>
    </ThemeScope>
  );
}
