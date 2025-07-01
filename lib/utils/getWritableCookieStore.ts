import { cookies } from 'next/headers';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';

/**
 * Returns a writable cookie store — safe only in Server Actions or Route Handlers.
 */
export async function getWritableCookieStore(): Promise<ResponseCookies> {
  const result = cookies();
  return (result instanceof Promise ? await result : result) as unknown as ResponseCookies;
}
