'use client';

import { ThemeProvider, useTheme } from '@/hooks/useThemeContext';
import clsx from 'clsx';
import { GoogleFontLoader } from './google-font-loader';
import { getFontClasses } from '@/lib/theme/getFontClasses';
import { GlowEffect } from './GlowEffect';

export default function TemplateRenderer({
  siteSlug = 'default',
  layout,
  children,
}: {
  siteSlug?: string;
  layout?: string;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider siteSlug={siteSlug}>
      <GoogleFontLoader />
      <ThemedPage>{children}</ThemedPage>
    </ThemeProvider>
  );
}

function ThemedPage({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const font = getFontClasses(theme);

  return (
    <main
      className={clsx(
        'relative min-h-screen text-white bg-zinc-950 px-4 py-12 overflow-hidden',
        font.tailwind
      )}
      style={{ fontFamily: font.css }}
      data-theme={theme.darkMode}
    >
      <GlowEffect />
      <div
        className={clsx(
          'relative mx-auto max-w-3xl border-l-4 p-6 z-10',
          theme.borderRadius && `rounded-${theme.borderRadius}`,
          theme.accentColor && `border-${theme.accentColor}`
        )}
      >
        {children}
      </div>
    </main>
  );
}
