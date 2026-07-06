// components/admin/templates/render-blocks/order-bar.tsx
'use client';

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
  const ctaHref: string = content.cta_href || '#menu';
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

  return (
    <>
      {/* spacer so fixed bar never hides the last bit of content on mobile */}
      <div className="h-16 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 backdrop-blur md:hidden dark:border-white/10 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-3xl gap-3">
          {tel && (
            <a
              href={tel}
              className="flex flex-1 items-center justify-center rounded-xl border border-zinc-300 py-3 text-base font-semibold dark:border-zinc-700"
            >
              📞 {callLabel}
            </a>
          )}
          {ctaHref && (
            <a
              href={ctaHref}
              onClick={onCta}
              className="flex flex-[1.4] items-center justify-center rounded-xl bg-zinc-900 py-3 text-base font-semibold text-white dark:bg-white dark:text-zinc-950"
            >
              {ctaLabel}
            </a>
          )}
        </div>
      </div>
    </>
  );
}
