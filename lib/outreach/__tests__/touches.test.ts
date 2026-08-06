import { awaitingReply, validateTouch } from '../touches';

const t = (o: any) => ({
  id: o.id ?? Math.random().toString(36), template_id: o.template_id ?? null,
  prospect_id: null, subject_label: o.label ?? null, direction: o.dir,
  channel: o.channel ?? 'sms', body: 'x', attachment_url: null, attachment_name: null,
  occurred_at: o.at, actor_id: null,
});

describe('validateTouch — a contact without its words is what we already had', () => {
  it('refuses an empty body', () => {
    expect(validateTouch({ body: '  ', channel: 'sms', direction: 'outbound' })).toMatch(/paste what was actually sent/i);
  });
  it('refuses an unknown direction', () => {
    expect(validateTouch({ body: 'hi', channel: 'sms', direction: 'sideways' })).toMatch(/outbound or inbound/i);
  });
  it('accepts a real one', () => {
    expect(validateTouch({ body: 'hi', channel: 'sms', direction: 'outbound' })).toBeNull();
  });
});

describe('awaitingReply', () => {
  const NOW = Date.parse('2026-08-10T00:00:00Z');

  it('lists a subject whose last touch was ours', () => {
    const r = awaitingReply([t({ label: 'WS', dir: 'outbound', at: '2026-08-05T00:00:00Z' })], NOW);
    expect(r).toHaveLength(1);
    expect(r[0].daysWaiting).toBe(5);
  });

  it('DROPS a subject once they reply — the ball is ours, not theirs', () => {
    const r = awaitingReply([
      t({ label: 'WS', dir: 'outbound', at: '2026-08-05T00:00:00Z' }),
      t({ label: 'WS', dir: 'inbound', at: '2026-08-06T00:00:00Z' }),
    ], NOW);
    expect(r).toHaveLength(0);
  });

  it('re-lists them if we spoke again after their reply', () => {
    const r = awaitingReply([
      t({ label: 'WS', dir: 'outbound', at: '2026-08-05T00:00:00Z' }),
      t({ label: 'WS', dir: 'inbound', at: '2026-08-06T00:00:00Z' }),
      t({ label: 'WS', dir: 'outbound', at: '2026-08-08T00:00:00Z' }),
    ], NOW);
    expect(r).toHaveLength(1);
    expect(r[0].daysWaiting).toBe(2);
  });

  it('keeps subjects separate', () => {
    const r = awaitingReply([
      t({ label: 'WS', dir: 'outbound', at: '2026-08-01T00:00:00Z' }),
      t({ label: 'Other', dir: 'inbound', at: '2026-08-09T00:00:00Z' }),
    ], NOW);
    expect(r.map((x) => x.label)).toEqual(['WS']);
  });
});
