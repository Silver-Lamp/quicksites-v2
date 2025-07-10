import { getStaticCookies } from './getStaticCookies';
import { getStaticHeaders } from './getStaticHeaders';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

export interface StaticRequestContext {
  cookies: ReadonlyRequestCookies;
  headers: ReadonlyHeaders;
}

/**
 * Returns both cookies and headers, statically and safely typed.
 * Use this in layouts, pages, or any Server Component to avoid Next.js warnings.
 */
export function getStaticContext(): StaticRequestContext {
  return {
    cookies: getStaticCookies(),
    headers: getStaticHeaders(),
  };
}
