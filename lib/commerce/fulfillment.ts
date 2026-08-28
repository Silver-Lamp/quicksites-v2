// lib/commerce/fulfillment.ts
//
// Where an order is in the KITCHEN — deliberately separate from where it is in the MONEY.
//
// ⚠️ `orders.status` IS PAYMENT. `orders.fulfillment_status` IS FOOD. Conflating them is the classic
// version of this bug: `paid` tells you Stripe captured, and says nothing about whether anyone has
// started cooking. A single column forces one of the two facts to be a lie the moment a paid order
// sits unmade — and the one that gets lost is always the operational one, because the money path is
// the one with tests.
//
// ⚠️ THIS IS NOT A STRICT STATE MACHINE, AND THAT IS THE DESIGN. Real kitchens go backwards: an order
// is marked ready, the wrong bag goes out, it returns to preparing. Software that refuses the
// correction does not prevent the mistake — it makes the screen disagree with the counter, and once
// that happens people stop updating the screen. So every transition is allowed; what the system owes
// is an honest record of when each one happened, not a veto.
export const FULFILLMENT_STATES = ['new', 'preparing', 'ready', 'completed', 'cancelled'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATES)[number];

export const DEFAULT_FULFILLMENT: FulfillmentStatus = 'new';

export function isFulfillmentStatus(v: unknown): v is FulfillmentStatus {
  return typeof v === 'string' && (FULFILLMENT_STATES as readonly string[]).includes(v);
}

/** Human label for the merchant screen. */
export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  completed: 'Picked up',
  cancelled: 'Cancelled',
};

/**
 * The timestamp column a transition stamps, if any.
 *
 * ⚠️ Each transition OVERWRITES its stamp rather than keeping first-touch. If an order goes
 * ready → preparing → ready, the second `ready_at` is when the food was actually collectable; the
 * first one describes a moment that turned out not to be true. Ticket-time measured from a
 * retracted milestone would quietly flatter us, and the whole reason for these columns is to find
 * out how long orders really take.
 */
export function stampFor(
  status: FulfillmentStatus
): 'accepted_at' | 'ready_at' | 'completed_at' | null {
  if (status === 'preparing') return 'accepted_at';
  if (status === 'ready') return 'ready_at';
  if (status === 'completed') return 'completed_at';
  return null;
}

export type Action = { to: FulfillmentStatus; label: string; primary?: boolean };

/**
 * What the merchant can do next. Ordered so the PRIMARY action is the one they want 95% of the
 * time — a kitchen screen is operated with flour on your hands and no time to read.
 */
export function nextActions(current: FulfillmentStatus): Action[] {
  switch (current) {
    case 'new':
      return [
        { to: 'preparing', label: 'Start preparing', primary: true },
        { to: 'cancelled', label: 'Cancel' },
      ];
    case 'preparing':
      return [
        { to: 'ready', label: 'Ready for pickup', primary: true },
        { to: 'new', label: 'Undo' },
        { to: 'cancelled', label: 'Cancel' },
      ];
    case 'ready':
      return [
        { to: 'completed', label: 'Picked up', primary: true },
        { to: 'preparing', label: 'Back to preparing' },
      ];
    case 'completed':
      // Reopening a finished order is rare but real — handed to the wrong customer.
      return [{ to: 'ready', label: 'Reopen' }];
    case 'cancelled':
      return [{ to: 'new', label: 'Reinstate' }];
  }
}

/** Terminal for display purposes only — never used to refuse a transition (see the header). */
export function isSettled(s: FulfillmentStatus): boolean {
  return s === 'completed' || s === 'cancelled';
}

/**
 * Minutes between two stamps, or null when either is missing.
 * Null means "we cannot say", which is different from zero and must never render as "0 min".
 */
export function minutesBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const t0 = Date.parse(a);
  const t1 = Date.parse(b);
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return Math.max(0, Math.round((t1 - t0) / 60000));
}

/** The patch to apply for a transition. Pure — the caller owns the write. */
export function transitionPatch(to: FulfillmentStatus, nowIso: string): Record<string, string> {
  const patch: Record<string, string> = { fulfillment_status: to };
  const stamp = stampFor(to);
  if (stamp) patch[stamp] = nowIso;
  return patch;
}
