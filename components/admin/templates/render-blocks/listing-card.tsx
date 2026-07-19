'use client';

// components/admin/templates/render-blocks/listing-card.tsx
//
// Real-estate listing card — the on-domain listing page most agent sites lack
// (docs/BLOCKS_BACKLOG.md Tier 4). Address / price / beds / baths / gallery /
// inquiry CTA, plus the strategic bit: a built-in About That agent-preset player
// slot (HiveJournal narration — the owner pitches the home, the skeptical AI buyer
// probes). Emits RealEstateListing JSON-LD inline when there's a real address, so
// listings are structured-data-ready out of the box. Display fields are freeform
// strings ("$524,900", "2.5") — we render what the agent writes, never compute.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { AboutThatEmbed, isValidEmbedId } from './about-that';

type Props = {
  block?: Block;
  content?: Block['content'];
  previewOnly?: boolean;
};

function str(v: any): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}

/** "$524,900" → 524900 (for JSON-LD only; display always uses the raw string). */
function priceDigits(price: string): number | null {
  const n = Number(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function RenderListingCard({ block, content }: Props) {
  const c: any = content ?? block?.content ?? (block as any)?.props ?? {};
  const headline = str(c.headline);
  const address = str(c.address);
  const price = str(c.price);
  const status = str(c.status);
  const beds = str(c.beds);
  const baths = str(c.baths);
  const sqft = str(c.sqft);
  const description = str(c.description);
  const ctaText = str(c.cta_text) || 'Request a showing';
  const ctaLink = str(c.cta_link) || '#contact';
  const images: string[] = Array.isArray(c.images) ? c.images.filter((u: any) => typeof u === 'string' && u) : [];
  const embedId = str(c.about_that_embed_id);
  const embedUrl = str(c.about_that_url);
  const embedWidth = str(c.about_that_width);

  const [mainIdx, setMainIdx] = React.useState(0);
  const main = images[Math.min(mainIdx, Math.max(0, images.length - 1))];

  const stats = [
    beds && { icon: '🛏', label: `${beds} bd` },
    baths && { icon: '🛁', label: `${baths} ba` },
    sqft && { icon: '📐', label: `${sqft} sqft` },
  ].filter(Boolean) as Array<{ icon: string; label: string }>;

  // Structured data: only with a real address, price only when parseable.
  const jsonLd = address
    ? {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: headline || address,
        ...(description ? { description } : {}),
        address,
        ...(images.length ? { image: images } : {}),
        ...(priceDigits(price) != null
          ? { offers: { '@type': 'Offer', price: priceDigits(price), priceCurrency: 'USD' } }
          : {}),
      }
    : null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm md:flex">
        {/* Gallery */}
        <div className="md:w-1/2">
          {main ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main} alt={headline || address || 'Listing photo'} className="h-64 w-full object-cover md:h-80" />
          ) : (
            <div className="flex h-64 w-full items-center justify-center bg-muted text-5xl md:h-80" aria-hidden>
              🏠
            </div>
          )}
          {images.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto p-2">
              {images.slice(0, 6).map((u, i) => (
                <button
                  key={`${u}-${i}`}
                  type="button"
                  onClick={() => setMainIdx(i)}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border ${i === mainIdx ? 'border-primary' : 'border-border opacity-80 hover:opacity-100'}`}
                  aria-label={`Photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-3 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            {status && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                {status}
              </span>
            )}
          </div>

          {price && <div className="text-3xl font-bold tabular-nums">{price}</div>}
          {headline && <h2 className="text-xl font-semibold tracking-tight">{headline}</h2>}
          {address && <div className="text-sm text-muted-foreground">{address}</div>}

          {stats.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
              {stats.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden>{s.icon}</span> {s.label}
                </span>
              ))}
            </div>
          )}

          {description && <p className="text-sm leading-relaxed text-foreground/90">{description}</p>}

          {/* The moat: the owner-voice pitch player for THIS listing. */}
          {isValidEmbedId(embedId) && (
            <div className="mt-1">
              <div className="mb-1 text-xs font-medium text-muted-foreground">🎙️ Hear about this home</div>
              <AboutThatEmbed embedId={embedId} url={embedUrl} width={embedWidth} />
            </div>
          )}

          <div className="mt-auto pt-2">
            <a
              href={ctaLink}
              className="inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
            >
              {ctaText}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
