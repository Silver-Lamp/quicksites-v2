// lib/collab/lastActivity.ts
//
// When this page last actually changed.
//
// ⚠️ WHY NOT `client_collabs.updated_at`. There is no trigger maintaining it (see
// 20260815_client_collabs.sql — it is `default now()` and nothing writes it), so it records when
// the row was created and calls that an update. A "last updated" stamp that is quietly the
// creation date is worse than no stamp: it is a specific false claim rather than a silence.
//
// ⚠️ WHY THE STAMP EXISTS AT ALL (PorchHearth, cold mesh poll 2026-08-04). The link is forwardable
// and has no login. Opened three weeks later it looks current, because nothing on the page says
// otherwise. The option screenshots are already dated for the same reason; this dates the page.
//
// So it is derived from the artefacts a visitor can actually see changing: the newest message, the
// newest option version, the newest preview capture. Never later than "now" — a future timestamp
// from a clock-skewed row would render as a page updated tomorrow.

/** All inputs are ISO strings or null; anything unparseable is ignored rather than throwing. */
export function lastActivityAt(candidates: Array<string | null | undefined>): string | null {
  let best: number | null = null;
  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!Number.isFinite(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}
