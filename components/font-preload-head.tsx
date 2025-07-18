// components/FontPreloadHead.tsx
'use client';

import { useTheme } from '@/hooks/useThemeContext';
import { fontMap } from '@/lib/theme/fontMap';
import Head from 'next/head';

export function FontPreloadHead() {
  const { theme } = useTheme();
  const fontKey = theme.fontFamily as keyof typeof fontMap;
  const font = fontMap[fontKey] ?? fontMap.sans;

  return (
    <Head>
      <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={font.googleUrl} />
    </Head>
  );
}
