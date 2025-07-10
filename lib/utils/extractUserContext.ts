'use server';

import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

/**
 * Returns static request stores. Safe to call early in Server Components.
 * Do not use `.get()` until after entering the async boundary.
 */
export async function extractUserContext(): Promise<{
  cookieStore: ReadonlyRequestCookies;
  headerStore: ReadonlyHeaders;
}> {
  const cookieResult = await cookies();
  const headerResult = await headers();

  return {
    cookieStore: cookieResult,
    headerStore: headerResult,
  };
}
