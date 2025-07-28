// app/admin/hooks/useSafeScroll.ts
'use client';

import { RefObject, useEffect, useRef, useState } from 'react';
import { useScroll, useTransform, type MotionValue } from 'framer-motion';

type SafeScrollOptions = {
  target: RefObject<HTMLElement>;
  offset?: [string, string];
  layoutEffect?: boolean;
};

type SafeScrollResult = {
  scrollYProgress: MotionValue<number>;
  y: MotionValue<string>;
};

export function useSafeScroll({
  target,
  offset = ['start start', 'end start'],
  layoutEffect = false,
}: SafeScrollOptions): SafeScrollResult | null {
  const { scrollYProgress } = useScroll({
    target,
    offset: offset as any,
    layoutEffect,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (target.current) {
      setMounted(true);
    }
  }, [target.current]);

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-20%']);
  return mounted ? { scrollYProgress, y } : null;
}
