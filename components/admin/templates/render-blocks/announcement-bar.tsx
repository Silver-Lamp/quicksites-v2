'use client';

// components/admin/templates/render-blocks/announcement-bar.tsx
//
// Dismissible site-wide announcement bar: free-shipping threshold, promo code chip,
// sale window. HONESTY RULES (product-wide): `ends_at` is a REAL end time — once it
// passes the bar renders NOTHING (no auto-resetting scarcity, ever). Dismissal is
// remembered per message-content in localStorage, so editing the message re-shows it.

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = { block?: Block; content?: Block['content']; previewOnly?: boolean };

function contentKey(message: string, code: string, endsAt: string): string {
  let h = 0;
  const s = `${message}|${code}|${endsAt}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `qs:announce:${h.toString(36)}`;
}

export default function RenderAnnouncementBar({ block, content, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const message: string = typeof c.message === 'string' ? c.message.trim() : '';
  const linkText: string = typeof c.link_text === 'string' ? c.link_text.trim() : '';
  const linkHref: string = typeof c.link_href === 'string' ? c.link_href.trim() : '';
  const code: string = typeof c.code === 'string' ? c.code.trim() : '';
  const endsAt: string = typeof c.ends_at === 'string' ? c.ends_at.trim() : '';
  const dismissible: boolean = c.dismissible !== false;

  const key = contentKey(message, code, endsAt);
  const [dismissed, setDismissed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === '1');
    } catch { /* ignore */ }
  }, [key]);

  if (!message) return null;

  // Real end times only: past the window, the bar is gone — everywhere, including
  // the editor (an operator seeing it vanish is the honest signal to update it).
  const ended = endsAt ? Number.isFinite(Date.parse(endsAt)) && Date.parse(endsAt) < Date.now() : false;
  if (ended) return null;
  if (dismissed && !previewOnly) return null;

  const endsLabel = endsAt && Number.isFinite(Date.parse(endsAt))
    ? new Date(endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="sticky top-0 z-40 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm font-medium">
        <span>{message}</span>
        {code && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch { /* ignore */ }
            }}
            className="rounded-md border border-primary-foreground/40 bg-primary-foreground/10 px-2 py-0.5 font-mono text-xs tracking-wide hover:bg-primary-foreground/20"
            title="Copy code"
          >
            {copied ? 'Copied ✓' : code}
          </button>
        )}
        {endsLabel && <span className="text-xs opacity-80">ends {endsLabel}</span>}
        {linkText && linkHref && (
          <a href={previewOnly ? '#' : linkHref} className="underline underline-offset-2 hover:opacity-80">
            {linkText}
          </a>
        )}
        {dismissible && (
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => {
              setDismissed(true);
              try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
            }}
            className="ml-1 rounded p-0.5 leading-none opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
