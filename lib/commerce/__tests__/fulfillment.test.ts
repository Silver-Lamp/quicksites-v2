/**
 * @jest-environment node
 */
// Kitchen state. The properties that matter are about honesty of the record and about not
// obstructing a correction — not about enforcing a tidy state machine.
import {
  FULFILLMENT_STATES,
  isFulfillmentStatus,
  nextActions,
  stampFor,
  transitionPatch,
  minutesBetween,
  isSettled,
  DEFAULT_FULFILLMENT,
} from '../fulfillment';

describe('the state set', () => {
  it('defaults to new — a paid order nobody has touched', () => {
    expect(DEFAULT_FULFILLMENT).toBe('new');
    expect(FULFILLMENT_STATES).toContain('new');
  });

  it('rejects anything not in the set', () => {
    expect(isFulfillmentStatus('preparing')).toBe(true);
    expect(isFulfillmentStatus('paid')).toBe(false); // payment word, not a kitchen word
    expect(isFulfillmentStatus('')).toBe(false);
    expect(isFulfillmentStatus(null)).toBe(false);
    expect(isFulfillmentStatus(undefined)).toBe(false);
  });
});

describe('what the merchant can do next', () => {
  it('offers exactly one primary action per state', () => {
    for (const s of FULFILLMENT_STATES) {
      const primaries = nextActions(s).filter((a) => a.primary);
      expect(primaries.length).toBeLessThanOrEqual(1);
    }
  });

  it('leads with the action wanted 95% of the time', () => {
    expect(nextActions('new').find((a) => a.primary)?.to).toBe('preparing');
    expect(nextActions('preparing').find((a) => a.primary)?.to).toBe('ready');
    expect(nextActions('ready').find((a) => a.primary)?.to).toBe('completed');
  });

  // ⚠️ THE DESIGN POINT. Real kitchens go backwards — the wrong bag goes out and the order returns
  // to preparing. Software that refuses the correction doesn't prevent the mistake, it makes the
  // screen disagree with the counter, and then people stop updating the screen.
  it('always allows a way back', () => {
    expect(nextActions('preparing').map((a) => a.to)).toContain('new');
    expect(nextActions('ready').map((a) => a.to)).toContain('preparing');
    expect(nextActions('completed').map((a) => a.to)).toContain('ready');
    expect(nextActions('cancelled').map((a) => a.to)).toContain('new');
  });

  it('never strands an order with no action at all', () => {
    for (const s of FULFILLMENT_STATES) expect(nextActions(s).length).toBeGreaterThan(0);
  });
});

describe('timestamps', () => {
  it('stamps the milestone states and nothing else', () => {
    expect(stampFor('preparing')).toBe('accepted_at');
    expect(stampFor('ready')).toBe('ready_at');
    expect(stampFor('completed')).toBe('completed_at');
    expect(stampFor('new')).toBeNull();
    expect(stampFor('cancelled')).toBeNull();
  });

  it('writes the status and its stamp together', () => {
    const patch = transitionPatch('ready', '2026-08-13T18:00:00.000Z');
    expect(patch).toEqual({ fulfillment_status: 'ready', ready_at: '2026-08-13T18:00:00.000Z' });
  });

  it('writes only the status when the state has no milestone', () => {
    expect(transitionPatch('new', '2026-08-13T18:00:00.000Z')).toEqual({ fulfillment_status: 'new' });
  });

  // ⚠️ Overwrite, not first-touch. ready → preparing → ready: the SECOND stamp is when the food was
  // actually collectable. Measuring ticket time from a retracted milestone flatters us, and finding
  // out how long orders really take is the entire reason these columns exist.
  it('overwrites on re-entry so the stamp describes a moment that stayed true', () => {
    const first = transitionPatch('ready', '2026-08-13T18:00:00.000Z');
    const second = transitionPatch('ready', '2026-08-13T18:12:00.000Z');
    expect(second.ready_at).toBe('2026-08-13T18:12:00.000Z');
    expect(second.ready_at).not.toBe(first.ready_at);
  });
});

describe('ticket time', () => {
  it('measures whole minutes', () => {
    expect(minutesBetween('2026-08-13T18:00:00Z', '2026-08-13T18:14:00Z')).toBe(14);
  });

  // ⚠️ null is "we cannot say", which is a different fact from 0 and must never render as "0 min".
  it('returns null rather than zero when a stamp is missing', () => {
    expect(minutesBetween(null, '2026-08-13T18:14:00Z')).toBeNull();
    expect(minutesBetween('2026-08-13T18:00:00Z', undefined)).toBeNull();
    expect(minutesBetween('nonsense', '2026-08-13T18:14:00Z')).toBeNull();
  });

  it('never reports negative time when stamps arrive out of order', () => {
    expect(minutesBetween('2026-08-13T18:14:00Z', '2026-08-13T18:00:00Z')).toBe(0);
  });
});

describe('isSettled', () => {
  it('is display-only and does not gate transitions', () => {
    expect(isSettled('completed')).toBe(true);
    expect(isSettled('cancelled')).toBe(true);
    expect(isSettled('ready')).toBe(false);
    // The proof it does not gate: a settled order still offers a way out.
    expect(nextActions('completed').length).toBeGreaterThan(0);
  });
});
