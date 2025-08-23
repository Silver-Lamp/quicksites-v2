'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Sparkles } from 'lucide-react';

// shadcn/ui — adjust imports if your paths differ
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/**
 * QuickSites Pricing Page
 * - Toggle: Founder/Beta vs Public
 * - AI Assist Pack add-on (+$10/user/mo)
 * - Cost calculator (sites, price-per-site revenue)
 * - Simple FAQs + migration offers
 */

// ---- Config ----
const COPY = {
  heroKicker: 'Pricing',
  heroTitle: 'Simple, predictable pricing for SEO builders',
  heroSubtitle:
    "Start lean, scale fast. Founder pricing undercuts the market while you grow — and it's grandfathered for 12 months.",
  ctas: {
    primaryHref: '/login',
    primary: 'Start free trial',
    secondaryHref: '/contact',
    secondary: 'Talk to sales',
  },
  ribbons: [
    'No setup fees',
    '14-day free trial',
    'Free month of per-site fees on first-30-day migrations',
  ],
  competitorNote:
    "Switching from another platform? We'll honor Founder pricing for 12 months.",
};

// Pricing numbers
type PlanNumbers = {
  platform: number; // per user / month
  perSite: number;  // flat per site / month
};

const FOUNDER_PLAN: PlanNumbers = {
  platform: 15,
  perSite: 5, // ✅ grandfathered flat price
};

const PUBLIC_PLAN: PlanNumbers = {
  platform: 19,
  perSite: 6, // flat, no tiers
};

const AI_ADDON_PER_USER = 10; // $10/user/mo

// ---- Utilities ----
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

// ---- Toggle component ----
function PlanToggle({ value, onChange }: { value: 'founder' | 'public'; onChange: (v: 'founder' | 'public') => void }) {
  return (
    <div className="inline-flex items-center rounded-full bg-muted p-1 shadow-inner">
      <button
        type="button"
        onClick={() => onChange('founder')}
        className={classNames(
          'px-4 py-2 rounded-full text-sm font-medium transition',
          value === 'founder' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Founder / Beta
      </button>
      <button
        type="button"
        onClick={() => onChange('public')}
        className={classNames(
          'px-4 py-2 rounded-full text-sm font-medium transition',
          value === 'public' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Public
      </button>
    </div>
  );
}

// ---- Calculator card ----
function Calculator({
    plan,
    includeAI,
    onToggleAI,
  }: {
    plan: 'founder' | 'public';
    includeAI: boolean;
    onToggleAI: (v: boolean) => void;
  }) {
    const PRICE_MIN = 10;
    const PRICE_MAX = 2000;
  
    const [sites, setSites] = React.useState(25);
    const [pricePerSite, setPricePerSite] = React.useState(49); // what you charge your clients
  
    const numbers = plan === 'founder' ? FOUNDER_PLAN : PUBLIC_PLAN;
  
    // clamp helper
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  
    const platformCost = numbers.platform;              // per user
    const perSiteFlat = numbers.perSite;                // flat per-site
    const siteCost = perSiteFlat * sites;               // monthly per-site total
    const aiCost = includeAI ? AI_ADDON_PER_USER : 0;   // per user
    const monthlyCost = platformCost + siteCost + aiCost;
  
    const monthlyRevenue = pricePerSite * sites;
    const grossMargin = monthlyRevenue - monthlyCost;
  
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Estimate your monthly cost</CardTitle>
          <CardDescription>Quick napkin math — adjust sites and what you charge.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sites slider + input */}
            <div>
              <Label htmlFor="sites">Sites</Label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="sites"
                  type="range"
                  min={0}
                  max={500}
                  step={1}
                  value={sites}
                  onChange={(e) => setSites(parseInt(e.target.value || '0', 10))}
                  className="w-full"
                />
                <Input
                  type="number"
                  min={0}
                  value={sites}
                  onChange={(e) => setSites(Math.max(0, Number(e.target.value || 0)))}
                  className="w-24"
                />
              </div>
            </div>
  
            {/* Price you charge slider + input */}
            <div>
              <Label htmlFor="pps">Price you charge to resell to your clients</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">USD</span>
                  <Input
                    id="pps"
                    type="number"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={1}
                    value={pricePerSite}
                    onChange={(e) =>
                      setPricePerSite(clamp(Number(e.target.value || 0), PRICE_MIN, PRICE_MAX))
                    }
                    className="w-32"
                  />
                  <span className="text-xs text-muted-foreground">
                    {usd.format(PRICE_MIN)}–{usd.format(PRICE_MAX)}
                  </span>
                </div>
                <input
                  aria-label="Price you charge slider"
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={1}
                  value={pricePerSite}
                  onChange={(e) => setPricePerSite(clamp(parseInt(e.target.value || '0', 10), PRICE_MIN, PRICE_MAX))}
                  className="w-full"
                />
              </div>
            </div>
  
            {/* AI toggle (wrapping safe) */}
            <div className="flex items-end md:items-center justify-between md:justify-start gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Switch id="ai" checked={includeAI} onCheckedChange={onToggleAI} />
                <Label
                  htmlFor="ai"
                  className="flex items-center gap-1 cursor-pointer min-w-0 break-words whitespace-normal"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">
                    Include AI Assist Pack{' '}
                    <span className="text-muted-foreground">(+{usd.format(AI_ADDON_PER_USER)}/user/mo)</span>
                  </span>
                </Label>
              </div>
            </div>
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryTile label="Platform" value={usd.format(platformCost)} sub="per user / mo" />
            <SummaryTile label={`Per-site × ${sites}`} value={usd.format(siteCost)} sub={`${usd.format(perSiteFlat)} each`} />
            <SummaryTile label="AI Pack" value={usd.format(aiCost)} sub={includeAI ? '+$10/user' : 'optional'} />
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SummaryTile
              label="Your revenue"
              value={usd.format(monthlyRevenue)}
              sub={`${usd.format(pricePerSite)} × ${sites}`}
              highlight
            />
            <SummaryTile
              label="Gross margin"
              value={usd.format(grossMargin)}
              sub="before payment processing"
              highlight
              subtle
            />
          </div>
        </CardContent>
      </Card>
    );
  }
  
function SummaryTile({
  label,
  value,
  sub,
  highlight = false,
  subtle = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  subtle?: boolean;
}) {
  return (
    <Card className={classNames(highlight && 'border-primary/40', 'overflow-hidden')}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={classNames('text-2xl', highlight && 'text-primary')}>{value}</CardTitle>
      </CardHeader>
      {sub && (
        <CardContent className={classNames('pt-0 text-sm', subtle ? 'text-muted-foreground' : '')}>
          {sub}
        </CardContent>
      )}
    </Card>
  );
}

// ---- Plan details card ----
function PlanCard({ plan, kind }: { plan: PlanNumbers; kind: 'founder' | 'public' }) {
  const title = kind === 'founder' ? 'Founder / Beta' : 'Public';
  const blurb =
    kind === 'founder'
      ? 'Grandfathered for 12 months. Limited time while we scale early partners.'
      : 'Standard pricing once the beta window closes — still simple and fair.';

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{title}</CardTitle>
          {kind === 'founder' ? <Badge variant="secondary">Grandfathered</Badge> : <Badge variant="outline">Standard</Badge>}
        </div>
        <CardDescription>{blurb}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <NumberTile label="Platform" value={usd.format(plan.platform)} suffix="/user/mo" />
          <NumberTile label="Per-site (flat)" value={usd.format(plan.perSite)} suffix="/site/mo" />
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          No volume tiers. Founder plan is a flat ${FOUNDER_PLAN.perSite.toFixed(2)}/site/mo for 12 months from signup.
        </div>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5" /> Unlimited pages, templates, and editors</li>
          <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5" /> Multi-tenant routing & SEO-ready sitemaps</li>
          <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5" /> API + webhooks (rollout during beta)</li>
          <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5" /> Email support; Slack access for high-volume partners</li>
        </ul>
      </CardContent>
      <CardFooter className="justify-between">
        <Link href={COPY.ctas.primaryHref} className="inline-flex">
          <Button>
            {COPY.ctas.primary}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link href={COPY.ctas.secondaryHref} className="inline-flex">
          <Button variant="ghost">{COPY.ctas.secondary}</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function NumberTile({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border p-4 overflow-hidden">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">
        {value}
        {suffix ? <span className="ml-1 text-base font-normal text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

// ---- AI Add-on explainer ----
function AiAddOn() {
  return (
    <Card className="h-full border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <CardTitle>AI Assist Pack</CardTitle>
          <Badge className="ml-auto" variant="secondary">+{usd.format(AI_ADDON_PER_USER)}/user/mo</Badge>
        </div>
        <CardDescription>Speed up content and on-page SEO. Keep it optional at first; add it when it pays for itself.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Feature text="AI page briefs & outlines" />
        <Feature text="Meta, schema & FAQ suggestions" />
        <Feature text="Content drafts with tone controls" />
        <Feature text="Hero image prompts & alt-text" />
        <Feature text="One-click internal linking hints" />
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Fair-use during beta; we may introduce soft usage caps later. You’ll always see costs before you opt in.
        </div>
      </CardContent>
      <CardFooter>
        <Link href={COPY.ctas.primaryHref} className="inline-flex">
          <Button variant="outline">
            Enable AI Add-on
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <Check className="h-4 w-4 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

// ---- FAQs ----
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Can I lock in Founder pricing?',
    a: 'Yes. Accounts created during the beta window are grandfathered at a flat $5/site/mo for 12 months from signup.',
  },
  {
    q: 'Do you offer volume discounts?',
    a: 'Not during beta. Founder pricing is already a reduced flat rate designed to be simple and predictable.',
  },
  {
    q: 'What if I only need the platform for myself?',
    a: 'Pricing is per user. Many agencies run a single owner account; you can add more seats later as you scale operations.',
  },
  {
    q: 'What’s included without the AI add-on?',
    a: 'Everything you need to build and host sites: templates, editor, routing, sitemaps, and support. The AI pack layers content and on-page accelerators on top.',
  },
];

function FaqList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {FAQS.map((item, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-base">{item.q}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{item.a}</CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Page ----
export default function PricingPage() {
  const [mode, setMode] = React.useState<'founder' | 'public'>('founder');
  const [includeAI, setIncludeAI] = React.useState(false);

  const numbers = mode === 'founder' ? FOUNDER_PLAN : PUBLIC_PLAN;

  return (
    <div className="relative">
      {/* hero */}
      <section className="relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-6xl px-6 pt-14 pb-6"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant="outline">{COPY.heroKicker}</Badge>
            <PlanToggle value={mode} onChange={setMode} />
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
              <Button size="lg" variant="ghost">{COPY.ctas.secondary}</Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {COPY.ribbons.map((r) => (
              <Badge key={r} variant="secondary">{r}</Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{COPY.competitorNote}</p>
        </motion.div>

        {/* soft gradient bg */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </section>

    {/* pricing cards + AI + calculator */}
    <section className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">
    <PlanCard plan={numbers} kind={mode} />
    <AiAddOn />

    {/* Calculator spans both columns below */}
    <div className="md:col-span-2">
        <Calculator plan={mode} includeAI={includeAI} onToggleAI={setIncludeAI} />
    </div>
    </section>

      {/* comparison table */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Side-by-side</CardTitle>
            <CardDescription>Flip the toggle to see numbers change. Flat per-site — no volume tiers.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Platform (per user)</th>
                  <th className="py-2 pr-4">Per-site (flat)</th>
                  <th className="py-2 pr-4">AI Pack (optional)</th>
                </tr>
              </thead>
              <tbody>
                <Row planName="Founder / Beta" p={FOUNDER_PLAN} />
                <Row planName="Public" p={PUBLIC_PLAN} dim />
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      {/* FAQs */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Frequently asked</h2>
          <p className="text-muted-foreground">Details on billing and the beta window.</p>
        </div>
        <FaqList />
      </section>

      {/* CTA footer */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-semibold">Ready to launch your next 10 sites?</h3>
              <p className="text-muted-foreground">Start on Founder pricing today — we&apos;ll grandfather it for 12 months.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={COPY.ctas.primaryHref} className="inline-flex">
                <Button size="lg">
                  {COPY.ctas.primary}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={COPY.ctas.secondaryHref} className="inline-flex">
                <Button size="lg" variant="outline">{COPY.ctas.secondary}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Row({ planName, p, dim = false }: { planName: string; p: PlanNumbers; dim?: boolean }) {
  return (
    <tr className={classNames('border-t', dim && 'opacity-80')}>
      <td className="py-3 pr-4 font-medium">{planName}</td>
      <td className="py-3 pr-4">{usd.format(p.platform)}/mo</td>
      <td className="py-3 pr-4">{usd.format(p.perSite)}/site/mo</td>
      <td className="py-3 pr-4">+{usd.format(AI_ADDON_PER_USER)}/user/mo</td>
    </tr>
  );
}
