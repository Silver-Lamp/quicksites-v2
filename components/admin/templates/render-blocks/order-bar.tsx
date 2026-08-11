// components/admin/templates/render-blocks/order-bar.tsx
'use client';

import { useFixedBottomVar } from '@/lib/ui/useFixedBottomVar';
import * as React from 'react';

// Mobile-only sticky bottom bar (the ChowNow/Toast pattern): a tap-to-call action
// and a primary CTA that jumps to the on-page menu (or links out to ordering).
// Hidden on desktop (md+). Renders a spacer so it never covers page content.

function telHref(phone: string) {
  const digits = (phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

export default function RenderOrderBar(props: any) {
  const content: any = props?.block?.content ?? props?.content ?? props ?? {};
  if (content.enabled === false) return null;

  const phone: string = content.phone || '';
  const callLabel: string = content.call_label || 'Call';
  const ctaLabel: string = content.cta_label || 'View Menu';
  // `??` not `||`, so an EXPLICIT empty string means "this site has no menu — show only the
  // Call button". Several listing-import restaurants have no menu we can honestly publish
  // (no menu photo in their listing, no website to scrape), and their menu block is removed
  // rather than filled with scaffold placeholders. With `||`, an empty value fell back to
  // '#menu' and rendered a "View Menu" button that scrolled to nothing.
  const ctaHref: string = content.cta_href ?? '#menu';
  const tel = telHref(phone);

  // Nothing actionable → render nothing (avoids an empty bar on non-restaurant sites).
  if (!tel && !ctaHref) return null;

  const onCta = (e: React.MouseEvent) => {
    if (!ctaHref.startsWith('#')) return; // real link → default nav
    e.preventDefault();
    if (typeof document === 'undefined') return;
    // Prefer an explicit #menu target; else jump to the first menu section.
    const target =
      document.querySelector(ctaHref) ||
      document.querySelector('[id^="menu-"]');
    if (target) (target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const orderBarRef = useFixedBottomVar<HTMLDivElement>('--qs-orderbar-h');

  return (
    <>
      {/* Spacer so the fixed bar never hides the last of the content. Grows with whatever else is
          pinned down there — on an unclaimed draft the claim bar is below us. */}
      <div
        className="md:hidden"
        style={{ height: 'calc(4rem + var(--qs-claimbar-h, 0px))' }}
        aria-hidden
      />
      {/* ⚠️ Sits ABOVE the claim bar rather than under it. Both were `bottom-0`, so on every
          unclaimed restaurant draft this bar was simply behind the claim bar — invisible, with its
          Call and View Menu actions unreachable. See lib/ui/useFixedBottomVar. */}
      <div
        ref={orderBarRef}
        style={{ bottom: 'var(--qs-claimbar-h, 0px)' }}
        className="fixed inset-x-0 z-40 border-t border-border bg-background/95 text-foreground p-3 backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-3xl gap-3">
          {tel && (
            <a
              href={tel}
              className="flex flex-1 items-center justify-center rounded-xl border border-border py-3 text-base font-semibold"
            >
              📞 {callLabel}
            </a>
          )}
          {ctaHref && (
            <a
              href={ctaHref}
              onClick={onCta}
              className="flex flex-[1.4] items-center justify-center rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground"
            >
              {ctaLabel}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
