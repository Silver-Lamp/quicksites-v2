'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { parseTypedQueryValue } from '@/admin/lib/query/parseTypedQueryValue';

type InferParamType<T> =
  T extends 'string[]' ? string[] :
  T extends 'number[]' ? number[] :
  T extends 'string' ? string :
  T extends 'number' ? number :
  T extends 'date' ? Date :
  T extends 'date[]' ? Date[] :
  T extends 'json' ? Record<string, any> :
  T extends 'json[]' ? Record<string, any>[] :
  T extends 'boolean' ? boolean :
  never;

type ParamReturn<T> = [
  InferParamType<T>,
  (value: any) => void,
  () => void
];

function getSearchParams(): URLSearchParams {
  return typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
}

function isArrayType(type: string): boolean {
  return ['string[]', 'number[]', 'date[]', 'json[]'].includes(type);
}

export default function useTypedQueryParam<
  T extends
    | 'string'
    | 'number'
    | 'boolean'
    | 'string[]'
    | 'number[]'
    | 'date'
    | 'date[]'
    | 'json'
    | 'json[]'
>(
  key: string,
  fallback: any,
  type: T,
  schema?: z.ZodTypeAny
): ParamReturn<T> {
  const router = useRouter();
  const searchParams = getSearchParams();

  // Set default param if missing (only in browser)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!searchParams.has(key) && fallback !== undefined && type !== 'json') {
      const updated = new URLSearchParams(window.location.search);
      updated.set(key, String(fallback));
      const newUrl = `${window.location.pathname}?${updated.toString()}`;
      router.replace(newUrl);
    }
  }, [key, fallback, router, type]);

  const setParam = (value: any) => {
    const newParams = new URLSearchParams(window.location.search);

    if (Array.isArray(value)) {
      newParams.delete(key);
      value.forEach((v) => {
        const serialized =
          typeof v === 'object'
            ? encodeURIComponent(JSON.stringify(v))
            : String(v);
        newParams.append(key, serialized);
      });
    } else if (value instanceof Date) {
      newParams.set(key, value.toISOString());
    } else if (typeof value === 'object' && value !== null) {
      newParams.set(key, encodeURIComponent(JSON.stringify(value)));
    } else {
      newParams.set(key, String(value));
    }

    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    router.replace(newUrl);
  };

  const clearParam = () => {
    const newParams = new URLSearchParams(window.location.search);
    newParams.delete(key);
    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    router.replace(newUrl);
  };

  const values = searchParams.getAll(key);
  const raw = isArrayType(type) ? values : searchParams.get(key);

  const parsed: InferParamType<T> = parseTypedQueryValue(
    key,
    raw,
    fallback,
    type,
    schema as any,
    router as any
  );

  return [parsed, setParam, clearParam];
}
