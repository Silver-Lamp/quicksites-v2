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
  resolveKinds,
  type HearThisPageSettings,
} from '@/lib/hearThisPage/config';

export default function HearThisPage({ settings }: { settings?: HearThisPageSettings | null }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [pageUrl, setPageUrl] = React.useState('');
  // Defer to an owner's own voice: if the page already renders an In Your Voice /
  // About That player (a different embed than the house one), suppress this launcher —
  // that owner-voice player is the richer experience, and it avoids a redundant
  // house-narrator render (and its spend).
  const [ownerVoiceOnPage, setOwnerVoiceOnPage] = React.useState(false);

  // Collapse + un-dismiss on navigation; recompute the grounded URL (origin+pathname,
  // no query string) so each page narrates itself. Then detect an owner embed once the
  // page's client components have had a beat to mount.
  React.useEffect(() => {
    setOpen(false);
    setDismissed(false);
    setOwnerVoiceOnPage(false);
    if (typeof window === 'undefined') return;
    setPageUrl(window.location.origin + window.location.pathname);
    const detect = () => {
      const hosts = Array.from(document.querySelectorAll('[data-about-that-embed]'));
      const hasOwner = hosts.some((el) => el.getAttribute('data-about-that-embed') !== HEAR_THIS_PAGE_EMBED_ID);
      if (hasOwner) setOwnerVoiceOnPage(true);
    };
    const t = window.setTimeout(detect, 1500);
    return () => window.clearTimeout(t);
  }, [pathname]);

  if (!HEAR_THIS_PAGE_ENABLED || !HEAR_THIS_PAGE_EMBED_ID) return null;
  if (!hearThisPageVisibleFor(pathname, settings)) return null;
  if (ownerVoiceOnPage) return null;
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
            <AboutThatEmbed
              embedId={HEAR_THIS_PAGE_EMBED_ID}
              url={pageUrl}
              width="100%"
              kinds={resolveKinds(pathname, settings)}
            />
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
