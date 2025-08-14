'use client';
import React from 'react';

type ReviewsContent = {
  mealId?: string;
  chefId?: string;
  siteId?: string;
  pageSize?: number;
  sort?: 'recent' | 'top';
  minStars?: number;
  showSummary?: boolean;
  showWriteCta?: boolean;
};

type Query = { mealId?: string; chefId?: string; siteId?: string; sort?: 'recent'|'top'; minStars?: number };

type AdminProps = { content: ReviewsContent }; // editor path
type SSRProps = {
  initial: any;               // { reviews, hasMore, summary? }
  pageSize: number;
  query: Query;
  showSummary: boolean;
  showWriteCta: boolean;
}; // public SSR path

type Props = AdminProps | SSRProps;

const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';

export default function ReviewsListClient(props: Props) {
  const isAdmin = 'content' in props;

  // normalize config
  const cfg: ReviewsContent = isAdmin ? props.content : {
    mealId: props.query.mealId,
    chefId: props.query.chefId,
    siteId: props.query.siteId,
    sort:   props.query.sort,
    minStars: props.query.minStars,
    pageSize: (props as SSRProps).pageSize,
    showSummary: (props as SSRProps).showSummary,
    showWriteCta: (props as SSRProps).showWriteCta,
  };

  const pageSize = Math.max(1, Math.min(cfg.pageSize ?? 6, 50));
  const showSummary = cfg.showSummary !== false;
  const showWriteCta = cfg.showWriteCta === true;

  const noScope =
    !cfg.mealId && !cfg.chefId &&
    (!cfg.siteId || cfg.siteId === DUMMY_UUID);

  // seed state (SSR path gets initial, editor path fetches)
  const [items, setItems] = React.useState<any[]>(
    isAdmin ? [] : ((props as SSRProps).initial?.reviews ?? [])
  );
  const [summary, setSummary] = React.useState<any | null>(
    isAdmin ? null : ((props as SSRProps).initial?.summary ?? null)
  );
  const [hasMore, setHasMore] = React.useState<boolean>(
    isAdmin ? false : Boolean((props as SSRProps).initial?.hasMore)
  );
  const [loading, setLoading] = React.useState<boolean>(isAdmin);

  // initial fetch (editor only; SSR already has data)
  React.useEffect(() => {
    if (!isAdmin) return;
    let canceled = false;
    async function load() {
      if (noScope) { setLoading(false); return; }
      setLoading(true);
      const p = new URLSearchParams();
      if (cfg.mealId) p.set('meal_id', cfg.mealId);
      if (cfg.chefId) p.set('chef_id', cfg.chefId);
      if (cfg.siteId) p.set('site_id', cfg.siteId);
      if (cfg.sort) p.set('sort', cfg.sort);
      if (cfg.minStars) p.set('min_stars', String(cfg.minStars));
      p.set('limit', String(pageSize));
      p.set('offset', '0');
      p.set('include_summary', '1');

      try {
        const r = await fetch(`/api/public/reviews?${p.toString()}`, { cache: 'no-store' });
        const d = await r.json();
        if (canceled) return;
        setItems(Array.isArray(d.reviews) ? d.reviews : []);
        setSummary(d.summary ?? null);
        setHasMore(Boolean(d.hasMore));
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, cfg.mealId, cfg.chefId, cfg.siteId, cfg.sort, cfg.minStars, pageSize, noScope]);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    const p = new URLSearchParams();
    const q = isAdmin ? cfg : (props as SSRProps).query;
    if (q.mealId) p.set('meal_id', q.mealId);
    if (q.chefId) p.set('chef_id', q.chefId);
    if (q.siteId) p.set('site_id', q.siteId);
    if (q.sort) p.set('sort', q.sort);
    if (q.minStars) p.set('min_stars', String(q.minStars));
    p.set('limit', String(pageSize));
    p.set('offset', String(items.length));

    try {
      const r = await fetch(`/api/public/reviews?${p.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      setItems((x) => x.concat(d.reviews || []));
      setHasMore(Boolean(d.hasMore));
    } finally {
      setLoading(false);
    }
  }

  if (isAdmin && noScope) {
    return (
      <div className="border rounded-2xl p-4 bg-amber-50 text-sm">
        <b>Reviews</b> — no scope selected. Set <code>mealId</code>, <code>chefId</code>, or <code>siteId</code>.
      </div>
    );
  }

  return (
    <section className="border rounded-2xl p-4 bg-white">
      {showSummary && summary && (
        <div className="mb-4 flex items-center gap-3">
          <div className="text-xl font-semibold">★ {Number(summary.avg || 0).toFixed(2)}</div>
          <div className="text-sm text-muted-foreground">
            {summary.count} review{summary.count === 1 ? '' : 's'}
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading reviews…</div>
      ) : !items.length ? (
        <div className="text-sm text-muted-foreground">No reviews yet.</div>
      ) : (
        <ul className="space-y-3">
          {items.map((r: any) => (
            <li key={r.id} className="border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
              {r.user_name && (
                <div className="text-xs text-muted-foreground mt-0.5">by {r.user_name}</div>
              )}
              {r.comment && <p className="text-sm mt-2">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-3">
          <button
            onClick={loadMore}
            className="border rounded-md px-3 py-1 text-sm"
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {showWriteCta && (
        <div className="mt-4 text-sm text-muted-foreground">
          Have a tokenized link? Use it here: <a className="underline" href="/reviews/start">/reviews/start</a>
        </div>
      )}
    </section>
  );
}
