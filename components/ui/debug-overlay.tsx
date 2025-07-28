'use client';

import { cn } from '@/lib/utils'; // or use your class merging util

type DebugOverlayProps = {
  children: React.ReactNode;
  className?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
};

const positionMap = {
  'top-left': 'top-0 left-0',
  'top-right': 'top-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'bottom-right': 'bottom-0 right-0',
};

export default function DebugOverlay({
  children,
  className,
  position = 'top-left',
}: DebugOverlayProps) {
  return (
    <div
      className={cn(
        'absolute z-50 text-xs text-yellow-300 bg-black/70 px-2 py-1 pointer-events-none whitespace-pre-wrap',
        positionMap[position],
        className
      )}
    >
      {children}
    </div>
  );
}
