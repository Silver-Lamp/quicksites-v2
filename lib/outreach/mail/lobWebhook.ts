// lib/outreach/mail/lobWebhook.ts
//
// Import-light helpers for the inbound Lob delivery webhook — signature verification,
// the event-type → status map, and the monotonic status ranking. Kept separate from
// lob.ts (the send path) and the DB layer so these stay unit-testable with only Node's
// crypto. See app/api/outreach/webhooks/lob/route.ts.

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Postcard lifecycle statuses in monotonic order. A late-arriving webhook (e.g. an
 * "in_transit" event delivered after "delivered") must never move the status backwards,
 * so updates compare rank and only advance. Terminal states (delivered / returned /
 * failed) rank highest.
 */
export const POSTCARD_STATUS_RANK: Readonly<Record<string, number>> = {
  created: 0,
  rendered: 1,
  in_transit: 2,
  in_local_area: 3,
  processed_for_delivery: 4,
  re_routed: 5,
  delivered: 6,
  returned_to_sender: 6,
  failed: 6,
};

export type PostcardStatus = keyof typeof POSTCARD_STATUS_RANK;

/** True when `next` is a forward (or lateral-terminal) transition from `current`. */
export function isForwardStatus(current: string | null | undefined, next: string): boolean {
  const c = current && current in POSTCARD_STATUS_RANK ? POSTCARD_STATUS_RANK[current] : -1;
  const n = next in POSTCARD_STATUS_RANK ? POSTCARD_STATUS_RANK[next] : -1;
  if (n < 0) return false;
  return n >= c;
}

/**
 * Map a Lob `event_type.id` (e.g. "postcard.delivered", "postcard.in_transit") to our
 * status vocabulary. Returns null for events we don't track (so the webhook no-ops on
 * them rather than writing a bogus status).
 */
export function mapLobEventToStatus(eventTypeId: string | null | undefined): PostcardStatus | null {
  if (!eventTypeId) return null;
  const suffix = eventTypeId.toLowerCase().replace(/^postcard\./, '').replace(/-/g, '_').trim();
  switch (suffix) {
    case 'created':
      return 'created';
    case 'rendered_pdf':
    case 'rendered_thumbnails':
      return 'rendered';
    case 'mailed':
    case 'in_transit':
      return 'in_transit';
    case 'in_local_area':
      return 'in_local_area';
    case 'processed_for_delivery':
      return 'processed_for_delivery';
    case 'delivered':
      return 'delivered';
    case 're_routed':
      return 're_routed';
    case 'returned_to_sender':
      return 'returned_to_sender';
    case 'deleted':
    case 'failed':
      return 'failed';
    default:
      return null;
  }
}

/**
 * Verify a Lob webhook signature. Lob signs with HMAC-SHA256 over
 * `${timestamp}.${rawBody}` using the endpoint's webhook secret, delivering the hex
 * digest in `Lob-Signature` and the timestamp in `Lob-Signature-Timestamp`.
 *
 * `toleranceSec` (default 5 min) rejects stale timestamps to blunt replay. Pass 0 to
 * skip the freshness check. Returns false on any missing input — callers fail closed.
 */
export function verifyLobSignature(opts: {
  rawBody: string;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  secret: string | null | undefined;
  nowMs?: number;
  toleranceSec?: number;
}): boolean {
  const { rawBody, signature, timestamp, secret } = opts;
  if (!rawBody || !signature || !timestamp || !secret) return false;

  const tolerance = opts.toleranceSec ?? 300;
  if (tolerance > 0) {
    const tsMs = Number(timestamp);
    if (!Number.isFinite(tsMs)) return false;
    const now = opts.nowMs ?? Date.now();
    if (Math.abs(now - tsMs) > tolerance * 1000) return false;
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim(), 'utf8');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
