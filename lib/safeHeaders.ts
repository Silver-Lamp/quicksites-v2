import { headers as getRawHeaders } from 'next/headers';

let _headerCache: Awaited<ReturnType<typeof getRawHeaders>> | null = null;

export async function getHeaderStore() {
  if (_headerCache) return _headerCache;
  const maybePromise = getRawHeaders();
  _headerCache = maybePromise instanceof Promise ? await maybePromise : maybePromise;
  return _headerCache;
}

/**
 * Safely get a single header value by name.
 */
export async function getSafeHeader(name: string): Promise<string | undefined> {
  const store = await getHeaderStore();
  return store.get(name.toLowerCase()) ?? undefined;
}

/**
 * Get the client IP address, with standard fallback.
 */
export async function getClientIp(): Promise<string> {
  const h = await getHeaderStore();
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Get the client user-agent string.
 */
export async function getUserAgent(): Promise<string> {
  const h = await getHeaderStore();
  return h.get('user-agent') ?? 'unknown';
}
