'use server';

import { cookies, headers } from 'next/headers';

/**
 * Returns static request stores. Safe to call early in Server Components.
 * Do not use `.get()` until after entering the async boundary.
 */
export function extractUserContext(): {
  cookieStore: ReturnType<typeof cookies>;
  headerStore: ReturnType<typeof headers>;
} {
  const cookieStore = cookies();
  const headerStore = headers();

  return {
    cookieStore,
    headerStore,
  };
}
