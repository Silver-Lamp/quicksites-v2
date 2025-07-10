import { headers } from 'next/headers';
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

export function getStaticHeaders(): ReadonlyHeaders {
  return headers() as unknown as ReadonlyHeaders;
}
