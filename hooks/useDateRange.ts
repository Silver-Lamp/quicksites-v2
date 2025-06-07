'use client';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

export function useDateRange() {
  const { query } = useRouter();

  const start = useMemo(() => {
    if (typeof query.start === 'string') return query.start;
    return '';
  }, [query.start]);

  const end = useMemo(() => {
    if (typeof query.end === 'string') return query.end;
    return '';
  }, [query.end]);

  return { start, end };
}