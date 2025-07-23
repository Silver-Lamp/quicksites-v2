// pages/admin/theme-editor.tsx
'use client';

import { useTheme } from '@/hooks/useThemeContext';
import { themePresets } from '@/lib/theme/themePresets';
import { ThemeControlPanel } from '@/components/admin/theme-control-panel';
import { ThemePreviewCard } from '@/components/admin/theme-preview-card';
import { ThemeDevicePreview } from '@/components/admin/theme-device-preview';
import GlowConfigurator from '@/components/glow-configurator';

export default function ThemeEditorPage() {
  const { theme, setTheme, siteSlug } = useTheme();

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
          <button
            onClick={() =>
              setTheme({
                fontFamily: 'sans',
                accentColor: 'indigo-600',
                borderRadius: 'lg',
                glow: [],
                darkMode: 'light',
              })
            }
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
          >
            Reset
          </button>
        </div>
      </div>

      <GlowConfigurator defaultGlowConfig={theme.glow} siteSlug={siteSlug} />

      <ThemePreviewCard
        theme={theme.name || ''}
        onSelectFont={(font) => console.log('Selected font:', font)}
      />

      <ThemeDevicePreview />
    </div>
  );
}
