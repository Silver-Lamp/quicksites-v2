// lib/outreach/candidates.ts
//
// Who is eligible for a hand-written outreach message, and — just as important — who is NOT,
// with the reason attached.
//
// ⚠️ THIS IS THE CLERICAL HALF ONLY, AND THE SPLIT IS DELIBERATE.
// `docs/OUTREACH_FIVE.md` carries a standing rule: **do not build a tool for this.** That rule is
// about the part that matters — the message. A generator that writes the copy destroys the exact
// thing under test, because "built from their own words" is the product and templating is the first
// thing that kills it.
//
// Qualifying a list is a different act. Nobody's judgement improves by hand-counting menu items
// across 26 JSON blobs, and doing it by eye is how the eleven placeholder drafts nearly went out.
// So: **the machine says who you MAY write to; a person still decides what to say.** Anything in
// this file that starts drafting prose is a bug in the design, not a feature.
//
// ⚠️ THE FAILURE THIS EXISTS TO PREVENT. 26 unclaimed drafts look like 26 prospects. Eleven of them
// carry the food scaffold's INVENTED menu under a real restaurant's name (#738). Sending one means
// telling a real business we built them a page, where the page shows food they do not serve. That is
// the worst artifact this pipeline can produce, and it is invisible unless you check every draft.
// Hence `disqualify` returns a REASON rather than a boolean — a filtered-out row you cannot explain
// is one you will eventually un-filter by accident.
import { readMenuSections, isPlaceholderOnly, type MenuSection } from '../menu/menuBlocks';

/** Below this, there is not enough of their own material for the page to look like theirs. */
export const MIN_MENU_ITEMS = 8;

export type CandidateInput = {
  id: string;
  slug: string | null;
  template_name: string | null;
  data: any;
};

export type DisqualifyReason =
  | 'placeholder-menu'
  | 'no-phone'
  | 'menu-too-thin'
  | 'no-menu'
  | 'already-contacted';

export type Candidate = {
  id: string;
  slug: string | null;
  name: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  items: number;
  sections: number;
  /** null = eligible. */
  disqualified: DisqualifyReason | null;
};

function contactOf(data: any): any {
  return data?.meta?.contact ?? {};
}

export function countItems(sections: MenuSection[]): number {
  return sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);
}

/**
 * Why this draft may not be written to, or null if it may.
 *
 * ⚠️ ORDER MATTERS AND IS NOT ARBITRARY. `placeholder-menu` is checked FIRST, before the phone,
 * because it is the disqualifier that describes a defect in OUR artifact rather than a gap in our
 * data. A draft reported as "no phone" reads as "find a phone number and proceed" — which for one of
 * the eleven would be exactly the wrong next step.
 */
export function disqualify(
  input: CandidateInput,
  opts: { contactedIds?: Set<string> } = {},
): DisqualifyReason | null {
  if (opts.contactedIds?.has(input.id)) return 'already-contacted';
  const sections = readMenuSections(input.data);
  if (!sections.length) return 'no-menu';
  if (isPlaceholderOnly(sections)) return 'placeholder-menu';
  const phone = contactOf(input.data).phone;
  if (!phone || !String(phone).trim()) return 'no-phone';
  if (countItems(sections) < MIN_MENU_ITEMS) return 'menu-too-thin';
  return null;
}

export function toCandidate(
  input: CandidateInput,
  opts: { contactedIds?: Set<string> } = {},
): Candidate {
  const sections = readMenuSections(input.data);
  const c = contactOf(input.data);
  return {
    id: input.id,
    slug: input.slug,
    name: input.template_name,
    phone: c.phone ?? null,
    city: c.city ?? null,
    address: c.address ?? null,
    items: countItems(sections),
    sections: sections.length,
    disqualified: disqualify(input, opts),
  };
}

/**
 * Eligible candidates, richest menu first.
 *
 * Menu size is the ranking key because it is the variable under test: more of their own material
 * means the page looks more like *theirs*, which is the whole hypothesis. It is NOT a quality score
 * — a thin menu with a striking flaw makes a better message than a fat one with nothing to say.
 */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => !c.disqualified).sort((a, b) => b.items - a.items);
}

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Weekdays the hours block does not mention at all.
 *
 * A day that is absent is NOT the same as a day marked closed, and that distinction is the whole
 * value: absent means we do not know, which is a question worth asking an owner ("Monday isn't
 * there — are you closed, or did I miss it?"). It made the strongest hook in batch 2.
 *
 * ⚠️ `days` IS AN ARRAY OF `{ key, label, closed }`, NOT AN OBJECT. The first version called
 * `Object.keys(days)`, got `"0".."6"`, matched no weekday name, and reported EVERY day missing on a
 * restaurant open seven days a week. A check that fires on correct data is worse than no check —
 * it teaches you to skim past its output, which is how the one real Monday gap would have been lost
 * in six false ones.
 */
export function missingWeekdays(hoursBlockContent: any): string[] {
  const days = hoursBlockContent?.days;
  if (!Array.isArray(days)) return [];
  const present = new Set(
    days
      .filter((d: any) => d && d.closed !== true)
      .map((d: any) => String(d.key ?? d.label ?? '').slice(0, 3).toLowerCase()),
  );
  return WEEKDAY_KEYS.filter((k) => !present.has(k));
}

/** Counts by disqualifier, so the gap between "drafts we hold" and "people we may write to" is loud. */
export function summarizeExclusions(candidates: Candidate[]): {
  total: number;
  eligible: number;
  byReason: Record<string, number>;
} {
  const byReason: Record<string, number> = {};
  let eligible = 0;
  for (const c of candidates) {
    if (!c.disqualified) eligible++;
    else byReason[c.disqualified] = (byReason[c.disqualified] ?? 0) + 1;
  }
  return { total: candidates.length, eligible, byReason };
}
