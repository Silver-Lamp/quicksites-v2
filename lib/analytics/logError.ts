// lib/analytics/logError.ts
import { cookies } from 'next/headers';
import { getRequestContext } from '../request/getRequestContext';

export async function logError(
  message: string,
  context: Record<string, any> = {},
  options: { debug?: boolean } = {}
) {
  const { traceId } = await getRequestContext({
    cookieStore: await cookies(),
    headerStore: new Headers(),
  });

  const payload = {
    message,
    traceId,
    ...context,
  };

  if (options.debug || process.env.NODE_ENV === 'development') {
    console.warn('[🚨 logError]', payload);
  }

  // try {
  //   await fetch('/api/log-client-error', {
  //     method: 'POST',
  //     body: JSON.stringify(payload),
  //   });
  // } catch (err) {
  //   console.warn('[logError → failed to report]', err);
  // }
}
