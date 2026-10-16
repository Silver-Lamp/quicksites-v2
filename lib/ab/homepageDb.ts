// lib/ab/homepageDb.ts — the service-role reads/writes behind the homepage A/B test.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { AB_EXPERIMENT, parseHomepageAb, summarizeAb, type AbCount, type AbEventName, type AbVariant, type HomepageAbSettings } from '@/lib/ab/homepage';

export const HOMEPAGE_AB_KEY = 'homepage_ab';

export async function getHomepageAb(): Promise<HomepageAbSettings> {
  return parseHomepageAb(await getSiteSetting<unknown>(HOMEPAGE_AB_KEY, null));
}

export async function setHomepageAb(value: unknown, updatedBy?: string | null): Promise<void> {
  await setSiteSetting(HOMEPAGE_AB_KEY, value, updatedBy ?? null);
}

export async function recordAbEvent(input: { experiment?: string; variant: AbVariant; visitor: string; event: AbEventName; path?: string | null }): Promise<void> {
  await supabaseAdmin.from('ab_events').insert({ experiment: input.experiment ?? AB_EXPERIMENT, variant: input.variant, visitor: input.visitor, event: input.event, path: input.path ?? null });
}

/** Unique visitors per (variant, event) since `since` (ISO) — the honest unit is a visitor, not a hit. */
export async function loadAbSummary(since?: string | null) {
  let q = supabaseAdmin.from('ab_events').select('variant, event, visitor').eq('experiment', AB_EXPERIMENT);
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
