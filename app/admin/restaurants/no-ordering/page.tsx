// app/admin/restaurants/no-ordering/page.tsx
//
// Restaurants in an area that HAVE a website and take NO online orders — the segment where a
// no-monthly ordering page has nothing to beat (docs/RESTAURANT_VERTICAL.md). Sweep a city for
// restaurants, read each site for its ordering platform, and build the ordering draft from the
// menu they already published. Admin-gated; in the sidebar under Restaurants.
import { getAdminUser } from '@/lib/auth/getAdminUser';
import NoOrderingClient from '@/components/admin/no-ordering-client';
import { restaurantCities } from '@/lib/prospects/noOrderingList';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NoOrderingPage({ searchParams }: { searchParams: Promise<{ city?: string; region?: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;
  const sp = await searchParams;
  const cities = await restaurantCities();
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-white">
      <h1 className="text-2xl font-semibold">Restaurants without online ordering</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-400">
        A restaurant with a website and no way to order from it pays nobody for orders today, so the
        no-monthly fee has nothing to beat. Sweep a city for restaurants, read each site for an ordering
        link (Toast, Square, DoorDash, …), and build the ordering page from the menu they already
        published. "Not checked" means nobody has read that site yet — never "no ordering".
      </p>
      <NoOrderingClient cities={cities} initialCity={sp.city ?? ''} initialRegion={sp.region ?? ''} />
    </div>
  );
}
