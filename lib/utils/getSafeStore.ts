import { cookies, headers } from 'next/headers';

type CookieStore = ReturnType<typeof cookies>;
type HeaderStore = ReturnType<typeof headers>;

/**
 * Returns either readable or writable cookie store, depending on context
 */
export function getSafeCookieStore(mode: 'readable' | 'writable'): CookieStore {
  const store = cookies() as any; // ← workaround TS bug

  if (mode === 'readable' && typeof store.get === 'function' && typeof store.set !== 'function') {
    return store;
  }

  if (mode === 'writable' && typeof store.set === 'function') {
    return store;
  }

  throw new Error(`getSafeCookieStore: store not valid for mode '${mode}'`);
}

/**
 * Safe header access
 */
export function getSafeHeaderStore(): HeaderStore {
  return headers();
}
