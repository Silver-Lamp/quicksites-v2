'use client';

// components/admin/templates/render-blocks/vehicles-grid.tsx
//
// Vehicle Inventory — the auto-dealer sibling of listings_grid. Each card shows
// year/make/model/trim/price/mileage/photo + an inquiry CTA, and — the differentiator —
// a "🎧 Hear the walkaround" toggle that plays THIS car's About That audio (the
// salesperson talking through the vehicle, in their voice). Emits a Vehicle ItemList
// JSON-LD. Display fields are freeform strings on purpose ("$18,995", "42,150 mi").

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { AboutThatEmbed, isValidEmbedId } from './about-that';

type Vehicle = {
  year?: string; make?: string; model?: string; trim?: string; price?: string;
  mileage?: string; status?: string; image_url?: string; cta_link?: string; about_that_embed_id?: string;
};
type Props = { block?: Block; content?: Block['content'] };

const s = (v: any) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const priceDigits = (p: string) => { const n = Number(p.replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };
const titleOf = (v: Vehicle) => [s(v.year), s(v.make), s(v.model), s(v.trim)].filter(Boolean).join(' ');

function Card({ v }: { v: Vehicle }) {
  const [tour, setTour] = React.useState(false);
  const embed = s(v.about_that_embed_id);
  const name = titleOf(v);
  const facts = [s(v.mileage)].filter(Boolean);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="relative">
        {s(v.image_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s(v.image_url)} alt={name || 'Vehicle'} className="h-48 w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-48 w-full items-center justify-center bg-muted text-4xl" aria-hidden>🚗</div>
        )}
        {s(v.status) && (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground shadow">{s(v.status)}</span>
        )}
      </div>
      <div className="p-4">
        {s(v.price) && <div className="text-lg font-bold tabular-nums">{s(v.price)}</div>}
        {name && <div className="text-sm font-semibold">{name}</div>}
        {facts.length > 0 && <div className="mt-1 text-xs font-medium text-foreground/80">{facts.join(' · ')}</div>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={s(v.cta_link) || '#contact'} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">Ask about this car</a>
          {isValidEmbedId(embed) && (
            <button type="button" onClick={() => setTour((t) => !t)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              {tour ? 'Hide walkaround' : '🎧 Hear the walkaround'}
            </button>
          )}
        </div>
        {tour && isValidEmbedId(embed) && <div className="mt-3"><AboutThatEmbed embedId={embed} /></div>}
      </div>
    </div>
  );
}

export default function RenderVehiclesGrid({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title: string = s(c.title) || 'Current Inventory';
  const columns = Math.min(3, Math.max(2, Number(c.columns) || 3));
  const vehicles: Vehicle[] = (Array.isArray(c.vehicles) ? c.vehicles : []).filter((v: Vehicle) => titleOf(v) || s(v.price));
  if (!vehicles.length) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: vehicles.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Vehicle',
        name: titleOf(v) || 'Vehicle',
        ...(s(v.make) ? { brand: s(v.make) } : {}),
        ...(s(v.model) ? { model: s(v.model) } : {}),
        ...(s(v.year) ? { vehicleModelDate: s(v.year) } : {}),
        ...(s(v.image_url) ? { image: s(v.image_url) } : {}),
        ...(priceDigits(s(v.price)) != null ? { offers: { '@type': 'Offer', price: priceDigits(s(v.price)), priceCurrency: 'USD' } } : {}),
      },
    })),
  };

  const colClass = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
      <div className={`grid grid-cols-1 gap-5 ${colClass}`}>
        {vehicles.map((v, i) => <Card key={`${titleOf(v)}-${i}`} v={v} />)}
      </div>
    </section>
  );
}
