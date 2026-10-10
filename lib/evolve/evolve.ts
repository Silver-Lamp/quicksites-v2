// lib/evolve/evolve.ts
//
// "Evolve" — the pitch page for a restaurant that HAS a website and takes no online orders:
// why evolve, what they likely pay today (only when we can see who serves the site AND that
// provider publishes pricing we have sourced), their site beside the evolved one, the next step,
// and a feature matrix. Pure: this module turns a prospect + its draft into the page's model;
// the route renders it. Every sentence a visitor reads is in COPY, held to the claim-postcard
// forbidden list by lib/evolve/__tests__/evolve.test.ts, and every figure is derived.
//
// ⚠️ The "likely paying" line is the provider's PUBLISHED pricing, labelled as such, never a
// statement about this restaurant's plan — we cannot see their invoice and do not pretend to.

import { RESTAURANT_FEE_MIN_CENTS, RESTAURANT_FEE_PERCENT } from '@/lib/commerce/pricingDefaults';
import { providerLabel, providerPublishedPricing } from '@/lib/prospects/siteProvider';
import { platformLabel } from '@/lib/prospects/orderingSegments';
import { evolveFeatureRows, type EvolveFeatureRow } from '@/lib/evolve/features';
import { withRef } from '@/lib/rep/repBuild';

export const COPY = {
  eyebrow: 'Evolve your site',
  whyTitle: 'Why evolve your site',
  why: [
    'People already find you — your site is up, your reviews are good. What they cannot do is order from it, so the ones who decide at 7pm on a phone go to whoever lets them.',
    'The evolved version is the same site with one thing added: your menu, orderable. Pickup and call-ahead, from a phone, with your prices. Your current site stays exactly as it is and links to it.',
    'Nothing is installed and nothing is billed monthly. You pay a small share of each online order and only when one comes in.',
  ],
  payingTitle: 'What you are likely paying today',
  payingKnown: (provider: string, pricing: string, verified: string) =>
    `Your site is served by ${provider}. ${provider}'s published pricing is ${pricing} (their public pricing as we read it in ${verified}). Your plan is yours to know — we cannot see it, and we are not asking you to change it.`,
  payingUnknown: (provider: string) => `Your site is served by ${provider}. We do not know what it costs you, and nothing here asks you to change it.`,
  payingUnread: 'We have not read your site closely enough to say who serves it, and nothing here asks you to change it.',
  nowTitle: 'Your site today',
  nowNote: (ordering: string) => `Online orders: ${ordering}.`,
  nowUnframeable: 'Your site does not allow itself to be shown inside another page, so open it in a new tab to compare.',
  nextTitle: 'Your site, evolved',
  nextNote: 'Built from your own menu and photos. Prices are shown as we read them and are confirmed by you before anything goes live.',
  portalTitle: 'And the part only you see',
  portal: [
    'When an order is paid you get a text and an email with the items, right away.',
    'Your orders page lists every order with its status — on a phone in the kitchen or a laptop at home.',
    'Card payments go to your own Stripe account, which you connect once.',
  ],
  ctaClaim: 'Claim it — it is yours',
  ctaCall: 'Set up a call first',
  ctaOpenCurrent: 'Open your current site',
  ctaOpenEvolved: 'Open the evolved site',
  matrixTitle: 'Side by side',
  matrixToday: 'Your site today',
  matrixEvolved: 'Evolved',
  fee: (pct: string, floorCents: number) => `${pct} of each online order, at least ${floorCents}¢, card processing included. No monthly, no contract.`,
  footer: 'This page was prepared for one restaurant from its public website and listing. If anything here is wrong, tell us and we will fix it or take the page down.',
} as const;

export type EvolveInput = {
  prospectId: string;
  businessName: string;
  website: string;
  /** The built draft's slug (required — no draft, no page). */
  slug: string;
  orderingPlatform: string | null;
  siteProvider: string | null;
  /** From a GET of their site: can it sit in an iframe? */
  currentFrameable: boolean;
  /** Where their site's redirects ended, https — the only URL an iframe on an https page may load. */
  currentFrameUrl?: string | null;
  refCode?: string | null;
  base: string;
  menuHost: string | null;
};

export type EvolveModel = {
  copy: typeof COPY;
  businessName: string;
  currentUrl: string;
  currentFrameable: boolean;
  evolvedUrl: string;
  claimUrl: string;
  callUrl: string;
  orderingToday: string;
  paying: string;
  payingSources: { label: string; url: string }[];
  fee: string;
  rows: EvolveFeatureRow[];
};

export function pct(fraction: number): string {
  const n = fraction * 100;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

export function buildEvolveModel(input: EvolveInput): EvolveModel {
  const ref = (u: string) => (input.refCode ? withRef(u, input.refCode) : u);
  const base = input.base.replace(/\/+$/, '');
  const evolvedUrl = ref(input.menuHost ? `https://deliveredmenu.com/${input.slug}` : `${base}/sites/${input.slug}`);
  const claimUrl = ref(`${base}/go/${input.prospectId}`);
  const callUrl = ref(`${base}/book`);
  const orderingToday = input.orderingPlatform === 'none' || !input.orderingPlatform ? 'none found on your site' : platformLabel(input.orderingPlatform);
  const provider = input.siteProvider ? providerLabel(input.siteProvider) : null;
  const published = providerPublishedPricing(input.siteProvider);
  const paying = !input.siteProvider
    ? COPY.payingUnread
    : published
      ? COPY.payingKnown(provider!, published.pricing, published.verified)
      : COPY.payingUnknown(provider!);
  // ⚠️ https, always: an http iframe inside an https page is blocked as mixed content and
  // renders blank with no error anyone can read (the first live page did exactly that).
  const currentUrl = (input.currentFrameUrl || (/^https?:\/\//i.test(input.website) ? input.website : `https://${input.website}`)).replace(/^http:\/\//i, 'https://');
  return {
    copy: COPY,
    businessName: input.businessName,
    currentUrl,
    currentFrameable: input.currentFrameable,
    evolvedUrl,
    claimUrl,
    callUrl,
    orderingToday,
    paying,
    payingSources: published?.sources ?? [],
    fee: COPY.fee(pct(RESTAURANT_FEE_PERCENT), RESTAURANT_FEE_MIN_CENTS),
    rows: evolveFeatureRows({ orderingToday: input.orderingPlatform === 'none' || !input.orderingPlatform ? 'None found' : platformLabel(input.orderingPlatform), providerLabel: provider, keepsSite: true }),
  };
}
