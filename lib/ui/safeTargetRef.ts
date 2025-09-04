// lib/ui/safeTargetRef.ts
import { useMemo } from 'react';

/** Returns the same ref once hydrated, or `undefined` before mount. */
export function useSafeTargetRef<T extends HTMLElement>(
  ref?: React.RefObject<T | null>
): React.RefObject<T> | undefined {
  // Recompute when ref.current flips from null → element
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (ref?.current ? (ref as React.RefObject<T>) : undefined), [ref?.current]);
}
