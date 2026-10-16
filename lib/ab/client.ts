'use client';

// lib/ab/client.ts — the browser half: find the active experiment + variant, post an event.
// Fire-and-forget; never blocks the page.
//
// Where the variant comes from: the site renderer stamps `data-qs-ab="<experiment>|<variant>"` on
// its root for a site test; the QuickSites homepage sets `window.__qsAb`. The cookie is set by
// the route, so on the first exposure the stamp is the only source.
import { AB_COOKIE, AB_EXPERIMENT, type AbEventName, type AbVariant } from '@/lib/ab/homepage';

export const AB_STAMP_ATTR = 'data-qs-ab';

export type ActiveAb = { experiment: string; variant: AbVariant };

export function readActiveAb(): ActiveAb | null {
  try {
    const w = window as any;
    if (w.__qsAb?.experiment && (w.__qsAb.variant === 'A' || w.__qsAb.variant === 'B')) return w.__qsAb as ActiveAb;
    const stamp = document.querySelector(`[${AB_STAMP_ATTR}]`)?.getAttribute(AB_STAMP_ATTR) ?? '';
    const [experiment, variant] = stamp.split('|');
    if (experiment && (variant === 'A' || variant === 'B')) return { experiment, variant };
    const m = document.cookie.match(new RegExp(`(?:^|; )${AB_COOKIE}=(A|B)`));
    if (m) return { experiment: AB_EXPERIMENT, variant: m[1] as AbVariant };
  } catch {
    /* no DOM */
  }
  return null;
}

/** Post an event for the active experiment. `assign` asks the route to set the sticky cookie (first exposure). */
export function abEvent(event: AbEventName, opts: { active?: ActiveAb | null; assign?: boolean } = {}): void {
  const active = opts.active ?? readActiveAb();
  if (!active) return;
  const body = JSON.stringify({ experiment: active.experiment, variant: active.variant, event, assign: opts.assign === true, path: location.pathname });
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
