'use client';

import { ReactNode } from 'react';

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
