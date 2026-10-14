/**
 * @jest-environment node
 */
// Partner-managed reps. Pure halves: the code from a name, the links, the input rules. Source
// guards: a rep code is OWNED by the partner (never the rep) and inherits the partner's plan; the
// routes are partner-gated; the dynamic page is noindex and mints a grant for its own code only;
// a rep-built draft is stamped with the partner's org at insert.
import fs from 'node:fs';
import path from 'node:path';
import { repCodeFromName, repLinks, validateRepInput } from '@/lib/partners/repCodes';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('repCodeFromName', () => {
  it('keeps letters and digits only, lowercased, 2–24 chars', () => {
    expect(repCodeFromName('Priya Shah')).toBe('priyashah');
    expect(repCodeFromName('  Jean-Luc O’Neil ')).toBe('jeanluconeil');
    expect(repCodeFromName('A')).toBeNull();
    expect(repCodeFromName('!!!')).toBeNull();
    expect(repCodeFromName('x'.repeat(40))?.length).toBe(24);
  });
});

describe('repLinks', () => {
  it('hands a rep their page and their ref link on the given base', () => {
    expect(repLinks('priya', 'https://www.quicksites.ai/')).toEqual({ pageUrl: 'https://www.quicksites.ai/for/priya', refLink: 'https://www.quicksites.ai/?ref=priya' });
  });
});

describe('validateRepInput', () => {
  it('needs a name, checks the email, and a region needs a city', () => {
    expect(validateRepInput({ name: 'P' })).toEqual({ ok: false, error: 'A name is required.' });
    expect(validateRepInput({ name: 'Priya', email: 'nope' })).toMatchObject({ ok: false });
    expect(validateRepInput({ name: 'Priya', region: 'UK' })).toMatchObject({ ok: false });
    expect(validateRepInput({ name: 'Priya Shah', email: 'P@X.io', city: 'Manchester', region: 'UK' })).toEqual({ ok: true, name: 'Priya Shah', email: 'p@x.io', city: 'Manchester', region: 'UK' });
  });
});

describe('source guards', () => {
  it('a rep code is owned by the partner, inherits the partner plan, and hangs under the partner code', () => {
    const src = read('lib/partners/repCodes.ts');
    expect(src).toMatch(/owner_id: input\.partnerUserId/);
    expect(src).toMatch(/plan: \(parent as any\)\.plan/);
    expect(src).toMatch(/parent_code: input\.partnerCode/);
    expect(src).toMatch(/created_by: input\.partnerUserId/);
    expect(src).not.toMatch(/owner_id: input\.email|owner_id: rep/);
  });
  it('the reps routes are partner-gated and rate-limited', () => {
    const src = read('app/api/partners/reps/route.ts');
    expect(src.match(/await requirePartner\(\)/g)?.length).toBe(2);
    expect(src).toMatch(/rateLimitOr429\(req, 'partner-reps'/);
    expect(src).toMatch(/partnerCode: gate\.codes\[0\]/);
  });
  it('the dynamic rep page is noindex, 404s on a non-rep code, and mints a grant for its own code only', () => {
    const src = read('app/for/[code]/page.tsx');
    expect(src).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(src).toMatch(/if \(!rep\) notFound\(\)/);
    expect(src).toMatch(/mintRepActionToken\(rep\.code\)/);
    expect(src).toMatch(/territory=\{territory\}/);
  });
  it('a rep-built draft is stamped with the partner org at insert, through both builders', () => {
    const route = read('app/api/rep/build-draft/route.ts');
    expect(route).toMatch(/const orgId = await orgIdForCode\(code\)/);
    expect(route).toMatch(/buildDraftFromSite\(\{[^}]*orgId \}\)/);
    expect(route).toMatch(/buildDraftFromListing\(\{[^}]*orgId \}\)/);
    for (const p of ['lib/outreach/buildDraftFromListing.ts', 'lib/outreach/buildDraftFromSite.ts']) {
      expect(read(p)).toMatch(/\.\.\.\(input\.orgId \? \{ org_id: input\.orgId \} : \{\}\)/);
    }
  });
  it('the dashboard mounts the reps card', () => {
    expect(read('app/partners/dashboard/page.tsx')).toMatch(/<RepsCard \/>/);
  });
});
