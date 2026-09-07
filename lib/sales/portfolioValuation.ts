// lib/sales/portfolioValuation.ts
//
// What the page-one inventory would be worth if every qualifying domain were rented.
//
// ⚠️ THIS IS A CAPACITY FIGURE, NOT A FORECAST, AND THE DISTINCTION IS THE WHOLE POINT. It answers
// "what is the ceiling of the inventory we can currently prove" — not what anyone will pay, not a
// pipeline, and emphatically not revenue. Nobody outside the company has ever rented one of these,
// so `rentedToday` travels with every total; a valuation shown without it is the number quietly
// pretending to be ARR.
//
// Rates come from priceTier() and the economics from splitRentalPayment(), both imported rather
// than restated — the house share is the REMAINDER after the closer and manager, not 35% of gross,
// and card fees come off before any share is taken.

import type { RateCardRow } from '@/lib/sales/rateCard';
import { splitRentalPayment, type SplitVariant } from '@/lib/commerce/rentalSplits';

export type PortfolioValuation = {
  /** Domains holding page one for their own city+trade phrase. */
  provenCount: number;
  /** Of those, the ones with nothing hard-stopping a pitch (a phone, a service area). */
  pitchableCount: number;
  /** Every proven domain rented at its page-one list rate. The ceiling. */
  grossAtListCents: number;
  /** Every proven domain rented at the founder rate — what early sales actually lock in. */
  grossAtFounderCents: number;
  /** What reaches the house monthly at list, after card fees and both commissions. */
  houseAtListCents: number;
  houseAtFounderCents: number;
  /** Annualised gross at list. Twelve times a monthly ceiling, and no more meaningful than that. */
  annualAtListCents: number;
  /** ⚠️ The anchor. Every figure above is hypothetical while this is zero. */
  rentedToday: number;
  /** Per-domain detail so a reader can see the concentration rather than trust a total. */
  lines: { host: string; listCents: number; founderCents: number; pitchable: boolean }[];
};

export function valuePortfolio(
  rows: RateCardRow[],
  opts: { rentedToday?: number; variant?: SplitVariant } = {},
): PortfolioValuation {
  const proven = rows.filter((r) => r.qualifies);
  const variant = opts.variant ?? 'standard';

  const lines = proven.map((r) => ({
    host: r.host,
    listCents: r.fullCents,
    founderCents: r.lockedCents,
    pitchable: r.pitchable,
  }));

  const grossAtListCents = lines.reduce((a, l) => a + l.listCents, 0);
  const grossAtFounderCents = lines.reduce((a, l) => a + l.founderCents, 0);

  // Split PER RENTAL, then sum. Stripe's fixed 30c is charged per transaction, so splitting one
  // combined total would understate the fee by 30c for every domain after the first.
  const houseAtListCents = lines.reduce((a, l) => a + splitRentalPayment(l.listCents, variant).houseCents, 0);
  const houseAtFounderCents = lines.reduce((a, l) => a + splitRentalPayment(l.founderCents, variant).houseCents, 0);

  return {
    provenCount: proven.length,
    pitchableCount: proven.filter((r) => r.pitchable).length,
    grossAtListCents,
    grossAtFounderCents,
    houseAtListCents,
    houseAtFounderCents,
    annualAtListCents: grossAtListCents * 12,
    rentedToday: Math.max(0, Math.round(Number(opts.rentedToday) || 0)),
    lines: lines.sort((a, b) => b.listCents - a.listCents),
  };
}
