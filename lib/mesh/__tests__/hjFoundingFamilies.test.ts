// lib/mesh/__tests__/hjFoundingFamilies.test.ts
//
// The founding-families seam carries COUNTS ONLY and never throws. A wrong secret, an
// unreachable HJ, or a row-shaped body must render as "not connected" — never as zeros
// (a zero reads as "nobody applied") and never as a list of applicants.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const ORIGINAL_ENV = { ...process.env };

function load() {
  jest.resetModules();
  return require('@/lib/mesh/hjFoundingFamilies') as typeof import('@/lib/mesh/hjFoundingFamilies');
}

const GOOD = { applications: 5, ipads_shipped: 2, active: 1, waiting: 3, oldest_waiting_days: 9 };

function fakeFetch(status: number, body: unknown): typeof fetch {
  return jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('fetchFoundingFamilyStats', () => {
  it('reports no_secret without calling HJ when the partner secret is unset', async () => {
    delete process.env.PARTNER_QUICKSITES_SECRET;
    const m = load();
    const f = fakeFetch(200, GOOD);
    const r = await m.fetchFoundingFamilyStats({ fetchImpl: f });
    expect(r).toEqual({ ok: false, reason: 'no_secret' });
    expect(f).not.toHaveBeenCalled();
  });

  it('sends the partner headers and returns the five counts', async () => {
    process.env.PARTNER_QUICKSITES_SECRET = 'shh';
    const m = load();
    const f = fakeFetch(200, GOOD);
    const r = await m.fetchFoundingFamilyStats({ fetchImpl: f });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.counts).toEqual(GOOD);
    const [url, init] = (f as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/cornerstone\/test-families\/counts$/);
    const h = init.headers as Record<string, string>;
    expect(h['X-Partner-Id']).toBe('quicksites');
    expect(h['X-Partner-Key']).toBe('shh');
  });

  it('a 401/403 is "unauthorized", not zeros', async () => {
    process.env.PARTNER_QUICKSITES_SECRET = 'shh';
    const m = load();
    const r = await m.fetchFoundingFamilyStats({ fetchImpl: fakeFetch(403, { error: 'nope' }) });
    expect(r).toMatchObject({ ok: false, reason: 'unauthorized' });
  });

  it('a row-shaped body is refused (bad_shape) — no applicant data crosses the seam', async () => {
    process.env.PARTNER_QUICKSITES_SECRET = 'shh';
    const m = load();
    const rows = { families: [{ name: 'A Family', email: 'a@example.com', status: 'applied' }] };
    const r = await m.fetchFoundingFamilyStats({ fetchImpl: fakeFetch(200, rows) });
    expect(r).toEqual({ ok: false, reason: 'bad_shape' });
  });

  it('a thrown fetch is "unreachable" and never propagates', async () => {
    process.env.PARTNER_QUICKSITES_SECRET = 'shh';
    const m = load();
    const f = jest.fn(async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    const r = await m.fetchFoundingFamilyStats({ fetchImpl: f });
    expect(r).toMatchObject({ ok: false, reason: 'unreachable', detail: 'ECONNREFUSED' });
  });
});

describe('parseCounts', () => {
  it('requires every count to be a finite non-negative number', () => {
    const { parseCounts } = load();
    expect(parseCounts(GOOD)).toEqual(GOOD);
    expect(parseCounts({ ...GOOD, active: -1 })).toBeNull();
    expect(parseCounts({ ...GOOD, waiting: '3' })).toBeNull();
    expect(parseCounts({ ...GOOD, oldest_waiting_days: undefined })).toBeNull();
    expect(parseCounts(null)).toBeNull();
  });
});

describe('the /admin/ops section renders counts only', () => {
  it('never references an applicant field', () => {
    const src = readFileSync(path.join(process.cwd(), 'components/admin/ops-dashboard-client.tsx'), 'utf8');
    const start = src.indexOf('Cornerstone founding families');
    expect(start).toBeGreaterThan(0);
    const section = src.slice(start, src.indexOf('Holistic Top 5', start));
    expect(section).not.toMatch(/\.(name|email|phone|city|kids_ages|household_note|admin_notes)\b/);
    expect(section).not.toMatch(/\.families\b|\.map\(\(f\b/); // no row array, no per-applicant map
  });
});
