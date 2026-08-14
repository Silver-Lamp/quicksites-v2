// lib/garageSales/payLinks.ts
//
// Hand a buyer off to the SELLER'S OWN payment app with the amount pre-filled.
//
// This is the whole payments design for garage sales v1, and the reason it isn't Stripe Connect
// is worth stating where the code lives: routing money to someone means verifying them, and
// Connect Express onboarding asks a person for their legal name, date of birth, last four of
// their SSN and a bank account — at the moment they are standing in their driveway trying to
// sell a lamp. The first payout then lands days later. For a two-day sale of $1–20 items that
// trade is terrible, and the platform fee we'd earn on it rounds to nothing.
//
// So: we never touch the money. We store a public handle, build a link, and get out of the way.
// The seller keeps 100%, there is no onboarding, no payout to wait for, and no credential of
// theirs in our database worth stealing. Connect becomes an opt-in upgrade for the seller doing
// this every weekend — a column, not a rewrite.
//
// ⚠️ VERIFY ON A REAL PHONE BEFORE PROMISING ANY OF THESE IN MARKETING COPY. These URL shapes are
// widely used but they are third-party surfaces that change without notice, and behaviour differs
// between mobile (app handoff) and desktop (web, often ignoring the amount). The UI therefore
// presents the amount as text next to the button as well as inside the link — see note below.

export type PaymentHandles = {
  venmo?: string | null;
  cashapp?: string | null;
  paypal?: string | null;
};

export type PayLink = {
  provider: 'venmo' | 'cashapp' | 'paypal';
  label: string;
  url: string;
  /**
   * Whether the amount is carried IN the link. When false the buyer must type it, so the UI
   * must show the amount prominently rather than relying on the app to fill it in.
   */
  carriesAmount: boolean;
};

/** Strip the decoration people paste: @name, $tag, full profile URLs. */
export function normalizeHandle(provider: keyof PaymentHandles, raw: string | null | undefined): string | null {
  let h = (raw || '').trim();
  if (!h) return null;
  h = h.replace(/^https?:\/\/(www\.)?(venmo\.com|cash\.app|paypal\.me|www\.paypal\.me)\//i, '');
  h = h.replace(/^[@$]/, '').replace(/\/+$/, '').trim();
  // A handle with a space or a slash left in it is someone's display name or a broken paste,
  // not a username. Better to store nothing than to build a link that 404s at the till.
  if (!h || /[\s/?#]/.test(h)) return null;
  return h;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Build the pay-links for a total, in the order they should be offered.
 * `amountCents` may be 0/undefined for a "pay what we agreed" handoff.
 */
export function buildPayLinks(handles: PaymentHandles, amountCents?: number | null, note?: string): PayLink[] {
  const amount = amountCents && amountCents > 0 ? round2(amountCents / 100) : null;
  const amt = amount != null ? amount.toFixed(2) : null;
  const n = (note || '').slice(0, 80);
  const links: PayLink[] = [];

  const venmo = normalizeHandle('venmo', handles.venmo);
  if (venmo) {
    // Venmo's web profile link with txn params. On a phone this hands off to the app.
    const q = new URLSearchParams({ txn: 'pay', ...(amt ? { amount: amt } : {}), ...(n ? { note: n } : {}) });
    links.push({ provider: 'venmo', label: 'Venmo', url: `https://venmo.com/${encodeURIComponent(venmo)}?${q}`, carriesAmount: !!amt });
  }

  const cashapp = normalizeHandle('cashapp', handles.cashapp);
  if (cashapp) {
    // Cash App takes the amount as a PATH segment: cash.app/$tag/40
    links.push({
      provider: 'cashapp',
      label: 'Cash App',
      url: `https://cash.app/$${encodeURIComponent(cashapp)}${amt ? `/${amt}` : ''}`,
      carriesAmount: !!amt,
    });
  }

  const paypal = normalizeHandle('paypal', handles.paypal);
  if (paypal) {
    links.push({
      provider: 'paypal',
      label: 'PayPal',
      url: `https://paypal.me/${encodeURIComponent(paypal)}${amt ? `/${amt}` : ''}`,
      carriesAmount: !!amt,
    });
  }

  return links;
}

/** True when the seller has given us at least one usable way to be paid. */
export function hasAnyHandle(handles: PaymentHandles): boolean {
  return buildPayLinks(handles, null).length > 0;
}
