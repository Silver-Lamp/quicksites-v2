// lib/outreach/mail/postcardCost.ts
//
// Pure cost estimation for a Lob postcard batch — so an operator sees the spend BEFORE
// confirming a paid send. These are ESTIMATES (Lob's real per-piece price varies by
// volume tier + postage class); override the defaults with LOB_POSTCARD_UNIT_CENTS when
// you know your negotiated rate. Never used to bill — display only.

export type PostcardSize = '4x6' | '6x9' | '6x11';

// Rough list prices (US, cents/piece) at low volume, standard postage. Deliberately on
// the high side so a shown estimate doesn't undersell the real Lob invoice.
const DEFAULT_UNIT_CENTS: Record<PostcardSize, number> = {
  '4x6': 77,
  '6x9': 116,
  '6x11': 155,
};

/** Per-piece estimate in cents for a size — LOB_POSTCARD_UNIT_CENTS overrides all sizes. */
export function postcardUnitCents(size: PostcardSize = '6x9'): number {
  const override = Number(process.env.LOB_POSTCARD_UNIT_CENTS);
  if (Number.isFinite(override) && override > 0) return Math.round(override);
  return DEFAULT_UNIT_CENTS[size] ?? DEFAULT_UNIT_CENTS['6x9'];
}

/** Estimated total cents for `count` pieces at `size`. */
export function estimatePostcardCents(count: number, size: PostcardSize = '6x9'): number {
  return Math.max(0, Math.round(count)) * postcardUnitCents(size);
}
