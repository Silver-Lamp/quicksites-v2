// lib/db/themeService.ts
import { getSupabaseRSC } from '@/lib/supabase/serverClient';

const supabase = await getSupabaseRSC();

export async function fetchIndustryTheme(industry: string) {
  const { data, error } = await supabase
    .from('industry_themes')
    .select('*')
    .eq('industry', industry)
    .single();
  return data;
}

export async function saveIndustryTheme(
  industry: string,
  theme: { font: string; primary_color: string; border_radius: string }
) {
  const { error } = await supabase
    .from('industry_themes')
    .upsert({ industry, ...theme }, { onConflict: 'industry' });
  return error;
}
