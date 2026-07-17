'use client';

// components/admin/templates/render-blocks/listings-grid.tsx
//
// Home Listings — an agent's portfolio of homes (the plural of listing_card). Each
// card shows price/address/beds/baths/status/photo + an inquiry CTA, and — the
// differentiator — a "🎧 Hear the tour" toggle that plays THIS home's About That
// audio tour inline (the agent talking through the property, in their voice). Emits a
// RealEstateListing ItemList JSON-LD for the set. Display fields are freeform strings.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { AboutThatEmbed, isValidEmbedId } from './about-that';

type Listing = {
  headline?: string; address?: string; price?: string; status?: string;
  beds?: string; baths?: string; sqft?: string; image_url?: string;
  cta_link?: string; about_that_embed_id?: string;
};
type Props = { block?: Block; content?: Block['content'] };

const s = (v: any) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const priceDigits = (p: string) => { const n = Number(p.replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };

function Card({ l }: { l: Listing }) {
  const [tour, setTour] = React.useState(false);
  const embed = s(l.about_that_embed_id);
  const stats = [s(l.beds) && `${s(l.beds)} bd`, s(l.baths) && `${s(l.baths)} ba`, s(l.sqft) && `${s(l.sqft)} sqft`].filter(Boolean);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="relative">
        {s(l.image_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s(l.image_url)} alt={s(l.headline) || s(l.address) || 'Home'} className="h-48 w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-48 w-full items-center justify-center bg-muted text-4xl" aria-hidden>🏠</div>
        )}
        {s(l.status) && (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground shadow">{s(l.status)}</span>
        )}
      </div>
      <div className="p-4">
        {s(l.price) && <div className="text-lg font-bold tabular-nums">{s(l.price)}</div>}
        {s(l.headline) && <div className="text-sm font-semibold">{s(l.headline)}</div>}
        {s(l.address) && <div className="text-xs text-muted-foreground">{s(l.address)}</div>}
        {stats.length > 0 && <div className="mt-1.5 text-xs font-medium text-foreground/80">{stats.join(' · ')}</div>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={s(l.cta_link) || '#contact'} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">Inquire</a>
          {isValidEmbedId(embed) && (
            <button type="button" onClick={() => setTour((v) => !v)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              {tour ? 'Hide tour' : '🎧 Hear the tour'}
            </button>
          )}
        </div>
        {tour && isValidEmbedId(embed) && <div className="mt-3"><AboutThatEmbed embedId={embed} /></div>}
      </div>
    </div>
  );
}

export default function RenderListingsGrid({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title: string = s(c.title) || 'Current Listings';
  const columns = Math.min(3, Math.max(2, Number(c.columns) || 3));
  const listings: Listing[] = (Array.isArray(c.listings) ? c.listings : []).filter((l: Listing) => s(l.headline) || s(l.address) || s(l.price));
  if (!listings.length) return null;

  const withAddr = listings.filter((l) => s(l.address));
  const jsonLd = withAddr.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: withAddr.map((l, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'RealEstateListing',
            name: s(l.headline) || s(l.address),
            address: s(l.address),
            ...(s(l.image_url) ? { image: s(l.image_url) } : {}),
            ...(priceDigits(s(l.price)) != null ? { offers: { '@type': 'Offer', price: priceDigits(s(l.price)), priceCurrency: 'USD' } } : {}),
          },
        })),
      }
    : null;

  const colClass = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
      <div className={`grid grid-cols-1 gap-5 ${colClass}`}>
        {listings.map((l, i) => <Card key={`${s(l.address)}-${i}`} l={l} />)}
      </div>
    </section>
  );
}
