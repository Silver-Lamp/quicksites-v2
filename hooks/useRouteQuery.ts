// hooks/useRouteQuery.ts
'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { z, ZodObject, ZodRawShape } from 'zod';
import { parseQueryParams } from '@/lib/parseQueryParams';
import { stringifyQueryParams } from '@/lib/stringifyQueryParams';

export function useRouteQuery<T extends ZodRawShape>(
  schema: ZodObject<T>
): {
  params: z.infer<typeof schema>;
  setParam: (key: keyof z.infer<typeof schema>, value: any) => void;
  clearParam: (key: keyof z.infer<typeof schema>) => void;
} {
  const router = useRouter();

  const searchParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const params = useMemo(() => parseQueryParams(schema, searchParams), [schema, searchParams]);

  const setParam = (key: keyof typeof params, value: any) => {
    const next = { ...params, [key]: value };
    const query = stringifyQueryParams(schema, next);
    const newUrl = `${window.location.pathname}?${query}`;
    router.replace(newUrl);
  };

  const clearParam = (key: keyof typeof params) => {
    const updated = new URLSearchParams(window.location.search);
    updated.delete(key as string);
    const newUrl = `${window.location.pathname}?${updated.toString()}`;
    router.replace(newUrl);
  };

  // Inject defaults once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const parsed = parseQueryParams(schema, searchParams);
    const urlParams = new URLSearchParams(window.location.search);
    let changed = false;

    for (const key in parsed) {
      const val = parsed[key];
      const raw = urlParams.get(key);
      const norm = Array.isArray(val) ? val.join(',') : String(val);
      if (!raw && val !== undefined && val !== null) {
        urlParams.set(key, norm);
        changed = true;
      }
    }

    if (changed) {
      router.replace(`${window.location.pathname}?${urlParams.toString()}`);
    }
  }, []);

  return { params, setParam, clearParam };
}
