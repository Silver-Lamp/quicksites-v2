// hooks/useSafeScroll.ts
'use client';

import { RefObject, useEffect, useRef, useState } from 'react';
import {
  useScroll,
  useTransform,
  motionValue,
  type MotionValue,
  type UseScrollOptions,
} from 'framer-motion';

type SafeScrollOptions = {
  target: RefObject<HTMLElement>;
  // Use the official type from framer-motion
  offset?: UseScrollOptions['offset'];
  /**
   * @deprecated Framer Motion's `useScroll` doesn't support `layoutEffect`.
   * Kept for backward compatibility; ignored.
   */
  layoutEffect?: boolean;
};

type SafeScrollResult = {
  scrollYProgress: MotionValue<number>;
  y: MotionValue<string>;
};

export function useSafeScroll({
  target,
  offset = ['start start', 'end start'],
}: SafeScrollOptions): SafeScrollResult {
  // Call useScroll with only supported options
  const { scrollYProgress } = useScroll({
    target,
    offset,
  });

  // Fallback MV for pre-mount / missing ref
  const fallback = useRef(motionValue(0)).current;

  // Track readiness of the target ref
  const [ready, setReady] = useState<boolean>(() => !!target.current);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(!!target.current));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const progress = ready ? scrollYProgress : fallback;
  const y = useTransform(progress, [0, 1], ['0%', '-20%']);

  return { scrollYProgress: progress, y };
}
