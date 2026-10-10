// lib/evolve/evolve.ts
//
// "Evolve" — the pitch page for a restaurant that HAS a website and takes no online food
// orders: the offer in one line, why, what they likely pay today (only when we can see who
// serves the site AND that provider publishes pricing we have sourced), their site beside the
// evolved one, the next step, and a feature matrix. Pure: this module turns a prospect + its
// draft into the page's model; the route renders it. Every sentence a visitor reads is in COPY,
// held to the claim-postcard forbidden list by lib/evolve/__tests__/evolve.test.ts, and every
// figure is derived.
//
// ⚠️ Two lessons from the first UX review (2026-10-10), both about EXHIBITS contradicting prose:
//   1. A draft with no menu block is the generic trade scaffold ("Are you licensed and insured?")
//      and must never be shown as "your menu, orderable". No menu → no evolved frame, no Claim
//      button; the page says the menu has not been read yet and offers the call.
//   2. "Online orders: none found" was false for a WooCommerce shop. The line now says what WAS
//      found (a shop) and what was not (food ordering), and hedges when nothing was found.
// ⚠️ The "likely paying" line is the provider's PUBLISHED pricing, labelled as such, never a
// statement about this restaurant's plan — we cannot see their invoice and do not pretend to.

import { RESTAURANT_FEE_MIN_CENTS, RESTAURANT_FEE_PERCENT } from '@/lib/commerce/pricingDefaults';
import { providerLabel, providerPublishedPricing } from '@/lib/prospects/siteProvider';
import { platformLabel } from '@/lib/prospects/orderingSegments';
import { SHOP, THIRD_PARTY, type OrderingPlatform } from '@/lib/prospects/orderingDetect';
import { evolveFeatureRows, type EvolveFeatureRow } from '@/lib/evolve/features';
import { withRef } from '@/lib/rep/repBuild';

export const COPY = {
  headline: 'Your menu, orderable from a phone. Your site stays as it is.',
  whyTitle: 'Why evolve your site',
  why: [
    'People already find you — your site is up, your reviews are good. What they cannot do is order a drink or food from it to pick up.',
    'The evolved version is the same site with one thing added: your menu, orderable. Order ahead for pickup, from a phone, with your prices. Your current site stays exactly as it is and links to it.',
    // {fee} is the derived fee sentence — the owner's first question, answered in the third paragraph.
    (fee: string) => `Nothing is installed and nothing is billed monthly. ${fee} You pay only when an order comes in.`,
  ] as const,
  payingTitle: 'What you are likely paying today',
  payingTitleUnknown: 'Your site today',
  payingKnown: (provider: string, pricing: string, verified: string) =>
    `Your site is served by ${provider}. ${provider}'s published pricing is ${pricing} (their public pricing as we read it in ${verified}). Your plan is yours to know — we cannot see it, and we are not asking you to change it.`,
  payingUnknown: (provider: string) => `Your site is served by ${provider}. Nothing here asks you to change it.`,
  payingUnread: 'Your current site stays as it is; nothing here asks you to change it.',
  nowTitle: 'Your site today',
  nowNone: 'Online orders today: we could not find a way to order from it.',
  nowShop: (shop: string) => `Online orders today: ${shop} for things you ship. Nothing for ordering a drink or food ahead for pickup.`,
  nowApp: (app: string) => `Online orders today: through ${app}, which takes a share of each one.`,
  nowPlatform: (platform: string) => `Online orders today: ${platform}.`,
  nowUnframeable: 'Your site does not allow itself to be shown inside another page, so open it in a new tab to compare.',
  nextTitle: 'Your site, evolved',
  nextNote: 'Built from your own menu and photos. Prices are shown as we read them and are confirmed by you before anything goes live.',
  nextNoMenuTitle: 'Your menu, next',
  nextNoMenu: 'We have not been able to read your menu from your site yet, so there is nothing honest to show here. On a call we go through it with you, and nothing is shown to customers before you confirm it.',
  portalTitle: 'What you get when an order comes in',
  portal: [
    'A text and an email with the items, the moment the order is paid.',
    'Your own orders page: every order with its status, on a phone in the kitchen or a laptop at home.',
    'Card payments go to a payment account in your name, paid out to your bank. You set it up once (it runs on Stripe).',
  ],
  ctaClaim: 'Take it — it is yours',
  ctaCall: 'Set up a call first',
  ctaCallOnly: 'Set up a call',
  ctaOpenCurrent: 'Open your current site',
  ctaOpenEvolved: 'Open the evolved site',
  matrixTitle: 'Side by side',
  matrixToday: 'Your site today',
  matrixEvolved: 'Evolved',
  fee: (pct: string, floorCents: number) => `You pay ${pct} of each online order (never less than ${floorCents}¢ on an order), card processing included. No monthly, no contract.`,
  footer: 'This page is for one restaurant only and is not listed anywhere. It was prepared from your public website and listing; if anything here is wrong, tell us and we will fix it or take the page down.',
} as const;

export type EvolveInput = {
  prospectId: string;
  businessName: string;
  website: string;
  /** The built draft's slug (required — no draft, no page). */
  slug: string;
  /** Does the draft carry a menu block with at least one item? Without one there is no exhibit. */
  draftHasMenu: boolean;
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
  headline: string;
  why: string[];
  currentUrl: string;
  currentFrameable: boolean;
  /** The evolved draft for OPENING (claim bar intact). Null when the draft has no menu. */
  evolvedUrl: string | null;
  /** The evolved draft for FRAMING: claim bar and preview strip hidden. Null when no menu. */
  evolvedFrameUrl: string | null;
  hasMenu: boolean;
  /** Null when there is no menu — the owner cannot be asked to take a page we could not fill. */
  claimUrl: string | null;
  callUrl: string;
  nowLine: string;
  payingTitle: string;
  paying: string;
  payingSources: { label: string; url: string }[];
  fee: string;
  rows: EvolveFeatureRow[];
};

export function pct(fraction: number): string {
  const n = fraction * 100;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

/** Does template `data` carry a menu block with at least one item, in any of the three copies? */
export function draftHasMenu(data: unknown): boolean {
  const pages = ((data as any)?.pages ?? []) as any[];
  for (const pg of pages) {
    for (const b of [...(pg?.blocks ?? []), ...(pg?.content_blocks ?? [])]) {
      if (b?.type !== 'menu') continue;
      const sections = b?.content?.sections ?? b?.props?.sections ?? [];
      if (sections.some((s: any) => (s?.items?.length ?? 0) > 0)) return true;
    }
  }
  return false;
}

export function nowLineFor(platform: string | null): string {
  if (!platform || platform === 'none') return COPY.nowNone;
  const p = platform as OrderingPlatform;
  if (SHOP.has(p)) return COPY.nowShop(platformLabel(p));
  if (THIRD_PARTY.has(p)) return COPY.nowApp(platformLabel(p));
  return COPY.nowPlatform(platformLabel(p));
}

export function buildEvolveModel(input: EvolveInput): EvolveModel {
  const ref = (u: string) => (input.refCode ? withRef(u, input.refCode) : u);
  const base = input.base.replace(/\/+$/, '');
  const evolvedBase = input.menuHost ? `https://deliveredmenu.com/${input.slug}` : `${base}/sites/${input.slug}`;
  const hasMenu = input.draftHasMenu;
  const evolvedUrl = hasMenu ? ref(evolvedBase) : null;
  const evolvedFrameUrl = hasMenu ? ref(`${evolvedBase}?exhibit=1`) : null;
  const claimUrl = hasMenu ? ref(`${base}/go/${input.prospectId}`) : null;
  const callUrl = ref(`${base}/book`);
  const provider = input.siteProvider ? providerLabel(input.siteProvider) : null;
  const published = providerPublishedPricing(input.siteProvider);
  const paying = !input.siteProvider
    ? COPY.payingUnread
    : published
      ? COPY.payingKnown(provider!, published.pricing, published.verified)
      : COPY.payingUnknown(provider!);
  const payingTitle = published ? COPY.payingTitle : COPY.payingTitleUnknown;
  // ⚠️ https, always: an http iframe inside an https page is blocked as mixed content and
  // renders blank with no error anyone can read (the first live page did exactly that).
  const currentUrl = (input.currentFrameUrl || (/^https?:\/\//i.test(input.website) ? input.website : `https://${input.website}`)).replace(/^http:\/\//i, 'https://');
  const fee = COPY.fee(pct(RESTAURANT_FEE_PERCENT), RESTAURANT_FEE_MIN_CENTS);
  const todayOrdering = !input.orderingPlatform || input.orderingPlatform === 'none'
    ? 'None found'
    : SHOP.has(input.orderingPlatform as OrderingPlatform)
      ? `${platformLabel(input.orderingPlatform)} for things you ship; no food ordering`
      : platformLabel(input.orderingPlatform);
  return {
    copy: COPY,
    businessName: input.businessName,
    headline: COPY.headline,
    why: COPY.why.map((w) => (typeof w === 'function' ? w(fee) : w)),
    currentUrl,
    currentFrameable: input.currentFrameable,
    evolvedUrl,
    evolvedFrameUrl,
    hasMenu,
    claimUrl,
    callUrl,
    nowLine: nowLineFor(input.orderingPlatform),
    payingTitle,
    paying,
    payingSources: published?.sources ?? [],
    fee,
    rows: evolveFeatureRows({ orderingToday: todayOrdering, providerLabel: provider, fee }),
  };
}
