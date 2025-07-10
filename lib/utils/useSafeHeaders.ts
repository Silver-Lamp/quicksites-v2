import { headers } from 'next/headers';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

export type HeaderAccessType = 'readonly';
export type SafeHeaders = ReadonlyHeaders;

export interface SafeHeadersResult {
  headers: SafeHeaders;
  headerMode: HeaderAccessType;
}

/**
 * Provides a consistent, type-safe headers() interface for Server Components and Route Handlers.
 */
export function useSafeHeaders(): SafeHeadersResult {
  const raw = headers() as unknown as ReadonlyHeaders;

  return {
    headers: raw,
    headerMode: 'readonly',
  };
}
