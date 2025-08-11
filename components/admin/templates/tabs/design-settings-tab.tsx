// components/admin/templates/design-settings-tab.tsx
'use client';

import { saveTemplate } from '@/admin/lib/saveTemplate';
import { ThemePreviewCard } from '@/components/admin/theme-preview-card';
import { useTheme } from '@/hooks/useThemeContext';
import type { Template } from '@/types/template';

type Props = {
  template: Template;
  onChange: (updated: Template) => void;
};

export default function DesignSettingsTab({ template, onChange }: Props) {
  const { theme: ctxTheme, setTheme } = useTheme();

  const currentMode = (template.color_mode as 'light' | 'dark' | undefined) ??
    ((ctxTheme?.darkMode as 'light' | 'dark') ?? 'light');

  return (
    <div className="pt-4 space-y-4">
      <ThemePreviewCard
        theme={template.theme}
        colorMode={currentMode}
        onToggleColorMode={async () => {
          const next = currentMode === 'dark' ? 'light' : 'dark';

          // Keep ThemeProvider and template in sync immediately
          setTheme({ ...ctxTheme, darkMode: next });
          onChange({ ...template, color_mode: next });

          // Persist to DB (saveTemplate already guards color_mode)
          await saveTemplate({ ...template, color_mode: next }, template.id);
        }}
        onSelectFont={(font: string) => {
          onChange({ ...template, theme: font });
        }}
      />
    </div>
  );
}
