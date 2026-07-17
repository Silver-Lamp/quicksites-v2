'use client';

// components/admin/templates/render-blocks/reviews.tsx
//
// Owner-curated customer reviews with star display + honest schema.org markup.
// The JSON-LD story, told straight (this is the part competitors fudge):
//   - Product reviews on a product page ARE eligible for Google star snippets —
//     when `product_name` is set we emit Product + AggregateRating + Review.
//   - Business-level reviews on the business's OWN site are "self-serving" and
//     Google ignores that markup — so with no product_name we render the reviews
//     visually and emit NOTHING, rather than shipping dead markup that implies a
//     ranking feature it can't deliver.
// Reviews themselves are real customer quotes the owner pastes in (same
// house rule as testimonials: never fabricate).

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = { block?: Block; content?: Block['content']; previewOnly?: boolean };

type Review = { author: string; rating: number; text: string; date?: string };

function Stars({ value, className = '' }: { value: number; className?: string }) {
  const full = Math.round(Math.min(5, Math.max(0, value)));
  return (
    <span className={`text-amber-500 ${className}`} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {'★'.repeat(full)}
      <span className="text-muted-foreground/40">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

export default function RenderReviews({ block, content }: Props) {
  const c: any = content ?? block?.content ?? {};
  const title: string = c.title || 'What customers say';
  const productName: string = typeof c.product_name === 'string' ? c.product_name.trim() : '';
  const showSchema: boolean = c.show_schema !== false;

  const reviews: Review[] = (Array.isArray(c.reviews) ? c.reviews : [])
    .map((r: any) => ({
      author: typeof r?.author === 'string' ? r.author : '',
      rating: Math.min(5, Math.max(1, Number(r?.rating) || 5)),
      text: typeof r?.text === 'string' ? r.text : '',
      date: typeof r?.date === 'string' ? r.date : '',
    }))
    .filter((r: Review) => r.author && r.text);

  if (!reviews.length) return null;

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  // Product-scoped JSON-LD only (see header comment for why).
  const jsonLd =
    showSchema && productName
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: productName,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Math.round(avg * 10) / 10,
            reviewCount: reviews.length,
            bestRating: 5,
          },
          review: reviews.map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.author },
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
            reviewBody: r.text,
            ...(r.date && Number.isFinite(Date.parse(r.date)) ? { datePublished: r.date } : {}),
          })),
        }
      : null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <div className="flex items-center gap-2 text-sm">
          <Stars value={avg} className="text-lg" />
          <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
          <span className="text-muted-foreground">
            · {reviews.length} review{reviews.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r, i) => (
          <figure key={`${r.author}-${i}`} className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <Stars value={r.rating} />
            <blockquote className="mt-2 text-sm leading-relaxed text-foreground/90">“{r.text}”</blockquote>
            <figcaption className="mt-3 text-xs font-medium text-muted-foreground">
              — {r.author}
              {r.date && Number.isFinite(Date.parse(r.date)) && (
                <span className="opacity-70"> · {new Date(r.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
