/**
 * @jest-environment node
 */
// lib/rep/__tests__/repBuild.test.ts
//
// A rep with no account can build a draft from their page with one click. The grant must be
// unforgeable and expiring, every link it hands back must carry the rep's code (or the rep
// does the work and is never paid), and the prefilled text makes no promise a postcard may not.
import fs from 'node:fs';
import path from 'node:path';
import { mintRepActionToken, verifyRepActionToken, REP_ACTION_TTL_MS } from '@/lib/rep/repActionToken';
import { repBuildLinks, repSmsDraft, smsHref, withRef, REP_BUILDS_PER_DAY } from '@/lib/rep/repBuild';
import { stripComments } from '@/test/stripComments';

process.env.CLAIM_TOKEN_SECRET ||= 'test-secret-for-rep-grants';
const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('the rep grant', () => {
  it('round-trips the code, lower-cased', () => {
    expect(verifyRepActionToken(mintRepActionToken('Abdou'))).toEqual({ code: 'abdou' });
  });
  it('rejects a tampered body, a wrong signature, and an expired grant', () => {
    const t = mintRepActionToken('abdou');
    const [body, sig] = t.split('.');
    const forged = `${Buffer.from(JSON.stringify({ c: 'angela', exp: Date.now() + 1e6 })).toString('base64url')}.${sig}`;
    expect(verifyRepActionToken(forged)).toBeNull();
    expect(verifyRepActionToken(`${body}.AAAA`)).toBeNull();
    expect(verifyRepActionToken(t, Date.now() + REP_ACTION_TTL_MS + 1)).toBeNull();
    expect(verifyRepActionToken(null)).toBeNull();
  });
});

describe('the links a build hands back', () => {
  it('carry ?ref=<code> on both the preview and the tracked claim link', () => {
    const l = repBuildLinks({ slug: 'durong-ip8ay', industryKey: 'restaurant', prospectId: 'p1', code: 'abdou', base: 'https://www.quicksites.ai', menuHost: 'delivered.menu' });
    expect(l.previewUrl).toBe('https://deliveredmenu.com/durong-ip8ay?ref=abdou');
    expect(l.claimUrl).toBe('https://www.quicksites.ai/go/p1?ref=abdou');
  });
  it('a non-restaurant previews on the platform, not the menu host', () => {
    const l = repBuildLinks({ slug: 'vashon-parts-x1', industryKey: 'auto_repair', prospectId: 'p2', code: 'abdou', base: 'https://www.quicksites.ai', menuHost: 'delivered.menu' });
    expect(l.previewUrl).toBe('https://www.quicksites.ai/sites/vashon-parts-x1?ref=abdou');
  });
  it('withRef replaces rather than duplicates', () => {
    expect(withRef('https://x.test/a?ref=old&b=1', 'new')).toBe('https://x.test/a?ref=new&b=1');
  });
});

describe('the prefilled text', () => {
  const FORBIDDEN: RegExp[] = [/\brank(s|ing|ed)?\b/i, /page one|page 1|#1\b/i, /\bgoogle\b/i, /24\s*\/\s*7/i, /licens|insured/i, /guarantee/i, /competitor|before someone else/i, /deadline|expires/i, /\$\s?\d/];
  const msg = repSmsDraft({ repName: 'Abdou', businessName: 'Durong', previewUrl: 'https://deliveredmenu.com/durong-ip8ay?ref=abdou' });
  it('names the rep, the business, the link, and makes no promise', () => {
    expect(msg).toMatch(/^Hi, this is Abdou\./);
    expect(msg).toContain('Durong');
    expect(msg).toContain('https://deliveredmenu.com/durong-ip8ay?ref=abdou');
    for (const re of FORBIDDEN) expect(msg).not.toMatch(re);
  });
  it('smsHref normalises the number and encodes the body', () => {
    expect(smsHref('(206) 463-3782', 'hi there')).toBe('sms:+12064633782?&body=hi%20there');
    expect(smsHref(null, 'x')).toBe('sms:?&body=x');
  });
});

describe('the route is bounded on the server', () => {
  const src = read('app/api/rep/build-draft/route.ts');
  it('verifies the grant, checks the code is active, throttles the IP and caps the code per day', () => {
    expect(src).toMatch(/verifyRepActionToken\(/);
    expect(src).toMatch(/codeIsUsable\(code\)/);
    expect(src).toMatch(/rateLimitOr429\(req, 'rep-build-draft'/);
    expect(src).toMatch(/checkRateLimit\(`rep-build:\$\{code\}`, REP_BUILDS_PER_DAY, 24 \* 3600\)/);
    expect(REP_BUILDS_PER_DAY).toBeLessThanOrEqual(25);
  });
  it('builds only a parked prospect by id, with its own industry, and never a second draft', () => {
    expect(src).toMatch(/\^\[0-9a-f-\]\{36\}\$/);
    expect(src).toMatch(/industryKey: \(p\.industry_key as any\) \|\| undefined/);
    expect(src).toMatch(/if \(p\.template_id\)/);
    expect(src).not.toMatch(/getAdminUser|requireAdmin/);
  });
  it('the page mints the grant for its own code and hands the table every link with the code', () => {
    const page = read('app/for-abdou/page.tsx');
    expect(page).toMatch(/mintRepActionToken\(CODE\)/);
    expect(page).toMatch(/repBuildLinks\(\{ slug, industryKey: r\.industry_key, prospectId: r\.id, code: CODE/);
  });
});
