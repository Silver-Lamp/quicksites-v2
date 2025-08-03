'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

export default function ThemeScope({
  mode,
  children,
  className = '',
}: {
  mode: ThemeMode;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      html.classList.remove('light', 'dark');
      html.classList.add(mode);
    }
  }, [mode]);

  return (
    <div
      key={`theme-${mode}`}
      data-theme={mode}
      className={className}
    >
      {children}
    </div>
  );
}
