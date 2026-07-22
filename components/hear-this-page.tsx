'use client';

// components/hear-this-page.tsx
//
// The platform-wide "🔊 Hear this page" launcher (see lib/hearThisPage/config.ts).
// Mounted once in the root layout; self-gates by feature flag + a configured embed +
// the current pathname, so it appears on public surfaces only (tenant sites, marketing,
// delivered.menu) and never on admin/auth/checkout. Collapsed it's a small pill; tapping
// it expands the About That player grounded at THIS page's URL, house narrator, short
// version. Honest: labeled "Narrated" — never presented as anyone's own voice.

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AboutThatEmbed } from '@/components/admin/templates/render-blocks/about-that';
import {
  HEAR_THIS_PAGE_ENABLED,
  HEAR_THIS_PAGE_EMBED_ID,
  HEAR_THIS_PAGE_VOICE_LABEL,
  hearThisPageVisibleFor,
} from '@/lib/hearThisPage/config';

export default function HearThisPage() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [pageUrl, setPageUrl] = React.useState('');

  // Collapse + un-dismiss on navigation; recompute the grounded URL (origin+pathname,
  // no query string) so each page narrates itself.
  React.useEffect(() => {
    setOpen(false);
    setDismissed(false);
    if (typeof window !== 'undefined') {
      setPageUrl(window.location.origin + window.location.pathname);
    }
  }, [pathname]);

  if (!HEAR_THIS_PAGE_ENABLED || !HEAR_THIS_PAGE_EMBED_ID) return null;
  if (!hearThisPageVisibleFor(pathname)) return null;
  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden">
      {open ? (
        <div className="w-[min(92vw,360px)] rounded-2xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <span aria-hidden>🎙️</span> Hear this page
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              ✕
            </button>
          </div>
          {pageUrl ? (
            <AboutThatEmbed embedId={HEAR_THIS_PAGE_EMBED_ID} url={pageUrl} width="100%" />
          ) : null}
          <p className="mt-2 text-[11px] text-muted-foreground">{HEAR_THIS_PAGE_VOICE_LABEL}</p>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-2 text-sm font-medium shadow-lg backdrop-blur transition hover:bg-muted"
          >
            <span aria-hidden>🔊</span> Hear this page
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="rounded-full border border-border bg-background/90 px-2 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur transition hover:bg-muted"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
