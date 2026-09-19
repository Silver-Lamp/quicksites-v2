/**
 * @jest-environment node
 */
// lib/ppl/__tests__/rules.test.ts — the money decisions and the honesty surface.

import {
  PPL_DEFAULTS,
  canRouteCall,
  disputeWindowOpen,
  estimateLeadsRemaining,
  isBillableCall,
  needsReload,
  reloadIdempotencyKey,
  usd,
} from '@/lib/ppl/rules';
import {
  FORBIDDEN_IVR_PHRASES,
  bridgeTwiml,
  notConnectingTwiml,
  recordingNotice,
} from '@/lib/ppl/ivr';

describe('billability', () => {
  it('a completed call at or over the minimum is a lead; under it is not', () => {
    expect(
      isBillableCall({ dialStatus: 'completed', connectedSeconds: 90, minBillableSeconds: 90 })
    ).toEqual({ billable: true, reason: 'completed' });
    expect(
      isBillableCall({ dialStatus: 'completed', connectedSeconds: 89, minBillableSeconds: 90 })
    ).toEqual({ billable: false, reason: 'too_short' });
  });
  it.each(['no-answer', 'busy', 'failed', 'canceled', undefined])(
    '%s never bills, whatever the duration',
    (s) => {
      expect(
        isBillableCall({ dialStatus: s, connectedSeconds: 600, minBillableSeconds: 90 }).billable
      ).toBe(false);
    }
  );
});

describe('routing + reload', () => {
  const base = { status: 'active' as const, balance_cents: 8500, cpl_cents: 8500 };
  it('routes only an active account that can afford one more lead', () => {
    expect(canRouteCall(base)).toBe(true);
    expect(canRouteCall({ ...base, balance_cents: 8499 })).toBe(false);
    expect(canRouteCall({ ...base, status: 'paused' })).toBe(false);
    expect(canRouteCall({ ...base, status: 'pending' })).toBe(false);
  });
  it('reloads under the threshold only when opted in', () => {
    expect(needsReload({ auto_reload: true, reload_threshold_cents: 30000 }, 29999)).toBe(true);
    expect(needsReload({ auto_reload: true, reload_threshold_cents: 30000 }, 30000)).toBe(false);
    expect(needsReload({ auto_reload: false, reload_threshold_cents: 30000 }, 0)).toBe(false);
  });
  it('the reload idempotency key is deterministic per triggering charge — never a time bucket', () => {
    const k = reloadIdempotencyKey('acc', 'ledger1');
    expect(k).toBe(reloadIdempotencyKey('acc', 'ledger1'));
    expect(k).not.toBe(reloadIdempotencyKey('acc', 'ledger2'));
    expect(k).not.toMatch(/\d{9,}/); // no Date.now() fragment
  });
  it('estimates leads remaining from the account’s own price, not a constant', () => {
    expect(estimateLeadsRemaining(30000, 8500)).toBe(3);
    expect(estimateLeadsRemaining(30000, 5000)).toBe(6);
    expect(estimateLeadsRemaining(-100, 8500)).toBe(0);
  });
  it('dispute window is 72h from the charge', () => {
    const t = Date.parse('2026-09-18T12:00:00Z');
    expect(disputeWindowOpen('2026-09-18T12:00:00Z', t + 71 * 3_600_000)).toBe(true);
    expect(disputeWindowOpen('2026-09-18T12:00:00Z', t + 73 * 3_600_000)).toBe(false);
    expect(PPL_DEFAULTS.disputeWindowHours).toBe(72);
  });
  it('formats cents as dollars', () => {
    expect(usd(8500)).toBe('$85.00');
    expect(usd(120000)).toBe('$1,200.00');
  });
});

describe('the IVR never lies to the caller', () => {
  const outputs = [
    recordingNotice('Austin Roofing Pros'),
    bridgeTwiml({
      businessName: 'Austin Roofing Pros',
      forwardTo: '+15125550100',
      actionUrl: 'https://x/api/twilio/ppl/complete?c=1',
      whisperUrl: 'https://x/w',
    }),
    notConnectingTwiml({
      businessName: 'Austin Roofing Pros',
      recordActionUrl: 'https://x/api/twilio-callback',
    }),
    notConnectingTwiml({ businessName: 'Austin Roofing Pros' }),
  ];
  it.each(FORBIDDEN_IVR_PHRASES)('never says “%s”', (phrase) => {
    for (const o of outputs) expect(o.toLowerCase()).not.toContain(phrase.toLowerCase());
  });
  it('the recording notice is spoken before every bridge', () => {
    const t = outputs[1];
    expect(t.indexOf('may be recorded')).toBeGreaterThan(0);
    expect(t.indexOf('may be recorded')).toBeLessThan(t.indexOf('<Dial'));
  });
  it('when the balance is out, the caller is told the line is not connecting — the true reason’s shape, not a fake one', () => {
    expect(outputs[2]).toContain('not connecting calls right now');
  });
  it('escapes the business name and URLs for XML', () => {
    const t = bridgeTwiml({
      businessName: "Bob's <Roofing> & Co",
      forwardTo: '+1',
      actionUrl: 'https://x/a?b=1&c=2',
    });
    expect(t).toContain('Bob&apos;s &lt;Roofing&gt; &amp; Co');
    expect(t).toContain('action="https://x/a?b=1&amp;c=2"');
  });
});

describe('the voice route bridges a PPL call only to the account holder', () => {
  // Some pitch sites carry a real local provider's number placed for visitor goodwill. That
  // provider never consented to be bridged with a recording notice, metered, or billed — so
  // the PPL branch may never fall back to the campaign's forward_to. A source guard, because
  // a unit test cannot see a `|| forwardTo` that someone adds back for convenience.
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const src = readFileSync('app/api/twilio/geo/[campaignId]/route.ts', 'utf8');
  const pplBlock = src.slice(
    src.indexOf("pricing_model === 'ppl'"),
    src.indexOf('if (!forwardTo)')
  );
  it('the PPL destination is account.contact_phone or nothing', () => {
    expect(pplBlock).toContain('account?.contact_phone || null');
    expect(pplBlock).not.toMatch(/contact_phone \|\| forwardTo/);
    expect(pplBlock).not.toMatch(/forwardTo:\s*forwardTo/);
  });
  it('the plain forward path says the recording notice before it dials', () => {
    const plain = src.slice(src.indexOf('if (!forwardTo)'));
    expect(plain.indexOf('may be recorded')).toBeGreaterThan(0);
    expect(plain.indexOf('may be recorded')).toBeLessThan(plain.indexOf('<Dial record='));
  });
});

describe('caller ID on the bridge', () => {
  it('presents the inbound caller, escaped, when given; omits the attribute otherwise', () => {
    const withId = bridgeTwiml({
      businessName: 'X',
      forwardTo: '+1',
      actionUrl: 'https://x/a',
      callerId: '+15551234567',
    });
    expect(withId).toContain('callerId="+15551234567"');
    const without = bridgeTwiml({ businessName: 'X', forwardTo: '+1', actionUrl: 'https://x/a' });
    expect(without).not.toContain('callerId');
  });
  it('both bridge paths present OUR number as caller ID and speak the caller’s number in the whisper', () => {
    const src = require('node:fs').readFileSync('app/api/twilio/geo/[campaignId]/route.ts', 'utf8');
    expect(src).toContain('callerId: campaign.tracking_number');
    expect(src).toContain('const ownNumber = campaign?.tracking_number');
    expect(src).not.toMatch(/callerId: searchParams\.get\('From'\)/);
    expect(src).not.toMatch(/callerId="\$\{esc\(from\)\}"/);
    expect(src).toContain('calling from ${spokenNumber(');
  });
});
