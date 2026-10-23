/**
 * @jest-environment node
 */
// A consultant used to be "Other" — the hero re-asked the site type and the scaffold printed
// "Local other you can count on" (Amy's walkthrough, 2026-10-22). `consulting` is a real industry.
import { resolveIndustryKey, KEY_TO_LABEL } from '@/lib/industries';
import { contactInterestsFor, genericServiceNames } from '@/lib/industries/contactInterests';
import { industryStyle } from '@/lib/builder/industryStyle';
import { pickHeroCopy } from '@/lib/builder/industryCopy';

it('resolves from the words a consultant types, without stealing other trades', () => {
  for (const s of ['Consulting', 'SVE Consulting', 'business consultant', 'Financial Advisor', 'business coaching']) {
    expect(resolveIndustryKey(s)).toBe('consulting');
  }
  expect(resolveIndustryKey('towing')).toBe('towing');
  expect(resolveIndustryKey('law firm')).toBe('legal');
  expect(KEY_TO_LABEL.consulting).toBe('Consulting');
});

it('gets its own services in the contact form, never the generic list', () => {
  const ci = contactInterestsFor('consulting');
  expect(ci.mode).toBe('services');
  if (ci.mode === 'services') expect(ci.options.join('|')).not.toBe(genericServiceNames().join('|'));
});

it('reads as a trust profession and names itself in the hero', () => {
  expect(industryStyle('consulting')).toBe('trust');
  const { subheadline } = pickHeroCopy({ industryKey: 'consulting', label: 'Consulting', rng: () => 0 });
  expect(subheadline).not.toMatch(/\bother\b/i);
});
