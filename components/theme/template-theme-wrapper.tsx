// components/theme/TemplateThemeWrapper.tsx
'use client';
import { useEffect } from 'react';

export function TemplateThemeWrapper({
  colorMode,
  children,
}: {
  colorMode: 'light' | 'dark';
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
  }, [colorMode]);

  return (
    <div className={colorMode === 'dark' ? 'dark' : ''}>
      {children}
    </div>
  );
}
