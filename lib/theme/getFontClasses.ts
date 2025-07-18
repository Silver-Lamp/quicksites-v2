// lib/theme/getFontClasses.ts

import { fontMap } from '@/lib/theme/fontMap';
import type { SiteTheme } from '@/hooks/useThemeContext';

export function getFontClasses(theme: SiteTheme) {
  const key = theme.fontFamily as keyof typeof fontMap;
  const font = fontMap[key] ?? fontMap.sans;

  return {
    tailwind: font.tailwind,           // e.g. "font-sans"
    css: font.css,                     // e.g. "'Inter', sans-serif"
    label: font.label,                 // e.g. "Inter"
    preloadUrl: font.googleUrl,        // Google Fonts link if needed
  };
}
