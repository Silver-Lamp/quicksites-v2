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

export type SyncResult = { skipped?: string; pulled: number; stored: number; acked: number; techs: number };

/** Pull + store + ack a shop owner's secondset_field captures. Idempotent. */
export async function syncOwnerCaptures(ownerId: string): Promise<SyncResult> {
  const zero = { pulled: 0, stored: 0, acked: 0, techs: 0 };
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
  const jobIdsSeen = new Set<string>(); // for passive tech-roster discovery after the loop

  for (const c of captures) {
    const jobId = c.context?.job_id;
    if (!c.id || !jobId) continue;
    jobIdsSeen.add(jobId);

    if (!existing.has(c.id)) {
      // Verify the job belongs to this owner (grant scopes the owner, but double-check).
      const job = await getJobDetail(jobId);
      if (!job || job.owner_id !== ownerId) continue;
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
      } catch {
        // unique conflict (concurrent pull) → already stored; fall through to ack
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

  return { pulled: captures.length, stored, acked, techs };
}
