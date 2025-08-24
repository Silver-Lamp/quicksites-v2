'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlayCircle, Search, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LazyVideoEmbed from '@/components/ui/lazy-video-embed';

const COPY = {
  heroKicker: 'Features',
  heroTitle: 'Build faster. Rank sooner. Scale confidently.',
  heroSubtitle:
    'A focused toolkit for high-velocity local SEO sites — with optional AI assistance when it pays for itself.',
  ribbons: ['No setup fees', '14-day free trial', 'Grandfathered Founder pricing'],
  ctas: {
    primaryHref: '/login',
    primary: 'Start free trial',
    secondaryHref: '/contact',
    secondary: 'Talk to sales',
  },
};

type FeatureRow = {
  id: string;
  title: string;
  blurb: string;
  category: string;
  video_url?: string | null;
  doc_href?: string | null;
  badge?: string | null;
  featured?: boolean | null;
  created_at?: string | null;
};

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

function FeatureCard({ f }: { f: FeatureRow }) {
  const featuredGlow =
    'ring-1 ring-purple-500/25 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent ' +
    'shadow-[0_10px_40px_-12px_rgba(168,85,247,0.45)]';

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
        </div>
        <CardDescription>{f.blurb}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {f.video_url ? (
          <div className="aspect-video rounded-lg overflow-hidden border border-zinc-800/50">
            {/* keep your existing LazyVideoEmbed or iframe/video here */}
            <LazyVideoEmbed url={f.video_url} title={f.title} className="h-full w-full" />
          </div>
        ) : (
          <div className="aspect-video rounded-lg border border-zinc-800/50 bg-muted/40 grid place-items-center text-muted-foreground">
            Demo coming soon
          </div>
        )}
      </CardContent>
      <CardFooter className="mt-auto">
        {f.doc_href ? (
          <Link href={f.doc_href} className="inline-flex">
            <Button variant="ghost" size="sm">
              Read docs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <div className="text-xs text-muted-foreground">Tip: Ask us for a live walkthrough.</div>
        )}
      </CardFooter>
    </Card>
  );
}


export default function FeatureGalleryClient({ initialRows }: { initialRows: FeatureRow[] }) {
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState<'All' | string>('All');
  const [featuredOnly, setFeaturedOnly] = React.useState(false);

  // Build categories from data
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
              Video demos
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
              <Label htmlFor="q">Search features</Label>
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
            <FeatureCard key={f.id} f={f} />
          ))}
          {filtered.length === 0 && (
            <Card className="col-span-full border-zinc-800/50">
              <CardContent className="py-10 text-center text-muted-foreground">
                No features match your filters yet.
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
                Want a guided tour?
              </h3>
              <p className="text-muted-foreground">
                Book a live walkthrough or send us your use case — we’ll record a custom demo.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/book" className="inline-flex">
                <Button size="lg">
                  Book a demo
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
