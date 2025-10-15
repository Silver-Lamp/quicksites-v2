// lib/electinfo/entitlements.ts
import { getServerSupabase } from '@/lib/supabase/server';
import { DEFAULT_FREE, Entitlements, FeatureCode } from './features';

export async function getEntitlementsBySiteId(siteId: string | null): Promise<Entitlements> {
  if (!siteId) return DEFAULT_FREE;

  const supabase = await getServerSupabase({ serviceRole: true });
  const { data, error } = await supabase
    .from('site_entitlements')
    .select('feature_code, is_unlocked')
    .eq('site_id', siteId);

  if (error || !data) return DEFAULT_FREE;

  const merged: Entitlements = { ...DEFAULT_FREE };
  for (const row of data) {
    const fc = row.feature_code as FeatureCode;
    merged[fc] = !!row.is_unlocked;
  }
  return merged;
}
