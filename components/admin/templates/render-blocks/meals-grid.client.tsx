'use client';
import React from 'react';

type Props = {
  siteSlug?: string; siteId?: string; tag?: string; q?: string;
  sort?: 'recent'|'rating'|'price_asc'|'price_desc'|'popular';
  limit?: number; columns?: number; ctaText?: string;
};

export default function MealsGridClient(props: Props) {
  const [items, setItems] = React.useState<any[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const p = new URLSearchParams();
    if (props.siteSlug) p.set('site', props.siteSlug);
    if (props.siteId)   p.set('site_id', props.siteId);
    if (props.tag)      p.set('tag', props.tag);
    if (props.q)        p.set('q', props.q);
    if (props.sort)     p.set('sort', props.sort);
    p.set('status', 'published');
    p.set('limit', String(Math.min(props.limit ?? 12, 48)));
    p.set('offset', '0');

    fetch(`/api/public/meals?${p.toString()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load meals'))
      .then(d => setItems(Array.isArray(d) ? d : (d.items || [])))
      .catch(e => setErr(String(e)));
  }, [props.siteSlug, props.siteId, props.tag, props.q, props.sort, props.limit]);

  if (!props.siteSlug && !props.siteId) {
    return <div className="border rounded-xl p-3 bg-amber-50 text-sm">
      <b>Meals Grid</b> — set <code>siteSlug</code> or <code>siteId</code> in block settings.
    </div>;
  }
  if (err) return <div className="border rounded-xl p-3 text-sm text-red-600">{err}</div>;

  const columns = Math.max(1, props.columns ?? 3);
  return (
    <div className="dm-meals-grid">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
        {items.map((m:any) => {
          const href = m.slug ? `/meals/${m.slug}` : `/meal/${m.id}`;
          const price = typeof m.price_cents === 'number'
            ? new Intl.NumberFormat(undefined, { style: 'currency', currency: m.currency || 'USD' })
                .format(m.price_cents/100)
            : (m.price || '');
          const rating = m.rating_avg ? `★ ${Number(m.rating_avg).toFixed(1)} (${m.rating_count||0})` : '';
          return (
            <article key={m.id} className="border rounded-xl overflow-hidden bg-white">
              <a href={href} className="block aspect-[4/3] bg-muted">
                {m.image_url && <img src={m.image_url} alt={m.title||''} className="w-full h-full object-cover" />}
              </a>
              <div className="p-3 space-y-1">
                <div className="font-semibold leading-tight">{m.title}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{price}</span>
                  <span className="text-muted-foreground">{rating}</span>
                </div>
                {Array.isArray(m.tags) && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {m.tags.slice(0,3).map((t:string) =>
                      <span key={t} className="text-[11px] px-2 py-0.5 border rounded-full bg-muted/40">{t}</span>
                    )}
                  </div>
                )}
                <div className="pt-2">
                  <a className="inline-block border rounded-md px-3 py-1 text-sm" href={href}>
                    {props.ctaText ?? 'View'}
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
