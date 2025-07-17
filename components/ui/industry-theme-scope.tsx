// components/ui/IndustryThemeScope.tsx
'use client';
import { industryThemes } from '@/lib/themes/industryThemes';

export function IndustryThemeScope({ industry = 'towing', children }: { industry?: string; children: React.ReactNode }) {
  const theme = industryThemes[industry] || industryThemes['towing'];

  return (
    <div
      style={{
        '--font-family': theme.font,
        '--primary-color': theme.primaryColor,
        '--radius': theme.borderRadius,
      } as React.CSSProperties}
      className="font-[var(--font-family)] text-white"
    >
      {children}
    </div>
  );
}
