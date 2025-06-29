'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';

type BackgroundGlowProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  intensity?: number;
  colors?: string[];
  className?: string;
};

const sizeMap = {
  sm: 'w-[80%] h-[80%]',
  md: 'w-[100%] h-[100%]',
  lg: 'w-[120%] h-[120%]',
  xl: 'w-[140%] h-[140%]',
};

export default function BackgroundGlow({
  size = 'xl',
  intensity = 0.2,
  colors = ['from-purple-600', 'via-blue-500', 'to-pink-500'],
  className = '',
}: BackgroundGlowProps) {
  const isLargeScreen = useMediaQuery('(min-width: 768px)');
  const [prefersReducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
  }, []);

  if (!isLargeScreen || prefersReducedMotion) return null;

  const gradientClass = `bg-gradient-to-tr ${colors.join(' ')}`;
  const opacity = Math.min(Math.max(intensity, 0), 1);

  return (
    <div
      className={clsx('absolute inset-0 z-0 pointer-events-none', className)}
      aria-hidden="true"
    >
      <div
        className={clsx(
          'absolute -top-1/2 left-1/2 rounded-full blur-3xl motion-safe:animate-pulse-slow',
          sizeMap[size],
          gradientClass
        )}
        style={{ opacity }}
      />
    </div>
  );
}
