'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlayCircle, Search, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LazyVideoEmbed from '@/components/ui/lazy-video-embed';

const COPY = {
  heroKicker: 'Portfolio',
  heroTitle: 'Web & app development, delivered fast.',
  heroSubtitle:
    'We design and ship custom software—modern web apps, dashboards, and integrations—built to scale on today’s cloud.',
  ribbons: ['Iterative sprints', 'Full-stack expertise', 'Production-ready delivery'],
  ctas: {
    primaryHref: '/contact',
    primary: 'Start a project',
    secondaryHref: '/contact',
    secondary: 'Talk to us',
  },
};

type GalleryItem = { src: string; alt?: string };

type PortfolioRow = {
  id: string;
  title: string;
  blurb: string;
  category: string;

  // portfolio fields
  media_type?: 'video' | 'image' | 'link' | 'gallery' | null;
  video_url?: string | null;
  image_url?: string | null;
  thumb_url?: string | null;
  site_url?: string | null;
  external_url?: string | null;
  gallery?: GalleryItem[] | null;

  // shared
  doc_href?: string | null;
  badge?: string | null;
  featured?: boolean | null;
  created_at?: string | null;
};

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

function isDirectVideo(u?: string | null) {
  return !!u && /\.(mp4|webm|ogg)(\?.*)?$/i.test(u);
}

/* ────────────────────────────── Card renderer ───────────────────────────── */

function PortfolioCard({ f }: { f: PortfolioRow }) {
  const featuredGlow =
    'ring-1 ring-purple-500/25 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent ' +
    'shadow-[0_10px_40px_-12px_rgba(168,85,247,0.45)]';

  const media = (f.media_type ?? (f.video_url ? 'video' : f.image_url ? 'image' : 'link')) as
    | 'video' | 'image' | 'link' | 'gallery';

  return (
    <Card
      className={classNames(
        'h-full flex flex-col overflow-hidden border-zinc-800/50',
        f.featured && featuredGlow
      )}
    >
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">{f.title}</CardTitle>
          {f.badge ? <Badge variant="secondary">{f.badge}</Badge> : null}
          {f.featured ? <Badge variant="default">Featured</Badge> : null}
          <Badge variant="outline" className="ml-auto">{media}</Badge>
        </div>
        <CardDescription>{f.blurb}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {media === 'video' && (
          <div className="aspect-video rounded-lg overflow-hidden border border-zinc-800/50">
            {isDirectVideo(f.video_url) ? (
              <video className="h-full w-full" controls preload="metadata" src={String(f.video_url)} />
            ) : (
              <LazyVideoEmbed url={String(f.video_url)} title={f.title} className="h-full w-full" />
            )}
          </div>
        )}

        {media === 'image' && (
          <div className="rounded-lg overflow-hidden border border-zinc-800/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={String(f.image_url ?? f.thumb_url)}
              alt={f.title}
              className="w-full h-auto"
            />
          </div>
        )}

        {media === 'gallery' && Array.isArray(f.gallery) && f.gallery.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {f.gallery.map((g, i) => (
              <div key={i} className="rounded-md overflow-hidden border border-zinc-800/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.alt || f.title} className="w-full h-40 object-cover" />
              </div>
            ))}
          </div>
        )}

        {media === 'link' && (
          <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/40 p-4 text-sm">
            <div className="text-zinc-300">External link</div>
            <div className="mt-1 break-all text-zinc-400">{f.external_url || f.site_url}</div>
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between gap-3">
        {f.doc_href ? (
          <Link href={f.doc_href} className="inline-flex">
            <Button variant="ghost" size="sm">
              Read docs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <div className="text-xs text-muted-foreground">Tip: ask us for a walkthrough.</div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {f.site_url ? (
            <a href={f.site_url} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button size="sm" variant="outline">
                Visit site <ExternalLink className="ml-1 h-4 w-4" />
              </Button>
            </a>
          ) : null}
          {f.external_url ? (
            <a href={f.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button size="sm" variant="outline">
                Open link <ExternalLink className="ml-1 h-4 w-4" />
              </Button>
            </a>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}

/* ────────────────────────────── Page client shell ───────────────────────── */

export default function PortfolioGalleryClient({ initialRows }: { initialRows: PortfolioRow[] }) {
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState<'All' | string>('All');
  const [featuredOnly, setFeaturedOnly] = React.useState(false);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    initialRows.forEach((r) => r.category && set.add(r.category));
    return ['All', ...Array.from(set)];
  }, [initialRows]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialRows.filter((f) => {
      const inCat = cat === 'All' || f.category === cat;
      const inText =
        !needle ||
        f.title.toLowerCase().includes(needle) ||
        f.blurb.toLowerCase().includes(needle);
      const inFeatured = !featuredOnly || !!f.featured;
      return inCat && inText && inFeatured;
    });
  }, [q, cat, featuredOnly, initialRows]);

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-6xl px-6 pt-14 pb-6"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant="outline">{COPY.heroKicker}</Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Recent work
            </Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
            {COPY.heroTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {COPY.heroSubtitle}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={COPY.ctas.primaryHref} className="inline-flex">
              <Button size="lg">
                {COPY.ctas.primary}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={COPY.ctas.secondaryHref} className="inline-flex">
              <Button size="lg" variant="ghost">
                {COPY.ctas.secondary}
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {COPY.ribbons.map((r) => (
              <Badge key={r} variant="secondary">
                {r}
              </Badge>
            ))}
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </section>

      {/* Controls */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <Card>
          <CardContent className="py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="q">Search projects</Label>
              <div className="mt-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="q"
                  placeholder="Type to filter titles and blurbs…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant={c === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCat(c)}
                  >
                    {c}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={featuredOnly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFeaturedOnly((v) => !v)}
                >
                  {featuredOnly ? 'Showing Featured' : 'Featured only'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((f) => (
            <PortfolioCard key={f.id} f={f} />
          ))}
          {filtered.length === 0 && (
            <Card className="col-span-full border-zinc-800/50">
              <CardContent className="py-10 text-center text-muted-foreground">
                No projects match your filters yet.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA footer */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-zinc-800/50">
          <CardContent className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-semibold">
                Have an idea to build?
              </h3>
              <p className="text-muted-foreground">
                Share your use case—We’ll walk you through a pragmatic plan to ship it.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/contact" className="inline-flex">
                <Button size="lg">
                  Book a consult
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/contact" className="inline-flex">
                <Button size="lg" variant="outline">
                  Contact sales
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
