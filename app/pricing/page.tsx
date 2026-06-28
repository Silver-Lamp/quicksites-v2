'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Sparkles, Store, Users, Handshake, Globe, BadgeCheck } from 'lucide-react';

// shadcn/ui — adjust imports if your paths differ
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SiteHeader from '@/components/site/site-header';

/**
 * QuickSites Pricing — hybrid model (see docs/PRICING_REDESIGN.md)
 *  A) Build my own  → free build/host/publish, 5% per order when you sell
 *  B) Run for clients → flat agency subscription (no per-order fee)
 *  C) Resell (partner) → 80% lifetime residual → /partners
 */

// ---- Config ----
const ORDER_FEE_PCT = 0.05;        // Path A: take-rate on orders
const AI_ADDON_PER_USER = 10;      // $/user/mo
const FOUNDER_PLAN = { platform: 15, perSite: 5 }; // Path B (agency) — beta
const PUBLIC_PLAN = { platform: 19, perSite: 6 };
const PARTNER_FEE_SHARE = 0.8;     // partners keep 80% of the order fee

const CTA = {
  buildHref: '/login',   // create a free site (publish requires an account)
  contactHref: '/contact',
  partnersHref: '/partners',
};

// ---- Utilities ----
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pct = (n: number) => `${Math.round(n * 100)}%`;
function classNames(...xs: (string | false | null | undefined)[]) { return xs.filter(Boolean).join(' '); }

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <Check className="h-4 w-4 mt-0.5 shrink-0 text-sky-400" />
      <span>{text}</span>
    </div>
  );
}

// ---- Top-of-page path chooser ----
function PathChooser() {
  const paths = [
    { icon: Store, title: 'Build my own site', blurb: 'Free to build & host. Pay only when you sell.', href: '#merchant', tag: 'Most popular' },
    { icon: Users, title: 'Run sites for clients', blurb: 'Flat, predictable pricing for agencies.', href: '#agency', tag: 'Agencies' },
    { icon: Handshake, title: 'Resell under my brand', blurb: 'White-label and earn 80% on every order, for life.', href: '#partner', tag: 'Partners' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {paths.map((p) => (
        <Link key={p.title} href={p.href} className="group">
          <Card className="h-full border-zinc-800/60 transition hover:border-sky-500/50 hover:bg-sky-500/[0.03]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <p.icon className="h-6 w-6 text-sky-400" />
                <Badge variant="secondary">{p.tag}</Badge>
              </div>
              <CardTitle className="mt-2 text-lg">{p.title}</CardTitle>
              <CardDescription>{p.blurb}</CardDescription>
            </CardHeader>
            <CardFooter>
              <span className="inline-flex items-center text-sm font-medium text-sky-400">
                See details <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// ---- Path A: Merchant order-fee calculator ----
function OrderFeeCalc() {
  const [gmv, setGmv] = React.useState(2000); // monthly sales
  const fee = gmv * ORDER_FEE_PCT;
  const keep = gmv - fee;
  return (
    <Card className="border-zinc-800/60">
      <CardHeader>
        <CardTitle>What “pay when you sell” looks like</CardTitle>
        <CardDescription>We take {pct(ORDER_FEE_PCT)} of each order. No monthly fee on the free plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label htmlFor="gmv">Your monthly sales</Label>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="gmv" type="range" min={0} max={50000} step={100}
              value={gmv} onChange={(e) => setGmv(parseInt(e.target.value || '0', 10))}
              className="w-full"
            />
            <Input
              type="number" min={0} value={gmv}
              onChange={(e) => setGmv(Math.max(0, Number(e.target.value || 0)))}
              className="w-28"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="You sell" value={usd0.format(gmv)} />
          <Stat label={`QuickSites (${pct(ORDER_FEE_PCT)})`} value={usd0.format(fee)} />
          <Stat label="You keep" value={usd0.format(keep)} highlight />
        </div>
        <p className="text-xs text-muted-foreground">
          Collected automatically via Stripe at checkout. Plus standard Stripe processing fees. No sales, no fee.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={classNames('rounded-xl border border-zinc-800/60 p-4', highlight && 'border-sky-500/40 bg-sky-500/[0.04]')}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={classNames('mt-1 text-xl font-semibold', highlight && 'text-sky-400')}>{value}</div>
    </div>
  );
}

// ---- Path B: Agency tier card + reseller calculator ----
function PlanToggle({ value, onChange }: { value: 'founder' | 'public'; onChange: (v: 'founder' | 'public') => void }) {
  return (
    <div className="inline-flex items-center rounded-full bg-muted p-1 shadow-inner">
      {(['founder', 'public'] as const).map((v) => (
        <button
          key={v} type="button" onClick={() => onChange(v)}
          className={classNames('px-4 py-1.5 rounded-full text-sm font-medium transition',
            value === v ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}
        >
          {v === 'founder' ? 'Founder / Beta' : 'Public'}
        </button>
      ))}
    </div>
  );
}

function NumberTile({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/60 p-4 overflow-hidden">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">
        {value}{suffix ? <span className="ml-1 text-base font-normal text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

function AgencyPlanCard({ mode }: { mode: 'founder' | 'public' }) {
  const plan = mode === 'founder' ? FOUNDER_PLAN : PUBLIC_PLAN;
  return (
    <Card className="h-full border-zinc-800/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{mode === 'founder' ? 'Founder / Beta' : 'Public'}</CardTitle>
          {mode === 'founder' ? <Badge variant="secondary">Grandfathered 12 mo</Badge> : <Badge variant="outline">Standard</Badge>}
        </div>
        <CardDescription>Flat, predictable pricing for agencies who’d rather not share order revenue. No per-order fee on this plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <NumberTile label="Platform" value={usd.format(plan.platform)} suffix="/user/mo" />
          <NumberTile label="Per site (flat)" value={usd.format(plan.perSite)} suffix="/site/mo" />
        </div>
        <ul className="space-y-2 text-sm">
          <Feature text="Unlimited pages, templates, and editors" />
          <Feature text="Multi-tenant routing & SEO-ready sitemaps" />
          <Feature text="Custom domains included" />
          <Feature text="No watermark on published sites" />
          <Feature text="Email support; Slack for high-volume partners" />
        </ul>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
          Flat per-site billing is rolling out in beta — we’ll set your account up directly. Talk to us to get started.
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Link href={CTA.contactHref}><Button>Talk to us<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
        <Link href={CTA.buildHref}><Button variant="ghost">Start a free trial</Button></Link>
      </CardFooter>
    </Card>
  );
}

function AgencyCalculator({ mode }: { mode: 'founder' | 'public' }) {
  const numbers = mode === 'founder' ? FOUNDER_PLAN : PUBLIC_PLAN;
  const [sites, setSites] = React.useState(25);
  const [pricePerSite, setPricePerSite] = React.useState(49);
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const siteCost = numbers.perSite * sites;
  const monthlyCost = numbers.platform + siteCost;
  const revenue = pricePerSite * sites;
  const margin = revenue - monthlyCost;

  return (
    <Card className="w-full border-zinc-800/60">
      <CardHeader>
        <CardTitle>Agency margin calculator</CardTitle>
        <CardDescription>What you’d pay us vs. what you charge your clients.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="sites">Client sites</Label>
            <div className="mt-2 flex items-center gap-3">
              <input id="sites" type="range" min={0} max={500} step={1} value={sites}
                onChange={(e) => setSites(parseInt(e.target.value || '0', 10))} className="w-full" />
              <Input type="number" min={0} value={sites}
                onChange={(e) => setSites(Math.max(0, Number(e.target.value || 0)))} className="w-24" />
            </div>
          </div>
          <div>
            <Label htmlFor="pps">Price you charge each client / mo</Label>
            <div className="mt-2 flex items-center gap-3">
              <input id="pps" type="range" min={10} max={500} step={1} value={pricePerSite}
                onChange={(e) => setPricePerSite(clamp(parseInt(e.target.value || '0', 10), 10, 500))} className="w-full" />
              <Input type="number" min={10} value={pricePerSite}
                onChange={(e) => setPricePerSite(clamp(Number(e.target.value || 0), 10, 5000))} className="w-24" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={`Platform`} value={usd.format(numbers.platform)} />
          <Stat label={`${sites} sites × ${usd.format(numbers.perSite)}`} value={usd.format(siteCost)} />
          <Stat label="Your revenue" value={usd.format(revenue)} />
          <Stat label="Gross margin" value={usd.format(margin)} highlight />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {sites} site{sites === 1 ? '' : 's'} → you pay <span className="font-medium text-foreground">{usd.format(monthlyCost)}</span>/mo,
          bill clients <span className="font-medium text-foreground">{usd.format(revenue)}</span>/mo →
          margin <span className="font-medium text-foreground">{usd.format(margin)}</span>/mo (before payment processing).
        </p>
      </CardContent>
    </Card>
  );
}

// ---- Add-ons ----
function AddOns() {
  const items = [
    { icon: Sparkles, title: 'AI Assist Pack', price: `+${usd.format(AI_ADDON_PER_USER)}/user/mo`, blurb: 'Hero/services/FAQ copy, meta & schema, image prompts. The free plan includes a starter AI allowance.' },
    { icon: Globe, title: 'Custom domain', price: 'Paid plans', blurb: 'Publish to your own domain (free sites use a quicksites.ai subdomain). Auto DNS + SSL.' },
    { icon: BadgeCheck, title: 'Remove branding', price: 'Paid plans', blurb: 'Drop the “Made with QuickSites” badge for a fully white-labeled site.' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((it) => (
        <Card key={it.title} className="border-zinc-800/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <it.icon className="h-5 w-5 text-sky-400" />
              <CardTitle className="text-base">{it.title}</CardTitle>
              <Badge className="ml-auto" variant="secondary">{it.price}</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{it.blurb}</CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- FAQs ----
const FAQS: { q: string; a: string }[] = [
  { q: 'Is it really free to start?', a: 'Yes — building, hosting, and publishing to a quicksites.ai subdomain are free. On the free (merchant) plan we only take a 5% fee on orders you actually sell. No sales, no fee.' },
  { q: 'When would I pay a subscription instead?', a: 'If you’re an agency running many client sites and prefer flat, predictable costs over a per-order fee, the Agency plan bills per user + per site with no order fee. Talk to us to get set up during the beta.' },
  { q: 'How do partners make money?', a: 'Partners white-label QuickSites, set their merchants’ order fee (up to 10%), and keep 80% of every fee as a lifetime residual. See the partner program for details.' },
  { q: 'What about payment processing fees?', a: 'Standard Stripe processing fees apply on top of our platform fee, the same as any checkout. You’ll always see fees before you publish.' },
];

// ---- Page ----
export default function PricingPage() {
  const [mode, setMode] = React.useState<'founder' | 'public'>('founder');

  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
        {/* hero */}
        <section className="relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="mx-auto max-w-6xl px-6 pt-14 pb-8"
          >
            <Badge variant="outline" className="mb-4">Pricing</Badge>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">Start free. Pay when you sell.</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Build and host your site for free — including a storefront and Stripe checkout. We take a small {pct(ORDER_FEE_PCT)} fee
              only on the orders you actually sell. Running sites for clients or reselling under your brand? There’s a path for that too.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href={CTA.buildHref}><Button size="lg">Create your free site<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link href={CTA.contactHref}><Button size="lg" variant="ghost">Talk to us</Button></Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Free to build & host', 'No card to start', `${pct(ORDER_FEE_PCT)} per order — that’s it on free`].map((r) => (
                <Badge key={r} variant="secondary">{r}</Badge>
              ))}
            </div>
          </motion.div>
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-sky-500/5 to-transparent" />
        </section>

        {/* path chooser */}
        <section className="mx-auto w-full max-w-6xl px-6 py-4">
          <PathChooser />
        </section>

        {/* Path A — Merchant */}
        <section id="merchant" className="mx-auto w-full max-w-6xl px-6 py-10 scroll-mt-24">
          <div className="mb-6 flex items-center gap-2">
            <Store className="h-6 w-6 text-sky-400" />
            <h2 className="text-2xl font-semibold">Build my own site</h2>
            <Badge variant="secondary" className="ml-2">Free</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-zinc-800/60">
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>Everything you need to launch and sell.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Feature text="Drag-and-drop builder, unlimited pages" />
                <Feature text="Free hosting on a quicksites.ai subdomain" />
                <Feature text="Storefront + Stripe checkout on every site" />
                <Feature text="Starter AI allowance (copy, images)" />
                <Feature text={`We take ${pct(ORDER_FEE_PCT)} per order — nothing until you sell`} />
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  Want your own domain or to remove the QuickSites badge? Those are paid add-ons below.
                </div>
              </CardContent>
              <CardFooter>
                <Link href={CTA.buildHref}><Button>Create your free site<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              </CardFooter>
            </Card>
            <OrderFeeCalc />
          </div>
        </section>

        {/* Path B — Agency */}
        <section id="agency" className="mx-auto w-full max-w-6xl px-6 py-10 scroll-mt-24 border-t border-zinc-800/60">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Users className="h-6 w-6 text-sky-400" />
            <h2 className="text-2xl font-semibold">Run sites for clients</h2>
            <PlanToggle value={mode} onChange={setMode} />
          </div>
          <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
            Prefer flat, predictable costs to a per-order fee? The Agency plan bills per user + per site with{' '}
            <span className="text-foreground font-medium">no platform fee on orders</span>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AgencyPlanCard mode={mode} />
            <AgencyCalculator mode={mode} />
          </div>
        </section>

        {/* Path C — Partner */}
        <section id="partner" className="mx-auto w-full max-w-6xl px-6 py-10 scroll-mt-24 border-t border-zinc-800/60">
          <Card className="border-zinc-800/60 bg-gradient-to-br from-sky-500/10 to-transparent">
            <CardContent className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <Handshake className="h-6 w-6 text-sky-400" />
                  <h2 className="text-2xl font-semibold">Resell under my brand</h2>
                </div>
                <p className="mt-2 text-muted-foreground">
                  White-label QuickSites for your network. Set each merchant’s order fee (up to 10%), keep{' '}
                  <span className="text-foreground font-medium">{pct(PARTNER_FEE_SHARE)} of every fee as a lifetime residual</span>.
                  Hosting is free for your merchants.
                </p>
              </div>
              <Link href={CTA.partnersHref}><Button size="lg">See the partner program<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            </CardContent>
          </Card>
        </section>

        {/* Add-ons */}
        <section id="addons" className="mx-auto w-full max-w-6xl px-6 py-10 scroll-mt-24 border-t border-zinc-800/60">
          <h2 className="mb-6 text-2xl font-semibold">Add-ons</h2>
          <AddOns />
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-6xl px-6 py-10 border-t border-zinc-800/60">
          <h2 className="mb-6 text-2xl font-semibold">Frequently asked</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FAQS.map((item, i) => (
              <Card key={i} className="border-zinc-800/60">
                <CardHeader><CardTitle className="text-base">{item.q}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">{item.a}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA footer */}
        <section className="mx-auto w-full max-w-6xl px-6 py-12">
          <Card className="bg-gradient-to-br from-sky-500/5 to-transparent border-zinc-800/60">
            <CardContent className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl md:text-2xl font-semibold">Launch your site in minutes — free.</h3>
                <p className="text-muted-foreground">No card required. You only pay when you make a sale.</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href={CTA.buildHref}><Button size="lg">Create your free site<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
                <Link href={CTA.contactHref}><Button size="lg" variant="outline">Talk to us</Button></Link>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6 text-center">
            <Link href="/"><Button variant="ghost" size="sm">← Back home</Button></Link>
          </div>
        </section>
      </div>
    </>
  );
}
