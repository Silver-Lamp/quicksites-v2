import { z } from 'zod';
import { NextRouter } from 'next/router';

export function parseTypedQueryValue<T>(
  key: string,
  value: string | string[] | null,
  fallback: any,
  type: T,
  schema: z.ZodType<any, any, any> | undefined,
  router: NextRouter
): any {
  const isJson = type === 'json' || type === 'json[]';
  if (value === null || (Array.isArray(value) && value.length === 0))
    return fallback;

  try {
    if (type === 'number') {
      const parsed = Number(value);
      return !isNaN(parsed) ? parsed : fallback;
    }

    if (type === 'date') return new Date(value as string);

    if (type === 'number[]')
      return (value as string[]).map(Number).filter((v) => !isNaN(v));

    if (type === 'date[]') return (value as string[]).map((v) => new Date(v));

    if (type === 'boolean') return value === 'true';

    if (isJson) {
      if (type === 'json[]' && Array.isArray(value)) {
        const decodedArray = value
          .map((v) => {
            try {
              const decoded = decodeURIComponent(v);
              const parsed = JSON.parse(decoded);
              return parsed;
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        return decodedArray;
      }

      const decoded = decodeURIComponent(value as string);
      const parsed = JSON.parse(decoded);
      const effectiveSchema = schema || z.record(z.any());
      const validation = effectiveSchema.safeParse(parsed);

      if (!validation.success) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Invalid query param for “${key}”`, validation.error);
        }

        if (typeof window !== 'undefined' && fallback !== undefined) {
          const newParams = new URLSearchParams(window.location.search);
          newParams.set(key, encodeURIComponent(JSON.stringify(fallback)));
          const newUrl = `${window.location.pathname}?${newParams.toString()}`;
          router.replace(newUrl, undefined, { shallow: true });
        }

        return fallback;
      }

      return validation.data;
    }

    return value;
  } catch {
    return fallback;
  }
}
