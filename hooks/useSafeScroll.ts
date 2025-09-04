// hooks/useSafeScroll.ts
'use client';

import { RefObject, useEffect, useMemo, useState } from 'react';
import { useScroll, useTransform, MotionValue, UseScrollOptions } from 'framer-motion';

type Offset = UseScrollOptions['offset'] | undefined;

type Options<T extends HTMLElement = HTMLElement> = {
  /** May be undefined before hydration; safe to omit */
  target?: RefObject<T | null> | undefined;
  offset?: Offset;
};

type Return = {
  /** Parallax-ready string transform (0% → -20%) */
  y?: MotionValue<string>;
  /** Raw progress from framer-motion */
  yProgress?: MotionValue<number>;
};

export function useSafeScroll<T extends HTMLElement = HTMLElement>(
  { target, offset }: Options<T>
): Return {
  // mark when we have a real element to attach to
  const [ready, setReady] = useState<boolean>(() => !!target?.current);

  useEffect(() => {
    if (!target?.current) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [target?.current]);

  // When not ready, pass {} → framer-motion binds to viewport (safe & SSR-friendly)
  // If you prefer to no-op until ready, set args = {} until ready === true
  const args = useMemo(
    () =>
      ready && target?.current
        ? ({ target: target as any, offset } as const)
        : ({} as const),
    [ready, target?.current, offset]
  );

  // This is safe even with {}: framer-motion defaults to viewport scroll
  const { scrollYProgress } = useScroll(args as any);

  // Provide a convenient parallax transform; consumers can ignore if not needed
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-20%']);

  return { y, yProgress: scrollYProgress };
}
