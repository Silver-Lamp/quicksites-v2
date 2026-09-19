// components/pricing/path-chooser.tsx
//
// The five ways to get a site, as ONE list rendered two ways: the full cards at the top of
// /pricing, and a compact strip on /build for the visitor who clicked "Build my own site" and
// wants a different door after all. One list so the two can never disagree — the figures in
// the blurbs come from lib/billing/planPricing + lib/commerce/partner-terms, never typed here.

import Link from 'next/link';
import { ArrowRight, Handshake, Phone, Store, Users, Wrench, type LucideIcon } from 'lucide-react';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DONE_FOR_YOU } from '@/lib/billing/planPricing';
import { PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export type PricingPathKey = 'merchant' | 'leadgen' | 'agency' | 'partner' | 'done-for-you';

export type PricingPath = {
  key: PricingPathKey;
  icon: LucideIcon;
  title: string;
  blurb: string;
  tag: string;
  /** Section anchor on /pricing. */
  hash: string;
};

export const PRICING_PATHS: PricingPath[] = [
  {
    key: 'merchant',
    icon: Store,
    title: 'Build my own site',
    blurb: 'Free to build & host. Pay only when you sell.',
    hash: '#merchant',
    tag: 'Most popular',
  },
  {
    key: 'leadgen',
    icon: Phone,
    title: 'No online store',
    blurb: 'Service trades: flat monthly on a premium local domain.',
    hash: '#leadgen',
    tag: 'Lead-gen',
  },
  {
    key: 'agency',
    icon: Users,
    title: 'Run sites for clients',
    blurb: 'Flat, predictable pricing for agencies.',
    hash: '#agency',
    tag: 'Agencies',
  },
  {
    key: 'partner',
    icon: Handshake,
    title: 'Resell under my brand',
    blurb: `White-label and earn ${Math.round(PARTNER_FEE_SHARE * 100)}% on every order, for life.`,
    hash: '#partner',
    tag: 'Partners',
  },
  {
    key: 'done-for-you',
    icon: Wrench,
    title: 'Have it built for me',
    blurb: `Fixed-price build from ${usd0.format(DONE_FOR_YOU.buildFrom)}. Hosting stays free.`,
    hash: '#done-for-you',
    tag: 'Done for you',
  },
];

/** The full cards (top of /pricing). Links are in-page anchors. */
export function PathChooser() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      {PRICING_PATHS.map((p) => (
        <Link key={p.key} href={p.hash} className="group">
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
                See details{' '}
                <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </CardFooter>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/**
 * The compact strip for another page (e.g. /build): small pills that link back to the matching
 * /pricing section. `exclude` drops the path the visitor is already on.
 */
export function PathChooserCompact({ exclude, lead }: { exclude?: PricingPathKey; lead?: string }) {
  const paths = PRICING_PATHS.filter((p) => p.key !== exclude);
  return (
    <nav aria-label="Other ways to get a site" className="w-full max-w-3xl">
      {lead ? <p className="text-sm text-zinc-500">{lead}</p> : null}
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {paths.map((p) => (
          <li key={p.key}>
            <Link
              href={`/pricing${p.hash}`}
              title={p.blurb}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-sky-500/50 hover:text-sky-300"
            >
              <p.icon className="h-4 w-4 text-sky-400" aria-hidden />
              <span>{p.title}</span>
              <span className="hidden text-[11px] uppercase tracking-wide text-zinc-500 sm:inline">
                · {p.tag}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
