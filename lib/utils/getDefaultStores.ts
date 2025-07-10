import { getStaticCookies } from './getStaticCookies';
import { getStaticHeaders } from './getStaticHeaders';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

/**
 * Returns both cookie and header stores for safe usage in layouts and RSCs.
 */
export function getDefaultStores(): {
  cookieStore: ReadonlyRequestCookies;
  headerStore: ReadonlyHeaders;
} {
  return {
    cookieStore: getStaticCookies(),
    headerStore: getStaticHeaders(),
  };
}
