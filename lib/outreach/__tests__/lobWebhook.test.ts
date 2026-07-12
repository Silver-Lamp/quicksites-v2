// Unit tests for the pure Lob-webhook helpers (event mapping, monotonic status, HMAC verify).

import { createHmac } from 'crypto';
import {
  mapLobEventToStatus,
  isForwardStatus,
  verifyLobSignature,
  POSTCARD_STATUS_RANK,
} from '@/lib/outreach/mail/lobWebhook';

describe('mapLobEventToStatus', () => {
  it('maps known Lob event ids to our status vocabulary', () => {
    expect(mapLobEventToStatus('postcard.created')).toBe('created');
    expect(mapLobEventToStatus('postcard.rendered_pdf')).toBe('rendered');
    expect(mapLobEventToStatus('postcard.in_transit')).toBe('in_transit');
    expect(mapLobEventToStatus('postcard.mailed')).toBe('in_transit');
    expect(mapLobEventToStatus('postcard.in_local_area')).toBe('in_local_area');
    expect(mapLobEventToStatus('postcard.processed_for_delivery')).toBe('processed_for_delivery');
    expect(mapLobEventToStatus('postcard.delivered')).toBe('delivered');
    expect(mapLobEventToStatus('postcard.re-routed')).toBe('re_routed');
    expect(mapLobEventToStatus('postcard.returned_to_sender')).toBe('returned_to_sender');
  });

  it('returns null for untracked / missing events', () => {
    expect(mapLobEventToStatus('postcard.viewed')).toBeNull();
    expect(mapLobEventToStatus('letter.delivered')).toBeNull();
    expect(mapLobEventToStatus(null)).toBeNull();
    expect(mapLobEventToStatus(undefined)).toBeNull();
  });
});

describe('isForwardStatus (monotonic)', () => {
  it('advances forward and laterally, never backward', () => {
    expect(isForwardStatus(null, 'created')).toBe(true);
    expect(isForwardStatus('created', 'in_transit')).toBe(true);
    expect(isForwardStatus('in_transit', 'delivered')).toBe(true);
    // late/out-of-order event must not regress a delivered piece
    expect(isForwardStatus('delivered', 'in_transit')).toBe(false);
    expect(isForwardStatus('processed_for_delivery', 'created')).toBe(false);
  });

  it('treats terminal states as same-rank (idempotent re-delivery)', () => {
    expect(isForwardStatus('delivered', 'delivered')).toBe(true);
    expect(POSTCARD_STATUS_RANK.delivered).toBe(POSTCARD_STATUS_RANK.returned_to_sender);
  });

  it('rejects unknown target statuses', () => {
    expect(isForwardStatus('created', 'nope')).toBe(false);
  });
});

describe('verifyLobSignature', () => {
  const secret = 'whsec_test_123';
  const body = JSON.stringify({ event_type: { id: 'postcard.delivered' }, body: { id: 'psc_abc' } });
  const ts = '1720000000000';
  const good = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');

  it('accepts a valid signature within tolerance', () => {
    expect(
      verifyLobSignature({ rawBody: body, signature: good, timestamp: ts, secret, nowMs: Number(ts) + 1000 }),
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(
      verifyLobSignature({ rawBody: body + 'x', signature: good, timestamp: ts, secret, nowMs: Number(ts) }),
    ).toBe(false);
  });

  it('rejects a stale timestamp', () => {
    expect(
      verifyLobSignature({ rawBody: body, signature: good, timestamp: ts, secret, nowMs: Number(ts) + 10 * 60 * 1000 }),
    ).toBe(false);
  });

  it('fails closed on missing inputs', () => {
    expect(verifyLobSignature({ rawBody: body, signature: null, timestamp: ts, secret })).toBe(false);
    expect(verifyLobSignature({ rawBody: body, signature: good, timestamp: ts, secret: null })).toBe(false);
    expect(verifyLobSignature({ rawBody: '', signature: good, timestamp: ts, secret })).toBe(false);
  });
});
