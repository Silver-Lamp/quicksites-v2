'use client';

// components/admin/templates/render-blocks/about-that.tsx
//
// "About That" — HiveJournal's narrated-audio embed. Nothing is built server-side:
// the player, rendering, caching, and rate limits all live on HiveJournal. This
// block's entire output is their loader snippet:
//
//   <script async src="https://www.hivejournal.com/about-that.js" data-embed="…">
//
// Optional data-url overrides the narrated URL (defaults to window.location.href on
// HiveJournal's side); data-width sizes the iframe. The script is appended via
// useEffect — React-rendered <script> elements don't reliably execute across
// hydration paths, so we create + append it manually (and clean up on unmount).
// Until embed_id is a real uuid, a quiet setup hint renders in the editor and
// NOTHING renders on the public site.

import * as React from 'react';
import type { Block } from '@/types/blocks';

const LOADER_SRC = 'https://www.hivejournal.com/about-that.js';
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidEmbedId(id: string): boolean {
  return UUID_RX.test(id);
}

/**
 * The bare HiveJournal embed (no section wrapper) — reusable by other blocks that
 * carry a player slot (e.g. the real-estate listing card's agent-preset player).
 * Renders nothing when the id isn't a valid uuid.
 */
export function AboutThatEmbed({
  embedId,
  url = '',
  width = '',
  className,
}: {
  embedId: string;
  url?: string;
  width?: string;
  className?: string;
}) {
  const valid = UUID_RX.test((embedId || '').trim());
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !valid) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = LOADER_SRC;
    s.setAttribute('data-embed', embedId.trim());
    if (url) s.setAttribute('data-url', url);
    if (width) s.setAttribute('data-width', width);
    host.appendChild(s);
    return () => {
      // Remove the loader AND whatever it injected next to itself.
      host.innerHTML = '';
    };
  }, [valid, embedId, url, width]);

  if (!valid) return null;
  return <div ref={hostRef} data-about-that-embed={embedId.trim()} className={className} />;
}

type Props = {
  block?: Block;
  content?: Block['content'];
  previewOnly?: boolean;
};

export default function RenderAboutThat({ block, content, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? (block as any)?.props ?? {};
  const embedId: string = typeof c.embed_id === 'string' ? c.embed_id.trim() : '';
  const url: string = typeof c.url === 'string' ? c.url.trim() : '';
  const width: string = typeof c.width === 'string' ? c.width.trim() : typeof c.width === 'number' ? String(c.width) : '';
  const valid = UUID_RX.test(embedId);

  if (!valid) {
    // Editor/preview: a setup hint. Public site: render nothing at all.
    const inIframe =
      typeof window !== 'undefined' && typeof window.parent !== 'undefined' && window.parent !== window;
    if (!previewOnly && !inIframe) return null;
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          🎙️ <b>About That</b> — paste your HiveJournal embed ID to add narrated audio for this page.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-4">
      <AboutThatEmbed embedId={embedId} url={url} width={width} />
    </section>
  );
}
