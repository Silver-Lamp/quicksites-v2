// lib/starterKit/starterKit.ts
//
// THE STARTER KIT: what a rep prints before walking into businesses. Pure — the page fetches,
// this decides what goes on paper. Owner's name for it, 2026-10-08, built for Abdou on Vashon.
//
// Three sheets, all letter-size, all keyed to the rep's referral code so every scan is theirs:
//   1. Business cards, 10-up — the thing left on a counter.
//   2. A leave-behind flyer — the one-page explanation for an owner who is busy right now.
//   3. One "your site is ready" sheet per draft we have already built in the rep's territory —
//      the preview address and a QR to the tracked claim link. This is the strongest sheet: it
//      is not a pitch, it is a thing that exists with their name on it.
//
// ⚠️ IT IS PAPER, AND PAPER CANNOT BE CAVEATED AFTER IT IS HANDED OVER. So it makes no promise
// the claim postcard may not make (lib/outreach/__tests__/claimPostcard.test.ts): no search
// engine, no ranking, no 24/7, no licensed/insured, no guarantee, no deadline, no competitor,
// and NO PRINTED PRICE — the fee follows the env and a number on a card outlives it. "Free"
// is true (hosting costs nothing; we earn a small cut on orders) and is the whole message.
//
// ⚠️ A DRAFT SHEET SAYS WHAT IS MISSING. Both Vashon drafts were built with no menu, because
// the listing photos held none and we never invent one (#738). The sheet says the menu and
// hours go in next, with the rep — which is the visit, not a defect.
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { trackedDraftClaimUrl } from '@/lib/outreach/claimPostcard';

export type StarterKitRep = {
  code: string;
  /** Display name — the code's label with any "(territory)" suffix removed. */
  name: string;
  /** Typed by the rep on the kit page; printed only when given. */
  phone: string | null;
  /** "Vashon Island" — the territory line on the cards. */
  territory: string | null;
};

export type StarterKitDraft = {
  prospectId: string;
  businessName: string;
  /** Where the draft can be seen right now. */
  previewUrl: string;
  /** Tracked claim link (/go/<prospectId>) — the QR target. Never visited by us. */
  claimUrl: string;
  /** True when the draft carries no menu/hours yet — the sheet says so. */
  needsMenu: boolean;
};

export type StarterKit = {
  rep: StarterKitRep;
  /** The referral link every card and flyer carries. */
  refUrl: string;
  /** The same, as it should be printed (no scheme). */
  refUrlPrinted: string;
  drafts: StarterKitDraft[];
  copy: typeof COPY;
};

/** "Abdou (Vashon Island)" → "Abdou"; "Daniel (DeckSketch)" → "Daniel". */
export function repNameFromLabel(label: string | null | undefined, code: string): string {
  const base = String(label ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return base || code;
}

/** "Abdou (Vashon Island)" → "Vashon Island"; nothing → null. */
export function territoryFromLabel(label: string | null | undefined): string | null {
  const m = String(label ?? '').match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

/** A phone as the rep typed it, kept only if it looks like one. */
export function printablePhone(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return null;
  const d = digits.length === 11 ? digits.slice(1) : digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function refUrlFor(code: string, base: string = publicBaseUrl()): string {
  return `${base.replace(/\/+$/, '')}/?ref=${encodeURIComponent(code)}`;
}

/** Strip the scheme for print: a QR carries the link; the text is for a human to type. */
export function printedUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

/**
 * Every sentence on the paper, in one place, so the forbidden-promise test reads them all.
 * Written for a business owner with thirty seconds, not for us.
 */
export const COPY = {
  brand: 'QuickSites',
  cardLine: 'A real website for your business. Free.',
  cardScan: 'Scan, or sign up with the code',
  flyerHeadline: "We'd like to build you a website. It's free.",
  flyerSub: 'A real site with your name on it — hours, menu or services, photos, a way to order or get in touch.',
  flyerBullets: [
    'It costs nothing to set up and nothing to keep. We only ever earn a small cut on orders placed through it.',
    'You own it. Edit it yourself, or ask and it gets done for you.',
    'If you already have a Facebook page or an old site, we build from what is already yours — your words, your photos.',
  ],
  flyerSteps: ['Scan the code or use the referral code below.', 'Tell us what you do and what you sell.', 'Your site is live the same day; add your menu or services whenever you like.'],
  flyerClose: 'Questions? Ask the person who handed you this.',
  draftHeadline: (name: string) => `${name}, your website is ready.`,
  draftSub: 'We built a first version from what is already public about you. Have a look:',
  draftNeedsMenu: 'Your menu and hours are not on it yet — they go in next, with you, in about ten minutes.',
  draftHasMenu: 'Check the details and tell us what to change.',
  draftClaim: 'Scan to make it yours',
  draftClaimSub: 'Claiming is free. It becomes your site, under your name, the moment you do.',
  draftFootnote: 'If you would rather it came down, say so and it does — no questions.',
} as const;

export function buildStarterKit(input: {
  code: string;
  label: string | null;
  phone?: string | null;
  territory?: string | null;
  drafts: Array<{ prospectId: string; businessName: string; previewUrl: string; needsMenu: boolean }>;
  baseUrl?: string;
}): StarterKit {
  const base = input.baseUrl ?? publicBaseUrl();
  const refUrl = refUrlFor(input.code, base);
  return {
    rep: {
      code: input.code,
      name: repNameFromLabel(input.label, input.code),
      phone: printablePhone(input.phone),
      territory: input.territory?.trim() || territoryFromLabel(input.label),
    },
    refUrl,
    refUrlPrinted: printedUrl(refUrl),
    drafts: input.drafts.map((d) => ({
      prospectId: d.prospectId,
      businessName: d.businessName,
      previewUrl: d.previewUrl,
      claimUrl: trackedDraftClaimUrl(d.prospectId, base),
      needsMenu: d.needsMenu,
    })),
    copy: COPY,
  };
}
