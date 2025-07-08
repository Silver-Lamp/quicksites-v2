// lib/stringifyQueryParams.ts
import { ZodObject, ZodRawShape, z } from 'zod';

function encodeValue(value: any): string {
  return encodeURIComponent(String(value));
}

function flattenParams(
  obj: Record<string, any>,
  prefix = '',
  useBrackets = false
): [string, string][] {
  const entries: [string, string][] = [];

  for (const [key, value] of Object.entries(obj)) {
    const paramKey = prefix
      ? useBrackets
        ? `${prefix}[${key}]`
        : `${prefix}.${key}`
      : key;

    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        entries.push([`${paramKey}[]`, encodeValue(v)]);
      }
    } else if (typeof value === 'object') {
      entries.push(...flattenParams(value, paramKey, true));
    } else {
      entries.push([paramKey, encodeValue(value)]);
    }
  }

  return entries;
}

export function stringifyQueryParams<T extends ZodRawShape>(
  schema: ZodObject<T>,
  values: Partial<z.infer<ZodObject<T>>>
): string {
  const parsed = schema.partial().parse(values);
  const flat = flattenParams(parsed);
  return new URLSearchParams(flat).toString();
}
