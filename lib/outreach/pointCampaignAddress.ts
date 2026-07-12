// lib/outreach/pointCampaignAddress.ts
//
// Point an org-branded geo campaign's pitch site at its org's service area, committing the
// change through the sanctioned template RPC (direct UPDATEs are trigger-blocked — see
// CLAUDE.md §8). Called automatically when a campaign is branded to an org, and on demand
// from the Growth Coach. No-op when the site already has its own address ("auto until edited").

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getOrgIdentity } from '@/lib/outreach/orgServiceArea';
import { seedServiceAreaContact } from '@/lib/outreach/seedServiceAreaContact';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';

export type PointResult = {
  ok: boolean;
  changed: boolean;
  /** The service-area label applied (or that would apply). */
  label?: string;
  /** What was seeded, for the UI message. */
  addressSet?: boolean;
  emailSet?: boolean;
  /** Why nothing changed: 'no_template' | 'no_org_address' | 'already_has_address' | commit error. */
  reason?: string;
};

/**
 * Seed campaign.template_id's contact with campaign.org_id's service area, if the site has
 * no address of its own. Best-effort + idempotent. `actorId` is recorded on the commit.
 */
export async function pointCampaignAtOrgServiceArea(
  campaign: Pick<GeoCampaign, 'template_id' | 'org_id'>,
  actorId: string | null = null,
): Promise<PointResult> {
  if (!campaign.template_id) return { ok: false, changed: false, reason: 'no_template' };

  const identity = await getOrgIdentity(campaign.org_id);
  if (!identity) return { ok: false, changed: false, reason: 'no_org_address' };

  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev')
    .eq('id', campaign.template_id)
    .maybeSingle();
  if (!t) return { ok: false, changed: false, reason: 'no_template' };

  const { data: newData, changed, addressSet, emailSet } = seedServiceAreaContact((t as any).data ?? {}, identity);
  if (!changed) return { ok: true, changed: false, reason: 'already_has_address', label: identity.label ?? undefined };

  // Persist via the sanctioned commit RPC (public.commit_template_http, app.commit_template
  // fallback) — the same path lib/builder/autogenerateForTemplate.ts uses. Also set the
  // contact_email column when seeded so the block editor's "Send submissions to" reflects it.
  const patch: Record<string, any> = { data: newData };
  if (emailSet && identity.email) patch.contact_email = identity.email;
  const payload = {
    id: campaign.template_id,
    base_rev: (t as any).rev ?? 0,
    patch,
    actor: actorId,
    kind: 'save',
    org_id: null,
  };
  let err: any = null;
  {
    const { error } = await (supabaseAdmin as any).schema('public').rpc('commit_template_http', { p_payload: payload });
    err = error;
  }
  if (err) {
    const { error } = await (supabaseAdmin as any).schema('app').rpc('commit_template', { p_payload: payload });
    err = error;
  }
  if (err) return { ok: false, changed: false, reason: err.message || 'commit failed' };

  return { ok: true, changed: true, label: identity.label ?? undefined, addressSet, emailSet };
}
