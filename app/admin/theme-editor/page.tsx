// pages/admin/theme-editor.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/hooks/useThemeContext';
import { themePresets } from '@/lib/theme/themePresets';
import { ThemeControlPanel } from '@/components/admin/theme-control-panel';
import { ThemePreviewCard } from '@/components/admin/theme-preview-card';
import { ThemeDevicePreview } from '@/components/admin/theme-device-preview';
import GlowConfigurator from '@/components/glow-configurator';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import type { Template } from '@/types/template';

export default function ThemeEditorPage() {
  const { theme, setTheme, siteSlug } = useTheme();

  // Resolve initial mode without hardcoding 'dark'
  const resolvedInitialMode = useMemo<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const key = `theme-config::${siteSlug}`;
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.darkMode === 'dark' || parsed?.darkMode === 'light') {
            return parsed.darkMode;
          }
        }
      } catch {}
      const dom = document.documentElement.getAttribute('data-theme');
      if (dom === 'dark' || dom === 'light') return dom;
    }
    return (theme.darkMode as 'light' | 'dark') ?? 'light';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteSlug]); // don't depend on theme to avoid flip during mount

  const [template, setTemplate] = useState<Template>({
    id: '1',
    template_name: 'My Template',
    theme: 'default',
    color_mode: resolvedInitialMode, // ✅ no hardcoded dark
    slug: 'my-template',
    layout: 'default',
    color_scheme: 'neutral',
    brand: 'My Brand',
    industry: 'Automotive',
    data: { pages: [] },
    pages: [],
    services: [],
  });

  // Keep template.color_mode in sync when global theme.darkMode changes elsewhere
  useEffect(() => {
    const mode = (theme.darkMode as 'light' | 'dark' | undefined) ?? undefined;
    if (!mode) return;
    setTemplate(t => (t.color_mode === mode ? t : { ...t, color_mode: mode }));
  }, [theme.darkMode]);

  const setFont = (font: string) => {
    setTemplate(t => ({ ...t, theme: font }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-bold">🎨 Theme Editor</h1>

      <div className="space-y-4">
        <ThemeControlPanel />

        <div className="flex flex-wrap gap-2">
          {Object.entries(themePresets).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => setTheme(preset)}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded"
            >
              Apply {name}
            </button>
          ))}

          {/* Reset to a known light preset and keep template in sync */}
          <button
            onClick={() => {
              const next = {
                fontFamily: 'sans',
                accentColor: 'indigo-600',
                borderRadius: 'lg',
                glow: [],
                darkMode: 'light' as const,
              };
              setTheme(next);
              setTemplate(t => ({ ...t, color_mode: next.darkMode }));
            }}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
          >
            Reset
          </button>
        </div>
      </div>

      <GlowConfigurator defaultGlowConfig={theme.glow} siteSlug={siteSlug} />

      <ThemePreviewCard
        theme={template.theme}
        colorMode={template.color_mode as 'light' | 'dark'}
        onToggleColorMode={async () => {
          const next = template.color_mode === 'dark' ? 'light' : 'dark';
          // Persist to DB
          await saveTemplate({ ...template, color_mode: next }, template.id);
          // Keep both template state and ThemeProvider in sync
          setTemplate(t => ({ ...t, color_mode: next as 'light' | 'dark' }));
          setTheme({ ...theme, darkMode: next as 'light' | 'dark' });
        }}
        onSelectFont={setFont}
      />

      <ThemeDevicePreview />
    </div>
  );
}
