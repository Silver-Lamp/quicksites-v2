// components/template-renderer.tsx
'use client';

import { ThemeProvider, useTheme } from '@/hooks/useThemeContext';
import clsx from 'clsx';

function getThemeClass(type: 'bg' | 'border' | 'rounded' | 'font', value?: string) {
  if (!value) return '';
  return `${type}-${value}`;
}

export default function TemplateRenderer({
  siteSlug = 'default',
  children,
}: {
  siteSlug?: string;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider siteSlug={siteSlug} >
      <ThemedPage>{children}</ThemedPage>
    </ThemeProvider>
  );
}

function ThemedPage({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <main
      className={clsx(
        'min-h-screen text-white bg-zinc-950 px-4 py-12',
        getThemeClass('font', theme.fontFamily)
      )}
    >
      <div
        className={clsx(
          'mx-auto max-w-3xl border-l-4 p-6',
          getThemeClass('rounded', theme.borderRadius),
          getThemeClass('border', theme.accentColor)
        )}
      >
        {children}
      </div>
    </main>
  );
}
