// components/admin/templates/panels/theme-panel.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useThemeContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Collapsible from '@/components/ui/collapsible-panel';
import { ThemePreviewCard } from '@/components/admin/theme-preview-card';
import { Palette } from 'lucide-react';
import type { Template } from '@/types/template';

const fonts = ['sans', 'serif', 'mono', 'cursive'];
const radii = ['sm', 'md', 'lg', 'xl', 'full'];
const modes = ['light', 'dark'];

export default function ThemePanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (patch: Partial<Template>) => void; // emit partials, parent will autosave data
}) {
  const { setTheme, theme: ctxTheme } = useTheme();

  // Local mirror for preview card, derive color mode from template or context
  const [localTpl, setLocalTpl] = useState<Template>(() => ({
    ...template,
    color_mode:
      (template.color_mode as 'light' | 'dark' | undefined) ??
      ((ctxTheme?.darkMode as 'light' | 'dark') ?? 'light'),
  }));

  // Keep local mirror synced with parent + context
  useEffect(() => {
    setLocalTpl((prev) => ({
      ...prev,
      ...template,
      color_mode:
        (template.color_mode as 'light' | 'dark' | undefined) ??
        (prev.color_mode as 'light' | 'dark') ??
        ((ctxTheme?.darkMode as 'light' | 'dark') ?? 'light'),
    }));
  }, [template, ctxTheme?.darkMode]);

  const handleResetTheme = () => {
    setTheme({ ...ctxTheme, glow: [], fontFamily: 'sans' });
    // Mirror into data so commit API persists it
    onChange({
      theme: 'sans',
      data: { ...(template.data ?? {}), theme: 'sans' } as any,
    });
  };

  // Persist a change into data.meta.theme — the object the render layer reads
  // (resolveSiteTheme). Merges onto any existing (e.g. curated) theme bag so the
  // manual controls below actually stick, not just update the preview context.
  const metaThemeData = (patch: Record<string, any>) => {
    const data: any = { ...(template.data ?? {}) };
    const meta: any = { ...(data.meta ?? {}) };
    const theme: any =
      meta.theme && typeof meta.theme === 'object' ? { ...meta.theme } : {};
    data.meta = { ...meta, theme: { ...theme, ...patch } };
    return data;
  };

  return (
    <Collapsible
      id="theme"
      title="Theme"
      icon={<Palette />}
      summary={[
        (template.color_mode || 'light') === 'dark' ? 'Dark' : 'Light',
        template.theme || null,
      ].filter(Boolean).join(' · ')}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Font family */}
          <div>
            <Label>Font</Label>
            <select
              value={template.theme || ''}
              onChange={(e) => {
                const font = e.target.value;
                // Persist into data.meta.theme (render field) + legacy data.theme.
                // Clear fontPair so a manual font choice wins over a curated pairing.
                const data = metaThemeData({ fontFamily: font, fontPair: null });
                data.theme = font;
                onChange({ theme: font, data });
                setTheme({ ...ctxTheme, glow: [], fontFamily: font });
                setLocalTpl((t) => ({ ...t, theme: font }));
              }}
              className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded mt-1"
            >
              <option value="">Default</option>
              {fonts.map((f) => (
                <option key={f} value={f}>
                  {f === 'sans'
                    ? 'Inter'
                    : f === 'serif'
                    ? 'Roboto Slab'
                    : f === 'mono'
                    ? 'Fira Code'
                    : 'Pacifico'}
                </option>
              ))}
            </select>
          </div>

          {/* Border radius (kept in UI theme; optionally mirror to data.meta if desired) */}
          <div>
            <Label>Border Radius</Label>
            <select
              value={ctxTheme.borderRadius || 'lg'}
              onChange={(e) => {
                const borderRadius = e.target.value;
                setTheme({ ...ctxTheme, glow: [], borderRadius });
                onChange({ data: metaThemeData({ borderRadius }) });
              }}
              className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded mt-1"
            >
              {radii.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Accent color (kept in UI theme; optionally mirror to data.meta if desired) */}
          <div>
            <Label>Accent Color</Label>
            <Input
              placeholder="e.g. indigo-600"
              defaultValue={ctxTheme.accentColor || ''}
              onBlur={(e) => {
                const accentColor = e.target.value;
                setTheme({ ...ctxTheme, glow: [], accentColor });
                onChange({ data: metaThemeData({ accentColor }) });
              }}
              className="bg-gray-800 text-white border border-gray-700"
            />
          </div>

          {/* Light/Dark mode */}
          <div>
            <Label>Mode</Label>
            <select
              value={template.color_mode || 'light'}
              onChange={(e) => {
                const mode = e.target.value as 'light' | 'dark';
                // Mirror into data (color_mode) + data.meta.theme.darkMode so the
                // commit API persists the change and the render layer reads it.
                const data = metaThemeData({ darkMode: mode });
                data.color_mode = mode;
                onChange({ color_mode: mode, data });
                setTheme({ ...ctxTheme, glow: [], darkMode: mode });
                setLocalTpl((t) => ({ ...t, color_mode: mode }));
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

        <ThemePreviewCard
          theme={localTpl.theme}
          colorMode={localTpl.color_mode as 'light' | 'dark'}
          onToggleColorMode={() => {
            const next =
              (localTpl.color_mode as 'light' | 'dark') === 'dark' ? 'light' : 'dark';
            // Sync context & parent first for immediate UI consistency
            setTheme({ ...ctxTheme, darkMode: next });
            onChange({
              color_mode: next,
              data: { ...(template.data ?? {}), color_mode: next },
            });
            // Keep local preview in step
            setLocalTpl((t) => ({ ...t, color_mode: next }));
          }}
          onSelectFont={(font: string) =>
            setLocalTpl((t) => ({ ...t, theme: font }))
          }
        />

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
