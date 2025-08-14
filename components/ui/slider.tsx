'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

type RootProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  RootProps
>(({ className, ...props }, ref) => {
  const cls = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(' ');
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cls('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-4 w-4 rounded-full border border-primary/20 bg-background ring-offset-background
                   transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                   focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = 'Slider';
