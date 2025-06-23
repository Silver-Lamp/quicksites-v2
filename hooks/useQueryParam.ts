import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

export function useQueryParam(key: string, fallback = ''): string {
  const searchParams = useSearchParams();

  return useMemo(() => {
    if (typeof window === 'undefined') return fallback;
    const value = searchParams?.get(key);
    return value || fallback;
  }, [searchParams, key, fallback]);
}
