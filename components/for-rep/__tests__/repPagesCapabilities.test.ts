/**
 * @jest-environment node
 */
// Every field-rep page (one that mounts RestaurantsSection with a rep grant) carries the same
// capabilities (owner, 2026-10-14: "check the for-<name> pages to make sure they all have the
// latest formatting and capabilities"): the hours log that appears when the code's hourly option
// is on, the no-website list + starter kit, a live render, and noindex. A new rep page that
// forgets one fails here.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => stripComments(fs.readFileSync(path.join(root, p), 'utf8'));
const repPages = fs
  .readdirSync(path.join(root, 'app'))
  .filter((d) => /^for-[a-z]+$/.test(d))
  .map((d) => `app/${d}/page.tsx`)
  .filter((p) => fs.existsSync(path.join(root, p)))
  .filter((p) => /mintRepActionToken\(/.test(read(p)));

describe('field-rep pages', () => {
  it('finds the rep pages (a sweep matching nothing reports success)', () => {
    expect(repPages.length).toBeGreaterThanOrEqual(5);
  });
  it.each(repPages)('%s carries the shared rep capabilities and renders live', (p) => {
    const src = read(p);
    expect(src).toMatch(/<RepHoursSection /);
    // The no-website list + the starter kit: either the shared section (which carries the kit link)
    // or a page's own table plus its own kit link (abdou, craig).
    expect(src).toMatch(/<NoSiteSection |<NoSiteTable /);
    expect(src).toMatch(/<NoSiteSection |starter-kit/);
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(src).toMatch(/robots: \{ index: false, follow: false \}/);
  });
  it('the dynamic /for/<code> page carries them too', () => {
    const src = read('app/for/[code]/page.tsx');
    expect(src).toMatch(/<RepHoursSection /);
    expect(src).toMatch(/<NoSiteSection /);
  });
  it('the hours section renders only when the option is on, from the server half', () => {
    const src = read('components/for-rep/rep-hours-section.tsx');
    expect(src).toMatch(/loadHourly\(code\)/);
    expect(src).toMatch(/if \(!arr\.enabled \|\| arr\.rateCents == null\) return null/);
    expect(src).toMatch(/from '@\/lib\/rep\/hoursDb'/);
  });
});
