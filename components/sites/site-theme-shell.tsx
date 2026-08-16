import * as React from 'react';

/**
 * Put a page into a SITE's light/dark instead of the app chrome's.
 *
 * ⚠️ THE CART AND CHECKOUT LIVE OUTSIDE `TemplateThemeWrapper`. That wrapper scopes
 * `[data-theme]` around a site's rendered blocks, but the site route returns the cart and
 * checkout before any of it — so they inherited the admin chrome, which is always dark
 * (CLAUDE.md §7). A light restaurant site handed its customer a black cart halfway through
 * ordering. Nothing broke and nothing logged; the page just stopped looking like the same
 * website, at the moment a stranger is deciding whether to trust it with a card.
 *
 * Two things are load-bearing here:
 *
 *   • `data-theme` is what the semantic tokens key off, so every `bg-card` / `text-foreground`
 *     / `border-border` inside resolves to the SITE's palette rather than the chrome's. This is
 *     why the fix is a wrapper and not a pile of `dark:` variants — those only apply after
 *     hydration and would flash the wrong theme first.
 *
 *   • `data-qs-themed` is the marker `CartFab` looks for when it mirrors the site's mode. With
 *     it, the floating cart button matches the page it is floating over on these routes too.
 *
 * `bg-background` here is correct and is NOT the occlusion bug from the site renderer: there is
 * no backdrop layer underneath a cart to hide.
 */
export default function SiteThemeShell({
  colorMode,
  children,
}: {
  colorMode: 'light' | 'dark';
  children: React.ReactNode;
}) {
  return (
    <div
      data-theme={colorMode}
      data-qs-themed="1"
      // colorScheme is what the BROWSER reads to paint native controls — checkboxes, radios,
      // scrollbars, date pickers. `data-theme` never reaches them. Checkout is full of native
      // inputs, so without this a light site renders dark form controls at the exact moment
      // someone is deciding whether to type a card number into them.
      style={{ colorScheme: colorMode }}
      className="min-h-screen bg-background text-foreground"
    >
      {children}
    </div>
  );
}
