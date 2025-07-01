import { cookies } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

/**
 * Returns a readable cookie store — safe in layouts and server components.
 */
export async function getReadableCookieStore(): Promise<ReadonlyRequestCookies> {
  const result = cookies();
  return result instanceof Promise ? await result : result;
}
