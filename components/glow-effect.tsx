// components/GlowEffect.tsx
'use client';

import { useTheme } from '@/hooks/useThemeContext';
import clsx from 'clsx';

export function GlowEffect({ className = '' }: { className?: string }) {
  const { theme } = useTheme();
  const glow = theme.glow?.[0];

  if (!glow || !glow.colors || glow.colors.length === 0) return null;

  return (
    <div
      className={clsx(
        'absolute inset-0 pointer-events-none z-[-1] opacity-60 blur-2xl',
        `bg-gradient-to-br ${glow.colors.join(' ')}`,
        className
      )}
      style={{ opacity: glow.intensity ?? 0.3 }}
    />
  );
}
