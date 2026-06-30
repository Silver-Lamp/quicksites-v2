'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight, Layers, Sparkles, Palette, ShoppingCart,
  Blocks, Globe, TrendingUp, BarChart3, PhoneCall, LayoutTemplate, Rocket,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// Per-category icon so each card reads as complete (replaces the old video frames).
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  AI: Sparkles,
  Brand: Palette,
  'E-Commerce': ShoppingCart,
  Editor: Blocks,
  Hosting: Globe,
  SEO: TrendingUp,
  Admin: BarChart3,
  Leads: PhoneCall,
};

const STEPS = [
  { icon: LayoutTemplate, title: 'Pick a starting point', body: 'Start from an industry scaffold, duplicate a template, or open a blank canvas.' },
  { icon: Blocks, title: 'Edit with blocks', body: 'Drag, drop, and tweak reusable blocks — with optional AI to draft the copy.' },
  { icon: Rocket, title: 'Publish & sell', body: 'Ship to a subdomain or custom domain, then take orders with Stripe built in.' },
];

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
  const Icon = CATEGORY_ICONS[f.category] ?? Layers;

  return (
    <Card
      className={classNames(
        'h-full flex flex-col overflow-hidden border-zinc-800/50 transition-colors hover:border-zinc-700',
        f.featured && featuredGlow
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-300 ring-1 ring-purple-500/20">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {f.badge ? <Badge variant="secondary">{f.badge}</Badge> : null}
            {f.featured ? <Badge variant="default">Featured</Badge> : null}
          </div>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg">{f.title}</CardTitle>
          <CardDescription>{f.blurb}</CardDescription>
        </div>
      </CardHeader>

      {f.video_url ? (
        <CardContent>
          <div className="aspect-video rounded-lg overflow-hidden border border-zinc-800/50">
            <LazyVideoEmbed url={f.video_url} title={f.title} className="h-full w-full" />
          </div>
        </CardContent>
      ) : null}

      <CardFooter className="mt-auto items-center justify-between pt-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{f.category}</span>
        {f.doc_href ? (
          <Link href={f.doc_href} className="inline-flex">
            <Button variant="ghost" size="sm">
              Read docs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        ) : null}
      </CardFooter>
    </Card>
  );
}


export default function FeatureGalleryClient({ initialRows }: { initialRows: FeatureRow[] }) {
  const [cat, setCat] = React.useState<'All' | string>('All');

  // Build categories from data
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    initialRows.forEach((r) => r.category && set.add(r.category));
    return ['All', ...Array.from(set)];
  }, [initialRows]);

  const filtered = React.useMemo(() => {
    return initialRows.filter((f) => cat === 'All' || f.category === cat);
  }, [cat, initialRows]);

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
              Everything in every plan
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

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <Card key={s.title} className="border-zinc-800/50">
                <CardContent className="flex gap-4 py-6">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-300 ring-1 ring-purple-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-purple-300/80">{`0${i + 1}`}</span>
                      <h3 className="font-medium">{s.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Category filter */}
      <section className="mx-auto max-w-6xl px-6 pt-2 pb-4">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
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
                No features in this category yet.
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
                See it on your own site
              </h3>
              <p className="text-muted-foreground">
                Spin up a free trial and build a real page in minutes — or book a live walkthrough and we’ll show you around.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="inline-flex">
                <Button size="lg">
                  Start free trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/book" className="inline-flex">
                <Button size="lg" variant="outline">
                  Book a walkthrough
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
