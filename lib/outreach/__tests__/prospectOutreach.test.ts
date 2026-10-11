// "Texted them" / card status / mail-the-card from the Evolve strip and the rep tables
// (owner, 2026-10-11). The pure lines, and source guards over the three surfaces.
import fs from 'fs';
import path from 'path';
import { postcardStatusLine, touchesLine } from '@/lib/outreach/prospectOutreach';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('postcardStatusLine', () => {
  it('reads mailed · in transit · scans, and prefers delivered / returned when known', () => {
    expect(postcardStatusLine(null)).toBeNull();
    expect(postcardStatusLine({ created_at: '2026-10-10T20:00:00Z', status: 'created', expected_delivery_date: null, delivered_at: null, returned_at: null, scans: 0 })).toBe('mailed Oct 10 · in transit · 0 scans');
    expect(postcardStatusLine({ created_at: '2026-10-10T20:00:00Z', status: 'created', expected_delivery_date: '2026-10-15', delivered_at: null, returned_at: null, scans: 1 })).toMatch(/^mailed Oct 10 · arrives ~Oct 1[45] · 1 scan$/);
    expect(postcardStatusLine({ created_at: '2026-10-10T20:00:00Z', status: 'delivered', expected_delivery_date: null, delivered_at: '2026-10-14T18:00:00Z', returned_at: null, scans: 2 })).toBe('mailed Oct 10 · delivered Oct 14 · 2 scans');
    expect(postcardStatusLine({ created_at: '2026-10-10T20:00:00Z', status: 'returned', expected_delivery_date: null, delivered_at: null, returned_at: '2026-10-20T18:00:00Z', scans: 0 })).toBe('mailed Oct 10 · returned · 0 scans');
  });
  it('touchesLine', () => {
    expect(touchesLine({ textedAt: null, dmAt: null })).toBeNull();
    expect(touchesLine({ textedAt: '2026-10-11T15:00:00Z', dmAt: '2026-10-11T16:00:00Z' })).toBe('texted Oct 11 · DM Oct 11');
  });
});

describe('the touch route: a grant or a signed-in member, never a bare tally', () => {
  const src = read('app/api/rep/touch/route.ts');
  it('authorises exactly like build-draft and records the message body', () => {
    expect(src).toMatch(/verifyRepActionToken\(token\)/);
    expect(src).toMatch(/await requireUser\(\)/);
    expect(src).toMatch(/validateTouch\(\{ body: text, channel, direction: 'outbound' \}\)/);
    expect(src).toMatch(/rateLimitOr429\(req, 'rep-touch'/);
    expect(src).not.toMatch(/getAdminUser|requireAdmin/);
  });
});

describe('the surfaces', () => {
  it('the Evolve strip logs the exact draft it offered, shows the card line, and mails only as admin', () => {
    const bar = read('components/evolve/operator-bar.tsx');
    expect(bar).toMatch(/logTouch\('sms', sms\)/);
    expect(bar).toMatch(/logTouch\('dm', dm\)/);
    expect(bar).toMatch(/'No card mailed'/);
    expect(bar).toMatch(/window\.confirm\(/); // postage
    expect(bar).toMatch(/\/api\/admin\/prospects\/mail-evolve-postcards/);
    expect(bar).toMatch(/p\.admin && !cardLine/);
  });
  it('the rep table carries Texted them ✓ with the text it offered, and the card line', () => {
    const t = read('components/for-rep/restaurant-table.tsx');
    expect(t).toMatch(/logTexted\(r, repOrderingSmsDraft\(/);
    expect(t).toMatch(/'No card mailed'/);
    const loader = read('lib/rep/repRestaurants.ts');
    expect(loader).toMatch(/loadOutreachMarks\(/);
  });
  it('the Evolve page decides postcard eligibility only inside the admin branch and passes the marks', () => {
    const page = read('app/evolve/[prospectId]/page.tsx');
    expect(page.indexOf('selectEvolveMailable({ ids: [p.id] })')).toBeGreaterThan(page.indexOf('if (admin) {'));
    expect(page).toMatch(/marks=\{marks\}/);
  });
});
