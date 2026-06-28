'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

type ShowcaseSite = {
  slug: string;
  name: string;
  industry: string | null;
  heroUrl: string | null;
  logoUrl: string | null;
  href: string;
};

/**
 * "Built with QuickSites" — a curated gallery of real published sites
 * (lib/home/featured-sites.ts). Renders nothing until data loads and nothing if
 * the feed is empty, so the homepage never shows a broken/empty section.
 */
export default function SiteShowcase() {
  const [sites, setSites] = useState<ShowcaseSite[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/public/showcase')
      .then((r) => r.json())
      .then((d) => {
        if (active) setSites(Array.isArray(d?.sites) ? d.sites : []);
      })
      .catch(() => {
        if (active) setSites([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!sites || sites.length === 0) return null;

  return (
    <section className="relative z-10 w-full border-t border-zinc-800/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-2xl md:text-3xl font-semibold">Built with QuickSites</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Real businesses, live on QuickSites. Click through to see the published sites.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <ShowcaseCard key={s.slug} site={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseCard({ site: s }: { site: ShowcaseSite }) {
  // Fall back to the lettered placeholder if the hero image URL is dead.
  const [imgOk, setImgOk] = useState(Boolean(s.heroUrl));
  const [logoOk, setLogoOk] = useState(Boolean(s.logoUrl));

  return (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition hover:border-sky-500/50 hover:bg-sky-500/[0.03]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-800/60">
        {s.heroUrl && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.heroUrl}
            alt={`${s.name} — built with QuickSites`}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-3xl font-bold text-zinc-600">
            {s.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-zinc-950/70 px-2.5 py-1 text-xs font-medium text-sky-300 opacity-0 backdrop-blur transition group-hover:opacity-100">
          View live <ArrowUpRight className="h-3 w-3" />
        </div>
      </div>
      <div className="flex items-center gap-3 p-4">
        {s.logoUrl && logoOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.logoUrl}
            alt=""
            onError={() => setLogoOk(false)}
            className="h-9 w-9 shrink-0 rounded-full border border-zinc-700 object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{s.name}</div>
          {s.industry ? <div className="truncate text-xs text-zinc-400">{s.industry}</div> : null}
        </div>
      </div>
    </a>
  );
}
