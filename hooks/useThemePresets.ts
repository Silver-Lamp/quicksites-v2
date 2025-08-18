// app/admin/hooks/useThemePresets.ts
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { SiteTheme } from '@/hooks/useThemeContext';

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
