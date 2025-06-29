// lib/analytics/trackEvent.ts
import event from '@vercel/analytics';
import { getRequestContext } from '../request/getRequestContext';

export async function trackEvent(
  name: string,
  data: Record<string, any> = {},
  options: { debug?: boolean } = {}
) {
  const { traceId, sessionId, userId, role } = await getRequestContext();

  const fullData = {
    traceId,
    sessionId,
    user: userId ?? 'guest',
    role,
    ...data,
  };

  event.track(name, fullData as any);

  if (options.debug || process.env.NODE_ENV === 'development') {
    console.debug('[📊 Tracked Event]', name, fullData);
  }
}
