// lib/db/themeService.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

const supabase = createClientComponentClient<Database>();

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
