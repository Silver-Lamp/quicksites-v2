// lib/commerce/menuPrice.ts
//
// Menu prices are freeform display strings ("$14", "14.00", "MP", "14/18") because
// they come from scraping/AI. Ordering needs integer cents. These convert both ways.
// The owner confirms the parsed price before anything becomes chargeable — this is
// only the pre-fill / display layer, never the checkout price authority (that stays
// server-side in authorizeCheckoutItems, repricing from catalog_items.price_cents).

/** Parse a display price into integer cents, or null if there's no usable number
 *  ("Market Price", "MP", "", "—"). A range ("14/18", "14-18") takes the first. */
export function parsePriceToCents(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100); // numbers are dollars
  }
  const s = String(input).trim();
  if (!s) return null;
  // For a range, price on the first value ("14/18" → 14, "$14 - $18" → 14).
  const firstToken = s.split(/[\/–—]|\s*-\s*/)[0];
  const cleaned = firstToken.replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const dollars = parseFloat(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

/** Cents → a clean display string ($14, $14.50). */
export function centsToDisplay(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents) || cents < 0) return '';
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}
