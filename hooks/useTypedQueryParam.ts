import { useRouter } from 'next/navigation.js';
import { z } from 'zod';
import { parseTypedQueryValue } from '../lib/query/parseTypedQueryValue.js';

type ParamReturn<T> = [
  T extends 'string[]'
    ? string[]
    : T extends 'number[]'
      ? number[]
      : T extends 'string'
        ? string
        : T extends 'number'
          ? number
          : T extends 'date'
            ? Date
            : T extends 'date[]'
              ? Date[]
              : T extends 'json'
                ? Record<string, any>
                : T extends 'json[]'
                  ? Record<string, any>[]
                  : T extends 'boolean'
                    ? boolean
                    : never,
  (value: any) => void,
];

export function useTypedQueryParam<
  T extends
    | 'string'
    | 'number'
    | 'boolean'
    | 'string[]'
    | 'number[]'
    | 'date'
    | 'date[]'
    | 'json'
    | 'json[]',
>(key: string, fallback: any, type: T, schema?: z.ZodType<any, any, any>): ParamReturn<T> {
  const router = useRouter();
  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );

  const setParam = (value: any) => {
    const newParams = new URLSearchParams(window.location.search);

    if (Array.isArray(value)) {
      newParams.delete(key);
      value.forEach((v) => {
        const serialized =
          typeof v === 'object' ? encodeURIComponent(JSON.stringify(v)) : String(v);
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
    router.replace(newUrl, undefined, { shallow: true });
  };

  if (!searchParams.has(key) && fallback !== undefined && type !== 'json') {
    searchParams.set(key, String(fallback));
    const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
    router.replace(newUrl, undefined, { shallow: true });
  }

  const values = searchParams.getAll(key);
  const value = ['string[]', 'number[]', 'date[]', 'json[]'].includes(type)
    ? values
    : searchParams.get(key);

  const parsed = parseTypedQueryValue(key, value, fallback, type, schema, router);
  return [parsed, setParam];
}
