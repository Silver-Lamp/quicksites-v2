import { cookies } from 'next/headers';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';

/**
 * Gets writable response cookies — only works inside route handlers.
 */
export function getResponseCookies(): ResponseCookies {
  return cookies() as unknown as ResponseCookies;
}
