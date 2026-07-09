/** @jest-environment node */
//
// Green-path e2e for the domain-claim email flow, at the route-handler layer:
// drive the REAL send → confirm → claim-site handlers end-to-end against an
// in-memory Supabase, capturing the actual OTP from the (mocked) email and
// threading the real grant cookie through. No DB / migration required.
//
// Mocks: the flag (force ON), rate limits (never limited), and email (capture
// the code). Everything else — OTP hashing, verified-row gating, grant
// mint/verify, consume, double-claim guard — is the production code path.
// Shared state lives on globalThis so the hoisted jest.mock factories can reach
// it without out-of-scope variable references.
import { NextRequest } from 'next/server';

type Store = { domains: any[]; claim_verifications: any[] };
const g = globalThis as any;
g.__cvStore = { domains: [], claim_verifications: [] } as Store;
g.__cvCode = '';

jest.mock('@supabase/supabase-js', () => {
  const store = () => (globalThis as any).__cvStore as { domains: any[]; claim_verifications: any[] };
  class Q {
    table: string;
    preds: ((r: any) => boolean)[] = [];
    _order: { c: string; asc: boolean } | null = null;
    _limit: number | null = null;
    _mode: 'select' | 'insert' | 'update' = 'select';
    _insert: any[] = [];
    _patch: any = {};
    constructor(table: string) { this.table = table; }
    rows() { const s = store() as any; return (s[this.table] ||= []); }
    select() { this._mode = 'select'; return this; }
    insert(rows: any) { this._mode = 'insert'; this._insert = Array.isArray(rows) ? rows : [rows]; return this; }
    update(patch: any) { this._mode = 'update'; this._patch = patch; return this; }
    eq(c: string, v: any) { this.preds.push((r) => r[c] === v); return this; }
    is(c: string, v: any) { this.preds.push((r) => (r[c] === null || r[c] === undefined) === (v === null)); return this; }
    not(c: string) { this.preds.push((r) => !(r[c] === null || r[c] === undefined)); return this; }
    gt(c: string, v: any) { this.preds.push((r) => r[c] > v); return this; }
    order(c: string, o?: { ascending?: boolean }) { this._order = { c, asc: o?.ascending !== false }; return this; }
    limit(n: number) { this._limit = n; return this; }
    match() {
      let rows = this.rows().filter((r: any) => this.preds.every((p) => p(r)));
      if (this._order) {
        const { c, asc } = this._order;
        rows = [...rows].sort((a: any, b: any) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
      }
      if (this._limit != null) rows = rows.slice(0, this._limit);
      return rows;
    }
    async maybeSingle() { return { data: this.match()[0] ?? null, error: null }; }
    then(resolve: (v: any) => any) {
      if (this._mode === 'insert') {
        for (const r of this._insert) { if (!r.id) r.id = 'row_' + (this.rows().length + 1); this.rows().push({ ...r }); }
        return resolve({ error: null, data: null });
      }
      if (this._mode === 'update') {
        for (const r of this.match()) Object.assign(r, this._patch);
        return resolve({ error: null, data: null });
      }
      return resolve({ data: this.match(), error: null });
    }
  }
  return { createClient: () => ({ from: (t: string) => new Q(t) }) };
});
jest.mock('@/lib/flags/domainClaimVerification', () => ({ DOMAIN_CLAIM_VERIFICATION_ENABLED: true }));
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: async () => ({ ok: true, count: 0, limit: 99 }),
  clientIp: () => '127.0.0.1',
}));
jest.mock('@/lib/api/rateLimitGuard', () => ({ rateLimitOr429: async () => null }));
jest.mock('@/lib/email', () => ({
  sendEmail: async ({ html }: { html: string }) => {
    (globalThis as any).__cvCode = (html.match(/(\d{6})/) || [])[1] || '';
    return { ok: true, id: 'dev' };
  },
}));

// Import the real handlers AFTER the mocks are registered.
import { POST as sendPOST } from '../send/route';
import { POST as confirmPOST } from '../confirm/route';
import { POST as claimPOST } from '@/app/api/claim-site/route';
import { DOMAIN_CLAIM_VERIFY_GRANT_COOKIE } from '@/lib/auth/claimVerify';

const store = (): Store => g.__cvStore;
const code = (): string => g.__cvCode;
const jsonReq = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

const SLUG = 'foo-diner.com';
const EMAIL = 'owner@foo-diner.com';
const send = () => sendPOST(jsonReq('http://t/api/claim/verify/email/send', { slug: SLUG, email: EMAIL }));
const confirm = (c: string) => confirmPOST(jsonReq('http://t/api/claim/verify/email/confirm', { slug: SLUG, email: EMAIL, code: c }));

beforeAll(() => { process.env.CLAIM_TOKEN_SECRET = 'test-secret-domain-claim-e2e'; });
beforeEach(() => {
  g.__cvStore.domains = [{ id: 'dom-1', domain: SLUG, is_claimed: false }];
  g.__cvStore.claim_verifications = [];
  g.__cvCode = '';
});

test('green path: send → confirm → claim completes and consumes the code', async () => {
  const s = await send();
  expect(s.status).toBe(200);
  expect(code()).toMatch(/^\d{6}$/);
  expect(store().claim_verifications).toHaveLength(1);
  expect(store().claim_verifications[0].verified_at).toBeUndefined();

  const c = await confirm(code());
  expect(c.status).toBe(200);
  const grant = c.cookies.get(DOMAIN_CLAIM_VERIFY_GRANT_COOKIE)?.value;
  expect(grant).toBeTruthy();
  expect(store().claim_verifications[0].verified_at).toBeTruthy();

  const kReq = jsonReq('http://t/api/claim-site', { slug: SLUG, email: EMAIL });
  kReq.cookies.set(DOMAIN_CLAIM_VERIFY_GRANT_COOKIE, grant!);
  const k = await claimPOST(kReq);
  expect(k.status).toBe(200);
  expect(await k.json()).toEqual({ success: true });

  expect(store().domains[0].is_claimed).toBe(true);
  expect(store().domains[0].claimed_email).toBe(EMAIL);
  expect(store().claim_verifications[0].consumed_at).toBeTruthy();
});

test('claim-site is refused without a verify grant (403)', async () => {
  await send();
  await confirm(code());
  const k = await claimPOST(jsonReq('http://t/api/claim-site', { slug: SLUG, email: EMAIL }));
  expect(k.status).toBe(403);
  expect(store().domains[0].is_claimed).toBe(false);
});

test('confirm rejects a wrong code and does not verify', async () => {
  await send();
  const wrong = code() === '000000' ? '111111' : '000000';
  const c = await confirm(wrong);
  expect(c.status).toBe(400);
  expect(store().claim_verifications[0].verified_at).toBeUndefined();
  expect(store().claim_verifications[0].attempts).toBe(1);
});
