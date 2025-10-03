// app/orgs/[slug]/portfolio/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import PortfolioGalleryClient from './client-gallery';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SiteHeader from '@/components/site/site-header';

export const revalidate = 60;

type GalleryItem = { src: string; alt?: string };

type PortfolioRow = {
  id: string;
  title: string;
  blurb: string;
  category: string;
  media_type?: 'video' | 'image' | 'link' | 'gallery' | null;
  video_url?: string | null;
  image_url?: string | null;
  thumb_url?: string | null;
  site_url?: string | null;
  external_url?: string | null;
  gallery?: GalleryItem[] | null;
  doc_href?: string | null;
  badge?: string | null;
  featured?: boolean | null;
  feature_order?: number | null;
  created_at?: string | null;
};

type OrgBranding = {
  name?: string;
  domain?: string | null;
  hero?: { headline?: string; subhead?: string } | null;
  colors?: { primary?: string; gradient?: string[] } | null;
  logoUrl?: string | null;
  darkLogoUrl?: string | null;
};

export default async function PortfoliosPage({ params }: { params: { slug: string } }) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          cookieStore.set({ name, value, ...(options ?? {}) });
        },
        remove(name: string, options?: any) {
          cookieStore.set({ name, value: '', ...(options ?? {}) });
        },
      },
    }
  );

  // Pull org meta/branding (optional, if present)
  const { data: orgRow } = await supabase
    .from('organizations_public')
    .select('id, slug, name, branding')
    .eq('slug', params.slug)
    .maybeSingle();

  const branding = (orgRow?.branding || {}) as OrgBranding;
  const orgName = branding?.name || orgRow?.name || params.slug;

  // pull org-specific portfolio rows
  const { data, error } = await supabase
    .from('features_public_portfolio')
    .select('*')
    .eq('org_slug', params.slug)
    .eq('is_public', true)
    .order('featured', { ascending: false })
    .order('feature_order', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div className="relative">
        <header className="sticky top-0 z-40 border-b border-zinc-800/40 backdrop-blur bg-black/10">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/favicon.ico" alt="Home" width={24} height={24} className="rounded" />
              <span className="text-sm text-zinc-300">Back to Home</span>
            </Link>
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm">← Back home</Button>
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-10">
          <Card className="border-zinc-800/50">
            <CardContent className="py-10 text-center text-red-500">
              Failed to load portfolio: {error.message}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const rows = (data ?? []) as PortfolioRow[];
  const total = rows.length;
  const featuredCount = rows.filter((r) => r.featured).length;
  const categories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean)));
  const lastUpdatedIso = rows[0]?.created_at || null;
  const lastUpdated = lastUpdatedIso ? new Date(lastUpdatedIso) : null;

  return (
    <>
      <SiteHeader sticky={true} />

      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(73,100,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.3))]" />
      </div>

      <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
        {/* Top banner / hero */}
        <section className="border-b border-zinc-900/60 bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent">
          <div className="mx-auto max-w-6xl px-6 pt-10 pb-6">
            {/* Breadcrumb */}
            <nav className="text-xs text-zinc-400">
              <Link href={`/orgs/${params.slug}`} className="underline-offset-4 hover:underline">
                {orgName}
              </Link>
              <span className="mx-2 text-zinc-600">/</span>
              <span className="text-zinc-200">Portfolio</span>
            </nav>

            {/* Heading */}
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
                  {branding?.hero?.headline || 'Selected Work & Case Studies'}
                </h1>
                <p className="mt-3 max-w-2xl text-zinc-300">
                  {branding?.hero?.subhead ||
                    'Real projects, measurable outcomes. A curated set of launches, redesigns, and integrations.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/contact" className="inline-flex">
                  <Button size="lg">Book a consult</Button>
                </Link>
                <Link href="/login" className="inline-flex">
                  <Button size="lg" variant="outline">Client login</Button>
                </Link>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-zinc-400">Items</div>
                <div className="mt-1 text-2xl font-medium">{total}</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-zinc-400">Featured</div>
                <div className="mt-1 text-2xl font-medium">{featuredCount}</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-zinc-400">Categories</div>
                <div className="mt-1 text-2xl font-medium">{categories.length}</div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-zinc-400">Updated</div>
                <div className="mt-1 text-2xl font-medium">
                  {lastUpdated ? lastUpdated.toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Empty state */}
        {rows.length === 0 ? (
          <div className="mx-auto max-w-6xl px-6 py-16">
            <Card className="border-zinc-800/60 bg-zinc-900/40">
              <CardContent className="py-12 text-center">
                <h2 className="text-xl font-semibold">Portfolio coming soon</h2>
                <p className="mt-2 text-zinc-300">
                  We’re assembling recent launches and case studies. Check back shortly—or reach out and we’ll
                  share a private deck.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Link href="/contact" className="inline-flex">
                    <Button>Contact us</Button>
                  </Link>
                  <Link href="/" className="inline-flex">
                    <Button variant="outline">Back to home</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Main gallery client (filters, grid, CTAs) */}
        {rows.length > 0 && (
          <PortfolioGalleryClient initialRows={rows as PortfolioRow[]} />
        )}
      </div>
    </>
  );
}
