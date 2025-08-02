// File: panels/ThemePanel.tsx

import { useTheme } from '@/hooks/useThemeContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Collapsible from '@/components/ui/collapsible-panel';
import { ThemePreviewCard } from '@/components/admin/theme-preview-card';
import type { Template } from '@/types/template';

const fonts = ['sans', 'serif', 'mono', 'cursive'];
const radii = ['sm', 'md', 'lg', 'xl', 'full'];
const modes = ['light', 'dark'];

export default function ThemePanel({ template, onChange }: { template: Template; onChange: (updated: Template) => void }) {
  const { setTheme } = useTheme();

  const handleResetTheme = () => {
    setTheme({ glow: [], fontFamily: 'sans' });
    onChange({ ...template, theme: 'sans' });
  };

  return (
    <Collapsible id="theme" title="Theme">
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Font</Label>
          <select
            value={template.theme || ''}
            onChange={(e) => {
              const font = e.target.value;
              onChange({ ...template, theme: font });
              setTheme({ glow: [], fontFamily: font });
            }}
            className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded mt-1"
          >
            <option value="">Default</option>
            {fonts.map((f) => (
              <option key={f} value={f}>
                {f === 'sans' ? 'Inter' : f === 'serif' ? 'Roboto Slab' : f === 'mono' ? 'Fira Code' : 'Pacifico'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Border Radius</Label>
          <select
            onChange={(e) => setTheme({ glow: [], fontFamily: template.theme || 'sans', borderRadius: e.target.value })}
            className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded mt-1"
          >
            {radii.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>Accent Color</Label>
          <Input
            placeholder="e.g. indigo-600"
            onBlur={(e) => setTheme({ glow: [], fontFamily: template.theme || 'sans', accentColor: e.target.value })}
            className="bg-gray-800 text-white border border-gray-700"
          />
        </div>

        <div>
          <Label>Dark Mode</Label>
          <select
            value={template.color_mode || 'dark'} // ✅ bound
            onChange={(e) => {
              const mode = e.target.value as 'light' | 'dark';
              onChange({ ...template, color_mode: mode });
              setTheme({ glow: [], fontFamily: template.theme || 'sans', darkMode: mode });
            }}
            className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded mt-1"
          >
            {modes.map((m) => (
              <option key={m} value={m}>
                {m === 'dark' ? '🌙 Dark' : '☀ Light'}
              </option>
            ))}
          </select>
        </div>

      </div>

      <ThemePreviewCard theme={template.theme || ''} onSelectFont={(font: string) => onChange({ ...template, theme: font })} />

      <div className="flex gap-4 pt-2">
        <button
          onClick={handleResetTheme}
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded"
        >
          Reset Theme
        </button>
        <button
          onClick={() => alert('🚧 Save as preset coming soon')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded"
        >
          Save as Preset
          </button>
        </div>
      </div>
    </Collapsible>
  );
}
