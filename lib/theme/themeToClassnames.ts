// lib/theme/themeToClassnames.ts
import type { SiteTheme } from '@/hooks/useThemeContext';
import clsx from 'clsx';

export function themeToClassnames(theme: SiteTheme) {
  return {
    button: clsx(
      'px-4 py-2 transition-colors',
      `rounded-${theme.borderRadius ?? 'md'}`,
      `font-${theme.fontFamily ?? 'sans'}`,
      theme.accentColor ? `bg-${theme.accentColor} text-white` : '',
    ),
    outlineButton: clsx(
      'px-4 py-2 border transition-colors',
      `rounded-${theme.borderRadius ?? 'md'}`,
      `font-${theme.fontFamily ?? 'sans'}`,
      theme.accentColor
        ? `border-${theme.accentColor} text-${theme.accentColor} hover:bg-${theme.accentColor}/10`
        : ''
    ),
    radius: theme.borderRadius ? `rounded-${theme.borderRadius}` : '',
    font: theme.fontFamily ? `font-${theme.fontFamily}` : '',
    accentBorder: theme.accentColor ? `border-${theme.accentColor}` : '',
    accentText: theme.accentColor ? `text-${theme.accentColor}` : '',
    accentBg: theme.accentColor ? `bg-${theme.accentColor}` : '',
  };
}
