// lib/theme/themePresets.ts

import type { SiteTheme } from '@/hooks/useThemeContext';

export const themePresets: Record<string, SiteTheme> = {
  Minimal: {
    glow: [],
    fontFamily: 'sans',
    borderRadius: 'md',
    accentColor: 'gray-700',
    darkMode: 'light',
  },
  Earthy: {
    glow: [
      { size: 'xl', intensity: 0.3, colors: ['from-lime-500', 'via-amber-500', 'to-rose-500'] },
    ],
    fontFamily: 'serif',
    borderRadius: 'lg',
    accentColor: 'amber-700',
    darkMode: 'light',
  },
  Vibrant: {
    glow: [
      { size: 'lg', intensity: 0.35, colors: ['from-pink-500', 'via-fuchsia-600', 'to-indigo-600'] },
    ],
    fontFamily: 'mono',
    borderRadius: 'xl',
    accentColor: 'fuchsia-500',
    darkMode: 'dark',
  },
};
