// app/admin/menu-run/page.tsx
//
// Operator-only menu run. Pick a restaurant-competition campaign, drive the route, photograph
// each menu. See lib/menu/menuRun.ts for why this exists rather than an online scrape.
//
// Deliberately NOT a public gig: it involves driving between stops and speaking for QuickSites
// at a stranger's counter. Neither belongs on an unpaid public gig board.
import { signInHref } from '@/lib/auth/authLinks';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import MenuRunClient from './menu-run-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function MenuRunPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }> | { campaign?: string };
}) {
  const admin = await getAdminUser();
  if (!admin) redirect(signInHref('/admin/menu-run'));

  const sp = await searchParams;
  const { data: campaigns } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, slug, domain')
    .eq('kind', 'restaurant_competition')
    .order('city');

  const list = campaigns ?? [];
  const selected = sp?.campaign ? list.find((c: any) => c.id === sp.campaign) : list[0];

  if (!selected) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-bold">Menu run</h1>
        <p className="mt-2 text-muted-foreground">
          No restaurant-competition campaigns yet. Launch one from{' '}
          <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
            Growth &rarr; Prospects
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      {list.length > 1 && (
        <nav className="mx-auto flex max-w-xl flex-wrap gap-2 px-4 pt-6">
          {list.map((c: any) => (
            <Link
              key={c.id}
              href={`/admin/menu-run?campaign=${c.id}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                c.id === selected.id
                  ? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {c.city}
            </Link>
          ))}
        </nav>
      )}
      <MenuRunClient
        campaignId={selected.id}
        city={selected.region ? `${selected.city}, ${selected.region}` : selected.city}
      />
    </>
  );
}
