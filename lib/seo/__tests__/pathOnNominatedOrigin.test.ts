/**
 * @jest-environment node
 */
// A platform copy of a custom-domain site must canonicalise to the page's address ON that domain
// — `https://bhard.store/`, not `https://bhard.store/sites/bhard` (every nominated site's
// platform copy did the latter until 2026-10-16).
import fs from 'node:fs';
import path from 'node:path';
import { absoluteUrl, pathOnNominatedOrigin } from '@/lib/seo/canonicalUrl';
import { stripComments } from '@/test/stripComments';

describe('pathOnNominatedOrigin', () => {
  it('strips the platform prefix for the site itself', () => {
    expect(pathOnNominatedOrigin('/sites/bhard', 'bhard')).toBe('/');
    expect(pathOnNominatedOrigin('/sites/bhard/', 'bhard')).toBe('/');
    expect(pathOnNominatedOrigin('/sites/bhard/menu', 'bhard')).toBe('/menu');
    expect(pathOnNominatedOrigin('/sites/bhard/services/towing', 'bhard')).toBe('/services/towing');
  });
  it('leaves a host-native path alone (custom domain, subdomain, delivered.menu apex form)', () => {
    expect(pathOnNominatedOrigin('/', 'bhard')).toBe('/');
    expect(pathOnNominatedOrigin('/menu', 'bhard')).toBe('/menu');
    expect(pathOnNominatedOrigin('/sites/other-site', 'bhard')).toBe('/sites/other-site');
    expect(pathOnNominatedOrigin('/sites/bhardware', 'bhard')).toBe('/sites/bhardware');
  });
  it('joins to the origin as the one address', () => {
    expect(absoluteUrl('https://bhard.store', pathOnNominatedOrigin('/sites/bhard', 'bhard'))).toBe('https://bhard.store/');
    expect(absoluteUrl('https://www.bremerton-towing.com', pathOnNominatedOrigin('/sites/bremerton-towing/services', 'bremerton-towing'))).toBe('https://www.bremerton-towing.com/services');
  });
  it('the platform route uses it whenever a canonical origin is nominated', () => {
    const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/sites/[slug]/[[...rest]]/page.tsx'), 'utf8'));
    expect(src).toMatch(/absoluteUrl\(canonicalOrigin, pathOnNominatedOrigin\(await publicPathFromHeaders\(/);
    expect(src).not.toMatch(/absoluteUrl\(canonicalOrigin, await publicPathFromHeaders\(/);
  });
});
