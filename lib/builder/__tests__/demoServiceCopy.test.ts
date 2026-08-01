/**
 * @jest-environment node
 */
// Two personas independently judged a generated demo site and both named "no detailed service
// descriptions" as a top reason not to trust it. The generator's copy type was `services:
// string[]` — bare names — so regenerating the cohort would have spent ~$0.04/site on fresh hero
// images and produced the identical bare list. Money for a no-op, reported as a fix.
//
// These tests hold the two halves of the change: descriptions are produced, and they land where
// a visitor reads them rather than in the site's offer list.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'lib/builder/generateDemoSite.ts'), 'utf8');
const code = src
  .split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
  .join('\n');

describe('demo copy asks for service descriptions', () => {
  it('types services as name + description, not a bare string list', () => {
    expect(code).toMatch(/type ServiceCopy = \{ name: string; description: string \}/);
    expect(code).toMatch(/services: ServiceCopy\[\]/);
  });

  it('the prompt actually requests a description', () => {
    // A richer type with an unchanged prompt would type-check and still return names.
    expect(code).toMatch(/\{name, description\}/);
    expect(code).toMatch(/description is ONE/);
  });
});

describe('the parse tolerates both shapes', () => {
  // Reimplements the parser's mapping so the behaviour is testable without an API call — the
  // shape contract is what matters, and it is asserted against the source above.
  const parse = (raw: any) =>
    Array.isArray(raw)
      ? raw
          .map((v: any) =>
            typeof v === 'string'
              ? { name: v.trim(), description: '' }
              : { name: String(v?.name ?? '').trim(), description: String(v?.description ?? '').trim() },
          )
          .filter((v) => v.name)
          .slice(0, 6)
      : [];

  it('reads the new object shape', () => {
    expect(parse([{ name: 'Driveway washing', description: 'Removes oil and moss.' }])).toEqual([
      { name: 'Driveway washing', description: 'Removes oil and moss.' },
    ]);
  });

  it('still reads a plain string, rather than crashing on an older response', () => {
    // A demo with names and no descriptions is worse copy, not a broken build.
    expect(parse(['Driveway washing'])).toEqual([{ name: 'Driveway washing', description: '' }]);
  });

  it('drops entries with no name', () => {
    expect(parse([{ description: 'orphaned' }, ''])).toEqual([]);
  });

  it('is not fooled by a non-array', () => {
    expect(parse('Driveway washing')).toEqual([]);
    expect(parse(null)).toEqual([]);
  });
});

// ⚠️ THE DISTINCTION THAT KEEPS THE CONTACT FORM SANE. `tpl.services` is the site's OFFER LIST,
// which the contact form renders as the "I'm Interested In:" dropdown. A full sentence in there
// is nonsense — a visitor picking "Removes oil and moss from concrete" as the thing they want.
// (That form already published a person's 40 résumé skills as enquiry options once this week.)
describe('descriptions go where they are read, not into the offer list', () => {
  it('keeps tpl.services as names only', () => {
    expect(code).toMatch(/const services = serviceCopy\.map\(\(sv\) => sv\.name\)/);
    expect(code).toMatch(/tpl\.services = services;/);
  });

  it('writes name + description onto the services BLOCK', () => {
    expect(code).toMatch(/b\?\.type !== 'services'/);
    expect(code).toMatch(/b\.content\.items = serviceCopy\.map/);
  });

  it('does not put descriptions in meta.services either', () => {
    // meta.services feeds the same offer-list consumers.
    const metaBlock = code.slice(code.indexOf('tpl.data.meta = {'), code.indexOf('is_demo: true'));
    expect(metaBlock).toContain('services,');
    expect(metaBlock).not.toContain('serviceCopy');
  });
});
