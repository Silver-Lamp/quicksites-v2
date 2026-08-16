// lib/payments/venmo.ts
//
// Venmo as a "pay the owner directly" option, deliberately OUTSIDE the commerce path.
//
// ⚠️ THIS TAKES NO FEE AND CREATES NO ORDER, AND BOTH HALVES OF THAT ARE THE POINT.
// A lemonade stand is $3 and a garage sale is cash-plus-whatever; routing that through Stripe
// Connect to collect 5% of $3 is not a business, it is a rounding error with onboarding
// attached. So this is a link to the seller's own Venmo, and the platform is not a party to it.
//
// The honesty consequence is the part to hold on to: we cannot see whether the customer paid.
// There is no order row, no receipt, no refund path, and no inventory decrement. Any UI built
// on this must say the site is not processing the payment — otherwise a seller reasonably
// assumes we recorded something we never saw, and a buyer assumes they have a receipt from us.
// Rendering a payment method implies a payment record unless you say otherwise.
//
// We also never encode an amount. Venmo's web profile link does not reliably carry one across
// platforms, and a link that silently drops a prefilled amount is worse than one that never
// promised it — the buyer sends whatever was already in the box.

/** Venmo usernames: 5–30 chars, letters/digits/hyphen/underscore. */
const HANDLE_RE = /^[A-Za-z0-9_-]{5,30}$/;

/**
 * Accept what a person actually pastes — `@name`, `venmo.com/u/name`, a full URL, or the bare
 * handle — and return the bare handle, or null when it isn't one.
 *
 * Returning null rather than a best guess is deliberate: this string addresses someone's money.
 * A handle we "cleaned up" into a different valid handle sends a stranger the payment.
 */
export function normalizeVenmoHandle(input: string | null | undefined): string | null {
  let s = String(input ?? '').trim();
  if (!s) return null;

  // Strip a URL form, with or without scheme, with or without the /u/ segment.
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (/^venmo\.com\//i.test(s)) {
    s = s.replace(/^venmo\.com\//i, '').replace(/^u\//i, '');
  }
  s = s.split(/[/?#]/)[0];        // drop any path/query/fragment remainder
  s = s.replace(/^@+/, '');       // a leading @ (or several) is how people write it

  return HANDLE_RE.test(s) ? s : null;
}

/** The seller's public Venmo profile — the one target that works on web and in-app. */
export function venmoProfileUrl(handle: string | null | undefined): string | null {
  const h = normalizeVenmoHandle(handle);
  return h ? `https://venmo.com/u/${h}` : null;
}

/** Read the configured handle off a template's data blob. Null when unset or invalid. */
export function readVenmoHandle(data: any): string | null {
  const raw =
    data?.meta?.payments?.venmo ??
    data?.meta?.payments?.venmo_handle ??
    null;
  return normalizeVenmoHandle(raw);
}

/** Write the handle into a template data blob (pure). Passing null/invalid clears it. */
export function writeVenmoHandle(data: any, input: string | null | undefined): any {
  const handle = normalizeVenmoHandle(input);
  const meta = data?.meta ?? {};
  const payments = { ...(meta.payments ?? {}) };
  if (handle) payments.venmo = handle;
  else delete payments.venmo;
  return { ...(data ?? {}), meta: { ...meta, payments } };
}
