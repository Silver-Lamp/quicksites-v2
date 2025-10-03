// app/org/[slug]/page.tsx
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Rocket, Users, ArrowRight, Globe, Github, Twitter, Linkedin, Mail } from 'lucide-react';

import PortfolioGalleryClient from '@/app/orgs/[slug]/portfolio/client-gallery';

export const revalidate = 60;

type Params = { slug: string };

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
  owner?: {
    name?: string | null;
    title?: string | null;
    photoUrl?: string | null;
    bio?: string | null;          // plaintext or light markdown; we render as paragraphs
    links?: {
      website?: string | null;
      email?: string | null;
      github?: string | null;
      twitter?: string | null;
      linkedin?: string | null;
    } | null;
  } | null;
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = params;
  return {
    title: slug === 'pointsevenstudio' ? 'Point Seven Studio' : slug,
    description: 'Custom software, fast launches, human-first AI integration.',
  };
}

export default async function OrgLandingPage({ params }: { params: Params }) {
  const { slug } = params;
  const cookieStore = await cookies();

  // Supabase (using only cookies.get to match your working pattern)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { async get(name: string) { return cookieStore.get(name)?.value; } } as any }
  );

  // Pull org branding
  const { data: orgRow } = await supabase
    .from('organizations_public')
    .select('id, slug, name, branding')
    .eq('slug', slug)
    .maybeSingle();

  const branding = (orgRow?.branding || {}) as OrgBranding;
  const orgName = branding?.name || orgRow?.name || (slug === 'pointsevenstudio' ? 'Point Seven Studio' : slug);

  // Pull public portfolio
  const { data, error } = await supabase
    .from('features_public_portfolio')
    .select('*')
    .eq('org_slug', slug)
    .eq('is_public', true)
    .order('featured', { ascending: false })
    .order('feature_order', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (data ?? []) as PortfolioRow[];
  const total = rows.length;
  const featuredCount = rows.filter((r) => r.featured).length;
  const categories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean)));
  const lastUpdatedIso = rows[0]?.created_at || null;
  const lastUpdated = lastUpdatedIso ? new Date(lastUpdatedIso) : null;

  const owner = branding?.owner ?? null;
  const hasOwner =
    !!(owner?.name || owner?.title || owner?.bio || owner?.photoUrl || owner?.links?.website);

  return (
    <main className="min-h-screen flex flex-col bg-zinc-950 text-white">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(73,100,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.3))]" />
      </div>

      {/* Hero */}
      <section className="relative border-b border-zinc-800 bg-gradient-to-b from-zinc-950 via-zinc-900/80 to-transparent">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-14 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-purple-500 bg-clip-text text-transparent">
            {orgName}
          </h1>
          <p className="mt-4 text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto">
            {branding?.hero?.subhead || 'Custom software, rapid launches, and human-first AI integration.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/contact">
              <Button size="lg">
                Start a Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#portfolio" className="inline-flex">
              <Button size="lg" variant="outline">
                View Portfolio
              </Button>
            </a>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mx-auto max-w-6xl px-6 pb-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
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

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-6 py-12 grid gap-8 md:grid-cols-3">
        <Card className="bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 transition">
          <CardContent className="p-6 text-center">
            <Rocket className="mx-auto h-10 w-10 text-sky-400" />
            <h3 className="mt-4 text-xl font-semibold">Fast Launches</h3>
            <p className="mt-2 text-sm text-zinc-400">
              MVPs and production systems in weeks, not months—without cutting corners.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 transition">
          <CardContent className="p-6 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-purple-400" />
            <h3 className="mt-4 text-xl font-semibold">AI-First Solutions</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Practical automation and generative AI where it demonstrably pays for itself.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 transition">
          <CardContent className="p-6 text-center">
            <Users className="mx-auto h-10 w-10 text-emerald-400" />
            <h3 className="mt-4 text-xl font-semibold">Human-Centered</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Products that empower teams and customers, not replace them.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Portfolio section */}
      <section id="portfolio" className="border-t border-zinc-900/60 bg-zinc-950/50">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-semibold">Portfolio</h2>
            <Link href="/contact" className="inline-flex">
              <Button variant="outline" size="sm">Book a consult</Button>
            </Link>
          </div>

          {error ? (
            <Card className="border-zinc-800/60 bg-zinc-900/40">
              <CardContent className="py-10 text-center text-red-400">
                Failed to load portfolio: {error.message}
              </CardContent>
            </Card>
          ) : rows.length === 0 ? (
            <Card className="border-zinc-800/60 bg-zinc-900/40">
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-semibold">Portfolio coming soon</h3>
                <p className="mt-2 text-zinc-300">
                  We’re assembling recent launches and case studies. Check back shortly—or reach out and we’ll
                  share a private deck.
                </p>
                <div className="mt-6">
                  <Link href="/contact">
                    <Button>Contact us</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <PortfolioGalleryClient initialRows={rows} />
          )}
        </div>
      </section>

      {/* Owner Bio (optional) */}
      {hasOwner && (
        <section className="border-t border-zinc-900/60 bg-zinc-950">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] items-start">
              <div className="flex md:block items-center justify-center">
                <div className="w-40 h-40 md:w-52 md:h-52 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40">
                  {owner?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={owner.photoUrl}
                      alt={owner.name ?? 'Owner headshot'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-zinc-500 text-sm">
                      No photo
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-semibold">{owner?.name ?? 'Owner'}</h3>
                {owner?.title ? (
                  <p className="mt-1 text-zinc-400">{owner.title}</p>
                ) : null}

                {owner?.bio ? (
                  <div className="mt-4 space-y-3 text-zinc-300 leading-relaxed">
                    {String(owner.bio)
                      .split(/\n{2,}/) // split paragraphs on blank lines
                      .map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                  </div>
                ) : null}

                {/* Links */}
                {(owner?.links && Object.values(owner.links).some(Boolean)) && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {owner.links?.website ? (
                      <a href={owner.links.website} target="_blank" rel="noopener noreferrer" className="inline-flex">
                        <Button size="sm" variant="outline">
                          <Globe className="h-4 w-4 mr-1" /> Website
                        </Button>
                      </a>
                    ) : null}
                    {owner.links?.email ? (
                      <a href={`mailto:${owner.links.email}`} className="inline-flex">
                        <Button size="sm" variant="outline">
                          <Mail className="h-4 w-4 mr-1" /> Email
                        </Button>
                      </a>
                    ) : null}
                    {owner.links?.github ? (
                      <a href={owner.links.github} target="_blank" rel="noopener noreferrer" className="inline-flex">
                        <Button size="sm" variant="outline">
                          <Github className="h-4 w-4 mr-1" /> GitHub
                        </Button>
                      </a>
                    ) : null}
                    {owner.links?.twitter ? (
                      <a href={owner.links.twitter} target="_blank" rel="noopener noreferrer" className="inline-flex">
                        <Button size="sm" variant="outline">
                          <Twitter className="h-4 w-4 mr-1" /> Twitter
                        </Button>
                      </a>
                    ) : null}
                    {owner.links?.linkedin ? (
                      <a href={owner.links.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex">
                        <Button size="sm" variant="outline">
                          <Linkedin className="h-4 w-4 mr-1" /> LinkedIn
                        </Button>
                      </a>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
