// components/ui/scroll-area.tsx
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional class for the inner viewport */
  viewportClassName?: string;
}

/**
 * Editor-safe ScrollArea
 * - Native overflow scrolling to avoid Radix ref/setState loops.
 * - Keeps a compatible API for common usages in your codebase.
 */
export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea({ className, viewportClassName, children, ...props }, ref) {
    return (
      <div ref={ref} className={cn('relative', className)} {...props}>
        <div className={cn('h-full w-full overflow-auto', viewportClassName)}>
          {children}
        </div>
      </div>
    );
  }
);

/**
 * No-op ScrollBar to satisfy existing imports/usages.
 * (Your layouts will rely on native scrollbars instead.)
 */
export const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: 'vertical' | 'horizontal' }
>(function ScrollBar(_props, _ref) {
  return null;
});

/** (Optional) tiny alias some codebases import */
export const ScrollAreaViewport = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function ScrollAreaViewport({ className, ...props }, ref) {
  return <div ref={ref} className={cn('h-full w-full overflow-auto', className)} {...props} />;
});
