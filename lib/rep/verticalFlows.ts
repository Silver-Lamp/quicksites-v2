// lib/rep/verticalFlows.ts
//
// The flowcharts under the restaurants section on /for-sales: for each remaining vertical, what
// the salesperson does, step by step, and what the result is (owner, 2026-10-10). Pure data so
// the copy is testable: every string is held to the claim-postcard forbidden list (no ranking,
// no search engine, no guarantee, no urgency, no typed price, no results promise), and the one
// figure — the closer's share — is DERIVED from the split the ledger pays, never typed.
//
// ⚠️ The website build pays no rep commission, and the flow says so. The page's own card calls
// it "not yours" and "self-serve on purpose"; a flowchart ending in a payout here would be the
// page arguing with itself again (the failure forSalesBrief.test.ts was written for).
import { SPLIT } from '@/lib/commerce/rentalSplits';

export type FlowWho = 'rep' | 'business' | 'auto';
export type FlowStep = { who: FlowWho; title: string; detail: string };
export type VerticalFlow = {
  key: 'rental' | 'website' | 'store';
  caption: string;
  steps: FlowStep[];
  result: { title: string; detail: string };
};

export const WHO_LABEL: Record<FlowWho, string> = {
  rep: 'you',
  business: 'the business',
  auto: 'runs on its own',
};

const closerShare = `${Math.round(SPLIT.closer * 100)}%`;

export const VERTICAL_FLOWS: Record<VerticalFlow['key'], VerticalFlow> = {
  // A store with checkout for a business that sells things but not online. The money path is
  // the same take-rate the restaurants ride (an attributed referral earns on each paid order —
  // markOrderPaid writes the ledger row), so the result is stated the same way.
  store: {
    key: 'store',
    caption: 'A store with checkout, start to finish',
    steps: [
      { who: 'rep', title: 'Spot a maker or a shop with no checkout', detail: 'A bakery that posts its loaves, a farm stand, a shop whose site is a brochure. The sweep and the no-website table are both doors.' },
      { who: 'rep', title: 'Build it from what they already show', detail: 'Their listing, their site, or their post: products, prices and photos they published. Nothing invented about a business we have never spoken to.' },
      { who: 'rep', title: 'Hand them the claim link', detail: 'Text it or leave the card. The link carries your code, so the store is attributed to you.' },
      { who: 'business', title: 'They claim it and connect payouts', detail: 'Their own name, their own prices; card payouts go to their account. They fix anything we read wrong before it goes live.' },
      { who: 'auto', title: 'Orders run through checkout', detail: 'Each paid order carries the per-order fee; your share of it posts to the ledger the payout run pays from.' },
    ],
    result: {
      title: 'A share of every order they take through it, for as long as they sell',
      detail: 'You earn when they do, and only then. No monthly fee for them, no bonus up front for you — the same deal as the lunch spot.',
    },
  },
  rental: {
    key: 'rental',
    caption: 'The domain rental, start to finish',
    steps: [
      { who: 'rep', title: 'Pick a city and trade', detail: 'From the inventory we already own — one domain per city and trade, so check it is still open.' },
      { who: 'rep', title: 'Call one business in it', detail: 'Ninety seconds. Ask them to type the domain in while you talk; sell what is true today, in the present tense.' },
      { who: 'business', title: 'They open it', detail: 'A working site on their trade and town, already live. It stops being a pitch and becomes a thing they are looking at.' },
      { who: 'rep', title: 'Send the checkout link', detail: 'Today Sandon generates it by hand; say early if you want your own login.' },
      { who: 'business', title: 'They rent it', detail: 'Card on file, monthly, exclusive — nobody else in that city and trade can have it while they keep it. The rate is locked.' },
      { who: 'auto', title: 'Billing and the ledger', detail: 'Every payment is split net of card fees and your share accrues to the ledger the payout run pays from.' },
    ],
    result: {
      title: `${closerShare} of every month's net rent, for as long as you are the rep on the account`,
      detail: 'Not a first-month bonus. You stay the person they call about renewals and changes; hand the account back and the residual goes with it.',
    },
  },
  website: {
    key: 'website',
    caption: 'The free website build — the somewhere-to-send a no',
    steps: [
      { who: 'rep', title: 'Spot a business with no website', detail: 'The no-website table on your page, or a sweep where you are standing.' },
      { who: 'rep', title: 'Build it from their listing', detail: 'One click. Their name, hours, phone and photos — nothing invented about a business we have never spoken to.' },
      { who: 'rep', title: 'Hand them the claim link', detail: 'Text it or leave the card. The link carries your code so the site is attributed to you.' },
      { who: 'business', title: 'They claim it, free', detail: 'The site goes live under their own name the moment they do, with no card and no call.' },
      { who: 'business', title: 'Self-serve from there', detail: 'A custom domain and the managed tier are on the post-claim page; they buy or they do not.' },
    ],
    result: {
      title: 'A live site under their name — and no rep commission on it',
      detail: 'A commission here would not cover the call that sold it, so it is self-serve by design. Its value to you is the warm door: a business you helped, that you can call about the rental when it fits.',
    },
  },
};
