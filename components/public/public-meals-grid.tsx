'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import NotifyInline from './notify-inline';
import Link from 'next/link';
import ShareMenu from './share-menu';
import { useCartStore } from '@/components/cart/cart-store';

type Meal = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  qty_available: number | null;
  max_per_order: number | null;
  is_active: boolean;
  created_at: string;
  cuisines?: string[] | null;
  merchant_id?: string;
};

type Merchant = { id: string; name: string };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const { couponCode } = useCartStore.getState();
  
export default function PublicMealsGrid({
  siteId,
  slug,
  limit = 12,
  showSearch = false,
  showChefFilter = true,
  showCuisineFilter = true,
  /** If true, append sold-out items (qty_available=0) after active ones, with disabled button. */
  showSoldOut = false,
  merchantId,
  initialCuisines = []
}: {
  siteId?: string;
  slug?: string;
  limit?: number;
  showSearch?: boolean;
  showChefFilter?: boolean;
  showCuisineFilter?: boolean;
  showSoldOut?: boolean;
  merchantId?: string;
  initialCuisines?: string[];
}) {
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [q, setQ] = useState('');
  const [chefs, setChefs] = useState<Merchant[]>([]);
  const [chefId, setChefId] = useState<string>(''); // ignored if merchantId prop is set
  const [loadingChefs, setLoadingChefs] = useState(false);

  const [allCuisines, setAllCuisines] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(initialCuisines);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const paramsBase = useMemo(() => {
    const p = new URLSearchParams({
      ...(siteId ? { siteId } : {}),
      ...(slug ? { slug } : {}),
      active: 'true',                   // keep default active
      availableNow: 'true'
    });
    if (showSoldOut) p.set('includeSoldOut', 'true'); // ← enable API inclusion
    return p;
  }, [siteId, slug, showSoldOut]);

  async function fetchMeals(append = false) {
    if (!append) setLoading(true);
    try {
      const p = new URLSearchParams(paramsBase);
      p.set('limit', String(limit));
      if (q) p.set('q', q);
      const effectiveChefId = merchantId || chefId;
      if (effectiveChefId) p.set('merchantId', effectiveChefId);
      if (selectedCuisines.length) p.set('cuisine', selectedCuisines.join(','));
      if (append && cursor) p.set('cursor', cursor);

      const r = await fetch(`/api/public/meals?${p.toString()}`);
      const data = await r.json();
      let next: Meal[] = data?.meals ?? [];

      // Sort: in-stock first, sold-out last
      if (showSoldOut) {
        next = [...next].sort((a, b) => {
          const aSold = a.qty_available === 0;
          const bSold = b.qty_available === 0;
          if (aSold === bSold) return 0;
          return aSold ? 1 : -1;
        });
      }

      setMeals(prev => (append ? [...prev, ...next] : next));
      setCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.nextCursor));
    } finally {
      if (!append) setLoading(false);
    }
  }

  async function loadChefs() {
    if (merchantId || !showChefFilter) return;
    setLoadingChefs(true);
    try {
      const p = new URLSearchParams({ ...(siteId ? { siteId } : {}), ...(slug ? { slug } : {}) });
      const r = await fetch(`/api/public/merchants?${p.toString()}`);
      const data = await r.json();
      setChefs(data?.merchants ?? []);
    } finally {
      setLoadingChefs(false);
    }
  }

  async function loadCuisines() {
    if (!showCuisineFilter) return;
    const p = new URLSearchParams({ ...(siteId ? { siteId } : {}), ...(slug ? { slug } : {}) });
    const r = await fetch(`/api/public/cuisines?${p.toString()}`);
    const data = await r.json();
    setAllCuisines(data?.cuisines ?? []);
  }

  // Initial loads
  useEffect(() => {
    setMeals([]); setCursor(null); setHasMore(false);
    fetchMeals(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsBase, merchantId]);

  useEffect(() => { loadChefs(); /* eslint-disable-next-line */ }, [paramsBase, merchantId]);
  useEffect(() => { loadCuisines(); /* eslint-disable-next-line */ }, [paramsBase]);

  function applyFilters() {
    setCursor(null);
    fetchMeals(false);
  }

  return (
    <div className="space-y-4">
      {(showSearch || (showChefFilter && !merchantId) || showCuisineFilter) && (
        <div className="grid gap-2 sm:grid-cols-3">
          {showSearch && (
            <div className="flex gap-2 sm:col-span-1">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Search meals…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
              <Button onClick={applyFilters}>Search</Button>
            </div>
          )}

          {showChefFilter && !merchantId && (
            <div className="sm:col-span-1">
              <select
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                value={chefId}
                onChange={(e) => { setChefId(e.target.value); }}
                onBlur={applyFilters}
                disabled={loadingChefs}
                aria-label="Filter by chef"
              >
                <option value="">All chefs</option>
                {chefs.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
          )}

          {showCuisineFilter && (
            <div className="sm:col-span-1">
              {/* Minimal chip buttons */}
              <div className="flex flex-wrap gap-2">
                {allCuisines.map((c) => {
                  const on = selectedCuisines.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setSelectedCuisines(on ? selectedCuisines.filter(x => x !== c) : [...selectedCuisines, c]);
                      }}
                      className={[
                        'rounded-full border px-3 py-1 text-xs',
                        on ? 'bg-primary text-primary-foreground' : 'bg-background'
                      ].join(' ')}
                    >
                      {c}
                    </button>
                  );
                })}
                {allCuisines.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedCuisines([])}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(showCuisineFilter && selectedCuisines.length > 0) && (
        <div className="text-xs text-muted-foreground">
          Filtering by: {selectedCuisines.join(', ')} <Button variant="link" onClick={applyFilters}>Apply</Button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading meals…</div>
      ) : meals.length === 0 ? (
        <div className="text-sm text-muted-foreground">No meals match your filters.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {meals.map((m) => {
              const soldOut = m.qty_available === 0;
              const href = `/meals/${m.slug ?? m.id}`;
              return (
                <div key={m.id} className="relative rounded-xl border overflow-hidden bg-background">
                  {/* Image */}
                  {m.image_url ? (
                        <Link href={href}><img src={m.image_url} alt={m.title} className="w-full h-40 object-cover" loading="lazy" /></Link>
                    ) : (
                    <Link href={href}><div className="w-full h-40 bg-muted" /></Link>
                    )}

                  {/* SOLD OUT badge */}
                  {showSoldOut && soldOut && (
                    <div className="absolute left-2 top-2 rounded-full bg-rose-600/90 px-2 py-0.5 text-xs font-medium text-white">
                      Sold out
                    </div>
                  )}

                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium">{m.title}</h3>
                      <div className="font-semibold shrink-0">{money(m.price_cents)}</div>
                    </div>
                    {m.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{m.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-muted-foreground">
                        {soldOut ? 'Sold out' : (m.qty_available != null ? `${m.qty_available} left` : '\u00A0')}
                    </div>

                    {!soldOut ? (
                      <div className="flex gap-2 items-center">
                        <Button
                        size="sm"
                        onClick={async () => {
                            const r = await fetch('/api/public/checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mealId: m.id, quantity: 1, couponCode: couponCode || undefined })
                            });
                            const data = await r.json();
                            if (data?.url) window.location.href = data.url;
                            else alert(data?.error || 'Could not start checkout');
                        }}
                        >
                        Buy Now
                        </Button>
                        <ShareMenu url={`${process.env.NEXT_PUBLIC_APP_URL}/meals/${m.slug || m.id}`} title={m.title} />
                      </div>
                    ) : (
                        <NotifyInline mealId={m.id} />
                    )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={async () => { setLoadingMore(true); await fetchMeals(true); setLoadingMore(false); }}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
