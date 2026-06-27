// app/admin/hooks/useThemeContext.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
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
  fontUrl?: string;
  name?: string;
  description?: string;
};

const defaultGlow: GlowConfig[] = [
  { size: 'xl', intensity: 0.2, colors: ['from-purple-600', 'via-blue-500', 'to-pink-500'] },
];

// ✅ Default to LIGHT so we never boot into dark unless we really mean it
const defaultTheme: SiteTheme = {
  glow: defaultGlow,
  fontFamily: 'sans',
  borderRadius: 'lg',
  accentColor: 'indigo-600',
  darkMode: 'light',
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

function applyDomMode(mode: 'light' | 'dark') {
  // Tailwind "class" strategy needs the .dark class
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

export function ThemeProvider({
  children,
  siteSlug = 'default',
}: {
  children: React.ReactNode;
  siteSlug?: string;
}) {
  // ✅ Resolve initial theme synchronously to avoid a flash/mismatch on mount/remount
  const initialTheme: SiteTheme = (() => {
    if (typeof window !== 'undefined') {
      const key = `theme-config::${siteSlug}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as SiteTheme;
          const mode = (parsed.darkMode === 'dark' || parsed.darkMode === 'light') ? parsed.darkMode : 'light';
          applyDomMode(mode);
          return { ...defaultTheme, ...parsed, darkMode: mode };
        } catch {
          // fall through
        }
      }
      // fall back to current DOM attribute if present (e.g., SSR/previous page set it)
      const domAttr = document.documentElement.getAttribute('data-theme');
      if (domAttr === 'dark' || domAttr === 'light') {
        applyDomMode(domAttr);
        return { ...defaultTheme, darkMode: domAttr };
      }
    }
    // final fallback
    applyDomMode('light');
    return defaultTheme;
  })();

  const [theme, setThemeState] = useState<SiteTheme>(initialTheme);

  // Async load to refine from Supabase/industry presets if no local cache exists
  useEffect(() => {
    let cancelled = false;

    const loadTheme = async () => {
      const key = `theme-config::${siteSlug}`;
      const cached = localStorage.getItem(key);
      if (cached) return; // already taken care of synchronously

      const userId = (window as any).__DEV_MOCK_USER__?.id;
      let foundTheme: SiteTheme | null = null;

      // 1) Supabase (user-specific)
      if (userId) {
        // NOTE: user_site_settings only has (user_id, site_slug, glow_config).
        // The theme_* columns this used to select don't exist in the DB, so they
        // always failed silently and the theme fell back to defaults — preserved here.
        const { data } = await supabase
          .from('user_site_settings')
          .select('glow_config')
          .eq('user_id', userId)
          .eq('site_slug', siteSlug)
          .single();

        if (data) {
          const glow = (Array.isArray(data.glow_config) ? data.glow_config : [data.glow_config]) as GlowConfig[];
          foundTheme = { ...defaultTheme, glow };
        }
      }

      // 2) Global site config (SSR-injected)
      if (!foundTheme && typeof window !== 'undefined') {
        const siteConfigTheme = (window as any).__SITE_CONFIG__?.theme as SiteTheme | undefined;
        if (siteConfigTheme) {
          foundTheme = {
            ...defaultTheme,
            ...siteConfigTheme,
            darkMode:
              siteConfigTheme.darkMode === 'dark' || siteConfigTheme.darkMode === 'light'
                ? siteConfigTheme.darkMode
                : defaultTheme.darkMode,
          };
        }
      }

      // 3) Industry preset
      if (!foundTheme) {
        const preset = industryPresets[siteSlug];
        if (preset) {
          foundTheme = {
            ...defaultTheme,
            ...preset,
            darkMode:
              preset.darkMode === 'dark' || preset.darkMode === 'light' ? preset.darkMode : defaultTheme.darkMode,
          };
        }
      }

      // 4) Final fallback
      if (!foundTheme) foundTheme = defaultTheme;

      if (cancelled) return;

      // Apply + persist
      applyDomMode(foundTheme.darkMode ?? 'light');
      setThemeState(foundTheme);
      localStorage.setItem(key, JSON.stringify(foundTheme));

      // Backfill user settings if authenticated and nothing cached before
      const userIdAgain = (window as any).__DEV_MOCK_USER__?.id;
      if (userIdAgain && !cached) {
        await supabase.from('user_site_settings').upsert({
          user_id: userIdAgain,
          site_slug: siteSlug,
          glow_config: foundTheme.glow,
        });
      }
    };

    loadTheme();
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  const setTheme = async (value: SiteTheme) => {
    setThemeState(value);
    const mode = value.darkMode ?? 'light';
    applyDomMode(mode);

    const userId = (window as any).__DEV_MOCK_USER__?.id;
    const key = `theme-config::${siteSlug}`;

    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (userId) {
        // Only glow_config exists on user_site_settings (see loadTheme note).
        await supabase.from('user_site_settings').upsert({
          user_id: userId,
          site_slug: siteSlug,
          glow_config: value.glow,
        });
      }
    } catch (err) {
      console.warn('⚠️ Failed to persist theme', err);
    }
  };

  const toggleDark = () => {
    const next = theme.darkMode === 'dark' ? 'light' : 'dark';
    setTheme({ ...theme, darkMode: next });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleDark, siteSlug }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
