// lib/garageSales/address.ts
//
// What a stranger is allowed to see about where a sale is, and when.
//
// ⚠️ THIS IS THE ONE PLACE THE PRECISE ADDRESS IS ALLOWED TO LEAVE THE DATABASE. Every public
// read of a sale must go through `publicAddress()`. RLS decides which ROWS are readable; it
// cannot decide which FIELDS, so if a route selects `address_line` and hands the row to a page,
// the precise address is public a week early and nothing fails.
//
// Why it matters, stated plainly because it is easy to wave off: a cardboard sign on a corner is
// seen by people driving past it on the day. A searchable, queryable listing that says "there
// will be cash and strangers at this exact address on Saturday morning" is a different object
// with a different audience, available a week in advance to anyone who asks. The seller who
// staked a sign in their yard agreed to the first thing. Most of them have never considered the
// second, so the default withholds the house number until the morning of, and a seller who HAS
// considered it can choose 'exact'.
//
// The block label is not a downgrade of the address — it is a genuinely useful thing to publish.
// "400 block of Elm St, Saturday 8am" is enough to plan a route, which is what a shopper reading
// a directory in advance is actually doing.

export type SaleAddressFields = {
  address_line?: string | null;
  block_label?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  address_precision?: string | null;
  address_public_from?: string | null;
  starts_at?: string | null;
};

export type PublicAddress = {
  /** The line to show. Either the precise address or the block label. */
  line: string | null;
  city: string | null;
  state: string | null;
  /** True when `line` is the exact street address. */
  exact: boolean;
  /** Set when the address is still withheld — what to tell the shopper. */
  revealsAt: string | null;
};

/**
 * Derive the block label from a street address: "412 Elm St" → "400 block of Elm St".
 * Returns null when there's no leading house number to round, which is the honest outcome —
 * a made-up block for "Apt 4, The Old Mill" would be worse than showing the street alone.
 */
export function blockLabelFor(addressLine: string | null | undefined): string | null {
  const s = (addressLine || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d+)\s+(.*)$/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  const street = m[2].trim();
  if (!Number.isFinite(num) || !street) return null;
  const block = num < 100 ? 0 : Math.floor(num / 100) * 100;
  return `${block} block of ${street}`;
}

/** Has the reveal moment passed? */
function revealed(f: SaleAddressFields, now: Date): boolean {
  if ((f.address_precision ?? 'block') === 'exact') return true;
  const from = f.address_public_from ? new Date(f.address_public_from) : null;
  // No explicit reveal time set → fall back to the sale's own start. A sale that has begun is
  // one people are already walking up to; withholding the number then helps nobody.
  const at = from ?? (f.starts_at ? new Date(f.starts_at) : null);
  if (!at || Number.isNaN(at.getTime())) return false;
  return now >= at;
}

/**
 * The address as a stranger may see it. Pure — pass `now` in tests.
 *
 * Never returns `address_line` before the reveal moment, regardless of what the caller selected
 * from the database.
 */
export function publicAddress(f: SaleAddressFields, now: Date = new Date()): PublicAddress {
  const city = f.city ?? null;
  const state = f.state ?? null;

  if (revealed(f, now)) {
    return {
      line: (f.address_line ?? null) || f.block_label || null,
      city,
      state,
      exact: !!f.address_line,
      revealsAt: null,
    };
  }

  const block = f.block_label || blockLabelFor(f.address_line);
  return {
    line: block,
    city,
    state,
    exact: false,
    revealsAt: f.address_public_from ?? f.starts_at ?? null,
  };
}

/** Columns a PUBLIC query may select. Importing this beats remembering the rule at each call site. */
export const PUBLIC_SALE_COLUMNS =
  'id, title, description, block_label, city, state, postal_code, lat, lng, starts_at, ends_at, address_precision, address_public_from, payment_handles, sticker_code';

/**
 * Columns a public query may select WHEN it will project through `publicAddress()`.
 * Separate from the constant above so that selecting the precise address is a visible, deliberate
 * act at the call site rather than something that rides along in a `select('*')`.
 */
export const PUBLIC_SALE_COLUMNS_WITH_ADDRESS = `${PUBLIC_SALE_COLUMNS}, address_line`;
