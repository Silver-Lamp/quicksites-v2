import { cookies } from 'next/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export function getStaticCookies(): ReadonlyRequestCookies {
  return cookies() as unknown as ReadonlyRequestCookies;
}
