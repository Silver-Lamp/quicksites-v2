'use client';

// lib/ab/client.ts — the browser half: read the sticky variant, post an event. Fire-and-forget.
import { AB_COOKIE, type AbEventName, type AbVariant } from '@/lib/ab/homepage';

export function readAbVariant(): AbVariant | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${AB_COOKIE}=(A|B)`));
    return (m?.[1] as AbVariant) ?? ((window as any).__qsAbVariant ?? null);
  } catch {
    return null;
  }
}

/** Post an event for the current variant. `assign` asks the route to set the sticky cookie (first exposure). */
export function abEvent(event: AbEventName, opts: { variant?: AbVariant | null; assign?: boolean } = {}): void {
  const variant = opts.variant ?? readAbVariant();
  if (!variant) return;
  const body = JSON.stringify({ variant, event, assign: opts.assign === true, path: location.pathname });
  try {
    if (navigator.sendBeacon && !opts.assign) {
      navigator.sendBeacon('/api/ab/event', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/ab/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true, credentials: 'same-origin' });
  } catch {
    /* never block the page */
  }
}
