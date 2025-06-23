'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export function useDateRange() {
  const searchParams = useSearchParams();

  const start = useMemo(() => {
    if (typeof searchParams?.get('start') === 'string') return searchParams.get('start');
    return '';
  }, [searchParams?.get('start')]);

  const end = useMemo(() => {
    if (typeof searchParams?.get('end') === 'string') return searchParams.get('end');
    return '';
  }, [searchParams?.get('end')]);

  return { start, end };
}
