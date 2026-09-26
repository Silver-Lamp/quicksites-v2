/**
 * @jest-environment node
 *
 * PUBLISH FIRST, CONFIRM WITHIN A WEEK.
 *
 * ⚠️ The dangerous direction here is not "a spam site stayed up a few extra days" — it is
 * **unpublishing a site belonging to someone who did exactly what we asked.** The deadline is only
 * defensible while it is honest, and one wrongful takedown of a real business's live page costs
 * more than every abusive publish this window could ever allow. Most of what follows guards that
 * direction.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import {
  PUBLISH_GRACE_DAYS,
  daysLeft,
  graceExpiryFrom,
  mayPublishOnGrace,
  shouldExpire,
} from '@/lib/guest/publishGrace';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));

describe('who may publish without confirming', () => {
  it('a confirmed account always may', () => {
    expect(mayPublishOnGrace({ isAnonymous: false, pendingEmail: null })).toBe(true);
  });

  it('an anonymous builder who has set an email may', () => {
    expect(mayPublishOnGrace({ isAnonymous: true, pendingEmail: 'a@b.com' })).toBe(true);
  });

  // ⚠️ THE LOAD-BEARING REFUSAL. Without it, any anonymous session — anyone with a browser and no
  // commitment whatsoever — gets a live page on our domain. The pending email is the entry ticket
  // precisely because typing one is the step the whole funnel dies on.
  it('an anonymous builder who has committed NOTHING may not', () => {
    expect(mayPublishOnGrace({ isAnonymous: true, pendingEmail: null })).toBe(false);
    expect(mayPublishOnGrace({ isAnonymous: true, pendingEmail: '' })).toBe(false);
    expect(mayPublishOnGrace({ isAnonymous: true, pendingEmail: '   ' })).toBe(false);
  });
});

describe('the clock', () => {
  it('runs for a week', () => {
    expect(PUBLISH_GRACE_DAYS).toBe(7);
    const now = new Date('2026-01-01T00:00:00Z');
    expect(graceExpiryFrom(now).toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });

  it('counts down in whole days and floors at zero', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(daysLeft('2026-01-08T00:00:00Z', now)).toBe(7);
    expect(daysLeft('2026-01-01T06:00:00Z', now)).toBe(1); // part of a day still reads as a day
    expect(daysLeft('2025-12-31T00:00:00Z', now)).toBe(0); // already past
    expect(daysLeft('nonsense', now)).toBe(0);
  });
});

describe('⚠️ when a site may actually be taken down', () => {
  const base = { expiresAt: '2026-01-01T00:00:00Z', now: new Date('2026-02-01T00:00:00Z') };

  it('expires a lapsed, still-anonymous owner', () => {
    expect(shouldExpire({ ...base, resolvedAt: null, ownerStillAnonymous: true })).toBe(true);
  });

  // The whole point. They confirmed — possibly on another device, possibly a week later — and
  // nothing wrote back to the row in that moment. Trusting the row would take down a customer who
  // did what we asked.
  it('NEVER expires an owner who has verified, however stale the row', () => {
    expect(shouldExpire({ ...base, resolvedAt: null, ownerStillAnonymous: false })).toBe(false);
  });

  it('never expires an already-resolved row', () => {
    expect(shouldExpire({ ...base, resolvedAt: '2026-01-02T00:00:00Z', ownerStillAnonymous: true })).toBe(false);
  });

  it('never expires before the deadline', () => {
    expect(
      shouldExpire({
        expiresAt: '2026-03-01T00:00:00Z',
        now: new Date('2026-02-01T00:00:00Z'),
        resolvedAt: null,
        ownerStillAnonymous: true,
      }),
    ).toBe(false);
  });
});

describe('⚠️ the wiring a unit test cannot see', () => {
  const SERVER = read('lib/guest/publishGraceServer.ts');
  const ROUTE = read('app/api/admin/sites/publish/route.ts');
  const CALLBACK = read('app/auth/callback/route.ts');
  const SETSESSION = read('app/api/auth/set-session/route.ts');
  const CRON = read('app/api/cron/publish-grace-expiry/route.ts');

  it('did not strip the files away', () => {
    expect(SERVER.length).toBeGreaterThan(2000);
    expect(ROUTE.length).toBeGreaterThan(3000);
  });

  // ⚠️ An unknown auth state is NOT "still anonymous". Taking a site down because a lookup flaked
  // is the wrongful-takedown case, and it would look like the sweep working.
  it('leaves the site up when the owner state cannot be read', () => {
    expect(SERVER).toMatch(/anon === null/);
    expect(SERVER).toMatch(/left up/);
  });

  // ⚠️ The existing unpublish ROUTE edits published_sites only and never flips
  // templates.published; the two have measurably drifted. A sweep that did the same would leave a
  // lapsed site live while reporting it down.
  it('unpublishes through the RPC that sets BOTH halves', () => {
    expect(SERVER).toMatch(/rpc\('unpublish_template'/);
    expect(SERVER).not.toMatch(/from\('published_sites'\)[\s\S]{0,80}\.delete\(\)/);
  });

  it('the publish route refuses when the clock cannot be stored', () => {
    // A site live with no recorded deadline is the open door this feature exists to close.
    expect(ROUTE).toMatch(/startPublishGrace\(/);
    expect(ROUTE).toMatch(/Could not start the confirmation window/);
  });

  it('the route hands the deadline back so the UI can say it', () => {
    expect(ROUTE).toMatch(/graceUntil,/);
  });

  // ⚠️ BOTH auth branches. A guest's email confirmation lands on the FRAGMENT branch
  // (set-session), not the PKCE one — wiring only the obvious callback would leave the sweep
  // taking down sites from people who confirmed.
  it('stops the clock on both auth branches', () => {
    expect(CALLBACK).toMatch(/resolveGraceForOwner\(/);
    expect(SETSESSION).toMatch(/resolveGraceForOwner\(/);
  });

  it('the cron is authorised and recorded', () => {
    expect(CRON).toMatch(/isCronAuthorized\(/);
    expect(CRON).toMatch(/runCron\('publish-grace-expiry'/);
  });

  it('the cron is registered in vercel.json, or it never runs', () => {
    const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
    const paths = (vercel.crons ?? []).map((c: any) => c.path);
    expect(paths).toContain('/api/cron/publish-grace-expiry');
  });
});

describe('⚠️ visible but not indexable while the clock runs', () => {
  const PAGE = read('app/sites/[slug]/[[...rest]]/page.tsx');

  it('noindexes a guest build that is still in grace', () => {
    expect(PAGE).toMatch(/graceFor\(/);
    expect(PAGE).toMatch(/claimSource === 'guest_build'/);
  });

  it('checks claim_source BEFORE querying, so the fleet pays nothing', () => {
    // 52 of 3,168 templates are guest builds. An unconditional lookup would add a query to every
    // page view of every site we host, for a state almost none of them can be in.
    const guard = PAGE.indexOf("claimSource === 'guest_build' && siteRow.template_id");
    const query = PAGE.indexOf('graceFor(');
    expect(guard).toBeGreaterThan(0);
    expect(query).toBeGreaterThan(guard);
  });
});
