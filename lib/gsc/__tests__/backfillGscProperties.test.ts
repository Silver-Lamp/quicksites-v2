/**
 * @jest-environment node
 */
import { pickBackfillCandidates, backfillFailed, summarize } from '@/lib/gsc/backfillGscProperties';

const c = (domain: string) => ({ id: domain, domain });

describe('picking what still needs connecting', () => {
  it('skips domains already connected, in any property spelling', () => {
    // gsc_tokens stores "https://www.x.com/" for URL-prefix properties and "sc-domain:x.com" for
    // domain ones. Comparing raw strings would re-connect everything already connected.
    const out = pickBackfillCandidates(
      [c('arab-towing.com'), c('richland-towing.com'), c('new-one.com')],
      ['https://www.arab-towing.com/', 'sc-domain:richland-towing.com'],
    );
    expect(out.map((x) => x.domain)).toEqual(['new-one.com']);
  });

  it('bounds the batch — each domain is a Google call and a real DNS write', () => {
    const many = Array.from({ length: 50 }, (_, i) => c(`d${i}.com`));
    expect(pickBackfillCandidates(many, [], 10)).toHaveLength(10);
  });

  it('does not attempt the same domain twice in one batch', () => {
    expect(pickBackfillCandidates([c('x.com'), c('www.x.com'), c('X.COM')], [])).toHaveLength(1);
  });

  it('ignores rows with no domain rather than attempting an empty one', () => {
    expect(pickBackfillCandidates([{ id: '1', domain: '' }, c('ok.com')], [])).toEqual([
      { id: 'ok.com', domain: 'ok.com' },
    ]);
  });
});

describe('a batch that moved nothing forward is a failure', () => {
  // ⚠️ geo-rank-sync reported {campaigns: 100, synced: 0, ok: true} every day for months and the
  // zero was never read. This is that lesson, applied before the fact.
  it('fails when it attempted work and nothing connected or even went pending', () => {
    expect(backfillFailed({ attempted: 10, connected: 0, pending: 0 })).toBe(true);
  });

  it('counts pending as progress — the TXT is published, DNS is just slow', () => {
    expect(backfillFailed({ attempted: 10, connected: 0, pending: 10 })).toBe(false);
  });

  it('is not a failure when there was nothing to do', () => {
    expect(backfillFailed({ attempted: 0, connected: 0, pending: 0 })).toBe(false);
  });
});

describe('the summary counts each outcome once', () => {
  it('adds up', () => {
    const s = summarize(
      [
        { domain: 'a.com', status: 'connected' },
        { domain: 'b.com', status: 'pending' },
        { domain: 'c.com', status: 'failed', reason: 'dns_write_failed' },
      ],
      88,
    );
    expect(s).toMatchObject({ attempted: 3, connected: 1, pending: 1, failed: 1, remaining: 88 });
  });
});
