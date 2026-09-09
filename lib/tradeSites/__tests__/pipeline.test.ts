/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { orderQueue, isBuildable, pipelineCaps, pipelineEnabled, parsePipelineOverrides, OVERRIDE_LIMITS } from '@/lib/tradeSites/pipeline';
import { SWEEP_CATEGORIES, resolveSweepCategory, sweepArgsFor } from '@/lib/prospects/sweepCategories';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('the queue drains highest priority first, then oldest', () => {
  it('orders deterministically', () => {
    const rows = [
      { id: 'b', priority: 0, created_at: '2026-09-02' },
      { id: 'a', priority: 0, created_at: '2026-09-01' },
      { id: 'c', priority: 5, created_at: '2026-09-03' },
    ];
    expect(orderQueue(rows).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('what the cron builds', () => {
  const base = { status: 'discovered', lead_tier: 'no_website', template_id: null, industry_key: 'towing' } as const;
  it('a parked, no-website trade prospect with no draft', () => {
    expect(isBuildable(base)).toBe(true);
  });
  it.each([
    ['already built', { ...base, template_id: 'tpl' }],
    ['has a website', { ...base, lead_tier: 'has_site' }],
    ['dismissed', { ...base, status: 'dismissed' }],
    ['a restaurant (take-rate model, other pipeline)', { ...base, industry_key: 'restaurant' }],
    ['unknown industry — the guess defaults to restaurant, so never build blind', { ...base, industry_key: null }],
  ])('never: %s', (_why, p) => {
    expect(isBuildable(p as any)).toBe(false);
  });
});

describe('a manual run can override the caps — clamped, zero allowed, never the review window', () => {
  it('parses and clamps each override independently', () => {
    expect(parsePipelineOverrides({ maxSweeps: 0, maxBuilds: 0, maxMail: 25 })).toEqual({ maxSweeps: 0, maxBuilds: 0, maxMail: 25 });
    expect(parsePipelineOverrides({ maxMail: 999 })).toEqual({ maxMail: OVERRIDE_LIMITS.maxMail });
    expect(parsePipelineOverrides({ maxSweeps: -3, maxBuilds: '12.9' })).toEqual({ maxSweeps: 0, maxBuilds: 12 });
    expect(parsePipelineOverrides({ maxMail: 'lots' })).toEqual({});
    expect(parsePipelineOverrides(null)).toEqual({});
    expect(parsePipelineOverrides('x')).toEqual({});
  });
  it('the mail ceiling equals the per-send cap, so a run can never exceed one send', () => {
    expect(OVERRIDE_LIMITS.maxMail).toBe(25);
  });
  it('the route applies overrides on POST only; the scheduled GET keeps the env caps; the 24h window is not a knob', () => {
    const route = readFileSync('app/api/cron/trade-site-pipeline/route.ts', 'utf8');
    expect(route).toMatch(/export async function POST[\s\S]*parsePipelineOverrides\(body\)/);
    expect(route).toMatch(/export async function GET\(req: NextRequest\) \{\s*return handle\(req\);/);
    const pipeline = readFileSync('lib/tradeSites/pipeline.ts', 'utf8');
    expect(pipeline).toMatch(/minAgeHours: caps\.minAgeHours/);
    expect(pipeline).not.toMatch(/minAgeHours: opts\./);
  });
});

describe('caps are bounded so a typo cannot become a fleet', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  it('defaults small', () => {
    delete process.env.TRADE_PIPELINE_MAX_SWEEPS;
    delete process.env.TRADE_PIPELINE_MAX_BUILDS;
    expect(pipelineCaps()).toEqual({ maxSweeps: 1, maxBuilds: 15 });
  });
  it('clamps', () => {
    process.env.TRADE_PIPELINE_MAX_SWEEPS = '999';
    process.env.TRADE_PIPELINE_MAX_BUILDS = '9999';
    expect(pipelineCaps()).toEqual({ maxSweeps: 10, maxBuilds: 50 });
  });
  it('is OFF by default', () => {
    delete process.env.TRADE_PIPELINE_ENABLED;
    expect(pipelineEnabled()).toBe(false);
  });
});

describe('sweep categories — one list for the button and the cron', () => {
  it('resolves by label or industry, case-insensitively', () => {
    expect(resolveSweepCategory('towing')?.label).toBe('Towing');
    expect(resolveSweepCategory('hvac')?.label).toBe('HVAC');
    expect(resolveSweepCategory('Auto repair')?.types).toEqual(['car_repair']);
    expect(resolveSweepCategory('nope')).toBeNull();
  });
  it('every text category carries the industry it stands for (else the guess defaults to restaurant)', () => {
    for (const c of SWEEP_CATEGORIES) if (c.textQuery) expect(c.industry).toBeTruthy();
  });
  it('builds the sweep request the discover route expects', () => {
    const args = sweepArgsFor([resolveSweepCategory('Towing')!, resolveSweepCategory('Plumbing')!]);
    expect(args.includedTypes).toEqual(['plumber']);
    expect(args.textCategories).toEqual([{ query: 'towing service', industry: 'towing' }]);
  });
  it('the operator UI imports the shared list rather than carrying its own copy', () => {
    const src = read('components/admin/prospects-client.tsx');
    expect(src).toMatch(/from '@\/lib\/prospects\/sweepCategories'/);
    expect(src).not.toMatch(/label: 'Towing', textQuery/);
  });
});

describe('wiring', () => {
  it('the cron is registered and flag-gated', () => {
    expect(read('vercel.json')).toMatch(/"\/api\/cron\/trade-site-pipeline"/);
    expect(read('app/api/cron/trade-site-pipeline/route.ts')).toMatch(/pipelineEnabled\(\)/);
  });
  it('the afternoon mail-only cron is registered after the window clears, flag-gated, and never sweeps or builds', () => {
    const vercel = read('vercel.json');
    expect(vercel).toMatch(/"\/api\/cron\/trade-site-mail"/);
    // 20:27 UTC = 13:27 PT — the previous afternoon's builds (≈19:50–20:20 UTC) are past 24h.
    expect(vercel).toMatch(/"\/api\/cron\/trade-site-mail",\s*"schedule": "27 20 \* \* \*"/);
    const route = read('app/api/cron/trade-site-mail/route.ts');
    expect(route).toMatch(/pipelineEnabled\(\)/);
    expect(route).toMatch(/mailEnabled\(\)/);
    expect(route).toMatch(/maxSweeps: 0, maxBuilds: 0/);
    expect(route).toMatch(/429\|rate limit\|too many requests/);
    expect(read('.env.example')).toMatch(/^TRADE_MAIL_AFTERNOON_MAX=/m);
  });
  it('the discover route and the cron run the same sweep', () => {
    expect(read('app/api/admin/prospects/discover/route.ts')).toMatch(/runSweep\(/);
    expect(read('lib/tradeSites/pipeline.ts')).toMatch(/runSweep\(/);
  });
  it('both build paths pass the prospect industry — the guess defaults to restaurant', () => {
    expect(read('lib/tradeSites/pipeline.ts')).toMatch(/industryKey: \(p\.industry_key/);
    expect(read('app/api/admin/prospects/build/route.ts')).toMatch(/industryKey: \(p\.industry_key/);
  });
  it('every new env key is declared', () => {
    const env = read('.env.example');
    for (const k of ['TRADE_PIPELINE_ENABLED', 'TRADE_PIPELINE_MAX_SWEEPS', 'TRADE_PIPELINE_MAX_BUILDS', 'TRADE_PIPELINE_OPERATOR_ID']) {
      expect(env).toMatch(new RegExp(`^${k}=`, 'm'));
    }
  });
});
