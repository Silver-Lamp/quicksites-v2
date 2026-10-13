/**
 * @jest-environment node
 */
// THE RULE: every industry decides what its contact dropdown asks — a trade's services, a real
// non-trade question, or nothing — and no industry may fall through to the catalog's generic
// "Consulting / Installation / Support / Upgrades / Maintenance". The House Band page offered
// exactly that to a band's visitors (2026-10-13); seven industries were in that state.
import fs from 'node:fs';
import path from 'node:path';
import { INDUSTRIES } from '@/lib/industries';
import { contactInterestsFor, genericServiceNames } from '@/lib/industries/contactInterests';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));
const generic = genericServiceNames();

describe('every industry has decided what its contact form asks', () => {
  it.each(INDUSTRIES.map((i) => [i.key] as const))('%s', (key) => {
    const r = contactInterestsFor(key);
    if (key === 'other') return; // the fallback itself
    if (r.mode === 'hide') return;
    expect(r.options.length).toBeGreaterThan(0);
    // Not the generic list, and no generic word inside a non-trade's options.
    expect(r.options.join('|')).not.toBe(generic.join('|'));
    if (r.mode === 'options') for (const g of generic) expect(r.options).not.toContain(g);
    expect(r.label).toBeTruthy();
    expect(r.placeholder).toBeTruthy();
  });

  it('an unknown industry hides the dropdown rather than showing the generic list', () => {
    expect(contactInterestsFor('not_an_industry')).toEqual({ mode: 'hide' });
    expect(contactInterestsFor(null)).toEqual({ mode: 'hide' });
  });

  it('a band is asked a band question', () => {
    const r = contactInterestsFor('musician');
    expect(r.mode).toBe('options');
    if (r.mode === 'options') {
      expect(r.options.some((o) => /show/i.test(o))).toBe(true);
      expect(r.label).not.toMatch(/service/i);
      expect(r.placeholder).not.toMatch(/service/i);
    }
  });
});

describe('the scaffold never writes the generic list into a site', () => {
  it.each(['musician', 'personal', 'lemonade_stand', 'dome_builder', 'restaurant'])('%s carries no template-level services', (key) => {
    const s: any = buildIndustryStarter({ businessName: 'T', industryKey: key as any });
    for (const list of [s.services, s.data?.services, s.data?.meta?.services]) {
      expect(Array.isArray(list) ? list : []).toEqual([]);
    }
  });
  it('a trade still gets its own services', () => {
    const s: any = buildIndustryStarter({ businessName: 'T', industryKey: 'towing' });
    expect(s.data.services.length).toBeGreaterThan(0);
    expect(s.data.services.join('|')).not.toBe(generic.join('|'));
  });
});

describe('the renderer asks the industry', () => {
  it('contact-form.tsx takes its label, placeholder and options from contactInterestsFor', () => {
    const src = read('components/admin/templates/render-blocks/contact-form.tsx');
    expect(src).toMatch(/contactInterestsFor\(/);
    expect(src).toMatch(/\{pickerLabel\}/);
    expect(src).toMatch(/\{pickerPlaceholder\}/);
    // The literal strings live in the module, not scattered in JSX.
    expect(src.match(/Select a service/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
