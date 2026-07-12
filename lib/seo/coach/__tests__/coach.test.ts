/**
 * @jest-environment node
 */
// lib/seo/coach/__tests__/coach.test.ts

process.env.CLAIM_TOKEN_SECRET = process.env.CLAIM_TOKEN_SECRET || 'test-secret-for-coach';

import { analyzeSiteOnPage } from '@/lib/seo/coach/onPage';
import { computeSeoScore } from '@/lib/seo/coach/score';
import { buildSiteSeoRecommendations } from '@/lib/seo/coach/recommendations';
import { parseDailyStep, parseWeeklySteps, pickDeterministicNextStep } from '@/lib/seo/coach/flags';
import { mintCoachUnsubToken, verifyCoachUnsubToken } from '@/lib/seo/coach/unsubToken';
import type { SiteSeoSignals } from '@/lib/seo/coach/types';

const paragraph =
  'Acme Plumbing has served Greater Boston for over twenty years with licensed, insured, and background-checked ' +
  'technicians who arrive on time and explain every repair before starting. We handle burst pipes, hidden leaks, ' +
  'failing water heaters, clogged drains, sump pumps, and full repipes for homes and businesses across the metro ' +
  'area. Every job comes with upfront flat-rate pricing, a written warranty, and a friendly team that treats your ' +
  'home like their own. Call us any hour of any day and a real local plumber will answer and dispatch quickly.';

const richData = {
  business_name: 'Acme Plumbing of Boston',
  meta: {
    title: 'Acme Plumbing — Emergency Plumbers in Boston, MA',
    description: 'Fast, licensed emergency plumbing across Greater Boston. 24/7 service, upfront pricing, and 500+ five-star reviews.',
    schema: { localBusiness: true },
  },
  pages: [
    { blocks: [{ type: 'hero', content: { headline: 'Boston Emergency Plumbers', subheadline: 'Licensed and insured, on call 24/7 across the metro area for burst pipes, leaks, water heaters and drain clearing.' } }] },
    { blocks: [{ type: 'text', content: { body: paragraph } }, { type: 'services', content: { items: ['Drain cleaning is a thorough process', 'Water heater repair and replacement done right', 'Leak detection using modern equipment'] } }] },
  ],
};

const thinData = {
  business_name: 'Bob',
  meta: {},
  pages: [{ blocks: [{ type: 'hero', content: { headline: 'Hi' } }, { type: 'image', content: { image: '/x.jpg' } }] }],
};

describe('analyzeSiteOnPage', () => {
  it('reads a well-built site', () => {
    const s = analyzeSiteOnPage(richData);
    expect(s.hasTitle).toBe(true);
    expect(s.hasDescription).toBe(true);
    expect(s.hasSchema).toBe(true);
    expect(s.pageCount).toBe(2);
    expect(s.thinContent).toBe(false);
    expect(s.hasH1).toBe(true);
  });

  it('flags a thin, meta-less site + missing alt', () => {
    const s = analyzeSiteOnPage(thinData);
    // Title falls back to business_name ('Bob') → present but far too short.
    expect(s.hasTitle).toBe(true);
    expect(s.titleLen).toBeLessThan(30);
    expect(s.hasDescription).toBe(false);
    expect(s.hasSchema).toBe(false);
    expect(s.thinContent).toBe(true);
    expect(s.imagesMissingAlt).toBe(1);
  });

  it('title-missing only when there is no business_name or meta title', () => {
    const s = analyzeSiteOnPage({ meta: {}, pages: [{ blocks: [] }] });
    expect(s.hasTitle).toBe(false);
  });
});

const gscConnected: SiteSeoSignals = {
  domain: 'acme.com',
  gscConnected: true,
  onPage: analyzeSiteOnPage(richData),
  gsc: { clicks: 40, impressions: 800, position: 4.2, ctr: 0.05 },
};

const unconnectedThin: SiteSeoSignals = {
  domain: 'bob.quicksites.ai',
  gscConnected: false,
  onPage: analyzeSiteOnPage(thinData),
  gsc: null,
};

describe('computeSeoScore', () => {
  it('scores a strong connected site high', () => {
    const { score, breakdown } = computeSeoScore(gscConnected);
    expect(score).toBeGreaterThanOrEqual(75);
    expect(Object.values(breakdown).reduce((a, b) => a + b, 0)).toBe(score);
  });

  it('scores a thin unconnected site low', () => {
    const { score } = computeSeoScore(unconnectedThin);
    expect(score).toBeLessThan(50);
  });

  it('clamps to 0..100', () => {
    const { score } = computeSeoScore(gscConnected);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('buildSiteSeoRecommendations', () => {
  it('recommends connecting GSC + fixing meta/content on a weak site', () => {
    const recs = buildSiteSeoRecommendations(unconnectedThin);
    const ids = recs.map((r) => r.id);
    expect(ids).toContain('connect-gsc');
    expect(ids).toContain('title-short'); // 'Bob' is a title, just far too short
    expect(ids).toContain('desc-missing');
    expect(ids).toContain('thin-content');
    // sorted by priority desc
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].priority).toBeGreaterThanOrEqual(recs[i].priority);
  });

  it('fires the page-2 push + low-CTR rules from GSC data', () => {
    const s: SiteSeoSignals = { ...gscConnected, gsc: { clicks: 2, impressions: 600, position: 14, ctr: 0.003 } };
    const ids = buildSiteSeoRecommendations(s).map((r) => r.id);
    expect(ids).toContain('page2-push');
    expect(ids).toContain('low-ctr');
  });

  it('a healthy connected site has few/no recs', () => {
    const recs = buildSiteSeoRecommendations(gscConnected);
    expect(recs.every((r) => r.id !== 'connect-gsc')).toBe(true);
  });
});

describe('parseDailyStep / parseWeeklySteps', () => {
  it('parses a single daily step', () => {
    expect(parseDailyStep('{"step":{"title":"Add a title","why":"It drives clicks"}}')).toEqual({ title: 'Add a title', why: 'It drives clicks' });
  });
  it('daily accepts a steps[] and takes the first', () => {
    expect(parseDailyStep('{"steps":[{"title":"A","why":"b"},{"title":"C"}]}')).toEqual({ title: 'A', why: 'b' });
  });
  it('rejects junk', () => {
    expect(parseDailyStep('not json')).toBeNull();
    expect(parseWeeklySteps('{"nope":1}')).toBeNull();
  });
  it('weekly caps at 3 and drops empty titles', () => {
    const out = parseWeeklySteps('{"steps":[{"title":"A"},{"title":""},{"title":"C"},{"title":"D"},{"title":"E"}]}');
    expect(out).toHaveLength(3);
    expect(out!.map((s) => s.title)).toEqual(['A', 'C', 'D']);
  });
});

describe('pickDeterministicNextStep', () => {
  it('returns the top-priority rec or null', () => {
    const recs = buildSiteSeoRecommendations(unconnectedThin);
    expect(pickDeterministicNextStep(recs)).toBe(recs[0]);
    expect(pickDeterministicNextStep([])).toBeNull();
  });
});

describe('coach unsub token', () => {
  it('round-trips a user id', () => {
    const t = mintCoachUnsubToken('user-123');
    expect(verifyCoachUnsubToken(t)).toEqual({ userId: 'user-123' });
  });
  it('rejects tampering + malformed + the wrong token family', () => {
    const t = mintCoachUnsubToken('user-123');
    expect(verifyCoachUnsubToken(t.slice(0, -2) + 'xy')).toBeNull();
    expect(verifyCoachUnsubToken('garbage')).toBeNull();
    expect(verifyCoachUnsubToken(null)).toBeNull();
    // A CRM-style {u:...} payload must not verify as a coach {c:...} token.
    const body = Buffer.from(JSON.stringify({ u: 'user-123' })).toString('base64url');
    expect(verifyCoachUnsubToken(`${body}.whatever`)).toBeNull();
  });
});
