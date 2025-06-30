'use server';

import { headers as rawHeaders } from 'next/headers';

let _headerCache: Awaited<ReturnType<typeof rawHeaders>> | null = null;

/**
 * Retrieves a cached or fresh header store.
 */
export async function getHeaderStore(): Promise<Headers> {
  if (_headerCache) return _headerCache;
  const result = rawHeaders();
  _headerCache = result instanceof Promise ? await result : result;
  return _headerCache;
}

/**
 * Retrieves a specific header value, lowercased.
 */
export async function getSafeHeader(name: string): Promise<string | undefined> {
  const store = await getHeaderStore();
  return store.get(name.toLowerCase()) ?? undefined;
}

/**
 * Get the client IP address, with standard fallbacks.
 */
export async function getClientIp(): Promise<string> {
  const headers = await getHeaderStore();
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Get the user-agent string from headers.
 */
export async function getUserAgent(): Promise<string> {
  const headers = await getHeaderStore();
  return headers.get('user-agent') ?? 'unknown';
}

/**
 * Get the referrer, if present.
 */
export async function getReferer(): Promise<string | undefined> {
  const headers = await getHeaderStore();
  return headers.get('referer') ?? undefined;
}
