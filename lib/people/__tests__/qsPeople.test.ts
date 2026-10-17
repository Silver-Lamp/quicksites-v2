// lib/people/__tests__/qsPeople.test.ts — the QuickSites people list is real pages, names only.
import fs from 'node:fs';
import path from 'node:path';
import { QS_PEOPLE, qsPersonKeyFromPath } from '@/lib/people/qsPeople';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('QS_PEOPLE', () => {
  it('every entry points at a page that exists, keys are unique, relations are written', () => {
    const keys = new Set<string>();
    for (const p of QS_PEOPLE) {
      expect(fs.existsSync(path.join(process.cwd(), 'app', p.pitchPath.slice(1), 'page.tsx'))).toBe(true);
      expect(keys.has(p.key)).toBe(false);
      keys.add(p.key);
      expect(p.relation.length).toBeGreaterThan(10);
    }
  });
  it('Craig is on it (the ask), and every /for-* page in the app is either listed or the generic sales brief', () => {
    expect(QS_PEOPLE.find((p) => p.key === 'craig')?.pitchPath).toBe('/for-craig');
    const dirs = fs.readdirSync(path.join(process.cwd(), 'app')).filter((d) => /^for-/.test(d));
    for (const d of dirs) {
      if (d === 'for-sales') continue; // the unlisted brief for people recruited to sell — not one person
      expect(QS_PEOPLE.some((p) => p.pitchPath === `/${d}`)).toBe(true);
    }
  });
  it('carries no contact details', () => {
    const src = read('lib/people/qsPeople.ts');
    expect(src).not.toMatch(/@[a-z0-9-]+\.(com|io|net)/i);
    expect(src).not.toMatch(/\(\d{3}\) \d{3}-\d{4}/);
  });
  it('maps a visited path to a key only for listed pages', () => {
    expect(qsPersonKeyFromPath('/for-craig')).toBe('craig');
    expect(qsPersonKeyFromPath('/for-craig/?utm=x')).toBe('craig');
    expect(qsPersonKeyFromPath('/for-nobody')).toBeNull();
    expect(qsPersonKeyFromPath('/for-sales')).toBeNull();
  });
});

describe('the partner feed (source guards)', () => {
  const src = read('app/api/partner/hj/people/route.ts');
  it('is signed over pathname + search with the shared secret, fails closed, and is rate-limited', () => {
    expect(src).toMatch(/verifyPartnerSignature\(`\$\{url\.pathname\}\$\{url\.search\}`/);
    expect(src).toMatch(/partner_secret_unset/);
    expect(src).toMatch(/x-partner-id'\) !== 'hivejournal'/);
    expect(src).toMatch(/rateLimitOr429\(/);
  });
  it('returns names, relations and daily counts — never emails or visitor ids', () => {
    expect(src).not.toMatch(/owner_email|email:|distinct_id as|person_id/);
    expect(src).toMatch(/count\(distinct distinct_id\) as visitors/); // aggregated only
    expect(src).toMatch(/visitsUnavailable/); // absence is reported, never read as zero
  });
});
