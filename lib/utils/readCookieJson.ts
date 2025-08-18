// lib/utils/readCookieJson.ts
import type { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { safeParse } from './safeParse';

export function readCookieJson<T = unknown>(store: RequestCookies, name: string): T | undefined {
  const raw = store.get(name)?.value;
  if (!raw) return undefined;
  // Never attempt to parse Supabase cookies
  if (name.startsWith('sb-')) return undefined;
  return safeParse<T>(raw) as T | undefined;
}
