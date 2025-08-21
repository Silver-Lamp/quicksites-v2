import type { Metadata } from 'next';
import { headers } from 'next/headers';
import NotifyInline from '@/components/public/notify-inline';
import ShareMenu from '@/components/public/share-menu';
import BuyNowButton from '@/components/public/BuyNowButton';

const siteSlug = 'deliveredmenu'; // TODO: derive from host/tenant

type Meal = {
  id: string; slug: string | null;
  title: string; description: string | null;
  price_cents: number; image_url: string | null;
  cuisines: string[] | null; is_active: boolean; qty_available: number | null;
  purchasable: boolean;
  merchant: { id: string; name: string; avatar_url: string | null } | null;
};

async function getOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function fetchMeal(handle: string): Promise<Meal | null> {
  const qs = new URLSearchParams({ slug: siteSlug });
  const base = process.env.APP_BASE_URL || getOrigin();
  const r = await fetch(`${base}/api/public/meal/${handle}?${qs.toString()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.meal ?? null;
}

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const meal = await fetchMeal(params.handle);
  const title = meal ? `${meal.title} — delivered.menu` : 'Meal — delivered.menu';
  const desc = meal?.description || 'Chef-prepared meal on delivered.menu';
  const handle = meal?.slug || params.handle;
  const canonical = `${process.env.APP_BASE_URL || getOrigin()}/meals/${handle}`;
  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title, description: desc, url: canonical,
      images: [{ url: `${canonical}/opengraph-image` }],
    },
    twitter: {
      card: 'summary_large_image',
      title, description: desc,
      images: [`${canonical}/opengraph-image`],
    },
  };
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function MealPage({ params }: { params: { handle: string } }) {
  const meal = await fetchMeal(params.handle);
  if (!meal) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="text-sm text-muted-foreground">This meal may be unavailable.</p>
      </div>
    );
  }

  const soldOut = !meal.purchasable;

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex gap-6 items-start">
        <div className="w-full sm:w-1/2 rounded-xl overflow-hidden border">
          {meal.image_url ? (
            <img src={meal.image_url} alt={meal.title} className="w-full h-auto object-cover" />
          ) : (
            <div className="aspect-video bg-muted" />
          )}
        </div>

        <div className="flex-1 space-y-3">
          <h1 className="text-2xl font-semibold">{meal.title}</h1>

          {meal.merchant && (
            <div className="flex items-center gap-2 text-sm">
              {meal.merchant.avatar_url ? (
                <img src={meal.merchant.avatar_url} alt={meal.merchant.name} className="w-6 h-6 rounded-md border" />
              ) : (
                <div className="w-6 h-6 rounded-md bg-muted border" />
              )}
              <span className="text-muted-foreground">by</span>
              <a className="underline" href={`/chefs/${meal.merchant.id}`}>
                {meal.merchant.name}
              </a>
            </div>
          )}

          {meal.description && <p className="text-sm">{meal.description}</p>}

          {meal.cuisines?.length ? (
            <div className="flex flex-wrap gap-2">
              {meal.cuisines.map((c) => (
                <span key={c} className="rounded-full border px-2 py-0.5 text-xs">
                  {c}
                </span>
              ))}
            </div>
          ) : null}

          <div className="pt-2 flex items-center gap-4">
            <div className="text-xl font-semibold">{money(meal.price_cents)}</div>
            <div className="text-xs text-muted-foreground">
              {meal.qty_available === null
                ? 'In stock'
                : meal.qty_available === 0
                ? 'Sold out'
                : `${meal.qty_available} left`}
            </div>
          </div>

          {!soldOut ? (
            <div className="flex justify-end gap-2 items-center">
              <BuyNowButton mealId={meal.id} slug={meal.slug} />
              <ShareMenu
                url={`${process.env.NEXT_PUBLIC_APP_URL || getOrigin()}/meals/${meal.slug || meal.id}`}
                title={meal.title}
                chefName={meal.merchant?.name}
              />
            </div>
          ) : (
            <NotifyInline mealId={meal.id} />
          )}
        </div>
      </div>
    </div>
  );
}
