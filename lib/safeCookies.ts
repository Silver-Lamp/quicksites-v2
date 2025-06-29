import { cookies as getRawCookies } from 'next/headers';

let _cookieCache: Awaited<ReturnType<typeof getRawCookies>> | null = null;

export async function getCookieStore() {
  if (_cookieCache) return _cookieCache;
  const maybePromise = getRawCookies();
  _cookieCache = maybePromise instanceof Promise ? await maybePromise : maybePromise;
  return _cookieCache;
}

export function safeParse<T = unknown>(value: string | undefined): T | string | undefined {
  if (!value) return undefined;

  if (
    value.startsWith('base64-') ||
    /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)
  ) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

type CookieStore = Awaited<ReturnType<typeof getRawCookies>>;

/**
 * Safe cookie getter — avoids parsing Supabase or JWT-style cookies.
 */
export async function getSafeCookie(
  name: string,
  cookieStore?: CookieStore
): Promise<string | object | undefined> {
  const store = cookieStore ?? (await getCookieStore());
  const raw = store.get(name)?.value;
  return safeParse(raw);
}

/**
 * Safe cookie setter — handles string or object values.
 */
export async function setSafeCookie(
  name: string,
  value: string | object,
  options: Parameters<CookieStore['set']>[2] = {}
) {
  const store = await getCookieStore();
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  store.set(name, encoded, options);
}

/**
 * Safe cookie remover.
 */
export async function removeSafeCookie(name: string) {
  const store = await getCookieStore();
  store.set(name, '', { maxAge: 0 });
}
