// components/cart/cart-fab.tsx
'use client';

import * as React from 'react';
import CartButton from './cart-button';

/**
 * The floating cart, and the reason it needs its own theme scope.
 *
 * ⚠️ THIS COMPONENT IS MOUNTED OUTSIDE THE SITE IT FLOATS OVER. `app/layout.tsx` renders it as a
 * SIBLING of `{children}`, so it is not inside `TemplateThemeWrapper` — the `<div data-theme>` that
 * establishes a tenant site's light/dark token set. Its nearest theme ancestor is the app chrome,
 * which is always dark (CLAUDE.md §7). So every semantic token it uses resolves to the DARK palette
 * no matter what the site under it looks like, and on a light site the cart rendered a near-white
 * icon on a near-white page.
 *
 * This is the SectionShell failure (#665) reached by a different road: there, a shared component
 * hard-coded `text-white`; here, correct tokens are read in the wrong scope. Same outcome — a
 * control that disappears on a light tenant site — and the same blind spot, because the whole
 * fleet defaults to dark, where being pinned to dark is indistinguishable from being right.
 *
 * Fix: mirror the site's own `data-theme` onto a wrapper here, so the tokens inside resolve
 * against the palette of the page the cart is actually sitting on.
 */
function useSiteColorMode(): 'light' | 'dark' {
  const [mode, setMode] = React.useState<'light' | 'dark'>('dark');

  React.useEffect(() => {
    const read = () => {
      // The site wrapper is the one that carries a color mode for the CONTENT. Prefer the
      // themed-site marker; fall back to any [data-theme] (the admin chrome sets one too).
      const el =
        document.querySelector('[data-qs-themed][data-theme]') ??
        document.querySelector('[data-theme]');
      const v = el?.getAttribute('data-theme');
      setMode(v === 'light' ? 'light' : 'dark');
    };
    read();

    // The editor flips the preview between light and dark without a reload, and the public
    // wrapper mounts after this does. Watch rather than sample once.
    const obs = new MutationObserver(read);
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme'], subtree: true, childList: true });
    return () => obs.disconnect();
  }, []);

  return mode;
}

export default function CartFab({ className = '' }: { className?: string }) {
  const mode = useSiteColorMode();

  return (
    <div
      data-theme={mode}
      className={['fixed bottom-4 right-4 z-50', className].filter(Boolean).join(' ')}
    >
      {/* Keep it visible even when empty; CartButton will still hide if e-com truly disabled */}
      <CartButton hideWhenEmpty={false} />
    </div>
  );
}
