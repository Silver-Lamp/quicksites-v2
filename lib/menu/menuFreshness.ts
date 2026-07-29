// lib/menu/menuFreshness.ts
//
// How old is this menu, and can we still stand behind its prices?
//
// DeckSketch's point, from their own scar: `/compare`'s credibility rests on `PRICES_VERIFIED`
// plus a staleness sweep, because a stale competitor price is a lie with your name on it. A
// menu is the same claim about someone else's business, with an extra problem — it's a claim
// about a business that never asked us to make it.
//
// The specific risk: Eyman's 32 items were OCR'd from a photograph of unknown age. A diner
// reads "$13.00", calls, and is told $16. They blame the restaurant, and the restaurant is
// annoyed at a site they never agreed to.
//
// ⚠️ WHEN IN DOUBT, DROP THE PRICE, NOT THE DISH. A menu with "call to confirm" is still
// useful — the diner learns the kitchen serves the thing they want, which is the whole job of
// the directory. A menu with a wrong price is worse than no menu. And an UNKNOWN verified date
// counts as stale: we cannot stand behind a number whose age we don't know.

/** Prices older than this are no longer shown as fact. Menus reprice seasonally. */
export const PRICE_TRUST_DAYS = 90;

/** Items older than this are likely gone entirely, not just repriced. */
export const ITEM_TRUST_DAYS = 365;

export type MenuFreshness = {
  /** null when the menu carries no verified date at all. */
  verifiedAt: Date | null;
  ageDays: number | null;
  /** Prices should be replaced with "call to confirm". */
  pricesStale: boolean;
  /** The menu itself is old enough to warn about. */
  menuStale: boolean;
};

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Read the verified date off a menu block's content.
 *
 * Accepts several spellings because menus arrive from three paths — OCR from a photo, an
 * operator menu run, and a claimed owner editing directly — and the fleet already proves that
 * two spellings of one field is the normal state of affairs here, not the exception.
 */
export function readVerifiedAt(menuContent: any): Date | null {
  return (
    parseDate(menuContent?.verified_at) ??
    parseDate(menuContent?.verifiedAt) ??
    parseDate(menuContent?.sourced_at) ??
    null
  );
}

export function assessFreshness(menuContent: any, now: Date = new Date()): MenuFreshness {
  const verifiedAt = readVerifiedAt(menuContent);
  if (!verifiedAt) {
    // Unknown age is NOT fresh. Treating it as fresh is how a photographed menu of unknown
    // vintage ends up quoted as fact.
    return { verifiedAt: null, ageDays: null, pricesStale: true, menuStale: false };
  }
  const ageDays = Math.floor((now.getTime() - verifiedAt.getTime()) / 86_400_000);
  return {
    verifiedAt,
    ageDays,
    pricesStale: ageDays >= PRICE_TRUST_DAYS,
    menuStale: ageDays >= ITEM_TRUST_DAYS,
  };
}

/**
 * What to render where a price would go.
 *
 * Returns the price when we can stand behind it, otherwise the honest fallback. Callers should
 * not re-implement this — the whole point is that one rule decides when a number is shown.
 */
export function priceOrConfirm(price: string | undefined, f: MenuFreshness): string {
  if (!price) return '';
  return f.pricesStale ? 'call to confirm' : price;
}

/** One short line for the menu header, or null when the menu is fresh and dated. */
export function freshnessNote(f: MenuFreshness): string | null {
  if (f.menuStale) return 'This menu is over a year old — call to confirm before ordering.';
  if (f.verifiedAt == null) return 'Prices unconfirmed — call to check before ordering.';
  if (f.pricesStale) return 'Prices last checked a while ago — call to confirm.';
  return null;
}
