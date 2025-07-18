import { useTheme } from '@/hooks/useThemeContext';
import { fontMap } from '@/lib/theme/fontMap';
import WebFont from 'webfontloader';
import { useEffect } from 'react';

export function GoogleFontLoader({ skip }: { skip?: boolean } = {}) {
  const { theme } = useTheme();
  const fontKey = theme.fontFamily as keyof typeof fontMap;
  const font = fontMap[fontKey] ?? fontMap.sans;

  useEffect(() => {
    if (skip) return;
    if (typeof document === 'undefined') return;

    const isLocal = document.fonts.check(`12px ${font.label}`);
    if (isLocal) return;

    WebFont.load({
      google: {
        families: [`${font.label}:400,700`],
      },
    });
  }, [font.label, skip]);

  return null;
}
