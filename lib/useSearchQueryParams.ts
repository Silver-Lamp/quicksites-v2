// lib/useSearchQueryParams.ts
'use client';

import { useMemo } from 'react';
import { searchQuerySchema } from '@/lib/querySchemas/search';
import { parseQueryParams } from '@/lib/parseQueryParams';

export function useSearchQueryParams() {
  return useMemo(() => {
    return parseQueryParams(searchQuerySchema, new URLSearchParams(window.location.search));
  }, []);
}
