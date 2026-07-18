// components/admin/templates/render-blocks/listing-search.tsx
'use client';

// Live MLS listing search (IDX) — the buyer-facing search + results grid for real-estate agent
// sites. Fetches the server-side proxy (/api/realty/listings), which resolves the agent's feed
// config server-side and returns normalized listings + the MLS-mandated compliance block (rendered
// below the results — non-negotiable per MLS rules). Flag-gated: when IDX isn't enabled/configured,
// the proxy returns { disabled }, and this block shows a quiet "connect a feed" note in the editor
// and nothing on the public site. See docs/REALTY_IDX_PLAN.md.

import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';
import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';
type Listing = {
  id: string;
  price: number;
  address: string;
  city?: string;
  state?: string;
  postal?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  photos: string[];
  status: string;
  listingOffice?: string;
};
type Result = {
  disabled?: boolean;
  listings: Listing[];
  total: number;
  compliance?: { disclaimer: string; mlsName?: string; fetchedAt: string };
};

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function ListingSearchRender({
  block,
  colorMode = 'light',
}: {
  block: Block;
  colorMode?: ThemeMode;
}) {
  const c: any = (block?.content as any) ?? (block as any)?.props ?? {};
  const dark = colorMode === 'dark';
  const title = String(c.title || 'Search homes for sale');

  const [siteSlug, setSiteSlug] = useState('');
  const [isEditor, setIsEditor] = useState(false);
  const [q, setQ] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBeds, setMinBeds] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const host = window.location.hostname.toLowerCase();
      const slug = host.endsWith('.quicksites.ai')
        ? host.split('.')[0]
        : host.replace(/^www\./, '').split('.')[0];
      setSiteSlug(slug);
      setIsEditor(window.location.pathname.startsWith('/admin/templates'));
    } catch {}
  }, []);

  const load = async () => {
    if (!siteSlug) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ site: siteSlug });
      if (q.trim()) p.set('q', q.trim());
      if (maxPrice.trim()) p.set('maxPrice', maxPrice);
      if (minBeds.trim()) p.set('minBeds', minBeds);
      const res = await fetch(`/api/realty/listings?${p}`, { cache: 'no-store' });
      setData(await res.json());
    } catch {
      setData({ listings: [], total: 0 });
    } finally {
      setLoading(false);
    }
  };
  // Load an initial set of active listings once we know the slug.
  useEffect(() => {
    if (siteSlug) void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [siteSlug]);

  // Not configured / flag off: quiet nudge in the editor, nothing on the public site.
  if (data?.disabled) {
    return isEditor ? (
      <SectionShell>
        <div
          className={`mx-auto max-w-md rounded-lg border border-dashed p-4 text-center text-sm ${dark ? 'border-white/20 text-white/50' : 'border-zinc-300 text-zinc-500'}`}
        >
          🔌 Live MLS search will appear here once an IDX feed is connected for this site.
        </div>
      </SectionShell>
    ) : null;
  }

  const field = `rounded-lg border px-3 py-2 text-sm ${dark ? 'border-white/15 bg-white/5 text-white placeholder-white/40' : 'border-zinc-300 bg-white text-zinc-900'}`;
  const listings = data?.listings ?? [];

  return (
    <SectionShell>
      <div id="listing-search" className="mx-auto max-w-5xl scroll-mt-20">
        <h2
          className={`text-center text-2xl font-bold md:text-3xl ${dark ? 'text-white' : 'text-zinc-900'}`}
        >
          {title}
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="mt-5 flex flex-wrap items-center justify-center gap-2"
        >
          <input
            className={`${field} min-w-[12rem] flex-1`}
            placeholder="City, ZIP, or address"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <input
            className={`${field} w-32`}
            placeholder="Max price"
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <input
            className={`${field} w-24`}
            placeholder="Beds"
            inputMode="numeric"
            value={minBeds}
            onChange={(e) => setMinBeds(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Search
          </button>
        </form>

        {loading ? (
          <p className={`mt-6 text-center text-sm ${dark ? 'text-white/50' : 'text-zinc-500'}`}>
            Searching…
          </p>
        ) : listings.length === 0 ? (
          <p className={`mt-6 text-center text-sm ${dark ? 'text-white/50' : 'text-zinc-500'}`}>
            No matching listings right now.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <div
                key={l.id}
                className={`overflow-hidden rounded-xl border ${dark ? 'border-white/10 bg-white/5' : 'border-zinc-200 bg-white'}`}
              >
                {l.photos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0]} alt={l.address} className="h-44 w-full object-cover" />
                )}
                <div className="p-3 text-left">
                  <div className={`text-lg font-bold ${dark ? 'text-white' : 'text-zinc-900'}`}>
                    {usd(l.price)}
                  </div>
                  <div className={`truncate text-sm ${dark ? 'text-white/70' : 'text-zinc-700'}`}>
                    {l.address}
                  </div>
                  <div className={`mt-1 text-xs ${dark ? 'text-white/50' : 'text-zinc-500'}`}>
                    {[
                      l.beds && `${l.beds} bd`,
                      l.baths && `${l.baths} ba`,
                      l.sqft && `${l.sqft.toLocaleString()} sqft`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {l.status !== 'active' ? ` · ${l.status}` : ''}
                  </div>
                  {l.listingOffice && (
                    <div className={`mt-1 text-[11px] ${dark ? 'text-white/35' : 'text-zinc-400'}`}>
                      Courtesy of {l.listingOffice}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MLS-mandated compliance — always render when present. */}
        {data?.compliance && (
          <p
            className={`mt-6 text-center text-[11px] leading-relaxed ${dark ? 'text-white/35' : 'text-zinc-400'}`}
          >
            {data.compliance.mlsName ? `${data.compliance.mlsName}. ` : ''}
            {data.compliance.disclaimer}
          </p>
        )}
      </div>
    </SectionShell>
  );
}
