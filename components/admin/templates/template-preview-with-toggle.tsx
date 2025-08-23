'use client';

import { IndustryThemeScope } from '@/components/ui/industry-theme-scope';
import TemplatePreview from './template-preview';
import type { TemplateData } from '@/types/template';
import { Template } from '@/types/template';

export default function TemplatePreviewWithToggle({
  data,
  theme,
  brand,
  colorScheme,
  showJsonFallback,
  isDark,
  toggleDark,
  industry,
  template,
}: {
  data: TemplateData;
  theme?: string;
  brand?: string;
  colorScheme?: string;
  showJsonFallback?: boolean;
  isDark: boolean;
  toggleDark: () => void;
  industry: string;
  template: Template | null;
}) {
  const mode = isDark ? 'dark' : 'light';

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-end">
        <button
          onClick={toggleDark}
          className="text-sm px-3 py-1 border rounded-md bg-muted hover:bg-accent transition"
        >
          {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>
      </div>
      <IndustryThemeScope industry={industry}>
      <TemplatePreview
        data={data}
        mode={mode}
        theme={theme}
        brand={brand}
        colorScheme={colorScheme}
        showJsonFallback={showJsonFallback}
        template={template as unknown as Template}
      />
      </IndustryThemeScope>
    </div>
  );
}
