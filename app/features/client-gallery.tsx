'use client';

import { signInHref } from '@/lib/auth/authLinks';
import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Layers,
  Sparkles,
  Palette,
  ShoppingCart,
  Blocks,
  Globe,
  TrendingUp,
  BarChart3,
  PhoneCall,
  LayoutTemplate,
  Rocket,
  Users,
  Mail,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { featureDetail } from '@/lib/features/detail';
import LazyVideoEmbed from '@/components/ui/lazy-video-embed';

const COPY = {
  heroKicker: 'Features',
  heroTitle: 'A site, a store, and a CRM. Built in.',
  heroSubtitle:
    'A drag-and-drop builder with e-commerce, a customer CRM, and email campaigns — every feature in every plan. AI assists when it pays for itself.',
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
  CRM: Users,
  Marketing: Mail,
};

const STEPS = [
  {
    icon: LayoutTemplate,
    title: 'Pick a starting point',
    body: 'Start from an industry scaffold, duplicate a template, or open a blank canvas.',
  },
  {
    icon: Blocks,
    title: 'Edit with blocks',
    body: 'Drag, drop, and tweak reusable blocks — with optional AI to draft the copy.',
  },
  {
    icon: Rocket,
    title: 'Publish & sell',
    body: 'Ship to a subdomain or custom domain, then take orders with Stripe built in.',
  },
];

type FeatureRow = {
  id: string;
  title: string;
  blurb: string;
  category: string;
  slug?: string | null;
  video_url?: string | null;
  doc_href?: string | null;
  demo_href?: string | null;
  badge?: string | null;
  featured?: boolean | null;
  created_at?: string | null;
};

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

function FeatureCard({ f }: { f: FeatureRow }) {
  const featuredGlow =
    'ring-1 ring-sky-500/25 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent ' +
    'shadow-[0_10px_40px_-12px_rgba(56,189,248,0.4)]';
  const Icon = CATEGORY_ICONS[f.category] ?? Layers;
  const detail = featureDetail(f.slug);

  // ⚠️ THE CARD USED TO LIFT AND SHOW A POINTER WITH NOWHERE TO GO. Fourteen of sixteen
  // features had no doc_href and no demo_href, so the affordance was writing a cheque the
  // page could not cash. Every feature with a slug now has a real detail page, so the whole
  // card is a link — and a feature without a slug stays inert rather than pretending.
  const href = f.slug ? `/features/${f.slug}` : null;

  // Featured cards take two columns: they carry the mechanics list, so they need the room.
  const wide = !!f.featured && !!detail;

  const body = (
    <Card
      className={classNames(
        'h-full flex flex-col overflow-hidden border-zinc-800/50 transition-all duration-200',
        href &&
          'group-hover:-translate-y-1 group-hover:border-sky-500/40 group-hover:shadow-2xl group-hover:shadow-sky-500/10',
        !href && 'hover:border-zinc-700',
        f.featured && featuredGlow
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 text-sky-300 ring-1 ring-sky-500/20">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {f.badge ? <Badge variant="secondary">{f.badge}</Badge> : null}
            {f.featured ? <Badge variant="default">Featured</Badge> : null}
          </div>
        </div>
        <div className="space-y-1">
          <CardTitle className={classNames('text-lg', wide && 'text-2xl')}>{f.title}</CardTitle>
          <CardDescription className={classNames(wide && 'text-base')}>{f.blurb}</CardDescription>
        </div>
      </CardHeader>

      {f.video_url ? (
        <CardContent>
          <div className="aspect-video rounded-lg overflow-hidden border border-zinc-800/50">
            <LazyVideoEmbed url={f.video_url} title={f.title} className="h-full w-full" />
          </div>
        </CardContent>
      ) : wide ? (
        // The extra width earns its keep: show what the feature actually does rather than
        // stretching a 119-character blurb across two columns.
        <CardContent>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {detail!.how.slice(0, 4).map((h) => (
              <li key={h} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400/70"
                />
                <span>{h}</span>
              </li>
            ))}
          </ul>
          {detail!.caveat ? (
            <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              {detail!.caveat}
            </p>
          ) : null}
        </CardContent>
      ) : null}

      <CardFooter className="mt-auto items-center justify-between pt-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{f.category}</span>
        {href ? (
          <span className="inline-flex items-center text-sm font-medium text-sky-400 transition group-hover:text-sky-300">
            Learn more
            <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        ) : null}
      </CardFooter>
    </Card>
  );

  if (!href) return <div className={wide ? 'md:col-span-2' : undefined}>{body}</div>;

  return (
    <Link
      href={href}
      className={classNames(
        'group block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xl',
        wide && 'md:col-span-2'
      )}
    >
      {body}
    </Link>
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
        {/* Sky-toned glow behind the hero (brand accent). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-[15%] h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute top-0 right-[10%] h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-6 pt-14 pb-8 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge variant="outline">{COPY.heroKicker}</Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Everything in every plan
              </Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">{COPY.heroTitle}</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{COPY.heroSubtitle}</p>
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

          {/* Motif visual — hidden on small screens so the copy leads on mobile. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="hidden lg:block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/qs-hero-bg.jpg"
              alt=""
              aria-hidden
              className="ml-auto w-full max-w-md rounded-2xl object-cover ring-1 ring-white/10 shadow-[0_0_90px_-24px_rgba(56,189,248,0.55)]"
            />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <Card key={s.title} className="border-zinc-800/50">
                <CardContent className="flex gap-4 py-6">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-500/5 text-sky-300 ring-1 ring-sky-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-sky-300/80">{`0${i + 1}`}</span>
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
              <h3 className="text-xl md:text-2xl font-semibold">See it on your own site</h3>
              <p className="text-muted-foreground">
                Spin up a free trial and build a real page in minutes — or book a live walkthrough
                and we’ll show you around.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={signInHref()} className="inline-flex">
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
