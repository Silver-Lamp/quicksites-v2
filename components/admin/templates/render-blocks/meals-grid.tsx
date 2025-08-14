import React from "react";

type Props = {
  siteSlug?: string;
  siteId?: string;
  tag?: string;
  q?: string;
  sort?: "recent"|"rating"|"price_asc"|"price_desc"|"popular";
  limit?: number;
  columns?: number;
  ctaText?: string;
};

async function fetchMeals(p: Props) {
  const params = new URLSearchParams();
  if (p.siteSlug) params.set("site", p.siteSlug);
  if (p.siteId) params.set("site_id", p.siteId);
  if (p.tag) params.set("tag", p.tag);
  if (p.q) params.set("q", p.q);
  if (p.sort) params.set("sort", p.sort);
  params.set("status", "published");
  params.set("limit", String(Math.min(p.limit ?? 12, 48)));
  params.set("offset", "0");

  // cache for 60s; tweak as needed
  const res = await fetch(`/api/public/meals?${params.toString()}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Failed to load meals");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.items || []);
}

export default async function MealsGrid(props: Props) {
  const columns = Math.max(1, props.columns ?? 3);
  const items = await fetchMeals(props);

  return (
    <div className="dm-meals-grid">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
        {items.map((m: any) => {
          const href = m.slug ? `/meals/${m.slug}` : `/meal/${m.id}`;
          const price = typeof m.price_cents === "number"
            ? new Intl.NumberFormat(undefined, { style: "currency", currency: m.currency || "USD" }).format(m.price_cents/100)
            : (m.price || "");
          const rating = m.rating_avg ? `★ ${Number(m.rating_avg).toFixed(1)} (${m.rating_count||0})` : "";
          return (
            <article key={m.id} className="border rounded-xl overflow-hidden bg-white">
              <a href={href} className="block aspect-[4/3] bg-muted">
                {m.image_url && <img src={m.image_url} alt={m.title||""} className="w-full h-full object-cover" />}
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
                  <a className="inline-block border rounded-md px-3 py-1 text-sm" href={href}>
                    {props.ctaText ?? "View meal"}
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
