'use client';

// components/admin/templates/render-blocks/quote-of-the-day.tsx
//
// Quote of the Day — HiveJournal's cached daily-quote endpoint (crosstalk/contracts/
// quote-of-the-day.md, LIVE). Zero-consent (a generic inspirational quote, not
// journal-derived), cost-safe (HJ caches ~1 external call/day). Backend host, NOT www.
// Degrades to rendering nothing on error (the endpoint self-heals, so errors are rare).
// The site slug rides as ?ref for HJ's per-embedder usage tracking.

import * as React from 'react';
import type { Block } from '@/types/blocks';

const QUOTE_URL = 'https://hivejournalbackend-production.up.railway.app/api/quotes/daily';

type Props = { block?: Block; content?: Block['content']; template?: any };
type Daily = { quote: string; author: string; date: string };

export default function RenderQuoteOfTheDay({ block, content, template }: Props) {
  const c: any = content ?? block?.content ?? {};
  const align: string = c.align === 'left' ? 'text-left' : 'text-center';
  const ref: string =
    (template as any)?.slug ?? (template as any)?.id ?? (typeof window !== 'undefined' ? (window as any).__QS_TEMPLATE__?.slug : '') ?? '';

  const [q, setQ] = React.useState<Daily | null>(null);

  React.useEffect(() => {
    let active = true;
    const url = ref ? `${QUOTE_URL}?ref=${encodeURIComponent(ref)}` : QUOTE_URL;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active && j && typeof j.quote === 'string' && j.quote) {
          setQ({ quote: j.quote, author: typeof j.author === 'string' ? j.author : '', date: j.date });
        }
      })
      .catch(() => { /* self-heals server-side; render nothing on failure */ });
    return () => { active = false; };
  }, [ref]);

  if (!q) return null; // no quote yet / endpoint down → render nothing (no empty frame)

  return (
    <section className={`mx-auto w-full max-w-2xl px-4 py-8 ${align}`}>
      <figure>
        <blockquote className="text-xl font-medium leading-relaxed text-foreground/90">“{q.quote}”</blockquote>
        {q.author && <figcaption className="mt-3 text-sm text-muted-foreground">— {q.author}</figcaption>}
      </figure>
    </section>
  );
}
