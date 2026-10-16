// lib/ab/siteAbDb.ts — service-role reads/writes for per-site A/B tests.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseSiteAb, siteExperimentId, type SiteAbTest } from '@/lib/ab/siteAb';
import { summarizeAb, type AbCount, type AbVariant } from '@/lib/ab/homepage';

export async function getSiteAb(templateId: string): Promise<SiteAbTest> {
  const { data } = await supabaseAdmin.from('template_ab_tests').select('*').eq('template_id', templateId).maybeSingle();
  return parseSiteAb(templateId, data ?? null);
}

export async function setSiteAb(templateId: string, value: { enabled: boolean; split_b: number; b: unknown; note?: string | null; started_at?: string | null }, updatedBy?: string | null): Promise<void> {
  const { error } = await supabaseAdmin.from('template_ab_tests').upsert({ template_id: templateId, enabled: value.enabled, split_b: value.split_b, b: value.b ?? {}, note: value.note ?? null, started_at: value.started_at ?? null, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null }, { onConflict: 'template_id' });
  if (error) throw new Error(error.message);
}

export async function listSiteAbTests(): Promise<Array<SiteAbTest & { slug: string | null; name: string | null }>> {
  const { data } = await supabaseAdmin.from('template_ab_tests').select('*').order('updated_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as any[];
  if (!rows.length) return [];
  const { data: tpls } = await supabaseAdmin.from('templates').select('id, slug, business_name, template_name').in('id', rows.map((r) => r.template_id));
  const byId = new Map((tpls ?? []).map((t: any) => [t.id, t]));
  return rows.map((r) => ({ ...parseSiteAb(r.template_id, r), slug: byId.get(r.template_id)?.slug ?? null, name: byId.get(r.template_id)?.business_name ?? byId.get(r.template_id)?.template_name ?? null }));
}

/** Unique visitors per (variant, event) for one experiment. */
export async function loadExperimentSummary(experiment: string, since?: string | null) {
  let q = supabaseAdmin.from('ab_events').select('variant, event, visitor').eq('experiment', experiment);
  if (since) q = q.gte('created_at', since);
  const { data } = await q.limit(50000);
  const seen = new Map<string, Set<string>>();
  for (const r of (data ?? []) as Array<{ variant: AbVariant; event: string; visitor: string }>) {
    const k = `${r.variant}|${r.event}`;
    if (!seen.has(k)) seen.set(k, new Set());
    seen.get(k)!.add(r.visitor);
  }
  const counts: AbCount[] = Array.from(seen.entries()).map(([k, v]) => ({ variant: k.split('|')[0] as AbVariant, event: k.split('|')[1], visitors: v.size }));
  return summarizeAb(counts);
}

export const siteSummary = (templateId: string, since?: string | null) => loadExperimentSummary(siteExperimentId(templateId), since);
