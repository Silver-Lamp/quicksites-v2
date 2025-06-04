import { useMemo } from 'react';
import { useRouter } from 'next/router';

export function useQueryParam(key: string, fallback = ''): string {
  const router = useRouter();

  return useMemo(() => {
    if (typeof window === 'undefined') return fallback;
    const value = new URLSearchParams(window.location.search).get(key);
    return value || fallback;
  }, [router.query, key, fallback]);
}
