// lib/gsc/backfillGscProperties.ts
//
// Connect every campaign domain to Search Console, and keep doing it.
//
// ⚠️ WHY THIS IS NEEDED AT ALL. connectDomainToGsc already runs on the two paths that CREATE a
// domain (buy-list purchase, bulk-automate) — but 99 campaign domains predate that wiring, and the
// adopt path added later never called it. A domain that is not a Search Console property cannot be
// measured, so its campaign keeps the `unranked` column default forever, and every surface
// downstream reports that default as though someone had looked. Exactly one of 100 campaigns was
// connected when this was written.
//
// The work per domain is: ask Google for a DNS TXT token, publish it through Vercel DNS (our
// nameservers), verify, add the property. DNS propagation is asynchronous, so a first attempt very
// often lands `pending` — that is success-so-far, not failure, and the next run retries it.

import { connectDomainToGsc, verifyPendingGscDomain, bareDomain } from '@/lib/gsc/connectDomain';
import { hasGoogleVerificationTxt } from '@/lib/domains/vercel';

export type BackfillCandidate = { id: string; domain: string };

/**
 * Split candidates by whether Vercel hosts their DNS. The first run under a working grant
 * (2026-09-08) spent 6 of its 10 slots on domains that answered "not a DNS zone" — they sit on
 * Namecheap nameservers (or have none), and no amount of retrying will write a TXT there. Those
 * are reported once, by name, and never consume the nightly budget. 93 of 100 are on Vercel.
 */
export function partitionByZone(
  candidates: BackfillCandidate[],
  vercelZones: Set<string> | null,
): { onVercel: BackfillCandidate[]; offVercel: BackfillCandidate[] } {
  if (!vercelZones) return { onVercel: candidates, offVercel: [] }; // unknown → try them all, as before
  const onVercel: BackfillCandidate[] = [];
  const offVercel: BackfillCandidate[] = [];
  for (const c of candidates) (vercelZones.has(bareDomain(c.domain)) ? onVercel : offVercel).push(c);
  return { onVercel, offVercel };
}

export type BackfillOutcome = {
  domain: string;
  status: 'connected' | 'pending' | 'failed';
  reason?: string | null;
};

export type BackfillSummary = {
  attempted: number;
  connected: number;
  pending: number;
  failed: number;
  remaining: number;
  outcomes: BackfillOutcome[];
};

/**
 * Which domains still need connecting, oldest first, bounded.
 *
 * ⚠️ Bounded on purpose. Each domain costs a Google verification call plus a DNS write against a
 * real zone; doing a hundred in one request would risk rate limits and leave no way to see which
 * step failed. Small batches, run repeatedly, are also self-healing — a domain that lands `pending`
 * today is retried tomorrow without anyone deciding to.
 */
export function pickBackfillCandidates(
  campaigns: BackfillCandidate[],
  connectedProperties: string[],
  limit = 10,
): BackfillCandidate[] {
  const connected = new Set(connectedProperties.map((p) => bareDomain(p)).filter(Boolean));
  const seen = new Set<string>();
  const out: BackfillCandidate[] = [];
  for (const c of campaigns) {
    const bare = bareDomain(c.domain);
    if (!bare || connected.has(bare) || seen.has(bare)) continue;
    seen.add(bare);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

/** True when the whole run accomplished nothing despite having work to do — see the note below. */
export function backfillFailed(s: Pick<BackfillSummary, 'attempted' | 'connected' | 'pending'>): boolean {
  // ⚠️ geo-rank-sync reported {campaigns: 100, synced: 0, ok: true} every day for months and the
  // zero was never read. A batch job that attempted work and moved nothing forward is a failure.
  return s.attempted > 0 && s.connected === 0 && s.pending === 0;
}

export function summarize(outcomes: BackfillOutcome[], remaining: number): BackfillSummary {
  return {
    attempted: outcomes.length,
    connected: outcomes.filter((o) => o.status === 'connected').length,
    pending: outcomes.filter((o) => o.status === 'pending').length,
    failed: outcomes.filter((o) => o.status === 'failed').length,
    remaining,
    outcomes,
  };
}

/** Connect one domain, translating the connect result into a flat outcome. */
export async function connectOne(domain: string, userId: string, retryPending?: boolean): Promise<BackfillOutcome> {
  // Unspecified → look at the zone: a google-site-verification TXT already there means a previous
  // run got as far as publishing it, so re-verify instead of asking for a second token and writing
  // a duplicate record every night.
  const retry = retryPending ?? ((await hasGoogleVerificationTxt(bareDomain(domain))) === true);
  const r = retry
    ? await verifyPendingGscDomain(domain, userId)
    : await connectDomainToGsc(domain, userId);
  if (r.verified && !r.pending) return { domain, status: 'connected' };
  // `ok && pending` means the TXT is published and DNS has not caught up — real progress.
  if (r.ok) return { domain, status: 'pending', reason: r.reason ?? null };
  return { domain, status: 'failed', reason: r.reason ?? null };
}
