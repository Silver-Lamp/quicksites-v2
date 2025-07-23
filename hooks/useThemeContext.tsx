'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { industryPresets } from '@/lib/theme/industryPresets';
import { fontMap } from '@/lib/theme/fontMap';

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
  darkMode?: 'light' | 'dark';
  fontUrl?: string; // optional reference
  name?: string;
  description?: string;
};

const defaultGlow: GlowConfig[] = [
  { size: 'xl', intensity: 0.2, colors: ['from-purple-600', 'via-blue-500', 'to-pink-500'] },
];

const defaultTheme: SiteTheme = {
  glow: defaultGlow,
  fontFamily: 'sans',
  borderRadius: 'lg',
  accentColor: 'indigo-600',
  darkMode: 'dark',
};

const ThemeContext = createContext<{
  theme: SiteTheme;
  setTheme: (t: SiteTheme) => void;
  toggleDark?: () => void;
  siteSlug: string;
}>({
  theme: defaultTheme,
  setTheme: () => {},
  toggleDark: () => {},
  siteSlug: 'default',
});

export function ThemeProvider({
  children,
  siteSlug = 'default',
}: {
  children: React.ReactNode;
  siteSlug?: string;
}) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [theme, setThemeState] = useState<SiteTheme>(defaultTheme);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const loadTheme = async () => {
      const key = `theme-config::${siteSlug}`;
      const cached = localStorage.getItem(key);

      // 1. Local storage cache
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          document.documentElement.setAttribute('data-theme', parsed.darkMode ?? 'light');
          setThemeState(parsed);
          return;
        } catch {
          console.warn('⚠️ Failed to parse cached theme');
        }
      }

      // 2. Supabase
      const userId = (window as any).__DEV_MOCK_USER__?.id;
      let foundTheme: SiteTheme | null = null;

      if (userId) {
        const { data } = await supabase
          .from('user_site_settings')
          .select('glow_config, theme_font, theme_radius, theme_accent, theme_mode, theme_font_url, theme_name, theme_description')
          .eq('user_id', userId)
          .eq('site_slug', siteSlug)
          .single();

        if (data) {
          foundTheme = {
            glow: Array.isArray(data.glow_config) ? data.glow_config : [data.glow_config],
            fontFamily: data.theme_font || defaultTheme.fontFamily,
            borderRadius: data.theme_radius || defaultTheme.borderRadius,
            accentColor: data.theme_accent || defaultTheme.accentColor,
            darkMode: data.theme_mode || defaultTheme.darkMode,
            fontUrl: data.theme_font_url || fontMap[data.theme_font as keyof typeof fontMap]?.googleUrl,
            name: data.theme_name || '',
            description: data.theme_description || '',
          };
        }
      }

      // 3. Fallback from global site config (e.g. SSR injected)
      if (!foundTheme && typeof window !== 'undefined') {
        const siteConfigTheme = (window as any).__SITE_CONFIG__?.theme;
        if (siteConfigTheme) {
          console.log('💡 Using __SITE_CONFIG__ theme fallback');
          foundTheme = siteConfigTheme;
        }
      }

      // 4. Fallback to industry preset
      if (!foundTheme) {
        const preset = industryPresets[siteSlug];
        if (preset) {
          console.log(`⚙️ Using industry preset for "${siteSlug}"`);
          foundTheme = preset;
        }
      }

      // 5. Final fallback
      if (!foundTheme) {
        foundTheme = defaultTheme;
      }

      // 6. Apply + persist
      document.documentElement.setAttribute('data-theme', foundTheme.darkMode ?? 'light');
      setThemeState(foundTheme);
      localStorage.setItem(key, JSON.stringify(foundTheme));

      const userIdAgain = (window as any).__DEV_MOCK_USER__?.id;
      if (userIdAgain && !cached) {
        const fontKey = foundTheme.fontFamily as keyof typeof fontMap;
        const fontUrl = fontMap[fontKey]?.googleUrl ?? '';

        await supabase.from('user_site_settings').upsert({
          user_id: userIdAgain,
          site_slug: siteSlug,
          glow_config: foundTheme.glow,
          theme_font: foundTheme.fontFamily,
          theme_radius: foundTheme.borderRadius,
          theme_accent: foundTheme.accentColor,
          theme_mode: foundTheme.darkMode,
          theme_font_url: fontUrl,
          theme_name: foundTheme.name,
          theme_description: foundTheme.description,
        });
      }
    };

    if (isClient) loadTheme();
  }, [siteSlug, isClient]);

  const setTheme = async (value: SiteTheme) => {
    setThemeState(value);
    if (value.darkMode) {
      document.documentElement.setAttribute('data-theme', value.darkMode);
    }

    const userId = (window as any).__DEV_MOCK_USER__?.id;
    const key = `theme-config::${siteSlug}`;
    const fontKey = value.fontFamily as keyof typeof fontMap;
    const fontUrl = fontMap[fontKey]?.googleUrl ?? '';

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
          theme_mode: value.darkMode,
          theme_font_url: fontUrl,
          theme_name: value.name,
          theme_description: value.description,
        });
      }
    } catch (err) {
      console.warn('⚠️ Failed to persist theme', err);
    }
  };

  const toggleDark = () => {
    const next = theme.darkMode === 'dark' ? 'light' : 'dark';
    const updated = { ...theme, darkMode: next };
    setTheme(updated as SiteTheme);
  };

  if (!isClient) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleDark, siteSlug }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
