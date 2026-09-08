/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { orderQueue, isBuildable, pipelineCaps, pipelineEnabled } from '@/lib/tradeSites/pipeline';
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
