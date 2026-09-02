/**
 * The usage row is what we invoice from. These tests are about the two ways a billing number
 * lies: an unknown recorded as a zero, and a failure recorded as a success.
 */
import { toUsageRow } from '@/lib/rehearsal/usage';

const envelope = { partner: 'quicksites', grant_id: 'g_1', lane: 'geo-domain-rental', cost_cents: 3, billed: true };

describe('rehearsal usage rows', () => {
  it('records what the engine actually reported', () => {
    const row = toUsageRow({ lane: 'geo-domain-rental', usage: envelope, latencyMs: 812.6 });
    expect(row).toMatchObject({
      lane: 'geo-domain-rental',
      partner: 'quicksites',
      grant_id: 'g_1',
      cost_cents: 3,
      billed: true,
      latency_ms: 813,
      status: 'ok',
      error: null,
    });
  });

  it('never turns an unknown cost into a zero', () => {
    // $0.00 meaning "we never found out" is a number that sums into an invoice and looks like a
    // fact. Null means unknown; zero means free. They are different and only one is checkable.
    for (const usage of [undefined, null, {}, { cost_cents: undefined }, { cost_cents: 1.5 }]) {
      const row = toUsageRow({ lane: 'x', usage: usage as any });
      expect(row.cost_cents).toBeNull();
    }
    // ...and a genuine zero survives as a zero.
    expect(toUsageRow({ lane: 'x', usage: { cost_cents: 0 } }).cost_cents).toBe(0);
  });

  it('never records a cost for a turn that failed', () => {
    // Mirrors the DB check constraint: status='error' implies cost_cents is null. A failed turn
    // did not return an envelope, so any number attached to it was invented downstream.
    const row = toUsageRow({ lane: 'x', usage: envelope, error: '401 grant rejected' });
    expect(row.status).toBe('error');
    expect(row.cost_cents).toBeNull();
    expect(row.error).toBe('401 grant rejected');
  });

  it('never stores billed as anything but what was reported', () => {
    // `billed` is HJ's determination, not ours to infer from the cost.
    expect(toUsageRow({ lane: 'x', usage: { cost_cents: 5 } }).billed).toBeNull();
    expect(toUsageRow({ lane: 'x', usage: { cost_cents: 0, billed: false } }).billed).toBe(false);
  });

  it('always attributes a lane, even if the engine echoes none', () => {
    expect(toUsageRow({ lane: 'geo-domain-rental', usage: {} }).lane).toBe('geo-domain-rental');
    expect(toUsageRow({ lane: '', usage: {} }).lane).toBe('unknown');
  });
});
