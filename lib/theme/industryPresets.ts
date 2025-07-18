// lib/theme/industryPresets.ts

import type { SiteTheme } from '@/hooks/useThemeContext';

export const industryPresets: Record<string, SiteTheme> = {
  towing: {
    fontFamily: 'serif',
    accentColor: 'purple-600',
    borderRadius: 'md',
    glow: [],
    darkMode: 'dark',
  },
  bakery: {
    fontFamily: 'cursive', // fallback, or override in font loader
    accentColor: 'yellow-500',
    borderRadius: 'xl',
    glow: [],
    darkMode: 'light',
  },
  agency: {
    fontFamily: 'sans',
    accentColor: 'sky-500',
    borderRadius: 'sm',
    glow: [],
    darkMode: 'light',
  },
};
