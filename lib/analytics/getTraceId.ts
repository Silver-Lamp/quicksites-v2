// lib/analytics/getTraceId.ts
import { getRequestContext } from '../request/getRequestContext';

/**
 * Returns the current request's traceId.
 */
export async function getTraceId(): Promise<string> {
  const { traceId } = await getRequestContext();
  return traceId;
}
