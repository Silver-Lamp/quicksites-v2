// app/gallery/page.tsx
//
// Public gallery: every industry we build for, with real published examples — as ONE flowing
// board (owner, 2026-10-03: "flow together like a pinterest board"), not a grid per industry.
//
// ⚠️ "EXAMPLES", NEVER "CUSTOMERS". Many of these are sites we built unprompted from public
// listings — unclaimed, unpaid, and in the towing cohort several name businesses that do not
// exist. They are genuinely our work and fine to show as what we build. Calling them clients
// would be a false claim about our book, so no copy on this page implies one.
//
// ⚠️ The thumbnail endpoint renders every site at the same 1200×750, so a board of equal tiles
// would be a grid wearing a masonry class. Each card crops that image to one of four heights,
// chosen from its position (deterministic, so the page is stable between renders and SSR matches
// the client) and anchored to the top of the page, where the hero is. A taller crop simply shows
// more of the site; nothing is stretched or invented.
//
// ⚠️ SSR with semantic tokens only. This renders on the app host, where `app/providers.tsx`
// wraps everything in a dark ThemeScope — a literal light utility here renders dark-on-dark
// (CLAUDE.md §7).

import type { Metadata } from 'next';
import Link from 'next/link';
import { getGalleryData } from '@/lib/gallery/getGalleryData';
import { GALLERY_HREF, galleryHrefFor } from '@/lib/site/industryNav';
import type { IndustryKey } from '@/lib/industries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gallery — sites we have built | QuickSites',
  description:
    'Real published examples across every industry we build for, from photographers and authors to towing and HVAC.',
};

/** Crop heights that make the board flow. Tailwind needs the literal class names. */
const CROPS = ['aspect-[4/5]', 'aspect-[8/5]', 'aspect-square', 'aspect-[3/4]', 'aspect-[16/9]', 'aspect-[5/6]'] as const;

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string }>;
}) {
  const { industry } = await searchParams;
  const only = (industry ?? '').trim() || null;
  const { groups, missing, totalExamples } = await getGalleryData({ industry: only });
  // The chip row always lists every industry that has examples, filtered view or not.
  const chips = only ? (await getGalleryData()).groups : groups;
  const onlyLabel = only ? chips.find((g) => g.key === only)?.label ?? only : null;

  // One board: creative first (where the current work is aimed), then the trades, each card
  // carrying its industry so the grouping survives the flow.
  const cards = groups.flatMap((g) => g.examples.map((e) => ({ ...e, industry: g.label, key: g.key })));

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Sites we have built
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {/* The honest framing, in the first sentence rather than a footnote. */}
          {only
            ? `${totalExamples} published ${totalExamples === 1 ? 'example' : 'examples'} for ${onlyLabel}.`
            : `${totalExamples} published examples across ${groups.length} industries.`}{' '}
          Some were built for owners, some we built to show what the tool does — every one is a
          live page you can open.
        </p>

        <nav aria-label="Industries" className="mt-5 flex flex-wrap gap-2">
          <Link
            href={GALLERY_HREF}
            className={
              !only
                ? 'rounded-full border border-foreground/40 bg-foreground/10 px-3 py-1 text-xs text-foreground'
                : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground'
            }
          >
            All
          </Link>
          {chips.map((g) => (
            <Link
              key={g.key}
              href={galleryHrefFor(g.key as IndustryKey)}
              className={
                only === g.key
                  ? 'rounded-full border border-foreground/40 bg-foreground/10 px-3 py-1 text-xs text-foreground'
                  : 'rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground'
              }
            >
              {g.label}
            </Link>
          ))}
        </nav>
      </header>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No published example here yet.</p>
      ) : (
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {cards.map((e, i) => (
            <li key={e.slug} className="mb-4 break-inside-avoid">
              <Link
                href={e.href}
                className="group block overflow-hidden rounded-xl border border-border bg-card transition hover:border-foreground/30"
              >
                {/* The thumbnail endpoint GENERATES a card when a site has no hero, so an example
                    never renders as a broken image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.thumb}
                  alt={`${e.name} — ${e.industry} site built with QuickSites`}
                  width={1200}
                  height={750}
                  loading={i < 8 ? 'eager' : 'lazy'}
                  className={`${CROPS[i % CROPS.length]} w-full object-cover object-top transition group-hover:scale-[1.02]`}
                />
                <div className="p-3">
                  <div className="truncate text-sm font-medium text-card-foreground">{e.name}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{e.slug}</span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                      {e.industry}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!only && missing.length > 0 && (
        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          {/* ⚠️ Stated, not hidden. A gallery that silently omits what it cannot show reads as
              complete coverage — a claim nobody checked. */}
          No published example yet for: {missing.join(', ')}.
        </p>
      )}
    </main>
  );
}
