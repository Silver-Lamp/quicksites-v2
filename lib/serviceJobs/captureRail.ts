// lib/serviceJobs/captureRail.ts
//
// SecondSet capture PULL (crosstalk/contracts/glasses-capture.md, HJ v2 partner-grant read).
// A shop's captures are created on HJ's rail; QS pulls the owner's `secondset_field`
// captures with a partner grant, matches each to a job by `context.job_id`, stores it
// against the job, and acks. De-duped by rail capture id (a re-pull before ack is a no-op).
// Fail-closed: no partner key or no grant → nothing pulled.

import 'server-only';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { getCaptureGrant } from '@/lib/serviceJobs/captureGrants';
import { addCapture, existingRailCaptureIds, getJobDetail } from '@/lib/serviceJobs/serviceJobs';
import { resolveTechRef } from '@/lib/serviceJobs/techRoster';

const RAIL_BASE = (process.env.HJ_BACKEND_URL || 'https://hivejournalbackend-production.up.railway.app').replace(/\/+$/, '');

function partnerHeaders(grant: string): Record<string, string> | null {
  const key = process.env.PARTNER_QUICKSITES_SECRET;
  if (!key) return null; // fail-closed: partner surface dark until the secret is set
  return { 'X-Partner-Id': 'quicksites', 'X-Partner-Key': key, 'X-Partner-Grant': grant };
}

type RailCapture = {
  id: string;
  media?: { image_url?: string | null } | null;
  note?: string | null;
  context?: { job_id?: string } | null;
  status?: string;
};

export type SyncResult = {
  skipped?: string;
  pulled: number;
  stored: number;
  acked: number;
  techs: number;
  /** Captures held back because the customer has not consented to on-site capture yet. */
  refusedNoConsent: number;
};

/** Pull + store + ack a shop owner's secondset_field captures. Idempotent. */
export async function syncOwnerCaptures(ownerId: string): Promise<SyncResult> {
  const zero = { pulled: 0, stored: 0, acked: 0, techs: 0, refusedNoConsent: 0 };
  if (!SECONDSET_ENABLED) return { skipped: 'not_enabled', ...zero };

  const grant = await getCaptureGrant(ownerId);
  if (!grant) return { skipped: 'no_grant', ...zero };
  const headers = partnerHeaders(grant);
  if (!headers) return { skipped: 'no_partner_key', ...zero };

  let captures: RailCapture[] = [];
  try {
    const res = await fetch(`${RAIL_BASE}/api/captures?status=pending`, { headers, cache: 'no-store' });
    if (!res.ok) return { skipped: `rail_${res.status}`, ...zero };
    const data = await res.json();
    captures = Array.isArray(data?.captures) ? data.captures : [];
  } catch (e) {
    return { skipped: 'rail_unreachable', ...zero };
  }
  if (!captures.length) return zero;

  const existing = await existingRailCaptureIds(captures.map((c) => c.id).filter(Boolean));
  let stored = 0;
  let acked = 0;
  let refusedNoConsent = 0;
  const jobIdsSeen = new Set<string>(); // for passive tech-roster discovery after the loop

  for (const c of captures) {
    const jobId = c.context?.job_id;
    if (!c.id || !jobId) continue;
    jobIdsSeen.add(jobId);

    if (!existing.has(c.id)) {
      // Verify the job belongs to this owner (grant scopes the owner, but double-check).
      const job = await getJobDetail(jobId);
      if (!job || job.owner_id !== ownerId) continue;

      // ⚠️ THE CUSTOMER'S CONSENT GATE, AND IT WAS MISSING ENTIRELY UNTIL 2026-09-24.
      //
      // Nothing on the ingest path read `consent_captured_at`: a photo of someone's driveway and a
      // recording of their voice would be stored because a TECH had a valid grant. Those are two
      // different consents — HJ's rail enforces that the wearer is bound, which is the tech
      // agreeing to be recorded, not the customer agreeing to be.
      //
      // ⚠️ Checked HERE rather than inside `addCapture`, and the reason is the catch below: it
      // swallows every error as "unique conflict" and then ACKS, so a throw would drop the capture
      // off the rail permanently while reporting success. That is the bare-catch failure CLAUDE.md
      // records from the rank sync, and adding a privacy gate through it would have been silent.
      //
      // ⚠️ DELIBERATELY NOT ACKED. Leaving it pending means the capture is still there when consent
      // arrives, so a customer who consents late loses nothing. Acking would destroy evidence the
      // shop may legitimately need, to enforce a rule that has not been broken yet.
      if (!job.consent_captured_at) {
        refusedNoConsent++;
        continue;
      }
      const hasImage = !!c.media?.image_url;
      try {
        await addCapture(jobId, {
          kind: hasImage ? 'photo' : 'note',
          photoUrl: hasImage ? c.media!.image_url! : null,
          transcript: c.note ?? null,
          capturedBy: 'glasses',
          railCaptureId: c.id,
        });
        stored++;
      } catch (e) {
        // ⚠️ Only a UNIQUE conflict means "already stored, safe to ack". The previous bare catch
        // treated every failure that way — a write that failed for any other reason was acked off
        // the rail and lost. Anything else re-raises to the caller rather than being acked away.
        const msg = String((e as any)?.message ?? e);
        const isDuplicate = /duplicate key|unique constraint|23505/i.test(msg);
        if (!isDuplicate) throw e;
      }
    }
    // Ack so the rail marks it delivered and it drops out of future pulls.
    try {
      const res = await fetch(`${RAIL_BASE}/api/captures/${encodeURIComponent(c.id)}/ack`, { method: 'POST', headers, cache: 'no-store' });
      if (res.ok) acked++;
    } catch {
      /* leave it pending; a later sync retries */
    }
  }
  // Passive tech-roster discovery: ask HJ who was wearing the glasses on each job we saw a
  // capture for, once per job. Best-effort — never blocks or fails the sync (each call is
  // itself fail-closed to null). resolveTechRef upserts the tech on a hit.
  let techs = 0;
  for (const jobId of jobIdsSeen) {
    if (await resolveTechRef(ownerId, jobId)) techs++;
  }

  return { pulled: captures.length, stored, acked, techs, refusedNoConsent };
}
