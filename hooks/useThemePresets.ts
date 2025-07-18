import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SiteTheme } from '@/hooks/useThemeContext';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useThemePresets(userId?: string) {
  const [presets, setPresets] = useState<SiteTheme[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPresets = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('theme_presets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setPresets(data || []);
    setLoading(false);
  };

  const savePreset = async (name: string, theme: SiteTheme) => {
    if (!userId) return;
    await supabase.from('theme_presets').upsert({
      user_id: userId,
      name,
      font_family: theme.fontFamily,
      border_radius: theme.borderRadius,
      accent_color: theme.accentColor,
      dark_mode: theme.darkMode,
      glow_config: theme.glow,
    });
    await fetchPresets();
  };

  const deletePreset = async (id: string) => {
    await supabase.from('theme_presets').delete().eq('id', id);
    await fetchPresets();
  };

  return { presets, loading, fetchPresets, savePreset, deletePreset };
}
