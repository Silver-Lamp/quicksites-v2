import React from "react";

type Props = {
  mealId?: string;
  mealSlug?: string;
  showPrice?: boolean;
  showChef?: boolean;
  showRating?: boolean;
  showTags?: boolean;
  ctaText?: string;
  variant?: "default" | "compact" | "hero";
};

async function fetchMeal({ mealId, mealSlug }: Props) {
  const params = new URLSearchParams();
  if (mealId) params.set("meal_id", mealId);
  if (mealSlug) params.set("meal_slug", mealSlug);
  const res = await fetch(`/api/public/meals/show?${params.toString()}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Meal not found");
  return await res.json(); // { id, slug, title, image_url, price_cents, currency, rating_avg, rating_count, tags, chef_name? }
}

export default async function MealCard(props: Props) {
  const m = await fetchMeal(props);

  const href = m.slug ? `/meals/${m.slug}` : `/meal/${m.id}`;
  const price = typeof m.price_cents === "number"
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: m.currency || "USD" }).format(m.price_cents/100)
    : (m.price || "");

  const rating = props.showRating && m.rating_avg
    ? `★ ${Number(m.rating_avg).toFixed(1)} (${m.rating_count||0})`
    : "";

  if (!props.mealId && (!props.mealSlug || props.mealSlug === "__select_meal__")) {
    return (
      <div className="border rounded-xl p-3 bg-amber-50 text-sm">
        <b>Meal Card</b> — no meal selected. Choose a meal in the block settings.
      </div>
    );
  }    

  const base = (
    <article className="border rounded-2xl overflow-hidden bg-white">
      <a href={href} className="block aspect-[4/3] bg-muted">
        {m.image_url && <img src={m.image_url} alt={m.title||""} className="w-full h-full object-cover" />}
      </a>
      <div className="p-4 space-y-2">
        <div className="text-lg font-semibold leading-tight">{m.title}</div>
        <div className="flex items-center justify-between text-sm">
          {props.showPrice !== false && <span className="font-medium">{price}</span>}
          {rating && <span className="text-muted-foreground">{rating}</span>}
        </div>
        {props.showChef && m.chef_name && (
          <div className="text-sm text-muted-foreground">by {m.chef_name}</div>
        )}
        {props.showTags && Array.isArray(m.tags) && m.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {m.tags.slice(0,3).map((t:string) =>
              <span key={t} className="text-[11px] px-2 py-0.5 border rounded-full bg-muted/40">{t}</span>
            )}
          </div>
        )}
        <div className="pt-1">
          <a className="inline-block border rounded-md px-3 py-1 text-sm" href={href}>
            {props.ctaText ?? "View meal"}
          </a>
        </div>
      </div>
    </article>
  );

  if (props.variant === "compact") {
    return (
      <a href={href} className="flex gap-3 items-center p-2 border rounded-xl bg-white">
        <div className="w-28 aspect-[4/3] bg-muted rounded-lg overflow-hidden">
          {m.image_url && <img src={m.image_url} alt={m.title||""} className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">{m.title}</div>
          <div className="text-sm text-muted-foreground">
            {props.showPrice !== false ? price : ""} {rating ? ` • ${rating}` : ""}
          </div>
        </div>
      </a>
    );
  }

  if (props.variant === "hero") {
    return (
      <section className="relative overflow-hidden rounded-3xl border">
        {m.image_url && (
          <img src={m.image_url} alt={m.title||""} className="w-full h-[280px] md:h-[360px] object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-0 p-5 text-white">
          <h2 className="text-2xl font-semibold">{m.title}</h2>
          <div className="text-sm opacity-90 mt-1">
            {props.showPrice !== false ? price : ""} {rating ? ` • ${rating}` : ""}
          </div>
          <a className="inline-block mt-3 border border-white/70 rounded-md px-3 py-1 text-sm" href={href}>
            {props.ctaText ?? "View meal"}
          </a>
        </div>
      </section>
    );
  }

  return base;
}
