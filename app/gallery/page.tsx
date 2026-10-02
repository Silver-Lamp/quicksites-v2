// app/gallery/page.tsx
//
// Public gallery: every industry we build for, with real published examples.
//
// ⚠️ "EXAMPLES", NEVER "CUSTOMERS". Many of these are sites we built unprompted from public
// listings — unclaimed, unpaid, and in the towing cohort several name businesses that do not
// exist. They are genuinely our work and fine to show as what we build. Calling them clients
// would be a false claim about our book, so no copy on this page implies one.
//
// ⚠️ SSR with semantic tokens only. This renders on the app host, where `app/providers.tsx`
// wraps everything in a dark ThemeScope — a literal light utility here renders dark-on-dark
// (CLAUDE.md §7).

import type { Metadata } from 'next';
import Link from 'next/link';
import { getGalleryData } from '@/lib/gallery/getGalleryData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gallery — sites we have built | QuickSites',
  description:
    'Real published examples across every industry we build for, from photographers and authors to towing and HVAC.',
};

export default async function GalleryPage() {
  const { groups, missing, totalExamples } = await getGalleryData();
  const creative = groups.filter((g) => g.creative);
  const rest = groups.filter((g) => !g.creative);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Sites we have built
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {/* The honest framing, in the first sentence rather than a footnote. */}
          {totalExamples} published examples across {groups.length} industries. Some were built
          for owners, some we built to show what the tool does — every one is a live page you can
          open.
        </p>
      </header>

      {creative.length > 0 && (
        <Section
          title="Portfolios &amp; creative work"
          blurb="Where the page is the product: photographers, authors, makers."
          groups={creative}
        />
      )}

      <Section title="Trades &amp; local business" groups={rest} />

      {missing.length > 0 && (
        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          {/* ⚠️ Stated, not hidden. A gallery that silently omits what it cannot show reads as
              complete coverage — a claim nobody checked. */}
          No published example yet for: {missing.join(', ')}.
        </p>
      )}
    </main>
  );
}

function Section({
  title,
  blurb,
  groups,
}: {
  title: string;
  blurb?: string;
  groups: Awaited<ReturnType<typeof getGalleryData>>['groups'];
}) {
  if (groups.length === 0) return null;
  return (
    <section className="mb-14">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {blurb && <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>}

      <div className="mt-6 space-y-10">
        {groups.map((g) => (
          <div key={g.key}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </h3>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.examples.map((e) => (
                <li key={e.slug}>
                  <Link
                    href={e.href}
                    className="group block overflow-hidden rounded-xl border border-border bg-card transition hover:border-foreground/30"
                  >
                    {/* The thumbnail endpoint GENERATES a card when a site has no hero, so an
                        example never renders as a broken image — which is most of them today:
                        not one creative example currently has a hero_url. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.thumb}
                      alt={`${e.name} — ${g.label} site built with QuickSites`}
                      width={1200}
                      height={750}
                      loading="lazy"
                      className="aspect-[8/5] w-full object-cover"
                    />
                    <div className="p-3">
                      <div className="truncate text-sm font-medium text-card-foreground">
                        {e.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{e.slug}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
