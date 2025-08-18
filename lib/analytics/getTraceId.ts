// lib/analytics/getTraceId.ts
import { getRequestContext } from '../request/getRequestContext';
import { cookies } from 'next/headers';

/**
 * Returns the current request's traceId.
 */
export async function getTraceId(): Promise<string> {
  const { traceId } = await getRequestContext({
    cookieStore: await cookies(),
    headerStore: new Headers(),
  });
  return traceId;
}
