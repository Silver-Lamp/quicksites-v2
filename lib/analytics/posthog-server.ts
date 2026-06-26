// lib/analytics/posthog-server.ts
//
// Server-side PostHog client (singleton). Used for capturing events that must be
// trusted/authoritative — primarily the money path (orders, platform fees,
// commissions, payouts) so revenue analytics survive the planned backend split.
//
// No-ops gracefully when POSTHOG_KEY is unset (e.g. local dev without analytics),
// so callers never need to guard.
import { PostHog } from 'posthog-node';

const POSTHOG_KEY = process.env.POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;

/** Returns the shared PostHog node client, or null if analytics is not configured. */
export function getPostHogServer(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // Flush quickly in a serverless context so events aren't lost between invocations.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture a server-side event. Safe to call anywhere; no-ops without config.
 * Prefer a stable `distinctId` (userId) so events stitch to client identity;
 * falls back to 'server' for system/cron events.
 */
export async function captureServer(
  event: string,
  properties: Record<string, any> = {},
  distinctId?: string | null
): Promise<void> {
  const ph = getPostHogServer();
  if (!ph) return;
  ph.capture({
    distinctId: distinctId || 'server',
    event,
    properties: { source: 'server', ...properties },
  });
}

/** Flush pending events. Call at the end of long-lived/cron handlers before exit. */
export async function flushPostHog(): Promise<void> {
  if (client) await client.flush();
}
