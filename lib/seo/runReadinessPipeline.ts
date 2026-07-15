// lib/seo/runReadinessPipeline.ts
//
// The readiness pipeline: run every applicable one-click fix for one site, in registry order,
// and report a per-step result + the before/after readiness score. Each step calls its server
// runner directly (idempotent — a step that's already satisfied no-ops), so the pipeline is
// safe to re-run. This is the per-site engine; batch = call it once per site (the endpoint /
// UI loop over sites), which keeps each site inside one serverless request.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveIndustryKey } from '@/lib/industries';
import { readinessScore } from '@/lib/outreach/readiness';
import { persistReadinessScore } from '@/lib/seo/persistReadiness';
import { getGeoCampaignByTemplateId } from '@/lib/outreach/geoCampaigns';
import { READINESS_ACTIONS, type ReadinessActionDef, type ReadinessActionKey } from '@/lib/seo/readinessActions';
import { READINESS_RUNNERS } from '@/lib/seo/readinessRunners';
import { classifyStep, type PipelineStepStatus } from '@/lib/seo/pipelineClassify';

export type { PipelineStepStatus } from '@/lib/seo/pipelineClassify';

export type PipelineStep = {
  key: ReadinessActionKey;
  itemId: string;
  label: string;
  status: PipelineStepStatus;
  message: string;
};

export type ScoreSnapshot = { pct: number; done: number; total: number };

export type PipelineResult = {
  ok: boolean;
  templateId: string;
  steps: PipelineStep[];
  before: ScoreSnapshot;
  after: ScoreSnapshot;
  error?: string;
};

const ZERO: ScoreSnapshot = { pct: 0, done: 0, total: 0 };

/** Whether an action applies to this site (geo + industry gating from the registry). */
function actionApplies(def: ReadinessActionDef, isGeoSite: boolean, industryKey: string): boolean {
  if (def.requiresGeoSite && !isGeoSite) return false;
  if (def.appliesToIndustry && !def.appliesToIndustry(industryKey)) return false;
  return true;
}

function snapshot(data: any, industryKey: string): ScoreSnapshot {
  const s = readinessScore(data ?? {}, industryKey);
  return { pct: s.pct, done: s.done, total: s.total };
}

/**
 * Run the pipeline for one template. Loads fresh at start + end (each runner reads+commits its
 * own state in between), runs every applicable action in registry order, and re-persists the
 * score afterward so the list reflects it.
 */
export async function runReadinessPipeline(templateId: string, actorId: string | null): Promise<PipelineResult> {
  const load = async () =>
    (await supabaseAdmin.from('templates').select('id, slug, data, industry').eq('id', templateId).maybeSingle()).data as any;

  const t0 = await load();
  if (!t0) return { ok: false, templateId, steps: [], before: ZERO, after: ZERO, error: 'no_template' };

  const meta = t0.data?.meta ?? {};
  const industryKey = resolveIndustryKey(t0.industry || meta?.identity?.industry || meta?.industry || '');
  const isGeoSite = !!(await getGeoCampaignByTemplateId(templateId));
  const before = snapshot(t0.data, industryKey);

  const steps: PipelineStep[] = [];
  for (const def of READINESS_ACTIONS) {
    if (!actionApplies(def, isGeoSite, industryKey)) {
      steps.push({
        key: def.key,
        itemId: def.itemId,
        label: def.label,
        status: 'skipped',
        message: def.requiresGeoSite && !isGeoSite ? 'Not a geo pitch site' : 'Not applicable to this site',
      });
      continue;
    }
    try {
      const result = await READINESS_RUNNERS[def.key](templateId, actorId);
      steps.push({
        key: def.key,
        itemId: def.itemId,
        label: def.label,
        status: classifyStep(result),
        message: result.error || def.result(result).text,
      });
    } catch (e: any) {
      steps.push({ key: def.key, itemId: def.itemId, label: def.label, status: 'error', message: e?.message || 'failed' });
    }
  }

  const tFinal = await load();
  const after = snapshot(tFinal?.data, industryKey);
  // Keep the stored score in sync so the list sorts/badges reflect the run.
  await persistReadinessScore(templateId, tFinal?.data ?? {}, tFinal?.industry, tFinal?.slug).catch(() => {});

  return { ok: true, templateId, steps, before, after };
}
