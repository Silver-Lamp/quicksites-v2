// components/ui/IndustryThemeScope.tsx
'use client';
import { industryPresets } from '@/lib/theme/industryPresets';

export function IndustryThemeScope({ industry = 'towing', children }: { industry?: string; children: React.ReactNode }) {
  const theme = industryPresets[industry] || industryPresets['towing'];

  return (
    <div
      style={{
        '--font-family': theme.fontFamily,
        '--primary-color': theme.accentColor,
        '--radius': theme.borderRadius,
      } as React.CSSProperties}
      className="font-[var(--font-family)] text-white"
    >
      {children}
    </div>
  );
}
