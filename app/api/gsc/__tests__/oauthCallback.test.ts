/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'app/api/gsc/oauth-callback/route.ts'), 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('the GSC consent callback keeps the grant', () => {
  // ⚠️ On 2026-09-08 the operator approved both scopes from an account with no Search Console
  // properties and the callback answered {"error":"No verified sites found"} — token discarded,
  // consent wasted, and the nightly backfill (which ADDS properties and needed exactly that grant)
  // kept failing on scopes. A consent is single-use; throwing one away costs a person a click.
  it('does not 404 an account with zero properties', () => {
    expect(CODE).not.toMatch(/No verified sites found/);
    expect(CODE).not.toMatch(/status: 404/);
  });

  it('stores a zero-property grant under a sentinel row the backfill can find by user id', () => {
    expect(CODE).toMatch(/domain: `account-grant:\$\{grantOwner\}`/);
    expect(CODE).toMatch(/user_id: grantOwner/);
  });

  it('never stores a grant with a null user id — the backfill looks the operator up by it', () => {
    expect(CODE).toMatch(/const grantOwner = userId \?\? \(await firstOperatorId\(\)\)/);
    expect(CODE).toMatch(/from\('admin_users'\)/);
  });

  it('still records one row per property when the account has them', () => {
    expect(CODE).toMatch(/for \(const entry of siteEntries\)/);
    expect(CODE).toMatch(/onConflict: 'domain'/);
  });

  it('the backfill acts under the newest CONSENT, not the freshest expiry — reads refresh old rows daily', () => {
    const connect = readFileSync(join(process.cwd(), 'lib/gsc/connectDomain.ts'), 'utf8');
    const created = connect.indexOf(".order('created_at', { ascending: false })");
    const expiry = connect.indexOf(".order('expiry', { ascending: false");
    expect(created).toBeGreaterThan(-1);
    expect(expiry).toBeGreaterThan(created); // created_at is the primary key of the sort
  });
});
