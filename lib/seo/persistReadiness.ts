// lib/seo/persistReadiness.ts
//
// Persist a template's SEO-readiness score to the templates row (via the
// guard-bypassing set_template_seo RPC — see migration 20260721) so the list can
// sort by it with a plain ORDER BY. Best-effort: never throws into its caller
// (commit/publish should not fail because scoring did).

import { supabaseAdmin } from '@/lib/supabase/admin';
import { readinessScore } from '@/lib/outreach/readiness';
import { resolveIndustryKey } from '@/lib/industries';

/** The deep link that takes an operator to the next-step fix in the editor. */
export function nextStepHref(slug: string | null | undefined, blockType?: string | null): string | null {
  if (!slug) return null;
  const base = `/admin/templates/${slug}`;
  return blockType ? `${base}?reveal=${encodeURIComponent(blockType)}` : base;
}

export async function persistReadinessScore(
  templateId: string,
  data: any,
  rawIndustry?: string | null,
  slug?: string | null
): Promise<void> {
  if (!templateId) return;
  try {
    const meta = (data?.meta ?? data) || {};
    const key = resolveIndustryKey(
      rawIndustry || meta?.identity?.industry || meta?.industry || ''
    );
    const score = readinessScore(data ?? {}, key);
    // Bake the deep link into the stored next step so the list can render a button
    // straight from the row (UI still derives one if a row predates this).
    const detail = {
      ...score,
      nextStep: score.nextStep
        ? { ...score.nextStep, href: nextStepHref(slug, score.nextStep.blockType) }
        : null,
    };
    await (supabaseAdmin as any)
      .schema('public')
      .rpc('set_template_seo', { p_id: templateId, p_pct: score.pct, p_detail: detail });
  } catch {
    /* best-effort */
  }
}
