// lib/menu/previewOrder.ts
//
// PREVIEW ordering for an exhibit: the Evolve page frames an unclaimed draft beside the
// restaurant's current site, and the owner needs to SEE ordering work — add a dish, see a total,
// press the order button — without any money moving, any order being recorded, or any demand
// event being logged against a business that did not ask for it.
//
// Rules, all pinned by lib/menu/__tests__/previewOrder.test.ts:
//   • Only where the draft is framed as an exhibit (?exhibit=1) and only for items that are NOT
//     already orderable (no catalog_item_id). Real ordering is untouched.
//   • The last step says, in words, that nothing was charged and ordering switches on when the
//     owner takes the site. It never says "order placed", never asks for a card.
//   • Totals come from the menu's own prices; an item without a price adds at zero and is
//     labelled "price to confirm" — never a guessed number.

export type PreviewLine = { key: string; name: string; priceCents: number | null; qty: number; option?: string | null };

export function parsePriceCents(input: { price_cents?: number | null; price?: string | null }): number | null {
  if (typeof input.price_cents === 'number' && Number.isFinite(input.price_cents)) return Math.max(0, Math.round(input.price_cents));
  const m = String(input.price ?? '').replace(',', '.').match(/\d+(?:\.\d{1,2})?/);
  if (!m) return null;
  return Math.round(parseFloat(m[0]) * 100);
}

export function centsLabel(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export function previewTotals(lines: PreviewLine[]): { count: number; subtotalCents: number; unpriced: number } {
  let count = 0;
  let subtotalCents = 0;
  let unpriced = 0;
  for (const l of lines) {
    count += l.qty;
    if (l.priceCents == null) unpriced += l.qty;
    else subtotalCents += l.priceCents * l.qty;
  }
  return { count, subtotalCents, unpriced };
}

export function addLine(lines: PreviewLine[], line: Omit<PreviewLine, 'qty'>): PreviewLine[] {
  const i = lines.findIndex((l) => l.key === line.key);
  if (i >= 0) return lines.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
  return [...lines, { ...line, qty: 1 }];
}

export function changeQty(lines: PreviewLine[], key: string, delta: number): PreviewLine[] {
  return lines.map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0);
}

/** Every sentence the preview cart shows. The test holds these to the honesty rules above. */
export const PREVIEW_COPY = {
  fab: (count: number, subtotal: string) => `Your order · ${count} · ${subtotal}`,
  title: 'Your order',
  empty: 'Add a dish from the menu to see how ordering works.',
  unpriced: 'price to confirm',
  subtotal: 'Subtotal',
  orderButton: 'Order ahead for pickup',
  doneTitle: 'This is where a customer would pay — and you would hear about it',
  doneBody: [
    'Nothing was charged and no order was sent. This is a preview.',
    'When ordering is switched on, the customer pays by card here, the money goes to a payment account in your name, and you get a text and an email with the items the moment it is paid.',
    'Ordering switches on when you take the site. The button for that is on the page around this one.',
  ],
  close: 'Close',
  back: 'Back to the order',
  previewBadge: 'Preview — nothing is charged',
} as const;
