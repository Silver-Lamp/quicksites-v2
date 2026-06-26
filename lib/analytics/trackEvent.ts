// lib/analytics/trackEvent.ts
import event from '@vercel/analytics';
import { getRequestContext } from '../request/getRequestContext';
import { cookies } from 'next/headers';
import { captureServer } from './posthog-server';

export async function trackEvent(
  name: string,
  data: Record<string, any> = {},
  options: { debug?: boolean } = {}
) {
  const { traceId, sessionId, userId, role } = await getRequestContext({
    cookieStore: await cookies(),
    headerStore: new Headers(),
  });
  const fullData = {
    traceId,
    sessionId,
    user: userId ?? 'guest',
    role,
    ...data,
  };

  event.track(name, fullData as any);

  // Mirror to PostHog (no-ops if POSTHOG_KEY is unset). Use userId as the distinct
  // id when known so server events stitch to the client-side identity.
  await captureServer(name, fullData, userId ?? sessionId ?? null);

  if (options.debug || process.env.NODE_ENV === 'development') {
    console.debug('[📊 Tracked Event]', name, fullData);
  }
}
