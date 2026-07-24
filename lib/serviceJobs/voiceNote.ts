// lib/serviceJobs/voiceNote.ts
//
// Owner→tech async voice note (crosstalk/contracts/glasses-capture.md). The shop owner
// sends a short note to the tech currently on a job; HJ TTS's it (house voice) and enqueues
// it for the glasses to playAudio in-ear. Addressed by `job_id` — HJ resolves the tech via
// their ACTIVE binding, so we never need the tech's HJ identity, and HJ's consent gate means
// a note only reaches a tech currently bound to one of our jobs (no unsolicited audio).
// Partner-authed (same X-Partner-* grant as the capture pull). Fail-closed.

import 'server-only';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { getCaptureGrant } from '@/lib/serviceJobs/captureGrants';

const RAIL_BASE = (process.env.HJ_BACKEND_URL || 'https://hivejournalbackend-production.up.railway.app').replace(/\/+$/, '');

export type VoiceNoteResult = { ok: boolean; skipped?: string; error?: string };

/**
 * Send a note to the tech on a job. Addressed by `job_id` (HJ resolves the currently-bound
 * tech) OR, when `targetUserId` (== a roster tech_ref) is given, directed at that specific
 * tech. HJ consent-gates both: it only enqueues if the target has an ACTIVE binding under
 * our partner, so a directed note to an off-shift tech returns 403 (mapped to `tech_not_bound`).
 */
export async function sendVoiceNote(
  ownerId: string,
  jobId: string,
  text: string,
  targetUserId?: string | null,
): Promise<VoiceNoteResult> {
  if (!SECONDSET_ENABLED) return { ok: false, skipped: 'not_enabled' };
  const clean = (text || '').trim();
  if (!clean) return { ok: false, error: 'empty' };

  const key = process.env.PARTNER_QUICKSITES_SECRET;
  if (!key) return { ok: false, skipped: 'no_partner_key' };
  const grant = await getCaptureGrant(ownerId);
  if (!grant) return { ok: false, skipped: 'no_grant' };

  const body: Record<string, string> = { job_id: jobId, text: clean };
  const target = (targetUserId || '').trim();
  if (target) body.target_user_id = target; // direct to a specific tech (alongside job_id)

  try {
    const res = await fetch(`${RAIL_BASE}/api/glasses/voice-notes`, {
      method: 'POST',
      headers: {
        'X-Partner-Id': 'quicksites',
        'X-Partner-Key': key,
        'X-Partner-Grant': grant,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (res.status === 403) return { ok: false, error: 'tech_not_bound' }; // consent gate: no active binding
    if (!res.ok) return { ok: false, error: `rail_${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'rail_unreachable' };
  }
}
