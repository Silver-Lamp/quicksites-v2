import type { Metadata } from 'next';
import { headers } from 'next/headers';
import PublicMealsGrid from '@/components/public/PublicMealsGridClient';

type ChefData = {
  merchant: {
    id: string;
    display_name: string;
    bio: string;
    avatar_url: string | null;
    city: string | null;
    region: string | null;
    website_url: string | null;
    social_links: Record<string, string>;
  };
  stats: { active_meals: number };
};

async function getOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function fetchChef(merchantId: string, siteSlug?: string): Promise<ChefData | null> {
  const qs = new URLSearchParams(siteSlug ? { slug: siteSlug } : {});
  const base = process.env.APP_BASE_URL || getOrigin(); // works locally, prod, and previews
  const res = await fetch(`${base}/api/public/merchants/${merchantId}?${qs.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { merchantId: string } }): Promise<Metadata> {
  const siteSlug = 'deliveredmenu'; // TODO: derive from host/tenant
  const data = await fetchChef(params.merchantId, siteSlug);
  const titleName = data?.merchant.display_name || 'Chef';
  const desc = data?.merchant.bio?.slice(0, 140) || 'Meals by local chef on delivered.menu';
  const img = data?.merchant.avatar_url || undefined;

  return {
    title: `${titleName} — delivered.menu`,
    description: desc,
    openGraph: {
      title: `${titleName} — delivered.menu`,
      description: desc,
      images: img ? [{ url: img }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${titleName} — delivered.menu`,
      description: desc,
      images: img ? [img] : undefined,
    },
  };
}

export default async function ChefPage({ params }: { params: { merchantId: string } }) {
  const siteSlug = 'deliveredmenu'; // TODO: derive from host/tenant
  const data = await fetchChef(params.merchantId, siteSlug);

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="text-xl font-semibold">Chef not found</h1>
        <p className="text-sm text-muted-foreground">This profile may be private or doesn’t exist.</p>
      </div>
    );
  }

  const m = data.merchant;
  const location = [m.city, m.region].filter(Boolean).join(', ');
  const links = Object.entries(m.social_links || {}).filter(([, v]) => typeof v === 'string' && v);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      {/* Profile header */}
      <div className="flex items-start gap-4">
        {m.avatar_url ? (
          <img src={m.avatar_url} alt={m.display_name} className="w-20 h-20 rounded-xl object-cover border" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-muted border" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{m.display_name}</h1>
          {location && <p className="text-sm text-muted-foreground">{location}</p>}
          {m.bio && <p className="mt-2 text-sm">{m.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {m.website_url && (
              <a href={m.website_url} target="_blank" rel="noopener noreferrer" className="underline">
                Website
              </a>
            )}
            {links.map(([key, url]) => (
              <a key={key} href={url as string} target="_blank" rel="noopener noreferrer" className="underline">
                {key}
              </a>
            ))}
            <span className="text-muted-foreground">
              {data.stats.active_meals} active {data.stats.active_meals === 1 ? 'meal' : 'meals'}
            </span>
          </div>
        </div>
      </div>

      {/* Meals by this chef */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Meals by {m.display_name}</h2>
        <PublicMealsGrid slug={siteSlug} showSearch showChefFilter showCuisineFilter showSoldOut />
      </section>
    </div>
  );
}
