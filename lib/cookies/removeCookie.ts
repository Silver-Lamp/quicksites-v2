// lib/cookies/removeCookie.ts
'use server';

import { cookies } from 'next/headers';

/**
 * Deletes a cookie by name.
 */
export async function removeCookie(name: string) {
  // eslint-disable-next-line no-restricted-syntax
  const store = await cookies();
  store.set(name, '', {
    path: '/',
    maxAge: 0,
  });
}
