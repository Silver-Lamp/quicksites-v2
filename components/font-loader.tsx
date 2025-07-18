// components/FontLoader.tsx
'use client';

import { useEffect } from 'react';
import WebFont from 'webfontloader';
import { useTheme } from '@/hooks/useThemeContext';

export function FontLoader() {
  const { theme } = useTheme();

  useEffect(() => {
    const family = theme.fontFamily;
    if (!family) return;

    const fontMap: Record<string, string> = {
      sans: 'Inter',
      serif: 'Roboto Slab',
      mono: 'Fira Code',
      cursive: 'Pacifico',
    };

    const googleFont = fontMap[family] || fontMap['sans'];

    WebFont.load({
      google: {
        families: [googleFont + ':400,700'],
      },
    });
  }, [theme.fontFamily]);

  return null;
}
