import { ThemePreviewCard } from '@/components/admin/theme-preview-card';
import type { Template } from '@/types/template';

const defaultTheme = {
  glow: [],
  fontFamily: 'sans',
  borderRadius: 'lg',
  accentColor: 'indigo-600',
  darkMode: 'dark',
};

type Props = {
  template: Template;
  onChange: (updated: Template) => void;
  defaultTheme?: typeof defaultTheme;
};

export default function DesignSettingsTab({ template, onChange }: Props) {
  return (
    <div className="pt-4 space-y-4">
      <ThemePreviewCard
        theme={template.theme || defaultTheme.fontFamily}
        onSelectFont={(font: string) => onChange({ ...template, theme: font })}
      />
    </div>
  );
}
