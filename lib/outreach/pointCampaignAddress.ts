// lib/outreach/pointCampaignAddress.ts
//
// Point an org-branded geo campaign's pitch site at its org's service area, committing the
// change through the sanctioned template RPC (direct UPDATEs are trigger-blocked — see
// CLAUDE.md §8). Called automatically when a campaign is branded to an org, and on demand
// from the Growth Coach. No-op when the site already has its own address ("auto until edited").

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getOrgServiceArea } from '@/lib/outreach/orgServiceArea';
import { seedServiceAreaContact } from '@/lib/outreach/seedServiceAreaContact';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';

export type PointResult = {
  ok: boolean;
  changed: boolean;
  /** The service-area label applied (or that would apply). */
  label?: string;
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

  const area = await getOrgServiceArea(campaign.org_id);
  if (!area) return { ok: false, changed: false, reason: 'no_org_address' };

  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev')
    .eq('id', campaign.template_id)
    .maybeSingle();
  if (!t) return { ok: false, changed: false, reason: 'no_template' };

  const { data: newData, changed } = seedServiceAreaContact((t as any).data ?? {}, area);
  if (!changed) return { ok: true, changed: false, reason: 'already_has_address', label: area.label };

  // Persist via the sanctioned commit RPC (public.commit_template_http, app.commit_template
  // fallback) — the same path lib/builder/autogenerateForTemplate.ts uses.
  const payload = {
    id: campaign.template_id,
    base_rev: (t as any).rev ?? 0,
    patch: { data: newData },
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

  return { ok: true, changed: true, label: area.label };
}
