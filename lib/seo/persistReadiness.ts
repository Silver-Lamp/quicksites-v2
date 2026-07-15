// lib/seo/persistReadiness.ts
//
// Persist a template's SEO-readiness score to the templates row (via the
// guard-bypassing set_template_seo RPC — see migration 20260721) so the list can
// sort by it with a plain ORDER BY. Best-effort: never throws into its caller
// (commit/publish should not fail because scoring did).

import { supabaseAdmin } from '@/lib/supabase/admin';
import { readinessScore } from '@/lib/outreach/readiness';
import { resolveIndustryKey } from '@/lib/industries';

export async function persistReadinessScore(
  templateId: string,
  data: any,
  rawIndustry?: string | null
): Promise<void> {
  if (!templateId) return;
  try {
    const meta = (data?.meta ?? data) || {};
    const key = resolveIndustryKey(
      rawIndustry || meta?.identity?.industry || meta?.industry || ''
    );
    const score = readinessScore(data ?? {}, key);
    await (supabaseAdmin as any)
      .schema('public')
      .rpc('set_template_seo', { p_id: templateId, p_pct: score.pct, p_detail: score });
  } catch {
    /* best-effort */
  }
}
