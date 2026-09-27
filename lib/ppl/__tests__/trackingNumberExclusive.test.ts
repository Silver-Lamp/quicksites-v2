// lib/ppl/__tests__/trackingNumberExclusive.test.ts
//
// ONE TRACKING NUMBER, ONE CAMPAIGN — a source guard, because the failure is invisible to
// TypeScript and to any unit test that does not talk to Postgres.
//
// The real enforcement is `geo_campaigns_tracking_number_uniq` (migration 20260856). This file
// guards the two things a future edit could quietly remove: the migration itself, and the route
// check that turns the constraint's raw unique-violation into something an operator can read.
//
// ⚠️ Why it matters: +1 425 270 2226 was live on maplevalley-towing.com AND millcreektowing.com
// with 13 calls logged and `geo_campaign_id` NULL on every one — no call creditable to a site,
// which is the only claim rank-and-rent makes.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/test/stripComments';

const ROOT = join(__dirname, '../../..');
const MIGRATION = join(ROOT, 'supabase/migrations/20260856_one_tracking_number_per_campaign.sql');
const ROUTE = join(ROOT, 'app/api/admin/prospects/geo-campaign/attach-number/route.ts');

describe('the unique index exists and is partial', () => {
  it('creates a unique index on tracking_number for non-null rows', () => {
    expect(existsSync(MIGRATION)).toBe(true);
    const sql = readFileSync(MIGRATION, 'utf8').toLowerCase();
    expect(sql).toMatch(/create unique index[\s\S]*geo_industry_campaigns[\s\S]*\(\s*tracking_number\s*\)/);
    // Partial, or every number-less campaign would collide with every other.
    expect(sql).toMatch(/where\s+tracking_number\s+is\s+not\s+null/);
  });
});

describe('the attach route checks both directions', () => {
  // Comments explain the rule, so they must not be what satisfies the test.
  const src = stripComments(readFileSync(ROUTE, 'utf8'));

  it('still refuses a second number for one campaign', () => {
    expect(src).toContain('already_tracked');
  });

  it('refuses a number that already backs another campaign', () => {
    expect(src).toContain('number_in_use');
    // The lookup that makes it real: find a DIFFERENT campaign holding this number.
    expect(src).toMatch(/\.eq\(\s*'tracking_number'/);
    expect(src).toMatch(/\.neq\(\s*'id'/);
  });

  it('names the campaign holding the number rather than failing blankly', () => {
    expect(src).toMatch(/heldBy/);
  });
});
