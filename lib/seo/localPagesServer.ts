// lib/seo/localPagesServer.ts
//
// Server side of the local-SEO page builders: generate a "<service> in <city>" subpage for
// a campaign's pitch site and commit it through the sanctioned template RPC (direct UPDATEs
// are trigger-blocked — see CLAUDE.md §8). Idempotent by slug.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import { buildCityServicePage, insertPage } from '@/lib/seo/localPages';

export type AddCityPageResult = { ok: boolean; changed: boolean; slug?: string; reason?: string };

export async function addCityServicePage(
  campaign: { template_id: string | null; city: string | null; industry_key: string },
  actorId: string | null = null,
): Promise<AddCityPageResult> {
  if (!campaign.template_id) return { ok: false, changed: false, reason: 'no_template' };
  if (!campaign.city) return { ok: false, changed: false, reason: 'no_city' };

  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev, business_name')
    .eq('id', campaign.template_id)
    .maybeSingle();
  if (!t) return { ok: false, changed: false, reason: 'no_template' };

  const label = KEY_TO_LABEL[campaign.industry_key as IndustryKey] ?? 'Services';
  const svcBlock = (t as any).data?.pages?.[0]?.blocks?.find((b: any) => b?.type === 'services');
  const services: string[] = (svcBlock?.content?.items ?? svcBlock?.content?.services ?? [])
    .map((s: any) => s?.name)
    .filter(Boolean)
    .slice(0, 6);

  const page = buildCityServicePage({
    businessName: (t as any).business_name || `${campaign.city} ${label}`,
    serviceLabel: label,
    city: campaign.city,
    services,
  });
  const ins = insertPage((t as any).data ?? {}, page);
  if (!ins.changed) return { ok: true, changed: false, slug: ins.slug, reason: 'already_exists' };

  const payload = {
    id: campaign.template_id,
    base_rev: (t as any).rev ?? 0,
    patch: { data: ins.data },
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

  return { ok: true, changed: true, slug: ins.slug };
}
