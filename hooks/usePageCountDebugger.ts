'use client';

import { useEffect, useRef } from 'react';
import type { Template } from '@/types/template';

export function usePageCountDebugger(template: Template) {
  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    const currentCount = template?.data?.pages?.length ?? 0;

    if (lastCount.current !== null && currentCount < lastCount.current) {
      console.warn(
        `%c⚠️ [PageCountDebugger] Pages dropped from ${lastCount.current} to ${currentCount}.`,
        'color: orange; font-weight: bold;'
      );
      console.log('Previous count:', lastCount.current);
      console.log('Current template.pages:', template?.data?.pages);
    }

    lastCount.current = currentCount;
  }, [template?.data?.pages]);
}
