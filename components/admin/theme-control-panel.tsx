// components/admin/theme-control-panel.tsx

import { useTheme } from '@/hooks/useThemeContext';
import { themePresets } from '@/lib/theme/themePresets';

const FONTS = ['sans', 'serif', 'mono'];
const RADII = ['sm', 'md', 'lg', 'xl', '2xl', 'full'];
const ACCENTS = ['indigo-600', 'green-600', 'red-500', 'blue-500', 'purple-600'];

export function ThemeControlPanel() {
  const { theme, setTheme } = useTheme();

  const update = (key: keyof typeof theme, value: any) => {
    setTheme({ ...theme, [key]: value });
  };

  return (
    <div className="p-4 border rounded-md space-y-4 text-sm bg-white dark:bg-neutral-900">
      <div>
        <label className="block mb-1 font-medium">Presets</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(themePresets).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => setTheme(preset)}
              className="px-3 py-1 text-xs rounded border hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block mb-1 font-medium">Font</label>
        <select value={theme.fontFamily} onChange={(e) => update('fontFamily', e.target.value)} className="w-full p-2 border rounded">
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div>
        <label className="block mb-1 font-medium">Border Radius</label>
        <select value={theme.borderRadius} onChange={(e) => update('borderRadius', e.target.value)} className="w-full p-2 border rounded">
          {RADII.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div>
        <label className="block mb-1 font-medium">Accent Color</label>
        <select value={theme.accentColor} onChange={(e) => update('accentColor', e.target.value)} className="w-full p-2 border rounded">
          {ACCENTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div>
        <label className="block mb-1 font-medium">Dark Mode</label>
        <select value={theme.darkMode} onChange={(e) => update('darkMode', e.target.value)} className="w-full p-2 border rounded">
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </div>
    </div>
  );
}
