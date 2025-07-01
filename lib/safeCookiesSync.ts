// lib/safeCookiesSync.ts
import { cookies as rawCookies } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { safeParse } from './utils/safeParse';

export function resolveCookiesSync(): ReadonlyRequestCookies {
  const result = rawCookies();
  if (result instanceof Promise) {
    throw new Error(
      'resolveCookiesSync() called in an async context. Use `await getCookieStore()` instead.'
    );
  }
  return result;
}

export function getSafeCookieSync(
  name: string,
  cookieStore?: ReadonlyRequestCookies
): string | object | undefined {
  const store = cookieStore ?? resolveCookiesSync();
  const raw = store.get(name)?.value;
  return safeParse(raw);
}
