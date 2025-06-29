// /hooks/useThemeContext.ts (now includes full theme + provider + glow sync)
import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

export type GlowConfig = {
  size: 'sm' | 'md' | 'lg' | 'xl';
  intensity: number;
  colors: string[];
};

export type SiteTheme = {
  glow: GlowConfig[];
  fontFamily?: string;
  borderRadius?: string;
  accentColor?: string;
  // add other themable options here
};

const defaultGlow: GlowConfig[] = [
  { size: 'xl', intensity: 0.2, colors: ['from-purple-600', 'via-blue-500', 'to-pink-500'] },
];

const defaultTheme: SiteTheme = {
  glow: defaultGlow,
  fontFamily: 'sans',
  borderRadius: 'lg',
  accentColor: 'indigo-600',
};

const ThemeContext = createContext<{
  theme: SiteTheme;
  setTheme: (t: SiteTheme) => void;
  siteSlug: string;
}>({
  theme: defaultTheme,
  setTheme: () => {},
  siteSlug: 'default',
});

export function ThemeProvider({ children, siteSlug = 'default' }: { children: React.ReactNode; siteSlug?: string }) {
  const supabase = createClientComponentClient<Database>();
  const [theme, setThemeState] = useState<SiteTheme>(defaultTheme);

  useEffect(() => {
    const loadTheme = async () => {
      if (typeof window === 'undefined') return;

      const key = `theme-config::${siteSlug}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setThemeState(parsed);
          return;
        } catch {
          console.warn('⚠️ Failed to parse cached theme');
        }
      }

      const userId = (window as any).__DEV_MOCK_USER__?.id;
      if (userId) {
        const { data } = await supabase
          .from('user_site_settings')
          .select('glow_config, theme_font, theme_radius, theme_accent')
          .eq('user_id', userId)
          .eq('site_slug', siteSlug)
          .single();

        if (data) {
          setThemeState({
            glow: Array.isArray(data.glow_config) ? data.glow_config : [data.glow_config],
            fontFamily: data.theme_font || defaultTheme.fontFamily,
            borderRadius: data.theme_radius || defaultTheme.borderRadius,
            accentColor: data.theme_accent || defaultTheme.accentColor,
          });
          return;
        }
      }

      setThemeState(defaultTheme);
    };

    loadTheme();
  }, [siteSlug]);

  const setTheme = async (value: SiteTheme) => {
    setThemeState(value);

    const userId = (window as any).__DEV_MOCK_USER__?.id;
    if (typeof window !== 'undefined') {
      const key = `theme-config::${siteSlug}`;
      try {
        localStorage.setItem(key, JSON.stringify(value));

        if (userId) {
          await supabase.from('user_site_settings').upsert({
            user_id: userId,
            site_slug: siteSlug,
            glow_config: value.glow,
            theme_font: value.fontFamily,
            theme_radius: value.borderRadius,
            theme_accent: value.accentColor,
          });
        }
      } catch (err) {
        console.warn('⚠️ Failed to persist theme', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, siteSlug }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
