import React from "react";
import { registerBlock } from "../_likely-remove_registry";

export type MealsGridProps = {
  siteSlug?: string;      // prefer slug OR
  siteId?: string;        // UUID fallback
  tag?: string;
  q?: string;
  sort?: "recent" | "rating" | "price_asc" | "price_desc" | "popular";
  limit?: number;         // default 12
  columns?: number;       // default 3
  ctaText?: string;       // default "View"
};

async function fetchMeals({ siteSlug, siteId, tag, q, sort, limit = 12 }: MealsGridProps) {
  const params = new URLSearchParams();
  if (siteSlug) params.set("site", siteSlug);
  if (siteId) params.set("site_id", siteId);
  if (tag) params.set("tag", tag);
  if (q) params.set("q", q);
  if (sort) params.set("sort", sort);
  params.set("status", "published");
  params.set("limit", String(Math.min(limit, 48)));
  params.set("offset", "0");

  const res = await fetch(`/api/public/meals?${params.toString()}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Failed to load meals");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.items || []);
}

export async function MealsGrid({ props }: { props: MealsGridProps }) {
  const { columns = 3, ctaText = "View" } = props;
  const items = await fetchMeals(props);
  return (
    <div className="dm-meals-grid">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}>
        {items.map((m: any) => {
          const url = m.slug ? `/meals/${m.slug}` : `/meal/${m.id}`;
          const price = typeof m.price_cents === 'number'
            ? new Intl.NumberFormat(undefined, { style: 'currency', currency: m.currency || 'USD' }).format(m.price_cents/100)
            : (m.price || '');
          const rating = m.rating_avg ? `★ ${Number(m.rating_avg).toFixed(1)} (${m.rating_count||0})` : '';
          return (
            <article key={m.id} className="border rounded-xl overflow-hidden bg-white">
              <a href={url} className="block aspect-[4/3] bg-muted">
                {m.image_url && <img src={m.image_url} alt={m.title||''} className="w-full h-full object-cover"/>}
              </a>
              <div className="p-3 space-y-1">
                <div className="font-semibold leading-tight">{m.title}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{price}</span>
                  <span className="text-muted-foreground">{rating}</span>
                </div>
                {Array.isArray(m.tags) && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {m.tags.slice(0,3).map((t:string) => (
                      <span key={t} className="text-[11px] px-2 py-0.5 border rounded-full bg-muted/40">{t}</span>
                    ))}
                  </div>
                )}
                <div className="pt-2">
                  <a className="inline-block border rounded-md px-3 py-1 text-sm" href={url}>{ctaText}</a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

registerBlock({
  type: 'meals_grid',
  version: 1,
  Component: MealsGrid,
  ssr: true,
  validate: (props: any) => {
    if (!props?.siteSlug && !props?.siteId) return { ok: false, error: 'Provide siteSlug or siteId' };
    return { ok: true };
  }
});