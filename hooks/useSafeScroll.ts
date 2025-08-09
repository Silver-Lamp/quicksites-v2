// app/admin/hooks/useSafeScroll.ts
'use client';

import { RefObject, useEffect, useRef, useState } from 'react';
import { useScroll, useTransform, type MotionValue, motionValue } from 'framer-motion';

type SafeScrollOptions = {
  target: RefObject<HTMLElement>;
  offset?: [string, string];
  layoutEffect?: boolean; // default false to avoid hydration races
};

type SafeScrollResult = {
  scrollYProgress: MotionValue<number>;
  y: MotionValue<string>;
};

/**
 * Safe wrapper around framer-motion useScroll:
 * - uses layoutEffect: false by default (prevents hydration warnings)
 * - always returns stable MotionValues (no nulls)
 * - detects when the ref becomes available
 */
export function useSafeScroll({
  target,
  offset = ['start start', 'end start'],
  layoutEffect = false,
}: SafeScrollOptions): SafeScrollResult {
  // Framer hook (will noop safely until target is ready when layoutEffect=false)
  const { scrollYProgress } = useScroll({
    target,
    offset: offset as any,
    layoutEffect,
  });

  // Fallback MV for pre-mount / missing ref
  const fallback = useRef(motionValue(0)).current;

  // Track readiness of the target ref
  const [ready, setReady] = useState<boolean>(() => !!target.current);
  useEffect(() => {
    // schedule to ensure DOM ref is attached
    let id = requestAnimationFrame(() => setReady(!!target.current));
    return () => cancelAnimationFrame(id);
  }, [target]);

  // Drive transform with either real progress or fallback
  const progress = ready ? scrollYProgress : fallback;
  const y = useTransform(progress, [0, 1], ['0%', '-20%']);

  return { scrollYProgress: progress, y };
}
