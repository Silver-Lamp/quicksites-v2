// components/editor/ThemeEditorPanel.tsx
'use client';

import { useTheme } from '@/hooks/useThemeContext';
import { themePresets } from '@/lib/theme/themePresets';
import { ThemePreviewCard } from '@/components/admin/theme-preview-card';

export function ThemeEditorPanel({ industry }: { industry: string }) {
  const { theme, setTheme, toggleDark } = useTheme();

  const handleChange = (key: keyof typeof theme, value: any) => {
    setTheme({ ...theme, [key]: value });
  };

  return (
    <div className="fixed right-4 top-20 z-50 w-80 bg-neutral-900 text-white border border-white/10 p-4 rounded shadow-lg space-y-4">
      <h3 className="text-lg font-semibold">Theme Editor</h3>

      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-white/70">Font Family</span>
          <select
            value={theme.fontFamily}
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
            value={theme.accentColor}
            onChange={(e) => handleChange('accentColor', e.target.value)}
            placeholder="e.g. indigo-600"
            className="w-full mt-1 rounded text-black p-1"
          />
        </label>

        <label className="block">
          <span className="text-white/70">Border Radius</span>
          <select
            value={theme.borderRadius}
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
          <span className="text-white/70">Dark Mode</span>
          <select
            value={theme.darkMode}
            onChange={(e) => handleChange('darkMode', e.target.value)}
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

      <ThemePreviewCard theme={theme.name || ''} onSelectFont={() => {}} />
    </div>
  );
}
