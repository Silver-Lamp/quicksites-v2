// lib/guest/publishGraceServer.ts
//
// The I/O half of publishGrace.ts — starting the clock, stopping it, and the sweep.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { graceExpiryFrom, shouldExpire, type PublishGraceRow } from './publishGrace';

/** The pending (unconfirmed) address on an account, or null. Admin API — the session lacks it. */
export async function pendingEmailFor(userId: string): Promise<string | null> {
  try {
    const { data } = await (supabaseAdmin as any).auth.admin.getUserById(userId);
    const u = data?.user;
    if (!u) return null;
    // `new_email` is Supabase's pending-change field; `email_change` on some versions.
    return (u.new_email || u.email_change || null) as string | null;
  } catch {
    return null;
  }
}

/** Is this account still anonymous (i.e. never confirmed)? Null when it cannot be determined. */
export async function stillAnonymous(userId: string): Promise<boolean | null> {
  try {
    const { data } = await (supabaseAdmin as any).auth.admin.getUserById(userId);
    if (!data?.user) return null;
    return !!data.user.is_anonymous;
  } catch {
    return null;
  }
}

/** Start (or restart) the clock for a template published by an unverified guest. */
export async function startPublishGrace(templateId: string, ownerId: string): Promise<string | null> {
  const expiresAt = graceExpiryFrom().toISOString();
  const { error } = await (supabaseAdmin as any)
    .from('publish_grace')
    .upsert(
      { template_id: templateId, owner_id: ownerId, expires_at: expiresAt, resolved_at: null, resolution: null },
      { onConflict: 'template_id' },
    );
  if (error) {
    // ⚠️ Logged, never swallowed. A publish whose deadline failed to record is a site with no
    // expiry — the exact open door the grace window exists to close.
    console.error('[publish-grace] could not start the clock', { templateId, message: error.message });
    return null;
  }
  return expiresAt;
}

/** Stop the clock. Called when the guest confirms, or when the sweep takes the site down. */
export async function resolvePublishGrace(
  templateId: string,
  resolution: 'verified' | 'expired' | 'manual',
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('publish_grace')
    .update({ resolved_at: new Date().toISOString(), resolution })
    .eq('template_id', templateId)
    .is('resolved_at', null);
  if (error) console.error('[publish-grace] could not resolve', { templateId, resolution, message: error.message });
}

/** Every template this owner has on the clock — used when they finally confirm. */
export async function resolveGraceForOwner(ownerId: string): Promise<number> {
  const { data, error } = await (supabaseAdmin as any)
    .from('publish_grace')
    .update({ resolved_at: new Date().toISOString(), resolution: 'verified' })
    .eq('owner_id', ownerId)
    .is('resolved_at', null)
    .select('template_id');
  if (error) {
    console.error('[publish-grace] could not resolve for owner', { ownerId, message: error.message });
    return 0;
  }
  return (data ?? []).length;
}

/** The live grace row for a template, if the clock is running. */
export async function graceFor(templateId: string): Promise<PublishGraceRow | null> {
  const { data } = await (supabaseAdmin as any)
    .from('publish_grace')
    .select('template_id, owner_id, expires_at, resolved_at, resolution')
    .eq('template_id', templateId)
    .is('resolved_at', null)
    .maybeSingle();
  return (data as PublishGraceRow) ?? null;
}

export type SweepResult = {
  due: number;
  unpublished: string[];
  keptVerified: string[];
  failed: { templateId: string; reason: string }[];
};

/**
 * Take down every lapsed, still-unverified site.
 *
 * ⚠️ Unpublishing goes through `public.unpublish_template`, which flips `published_sites` AND
 * `templates.published` together. The existing unpublish ROUTE sets only the first, and the two
 * have measurably drifted (2026-09-26: three templates serving publicly while flagged
 * unpublished). A sweep that half-works would leave a lapsed site live while reporting it down —
 * strictly worse than not sweeping.
 */
export async function sweepExpiredGrace(limit = 200): Promise<SweepResult> {
  const out: SweepResult = { due: 0, unpublished: [], keptVerified: [], failed: [] };

  const { data, error } = await (supabaseAdmin as any)
    .from('publish_grace')
    .select('template_id, owner_id, expires_at, resolved_at, resolution')
    .is('resolved_at', null)
    .lte('expires_at', new Date().toISOString())
    .limit(limit);
  if (error) {
    out.failed.push({ templateId: '-', reason: `query failed: ${error.message}` });
    return out;
  }

  const rows = (data ?? []) as PublishGraceRow[];
  out.due = rows.length;

  for (const row of rows) {
    const anon = await stillAnonymous(row.owner_id);
    if (anon === null) {
      // ⚠️ Unknown is NOT "still anonymous". If the auth lookup failed we cannot tell whether they
      // verified, and taking a site down on a failed read would punish the wrong person. Leave it
      // for the next run — a day late is recoverable, a wrongful takedown is not.
      out.failed.push({ templateId: row.template_id, reason: 'owner state unreadable — left up' });
      continue;
    }
    if (!shouldExpire({ resolvedAt: row.resolved_at, expiresAt: row.expires_at, ownerStillAnonymous: anon })) {
      await resolvePublishGrace(row.template_id, 'verified');
      out.keptVerified.push(row.template_id);
      continue;
    }
    const { error: rpcErr } = await (supabaseAdmin as any).rpc('unpublish_template', {
      p_template_id: row.template_id,
      p_actor: null,
    });
    if (rpcErr) {
      out.failed.push({ templateId: row.template_id, reason: rpcErr.message });
      continue;
    }
    await resolvePublishGrace(row.template_id, 'expired');
    out.unpublished.push(row.template_id);
  }

  return out;
}
