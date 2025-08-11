// components/editor/ThemeEditorPanel.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/hooks/useThemeContext';
import { themePresets } from '@/lib/theme/themePresets';
import { ThemePreviewCard } from '@/components/admin/theme-preview-card';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import type { Template } from '@/types/template';

type ThemeKeys = 'fontFamily' | 'accentColor' | 'borderRadius' | 'darkMode';

export function ThemeEditorPanel({ industry }: { industry: string }) {
  const { theme: ctxTheme, setTheme, siteSlug } = useTheme();

  // Resolve initial color mode from context (persisted) -> fallback to light
  const initialColorMode = useMemo<'light' | 'dark'>(() => {
    if (ctxTheme?.darkMode === 'dark' || ctxTheme?.darkMode === 'light') {
      return ctxTheme.darkMode;
    }
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
    return 'light';
  }, [ctxTheme?.darkMode, siteSlug]);

  const [template, setTemplate] = useState<Template>(() => ({
    id: '1',
    template_name: 'My Template',
    theme: 'default',
    color_mode: initialColorMode, // ✅ derive, don't hardcode
    slug: 'my-template',
    layout: 'default',
    color_scheme: 'neutral',
    brand: 'My Brand',
    industry: industry || 'Automotive',
    data: { pages: [] },
    pages: [],
    services: [],
  }));

  // Mirror context darkMode into local template.color_mode when it changes elsewhere
  useEffect(() => {
    const next = (ctxTheme?.darkMode as 'light' | 'dark' | undefined) ?? undefined;
    if (!next) return;
    setTemplate(t => (t.color_mode === next ? t : { ...t, color_mode: next }));
  }, [ctxTheme?.darkMode]);

  const handleChange = (key: ThemeKeys, value: any) => {
    setTheme({ ...ctxTheme, [key]: value });
  };

  return (
    <div className="fixed right-4 top-20 z-50 w-80 bg-neutral-900 text-white border border-white/10 p-4 rounded shadow-lg space-y-4">
      <h3 className="text-lg font-semibold">Theme Editor</h3>

      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-white/70">Font Family</span>
          <select
            value={ctxTheme.fontFamily}
            onChange={(e) => handleChange('fontFamily', e.target.value)}
            className="w-full mt-1 rounded text-black p-1"
          >
            <option value="sans">Inter (Sans)</option>
            <option value="serif">Roboto Slab (Serif)</option>
            <option value="mono">Fira Code (Mono)</option>
          </select>
        </label>

        <label className="block">
          <span className="text-white/70">Accent Color</span>
          <input
            type="text"
            value={ctxTheme.accentColor || ''}
            onChange={(e) => handleChange('accentColor', e.target.value)}
            placeholder="e.g. indigo-600"
            className="w-full mt-1 rounded text-black p-1"
          />
        </label>

        <label className="block">
          <span className="text-white/70">Border Radius</span>
          <select
            value={ctxTheme.borderRadius}
            onChange={(e) => handleChange('borderRadius', e.target.value)}
            className="w-full mt-1 rounded text-black p-1"
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
            <option value="xl">Extra Large</option>
            <option value="full">Full</option>
          </select>
        </label>

        <label className="block">
          <span className="text-white/70">Mode</span>
          <select
            value={ctxTheme.darkMode ?? 'light'}
            onChange={(e) => handleChange('darkMode', e.target.value as 'light' | 'dark')}
            className="w-full mt-1 rounded text-black p-1"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {Object.entries(themePresets).map(([name, preset]) => (
          <button
            key={name}
            onClick={() => setTheme(preset)}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs"
          >
            {name}
          </button>
        ))}
      </div>

      <ThemePreviewCard
        theme={template.theme}
        colorMode={template.color_mode as 'light' | 'dark'}
        onToggleColorMode={async () => {
          const next = template.color_mode === 'dark' ? 'light' : 'dark';
          // 1) keep ThemeProvider in sync immediately
          setTheme({ ...ctxTheme, darkMode: next });
          // 2) persist wherever your Template lives
          await saveTemplate({ ...template, color_mode: next }, template.id);
          // 3) mirror into local stub template state
          setTemplate(t => ({ ...t, color_mode: next }));
        }}
        onSelectFont={(font: string) => setTemplate(t => ({ ...t, theme: font }))}
      />
    </div>
  );
}
