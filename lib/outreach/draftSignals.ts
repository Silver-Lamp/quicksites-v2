// lib/outreach/draftSignals.ts
//
// What is notable about a draft — the observations a person would otherwise find by reading a JSON
// blob.
//
// ⚠️ THIS RETURNS FACTS, NOT COPY, AND THAT LINE IS THE WHOLE DESIGN.
// Twenty hand-written outreach messages produced ~9 hooks a machine could have spotted (blank
// prices, sizes parsed as dishes, hours missing a weekday) and ~4 it could not (a Street View
// landmark, "tucked back on S 211th where nobody finds you by accident"). Detecting the first group
// is pure win: nobody's judgement improves by scanning 44 menu items for a pattern.
//
// Writing the sentence is the part that must NOT move here, and not for taste. These messages work —
// if they work — because they are visibly not templated. The moment a signal ships with a
// ready-made phrase, every message opens "Fair warning, I got something wrong", the hooks converge
// on whatever this file can detect, and the thing that made them land (a person actually looked)
// becomes a format. That is the template set docs/OUTREACH_FIVE.md exists to be the opposite of.
//
// So: `label` names the observation, `detail` gives the evidence, and neither is a sentence anyone
// would send. If a future change adds a `suggestedCopy` field, it has crossed the line this comment
// is here to hold.
//
// ⚠️ SECOND JOB, EQUALLY IMPORTANT: most of these signals are OUR parse failures, not their menu's
// quirks. Every one below was first found by a human reading a draft *after* it went live — the
// all-$14 taqueria, the blank-price birria place, the doubled `$`. Surfacing them on the operator
// screen is how a bad draft gets caught before an owner sees a page that misstates their prices.
import { readMenuSections, type MenuSection, type MenuItem } from '@/lib/menu/menuBlocks';

export type SignalKind =
  | 'no_prices'
  | 'partial_prices'
  | 'all_same_price'
  | 'odd_prices'
  | 'doubled_currency'
  | 'sizes_as_dishes'
  | 'packed_price'
  | 'undescribed_codes'
  | 'single_section'
  | 'day_named_items'
  | 'hours_missing_days';

export type Signal = {
  kind: SignalKind;
  /** 'defect' = probably wrong on OUR page. 'note' = true of their business, worth mentioning. */
  severity: 'defect' | 'note';
  label: string;
  detail: string;
};

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const WEEKDAY_WORDS = /^(mon|tues|wednes|thurs|fri|satur|sun)day\b/i;

function allItems(sections: MenuSection[]): MenuItem[] {
  return sections.flatMap((s) => s.items ?? []);
}

function priceOf(i: MenuItem): string {
  return String(i?.price ?? '').trim();
}

/**
 * A price is a price only if it contains a DIGIT.
 *
 * ⚠️ Taqueria Del Sol stores `"$"` — a currency symbol with nothing after it — for all 28 dishes.
 * Treating a non-empty string as "priced" made the detector report "every item is the same price:
 * $", which is both wrong and unreadable, and it hid the real finding (no prices came through at
 * all). A signal that mislabels real data is worse than a missing one: it gets believed.
 */
function hasPrice(i: MenuItem): boolean {
  return /\d/.test(priceOf(i));
}

/** Weekdays the hours block does not show. Absent ≠ closed — the caller must ask, not assume. */
export function missingWeekdays(hoursContent: any): string[] {
  const days = hoursContent?.days;
  if (!Array.isArray(days)) return [];
  const present = new Set(
    days
      .filter((d: any) => d && d.closed !== true)
      .map((d: any) => String(d.key ?? d.label ?? '').slice(0, 3).toLowerCase()),
  );
  return WEEKDAYS.filter((k) => !present.has(k));
}

function hoursContentOf(data: any): any {
  const page = data?.pages?.[0] ?? {};
  for (const b of [...(page.content_blocks ?? []), ...(page.blocks ?? [])]) {
    if (b?.type === 'hours') return b.content ?? b.props;
  }
  return null;
}

export function detectSignals(data: any): Signal[] {
  const sections = readMenuSections(data);
  const items = allItems(sections);
  const out: Signal[] = [];
  if (!items.length) return out;

  const priced = items.filter(hasPrice);
  const prices = priced.map(priceOf);

  // ── OUR parse failures ────────────────────────────────────────────────────────────────────
  if (priced.length === 0) {
    out.push({
      kind: 'no_prices',
      severity: 'defect',
      label: 'No prices came through',
      detail: `All ${items.length} items parsed without a price — the page shows "call to confirm" throughout.`,
    });
  } else if (priced.length < items.length * 0.5) {
    out.push({
      kind: 'partial_prices',
      severity: 'defect',
      label: 'Most items have no price',
      detail: `${items.length - priced.length} of ${items.length} items parsed without a price.`,
    });
  }

  // ⚠️ Needs >3 items. On a 2-item menu "everything costs the same" is a coincidence, not a bug —
  // a rule that fires there would cry wolf on correct data.
  if (prices.length > 3 && new Set(prices).size === 1) {
    out.push({
      kind: 'all_same_price',
      severity: 'defect',
      label: 'Every item is the same price',
      detail: `All ${prices.length} priced items read ${prices[0]} — almost certainly a parse failure.`,
    });
  }

  if (prices.some((p) => p.startsWith('$$'))) {
    out.push({
      kind: 'doubled_currency',
      severity: 'defect',
      label: 'Prices stored with a doubled "$"',
      detail: 'Latent: menuFreshness hides prices until an owner confirms them, so it is not visible yet.',
    });
  }

  // Money that is not a round menu price — tax already included, or a misread decimal.
  const odd = prices.filter((p) => /\d+\.\d{2}$/.test(p) && !/\.(00|25|49|50|75|95|99|45|29|79|89|59|39|19|09|69)$/.test(p));
  if (odd.length >= 2) {
    out.push({
      kind: 'odd_prices',
      severity: 'defect',
      label: 'Prices look tax-inclusive or misread',
      detail: `e.g. ${odd.slice(0, 3).join(', ')} — menu prices rarely end in these cents.`,
    });
  }

  // ⚠️ #1 Hawaiian BBQ stores BOTH sizes in one price field: "Mini 10.45 Reg. 12.95". The page then
  // shows it as a single price string, so a diner sees one unreadable number instead of two choices.
  // Found because the detector returned NOTHING for a draft whose hook I had already written by hand.
  const packed = prices.filter((p) => (p.match(/\d+(?:\.\d{2})?/g) ?? []).length >= 2);
  if (packed.length >= 2) {
    out.push({
      kind: 'packed_price',
      severity: 'defect',
      label: 'Two prices packed into one field',
      detail: `e.g. "${packed[0]}" — the size options read as a single price rather than a choice.`,
    });
  }

  const sizeNames = items.filter((i) =>
    /^(small|large|x-?large|extra large|mini|regular|reg\.?|sm|lg)$/i.test(String(i?.name ?? '').trim()),
  );
  if (sizeNames.length >= 2) {
    out.push({
      kind: 'sizes_as_dishes',
      severity: 'defect',
      label: 'Portion sizes parsed as their own dishes',
      detail: `${sizeNames.map((i) => i.name).slice(0, 4).join(', ')} appear as menu items rather than options.`,
    });
  }

  // ── True of their business, worth a human mentioning ──────────────────────────────────────
  const codes = items.filter(
    (i) => /^([#A-Z]?\d{1,2}|[A-Z]\d{1,2})\b/.test(String(i?.name ?? '').trim()) && !String(i?.description ?? '').trim(),
  );
  if (codes.length >= 3) {
    out.push({
      kind: 'undescribed_codes',
      severity: 'note',
      label: 'Numbered items with no description',
      detail: `${codes.length} items like ${codes.slice(0, 3).map((i) => i.name).join(', ')} — a stranger cannot tell what they are.`,
    });
  }

  if (sections.length === 1 && items.length >= 5) {
    out.push({
      kind: 'single_section',
      severity: 'note',
      label: 'Only one part of the menu came through',
      detail: `Everything sits under "${(sections[0] as any).name ?? 'one section'}" — the rest of their menu may be missing.`,
    });
  }

  const dayItems = items.filter((i) => WEEKDAY_WORDS.test(String(i?.name ?? '').trim()));
  if (dayItems.length >= 2) {
    out.push({
      kind: 'day_named_items',
      severity: 'note',
      label: 'Day-by-day specials',
      detail: `${dayItems.length} items are named for a weekday — information no listing carries.`,
    });
  }

  const missing = missingWeekdays(hoursContentOf(data));
  if (missing.length) {
    out.push({
      kind: 'hours_missing_days',
      severity: 'note',
      label: `Hours omit ${missing.join(', ')}`,
      detail: 'Absent is not the same as closed — ask, do not assume.',
    });
  }

  return out;
}

/** Defects first: those are wrong on a page an owner may be about to look at. */
export function sortSignals(signals: Signal[]): Signal[] {
  return [...signals].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'defect' ? -1 : 1));
}
