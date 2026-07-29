'use client';

// components/site/sitemap-explorer.tsx
//
// The searchable top-level map. ONE component powers both the 404 and /sitemap, so the map
// has a single source and the two can never drift (mesh advisory, crosstalk 20260727-015522).
//
// Colours are explicit rather than inherited: this renders on the 404 over a full-bleed
// painterly image AND on a plain page, so it cannot assume a background. Same lesson as the
// directory curator, which went unreadable the moment it sat on a light site.
import * as React from 'react';
import Link from 'next/link';
import { SITE_MAP, filterSiteMap } from '@/lib/site/siteMap';

export default function SiteMapExplorer({
  autoFocus = false,
  compact = false,
}: {
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [q, setQ] = React.useState('');
  const groups = React.useMemo(() => filterSiteMap(SITE_MAP, q), [q]);
  const total = React.useMemo(
    () => groups.reduce((n, g) => n + g.links.length, 0),
    [groups],
  );

  return (
    <div className="w-full">
      <label className="block">
        <span className="sr-only">Search the site map</span>
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search — try “menu”, “pricing”, “partner”…"
          className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 outline-none backdrop-blur focus:border-sky-400/60"
        />
      </label>

      {q && (
        <p className="mt-2 text-xs text-zinc-400" role="status" aria-live="polite">
          {total === 0
            ? 'Nothing matches that. Try a shorter word, or browse the groups below.'
            : `${total} page${total === 1 ? '' : 's'}`}
        </p>
      )}

      {/* An empty result still shows the full map underneath rather than a blank pane — the
          visitor is already lost; a dead end is the one thing this page must not produce. */}
      <div
        className={`mt-6 grid gap-x-8 gap-y-7 ${
          compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {(total === 0 ? SITE_MAP : groups).map((g) => (
          <section key={g.title}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/80">
              {g.title}
            </h2>
            <ul className="mt-2 space-y-1.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="group block rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-white/5"
                  >
                    <span className="block text-sm font-medium text-zinc-100 group-hover:text-white">
                      {l.label}
                    </span>
                    {l.blurb && !compact && (
                      <span className="block text-xs text-zinc-400">{l.blurb}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
