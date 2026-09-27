// lib/ppl/__tests__/forwardCandidates.test.ts
//
// The load-bearing assertions are the ones about NOT recommending: a thin or stale pool must
// refuse to auto-apply, and an unrated business must not be punished for being unrated. The
// ranking itself is the easy part.
import {
  recommendForwardTargets,
  shrunkRating,
  areaCodeFlag,
  normalizePhone,
  isAutoApplyEligible,
  decidedByLabel,
  type ForwardProspect,
  type ForwardCampaign,
} from '../forwardCandidates';

const NOW = new Date('2026-09-27T00:00:00Z');
const FRESH = '2026-09-20T00:00:00Z';
const STALE = '2026-07-12T00:00:00Z';

function prospect(over: Partial<ForwardProspect> & { id: string }): ForwardProspect {
  return {
    business_name: `Biz ${over.id}`,
    phone: '(253) 555-0100',
    website: null,
    city: 'South Hill',
    region: 'WA',
    industry_key: 'towing',
    rating: null,
    review_count: null,
    status: 'draft_built',
    created_at: FRESH,
    ...over,
  };
}

const CAMPAIGN: ForwardCampaign = {
  id: 'c1',
  domain: 'southhilltowing.com',
  city: 'South Hill',
  region: 'WA',
  industry_key: 'towing',
};

describe('normalizePhone', () => {
  it('compares a formatted number equal to E.164', () => {
    expect(normalizePhone('(253) 204-1234')).toBe('2532041234');
    expect(normalizePhone('+12532041234')).toBe('2532041234');
  });
});

describe('shrunkRating', () => {
  it('does not let a 5.0 from 2 reviews beat a 4.6 from 200', () => {
    expect(shrunkRating(4.6, 200)).toBeGreaterThan(shrunkRating(5.0, 2));
  });

  it('scores an unrated business at the prior rather than zero', () => {
    // The no-website cohort is mostly unrated; treating absence as badness would rank the pool
    // by how thoroughly Google has noticed it.
    expect(shrunkRating(null, null)).toBeCloseTo(4.3, 5);
    expect(shrunkRating(null, null)).toBeGreaterThan(shrunkRating(3.0, 500));
  });
});

describe('region matching', () => {
  it('refuses a same-named city in another state', () => {
    // Covington WA and Covington GA both exist. A city-name match would forward Washington
    // towing calls to Georgia.
    const wa: ForwardCampaign = { ...CAMPAIGN, domain: 'covingtontow.com', city: 'Covington', region: 'WA' };
    const out = recommendForwardTargets(
      wa,
      [
        prospect({ id: 'ga', city: 'Covington', region: 'GA' }),
        prospect({ id: 'wa', city: 'Covington', region: 'WA' }),
      ],
      { now: NOW },
    );
    expect(out.ranked.map((c) => c.prospect.id)).toEqual(['wa']);
    expect(out.disqualified).toEqual([
      expect.objectContaining({ reason: 'region_mismatch' }),
    ]);
  });
});

describe('hard requirements', () => {
  it('drops a business with no usable phone regardless of how good it looks', () => {
    const out = recommendForwardTargets(
      CAMPAIGN,
      [prospect({ id: 'a', phone: null, rating: 5, review_count: 400 })],
      { now: NOW },
    );
    expect(out.ranked).toHaveLength(0);
    expect(out.disqualified[0].reason).toBe('no_phone');
  });

  it('drops a business that replied STOP', () => {
    const out = recommendForwardTargets(CAMPAIGN, [prospect({ id: 'a', phone: '2535550100' })], {
      now: NOW,
      optedOut: new Set(['2535550100']),
    });
    expect(out.disqualified[0].reason).toBe('opted_out');
  });

  it('drops a different trade', () => {
    const out = recommendForwardTargets(CAMPAIGN, [prospect({ id: 'a', industry_key: 'concrete' })], {
      now: NOW,
    });
    expect(out.disqualified[0].reason).toBe('industry_mismatch');
  });
});

describe('already forwarded elsewhere', () => {
  it('penalises and flags but does not disqualify', () => {
    // A single operator can legitimately cover two towns; refusing outright would strand a
    // market whose only real business already takes calls for a neighbour.
    const out = recommendForwardTargets(
      CAMPAIGN,
      [prospect({ id: 'busy', phone: '2535550100' })],
      { now: NOW, forwardedElsewhere: new Map([['2535550100', 'graftontowing.com']]) },
    );
    expect(out.ranked).toHaveLength(1);
    expect(out.ranked[0].flags.join(' ')).toContain('graftontowing.com');
    expect(out.autoApplyEligible).toBe(false);
  });
});

describe('duplicate rows', () => {
  it('collapses two sweeps of one business and keeps the rated row', () => {
    // Live data: "Space Age Wrecker and Recovery" on (256) 550-2383 twice — unrated from July,
    // rated from September. Two rows would show the operator one business twice AND inflate
    // pool.qualified, which gates auto-apply.
    const out = recommendForwardTargets(
      CAMPAIGN,
      [
        prospect({ id: 'july', business_name: 'Space Age', phone: '2565502383', created_at: STALE }),
        prospect({
          id: 'sept',
          business_name: 'Space Age',
          phone: '(256) 550-2383',
          rating: 4.2,
          review_count: 9,
          created_at: FRESH,
        }),
      ],
      { now: NOW },
    );
    expect(out.ranked).toHaveLength(1);
    expect(out.ranked[0].prospect.id).toBe('sept');
    expect(out.pool.qualified).toBe(1);
  });

  it('keeps the freshest when neither row is rated', () => {
    const out = recommendForwardTargets(
      CAMPAIGN,
      [
        prospect({ id: 'old', phone: '2565502383', created_at: STALE }),
        prospect({ id: 'new', phone: '2565502383', created_at: FRESH }),
      ],
      { now: NOW },
    );
    expect(out.ranked).toHaveLength(1);
    expect(out.ranked[0].prospect.id).toBe('new');
  });
});

describe('pool quality', () => {
  it('calls the real South Hill pool thin and refuses to auto-apply', () => {
    // The actual data as of 2026-09-27: two unrated towing businesses from a 2026-07-12 sweep.
    const out = recommendForwardTargets(
      CAMPAIGN,
      [
        prospect({ id: 'toocool', business_name: 'Too Cool Towing LLC', phone: '(253) 442-5373', created_at: STALE }),
        prospect({ id: 'pnw', business_name: 'PNW Towing & Recovery', phone: '(206) 929-2000', created_at: STALE }),
      ],
      { now: NOW },
    );
    expect(out.ranked).toHaveLength(2);
    expect(out.pool.verdict).toBe('stale');
    expect(out.pool.rated).toBe(0);
    expect(out.autoApplyEligible).toBe(false);
    expect(out.pool.advice).toMatch(/re-sweep/i);
  });

  it('reports an empty pool rather than silently succeeding', () => {
    const out = recommendForwardTargets(CAMPAIGN, [], { now: NOW });
    expect(out.pool.verdict).toBe('empty');
    expect(out.autoApplyEligible).toBe(false);
  });

  it('calls a fresh, rated, populated market usable', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      prospect({ id: `p${i}`, rating: 4 + i * 0.1, review_count: 50, phone: `253555010${i}` }),
    );
    const out = recommendForwardTargets(CAMPAIGN, many, { now: NOW });
    expect(out.pool.verdict).toBe('usable');
    expect(out.pool.rated).toBe(6);
  });
});

describe('autoApplyEligible', () => {
  it('stays false for a near-tie even in a healthy pool', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      prospect({ id: `p${i}`, rating: 4.5, review_count: 50, phone: `253555010${i}` }),
    );
    const out = recommendForwardTargets(CAMPAIGN, many, { now: NOW });
    expect(out.pool.verdict).toBe('usable');
    expect(out.autoApplyEligible).toBe(false);
  });

  it('becomes true only with a clear winner, a real field and no flags', () => {
    const rows = [
      prospect({ id: 'winner', rating: 4.9, review_count: 300, phone: '2535550101' }),
      prospect({ id: 'b', rating: 4.0, review_count: 80, phone: '2535550102', website: 'https://b.com' }),
      prospect({ id: 'c', rating: 3.9, review_count: 60, phone: '2535550103', website: 'https://c.com' }),
      prospect({ id: 'd', rating: 3.8, review_count: 60, phone: '2535550104', website: 'https://d.com' }),
    ];
    const out = recommendForwardTargets(CAMPAIGN, rows, { now: NOW });
    expect(out.ranked[0].prospect.id).toBe('winner');
    expect(out.autoApplyEligible).toBe(true);
  });

  it('never auto-applies on a pool that is merely thin', () => {
    expect(
      isAutoApplyEligible(
        [
          { prospect: prospect({ id: 'a' }), score: 90, reasons: [], flags: [], decidedBy: 'score' as const },
          { prospect: prospect({ id: 'b' }), score: 10, reasons: [], flags: [], decidedBy: 'score' as const },
        ],
        { considered: 2, qualified: 2, rated: 0, freshestDays: 1, verdict: 'thin', advice: '' },
      ),
    ).toBe(false);
  });
});

describe('areaCodeFlag', () => {
  it('has no opinion on a market too small to have a modal area code', () => {
    // With the real two-row pools this must stay silent rather than invent a local prefix.
    expect(areaCodeFlag(prospect({ id: 'a', phone: '2069292000' }), ['2534425373', '2069292000'])).toBeNull();
  });

  it('flags an out-of-market area code once the market has spoken', () => {
    const market = ['2535550101', '2535550102', '2535550103', '2535550104', '2069292000'];
    expect(areaCodeFlag(prospect({ id: 'a', phone: '2069292000' }), market)).toMatch(/206.*not the local 253/);
    expect(areaCodeFlag(prospect({ id: 'b', phone: '2535550101' }), market)).toBeNull();
  });
});

describe('ties always resolve to a pick', () => {
  it('breaks a dead tie on the local area code, and says that is what it did', () => {
    // ⚠️ The real South Hill case before ratings existed. Both unrated, both no-website: 61-61.
    // Alphabetical order handed it to PNW ("P" < "T"); the area code says Too Cool is the 253
    // business in a 253 town — and when ratings arrived Too Cool won on 4.8★/201. The tiebreak
    // had the right answer the whole time.
    const market = [
      prospect({ id: 'toocool', business_name: 'Too Cool Towing LLC', phone: '(253) 442-5373' }),
      prospect({ id: 'pnw', business_name: 'PNW Towing & Recovery', phone: '(206) 929-2000' }),
      // Filler so the market has ≥5 phones and a modal area code exists at all.
      prospect({ id: 'f1', phone: '2535550111', website: 'https://f1.com' }),
      prospect({ id: 'f2', phone: '2535550112', website: 'https://f2.com' }),
      prospect({ id: 'f3', phone: '2535550113', website: 'https://f3.com' }),
    ];
    const out = recommendForwardTargets(CAMPAIGN, market, { now: NOW });
    expect(out.ranked[0].prospect.id).toBe('toocool');
    expect(out.ranked[0].decidedBy).toBe('local_area_code');
    expect(decidedByLabel(out.ranked[0].decidedBy)).toMatch(/tied on the signals/);
  });

  it('falls to review count when the area code cannot separate them', () => {
    const market = [
      prospect({ id: 'few', phone: '2535550101', rating: 4.3, review_count: 3 }),
      prospect({ id: 'many', phone: '2535550102', rating: 4.3, review_count: 3 }),
      prospect({ id: 'f1', phone: '2535550111', website: 'https://f1.com' }),
      prospect({ id: 'f2', phone: '2535550112', website: 'https://f2.com' }),
      prospect({ id: 'f3', phone: '2535550113', website: 'https://f3.com' }),
    ];
    // Same shrunk score, same locality — only the raw review count differs.
    market[1].review_count = 40;
    market[1].rating = 4.3;
    const out = recommendForwardTargets(CAMPAIGN, market, { now: NOW });
    expect(out.ranked[0].prospect.id).toBe('many');
    expect(out.ranked[0].decidedBy).toBe('more_reviews');
  });

  it('still names a winner when every signal is identical, and admits it is a rule', () => {
    const out = recommendForwardTargets(
      CAMPAIGN,
      [
        prospect({ id: 'b', business_name: 'Bravo Towing', phone: '2535550101' }),
        prospect({ id: 'a', business_name: 'Alpha Towing', phone: '2535550102' }),
      ],
      { now: NOW },
    );
    expect(out.ranked[0].prospect.business_name).toBe('Alpha Towing');
    expect(out.ranked[0].decidedBy).toBe('stable_name');
    expect(decidedByLabel(out.ranked[0].decidedBy)).toMatch(/not because it is better/);
  });

  it('is stable — the same pool always yields the same pick', () => {
    const rows = [
      prospect({ id: 'b', business_name: 'Bravo', phone: '2535550101' }),
      prospect({ id: 'a', business_name: 'Alpha', phone: '2535550102' }),
      prospect({ id: 'c', business_name: 'Charlie', phone: '2535550103' }),
    ];
    const first = recommendForwardTargets(CAMPAIGN, rows, { now: NOW }).ranked.map((c) => c.prospect.id);
    const reversed = recommendForwardTargets(CAMPAIGN, [...rows].reverse(), { now: NOW }).ranked.map(
      (c) => c.prospect.id,
    );
    expect(reversed).toEqual(first);
  });

  it('a tiebreak never counts as evidence for an unattended write', () => {
    // The whole point of keeping decidedBy separate: picking one is not the same as being sure.
    const many = Array.from({ length: 6 }, (_, i) =>
      prospect({ id: `p${i}`, rating: 4.5, review_count: 50, phone: `253555010${i}` }),
    );
    const out = recommendForwardTargets(CAMPAIGN, many, { now: NOW });
    expect(out.ranked[0].decidedBy).not.toBe('score');
    expect(out.autoApplyEligible).toBe(false);
  });
});

describe('freshness is the last observation, not the row birthday', () => {
  it('a long-parked business re-seen today is not stale', () => {
    // ⚠️ The bug this exists to prevent: all 15 Renton towing rows carry created_at 2026-07-14,
    // a sweep re-observed 17 businesses and inserted 0, and the pool still advised "re-sweep
    // this city" — advice the operator had just followed. Unsatisfiable advice reads as a real
    // finding and sends them in a loop.
    const rows = Array.from({ length: 5 }, (_, i) =>
      prospect({
        id: `p${i}`,
        phone: `253555010${i}`,
        rating: 4.5,
        review_count: 30,
        created_at: STALE,
        last_seen_at: FRESH,
      }),
    );
    const out = recommendForwardTargets(CAMPAIGN, rows, { now: NOW });
    expect(out.pool.verdict).toBe('usable');
    expect(out.pool.freshestDays).toBe(7);
    expect(out.ranked[0].flags.join(' ')).not.toMatch(/last observed/);
  });

  it('falls back to created_at when nothing has re-observed the row', () => {
    const rows = [prospect({ id: 'old', created_at: STALE, last_seen_at: null })];
    const out = recommendForwardTargets(CAMPAIGN, rows, { now: NOW });
    expect(out.pool.verdict).toBe('stale');
    expect(out.pool.advice).toMatch(/re-sweep/i);
  });
});

describe('the consent path is not optional', () => {
  it('always reports that the forwarding notice is required', () => {
    const out = recommendForwardTargets(CAMPAIGN, [prospect({ id: 'a' })], { now: NOW });
    expect(out.requiresNotice).toBe(true);
  });
});
