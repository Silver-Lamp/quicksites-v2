// /pages/admin/theme-editor.tsx (adds TemplateRenderer demo for applying theme to a template)
'use client';

import { useTheme } from '@/hooks/useThemeContext';
import { useState } from 'react';
import GlowConfigurator from '@/components/glow-configurator';
import clsx from 'clsx';

const themePresets = {
  Classic: {
    accentColor: 'indigo-600',
    fontFamily: 'sans',
    borderRadius: 'lg',
  },
  Ocean: {
    accentColor: 'cyan-500',
    fontFamily: 'sans',
    borderRadius: 'xl',
  },
  Neon: {
    accentColor: 'fuchsia-500',
    fontFamily: 'mono',
    borderRadius: 'md',
  },
};

function getThemeClass(type: 'bg' | 'border' | 'rounded' | 'font', value: string | undefined) {
  if (!value) return '';
  return `${type}-${value}`;
}

export default function ThemeEditorPage() {
  const { theme, setTheme, siteSlug } = useTheme();
  const [localTheme, setLocalTheme] = useState(theme);

  const update = (field: keyof typeof localTheme, value: any) => {
    setLocalTheme((prev) => ({ ...prev, [field]: value }));
  };

  const applyPreset = (presetName: keyof typeof themePresets) => {
    setLocalTheme((prev) => ({ ...prev, ...themePresets[presetName] }));
  };

  const resetTheme = () => {
    setLocalTheme({
      accentColor: 'indigo-600',
      fontFamily: 'sans',
      borderRadius: 'lg',
      glow: theme.glow,
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🎨 Theme Editor</h1>

      <section className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Accent Color</label>
          <input
            type="text"
            value={localTheme.accentColor || ''}
            onChange={(e) => update('accentColor', e.target.value)}
            className="bg-zinc-800 text-white px-3 py-2 rounded border border-zinc-600 w-full"
            placeholder="e.g. indigo-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Font Family</label>
          <select
            value={localTheme.fontFamily || ''}
            onChange={(e) => update('fontFamily', e.target.value)}
            className="bg-zinc-800 text-white px-3 py-2 rounded border border-zinc-600 w-full"
          >
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Border Radius</label>
          <select
            value={localTheme.borderRadius || ''}
            onChange={(e) => update('borderRadius', e.target.value)}
            className="bg-zinc-800 text-white px-3 py-2 rounded border border-zinc-600 w-full"
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
            <option value="xl">Extra Large</option>
          </select>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 pt-4">
        {Object.keys(themePresets).map((preset) => (
          <button
            key={preset}
            onClick={() => applyPreset(preset as keyof typeof themePresets)}
            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded"
          >
            Apply {preset}
          </button>
        ))}
        <button
          onClick={resetTheme}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
        >
          Reset to Default
        </button>
      </div>

      <div className="pt-6">
        <button
          onClick={() => setTheme(localTheme)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
        >
          💾 Save Theme
        </button>
      </div>

      <div className="pt-8">
        <h2 className="text-xl font-semibold mb-3">💡 Glow Configuration</h2>
        <GlowConfigurator defaultGlowConfig={theme.glow} siteSlug={siteSlug} />
      </div>

      <div className="pt-12">
        <h2 className="text-xl font-semibold mb-3">🧪 Live Preview</h2>
        <div
          className={clsx(
            'border-l-4 p-4 bg-zinc-800 text-white',
            getThemeClass('rounded', localTheme.borderRadius),
            getThemeClass('font', localTheme.fontFamily),
            getThemeClass('border', localTheme.accentColor)
          )}
        >
          <p className="text-sm">This card reflects the current theme settings.</p>
          <button
            className={clsx(
              'mt-3 px-3 py-2 text-sm text-white',
              getThemeClass('bg', localTheme.accentColor),
              getThemeClass('rounded', localTheme.borderRadius)
            )}
          >
            Themed Button
          </button>
        </div>
      </div>
    </div>
  );
}
