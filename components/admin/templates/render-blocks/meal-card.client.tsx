'use client';
import React from 'react';

type MealContent = {
  mealId?: string;
  mealSlug?: string;
  showPrice?: boolean;
  showChef?: boolean;
  showRating?: boolean;
  showTags?: boolean;
  ctaText?: string;
  variant?: 'default' | 'compact' | 'hero';
};

const PLACEHOLDER = '__select_meal__';

export default function MealCardClient({ content }: { content: MealContent }) {
  const cfg = content ?? {};
  const noSelection =
    !cfg.mealId && (!cfg.mealSlug || cfg.mealSlug === PLACEHOLDER);

  const [meal, setMeal] = React.useState<any>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (noSelection) return;
    const s = new URLSearchParams();
    if (cfg.mealId) s.set('meal_id', cfg.mealId);
    if (cfg.mealSlug) s.set('meal_slug', cfg.mealSlug);
    fetch(`/api/public/meals/show?${s.toString()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject('Meal not found')))
      .then(setMeal)
      .catch((e) => setErr(String(e)));
  }, [cfg.mealId, cfg.mealSlug, noSelection]);

  if (noSelection) {
    return (
      <div className="border rounded-xl p-3 bg-amber-50 text-sm">
        <b>Meal Card</b> — no meal selected. Choose a meal in the block
        settings.
      </div>
    );
  }
  if (err) return <div className="border rounded-xl p-3 text-sm text-red-600">{err}</div>;
  if (!meal) return <div className="border rounded-xl p-3 text-sm text-muted-foreground">Loading meal…</div>;

  const href = meal.slug ? `/meals/${meal.slug}` : `/meal/${meal.id}`;
  const price =
    typeof meal.price_cents === 'number'
      ? new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: meal.currency || 'USD',
        }).format(meal.price_cents / 100)
      : meal.price || '';

  const rating =
    cfg.showRating !== false && meal.rating_avg
      ? `★ ${Number(meal.rating_avg).toFixed(1)} (${meal.rating_count || 0})`
      : '';

  return (
    <article className="border rounded-2xl overflow-hidden bg-white">
      <a href={href} className="block aspect-[4/3] bg-muted">
        {meal.image_url && (
          <img
            src={meal.image_url}
            alt={meal.title || ''}
            className="w-full h-full object-cover"
          />
        )}
      </a>
      <div className="p-4 space-y-2">
        <div className="text-lg font-semibold leading-tight">{meal.title}</div>
        <div className="flex items-center justify-between text-sm">
          {cfg.showPrice !== false && <span className="font-medium">{price}</span>}
          {rating && <span className="text-muted-foreground">{rating}</span>}
        </div>
        {cfg.showChef && meal.chef_name && (
          <div className="text-sm text-muted-foreground">by {meal.chef_name}</div>
        )}
        {cfg.showTags && Array.isArray(meal.tags) && meal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {meal.tags.slice(0, 3).map((t: string) => (
              <span
                key={t}
                className="text-[11px] px-2 py-0.5 border rounded-full bg-muted/40"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="pt-1">
          <a className="inline-block border rounded-md px-3 py-1 text-sm" href={href}>
            {cfg.ctaText ?? 'View meal'}
          </a>
        </div>
      </div>
    </article>
  );
}
