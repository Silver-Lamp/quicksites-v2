'use client';

import * as React from 'react';
import PublicMealsGrid from '@/components/public/public-meals-grid';

type DevMeal = {
  id: string;
  title: string;
  image_url: string | null;
  price_cents: number | null;
  qty_available: number | null;
  status: string;
  is_active: boolean | null;
  created_at: string | null;
};

export default function ClientMealsView({
  slug,
  devDefaultIncludeTest = false,
}: {
  slug: string;
  devDefaultIncludeTest?: boolean;
}) {
  const [showTest, setShowTest] = React.useState(devDefaultIncludeTest);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draftMeals, setDraftMeals] = React.useState<DevMeal[]>([]);

  React.useEffect(() => {
    let cancel = false;
    async function load() {
      if (!showTest) {
        setDraftMeals([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dev/meals?slug=${encodeURIComponent(slug)}&onlyTest=1`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load dev meals');
        if (!cancel) setDraftMeals(json.meals || []);
      } catch (e: any) {
        if (!cancel) setError(e.message || 'Failed to load dev meals');
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, [slug, showTest]);

  return (
    <div className="space-y-6">
      {/* Toggle row (visible always; defaults ON in dev) */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-3">
        <div className="text-sm">
          <div className="font-medium">Show test data (local only)</div>
          <div className="text-xs text-muted-foreground">
            Includes draft/unpublished meals created via admin/tools. Disabled in production.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowTest(v => !v)}
          className={`h-8 rounded-md border px-3 text-sm ${showTest ? 'bg-accent text-accent-foreground' : ''}`}
        >
          {showTest ? 'On' : 'Off'}
        </button>
      </div>

      {/* Always show published meals (public grid’s normal behavior) */}
      <PublicMealsGrid slug={slug} />

      {/* Draft/Test section (dev only) */}
      {showTest && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Admin/Test Meals (unpublished)</h2>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!loading && !error && draftMeals.length === 0 && (
            <p className="text-sm text-muted-foreground">No draft/test meals found.</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {draftMeals.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
                <div className="h-40 w-full bg-muted flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.image_url ? (
                    <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image</span>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold leading-tight">{m.title}</h4>
                    <span className="text-[10px] rounded-full px-2 py-0.5 border">
                      {m.status || 'draft'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {typeof m.price_cents === 'number' ? `$${(m.price_cents / 100).toFixed(2)}` : '—'} · Qty{' '}
                    {m.qty_available ?? '—'}
                  </div>
                  {m.created_at && (
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(m.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
