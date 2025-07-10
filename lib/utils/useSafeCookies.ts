import { cookies } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';

export type CookieAccessType = 'readonly' | 'writable';
export type SafeCookies = ReadonlyRequestCookies | ResponseCookies;

export interface SafeCookiesResult {
  cookies: SafeCookies;
  cookieMode: CookieAccessType;
}

/**
 * Provides a consistent, type-safe cookies() interface for both
 * server components (readonly) and route handlers (writable).
 */
export function useSafeCookies(): SafeCookiesResult {
  const raw = cookies() as unknown;

  const isWritable =
    typeof raw === 'object' &&
    raw !== null &&
    'set' in raw &&
    'delete' in raw;

  return {
    cookies: isWritable ? (raw as ResponseCookies) : (raw as ReadonlyRequestCookies),
    cookieMode: isWritable ? 'writable' : 'readonly',
  };
}
