// lib/serviceJobs/techRoster.ts
//
// SecondSet v1 tech roster (crosstalk/contracts/glasses-capture.md, HJ lazy-discovery #1508).
// Who was wearing the glasses on a job? HJ's partner-authed GET /api/glasses/binding?job_id
// answers with `tech_ref` (the wearer's HJ user_id, == the target_user_id we already pass to
// POST /voice-notes — no new id space). We discover techs passively as captures arrive and
// remember (owner, tech_ref) so the "say something to the tech" input can become a picker.
// Partner-authed (same X-Partner-* grant as the capture pull). Fail-closed: no key / no grant
// / job-not-under-grant (404/empty) → nothing learned, nothing thrown.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';
import { getCaptureGrant } from '@/lib/serviceJobs/captureGrants';

const RAIL_BASE = (process.env.HJ_BACKEND_URL || 'https://hivejournalbackend-production.up.railway.app').replace(/\/+$/, '');

const db = () => supabaseAdmin as any;

function partnerHeaders(grant: string): Record<string, string> | null {
  const key = process.env.PARTNER_QUICKSITES_SECRET;
  if (!key) return null; // fail-closed
  return { 'X-Partner-Id': 'quicksites', 'X-Partner-Key': key, 'X-Partner-Grant': grant };
}

export type ShopTech = { tech_ref: string; label: string | null; first_bound_at: string; last_seen_at: string };

/** Remember (or refresh) a tech for a shop. Bumps last_seen_at; never overwrites a label. */
export async function upsertTech(ownerId: string, techRef: string, boundAt?: string | null): Promise<void> {
  if (!ownerId || !techRef) return;
  const now = new Date().toISOString();
  await db()
    .from('service_shop_techs')
    .upsert(
      { owner_id: ownerId, tech_ref: techRef, first_bound_at: boundAt || now, last_seen_at: now },
      { onConflict: 'owner_id,tech_ref', ignoreDuplicates: false },
    );
  // Keep last_seen_at fresh on repeat sightings (upsert with a fixed first_bound_at would
  // otherwise reset it); a targeted update is cheap and idempotent.
  await db().from('service_shop_techs').update({ last_seen_at: now }).eq('owner_id', ownerId).eq('tech_ref', techRef);
}

/** Ask HJ who was on this job. Returns the tech_ref (== voice-note target_user_id) or null. */
export async function resolveTechRef(ownerId: string, jobId: string): Promise<string | null> {
  if (!SECONDSET_ENABLED || !ownerId || !jobId) return null;
  const grant = await getCaptureGrant(ownerId);
  if (!grant) return null;
  const headers = partnerHeaders(grant);
  if (!headers) return null;

  try {
    const res = await fetch(`${RAIL_BASE}/api/glasses/binding?job_id=${encodeURIComponent(jobId)}`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null; // 404/403 → not bound / not ours; fail-closed
    const data = await res.json().catch(() => null);
    const techRef = data?.tech_ref;
    if (typeof techRef !== 'string' || !techRef) return null;
    await upsertTech(ownerId, techRef, typeof data?.bound_at === 'string' ? data.bound_at : null);
    return techRef;
  } catch {
    return null; // rail unreachable
  }
}

/** The techs known for a shop (most-recently-seen first) — for the voice-note picker. */
export async function listShopTechs(ownerId: string): Promise<ShopTech[]> {
  if (!ownerId) return [];
  const { data } = await db()
    .from('service_shop_techs')
    .select('tech_ref, label, first_bound_at, last_seen_at')
    .eq('owner_id', ownerId)
    .order('last_seen_at', { ascending: false });
  return (data ?? []) as ShopTech[];
}
