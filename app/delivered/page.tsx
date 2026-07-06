// app/delivered/page.tsx
//
// The delivered.menu apex landing: a directory of live (published) restaurants, each
// linking to its own delivered.menu site. Middleware rewrites `delivered.menu/` here.
// Restaurant = industry 'restaurant' OR a site carrying a menu block. Published-only,
// so unclaimed outreach drafts never leak into the public directory.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { menuSiteUrl, MENU_BASE_DOMAIN } from '@/lib/menu/deliveredMenu';

type Row = {
  slug: string | null;
  business_name: string | null;
  industry: string | null;
  industry_label: string | null;
  hero_url: string | null;
  logo_url: string | null;
  data: any;
};

export const metadata: Metadata = {
  title: 'Order from local restaurants — delivered.menu',
  description: 'Browse local restaurants and order online. Every site built and hosted on delivered.menu.',
};

function safeParse(x: any) {
  if (typeof x !== 'string') return x ?? {};
  try { return JSON.parse(x); } catch { return {}; }
}

function hasMenuBlock(data: any): boolean {
  const blocks: any[] = safeParse(data)?.pages?.[0]?.blocks ?? [];
  return Array.isArray(blocks) && blocks.some((b) => b?.type === 'menu');
}

function prettifySlug(slug: string | null): string {
  return (slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function Card({ r }: { r: Row }) {
  const name = r.business_name?.trim() || prettifySlug(r.slug) || 'Restaurant';
  const img = r.hero_url || r.logo_url || null;
  const href = menuSiteUrl(r.slug ?? '');
  return (
    <a
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-amber-100 to-orange-200 dark:from-neutral-800 dark:to-neutral-700">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">🍽️</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{name}</div>
        {r.industry_label && (
          <div className="mt-0.5 text-xs text-neutral-500">{r.industry_label}</div>
        )}
        <div className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-400">Order online →</div>
      </div>
    </a>
  );
}

export default async function DeliveredDirectoryPage() {
  const { data } = await supabaseAdmin
    .from('templates')
    .select('slug, business_name, industry, industry_label, hero_url, logo_url, data')
    .eq('is_site', true)
    .eq('published', true)
    .eq('archived', false)
    .eq('is_version', false)
    .order('updated_at', { ascending: false })
    .limit(120);

  const rows: Row[] = ((data as Row[]) ?? []).filter(
    (r) => !!r.slug && (String(r.industry).toLowerCase() === 'restaurant' || hasMenuBlock(r.data)),
  );

  const brand = MENU_BASE_DOMAIN || 'delivered.menu';

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="text-sm font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            {brand}
          </div>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Order from local restaurants.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
            Real menus from spots near you — order online in a couple taps. Every restaurant here runs
            on a free site we built for them.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        {rows.length > 0 ? (
          <>
            <div className="mb-6 text-sm text-neutral-500">
              {rows.length} restaurant{rows.length === 1 ? '' : 's'} taking orders
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <Card key={r.slug} r={r} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
            <div className="text-4xl">🍜</div>
            <h2 className="mt-4 text-xl font-semibold">No restaurants live yet — but they're coming.</h2>
            <p className="mx-auto mt-2 max-w-md text-neutral-600 dark:text-neutral-400">
              We're building free ordering sites for local spots. Run a restaurant?{' '}
              <a href="/restaurants" className="font-medium text-amber-700 underline underline-offset-4 dark:text-amber-400">
                Get yours →
              </a>
            </p>
          </div>
        )}
      </section>

      <footer className="border-t border-neutral-200 px-6 py-10 text-center text-sm text-neutral-500 dark:border-neutral-800">
        Own a restaurant?{' '}
        <a href="/restaurants" className="font-medium text-amber-700 underline underline-offset-4 dark:text-amber-400">
          Claim a free ordering site →
        </a>
      </footer>
    </main>
  );
}
