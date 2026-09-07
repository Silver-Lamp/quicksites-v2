/**
 * @jest-environment node
 */
// lib/gsc/__tests__/oauthEnvNaming.test.ts
//
// ⚠️ geo-rank-sync ran every day for months and wrote ZERO ranks: 100 campaigns in, 0 synced,
// status ok. The OAuth client was built from GSC_CLIENT_ID, the credentials are stored under
// GOOGLE_CLIENT_ID, so every token refresh threw — into a bare `catch { return null }`, which the
// loop read as "no rank data" and skipped. Downstream, every surface showed the `unranked` column
// DEFAULT as though it were a measurement, for domains that were on page one.
//
// oauthConfig.ts already existed to fix exactly this drift for the connect flow. The token clients
// were never migrated to it. This test is about the source, because no unit test can catch a file
// reading the wrong env name — it just quietly gets undefined.
import { readFileSync } from 'fs';
import { join } from 'path';

const FILES = [
  'lib/gsc/getValidOAuthClient.ts',
  'lib/gsc/getAllValidOAuthClients.ts',
  'lib/gsc/refreshToken.ts',
];
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('every GSC client is built through the tolerant helper', () => {
  it.each(FILES)('%s reads no OAuth env var directly', (f) => {
    const src = read(f);
    expect(src).not.toMatch(/process\.env\.GSC_CLIENT_(ID|SECRET)/);
    expect(src).not.toMatch(/process\.env\.GOOGLE_CLIENT_(ID|SECRET)/);
  });

  it.each(FILES)('%s uses gscClientId/gscClientSecret', (f) => {
    expect(read(f)).toMatch(/gscClientId\(\)/);
  });

  it('the helper still tolerates BOTH namings — that is the whole point', () => {
    const src = read('lib/gsc/oauthConfig.ts');
    expect(src).toMatch(/GOOGLE_CLIENT_ID\s*\|\|\s*process\.env\.GSC_CLIENT_ID/);
    expect(src).toMatch(/GOOGLE_CLIENT_SECRET\s*\|\|\s*process\.env\.GSC_CLIENT_SECRET/);
  });

  it('the guard is not inert — it would catch a direct read coming back', () => {
    const planted = 'const c = new OAuth2(process.env.GSC_CLIENT_ID!, process.env.GSC_CLIENT_SECRET!);';
    expect(/process\.env\.GSC_CLIENT_(ID|SECRET)/.test(planted)).toBe(true);
  });
});

describe('the rank sync refuses to call syncing nothing a success', () => {
  const CRON = read('app/api/cron/geo-rank-sync/route.ts');

  it('reports ok:false when it resolved campaigns and synced none', () => {
    expect(CRON).toMatch(/campaigns\.length > 0 && synced === 0/);
    expect(CRON).toMatch(/ok:\s*!noneSynced/);
  });

  it('surfaces the Search Console error instead of discarding it', () => {
    // The bare `catch { return null }` is what made months of failure invisible.
    expect(CRON).not.toMatch(/catch\s*\{\s*return null;\s*\}/);
    expect(CRON).toMatch(/lastGscError/);
  });
});
