/**
 * @jest-environment node
 */
// Scaffold copy may not make claims on a stranger's behalf.
//
// ⚠️ THE INCIDENT. FAQS_GENERIC shipped 'Yes — {business} is fully licensed and insured, so you're
// covered every step of the way.' The listing-import pipeline publishes these pages under REAL,
// NAMED businesses that never asked for a site — 51 templates carried that sentence, 16 of them
// listing-imports and 15 published. An invented menu item is a mistake about food. An invented
// insurance claim is one a customer can rely on and a regulator can act on.
//
// The rule this file enforces: an answer may state something true BY CONSTRUCTION — an invitation,
// or a process we control — and may never assert a fact about the business's operation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickFaqItems } from '../industryCopy';
import type { IndustryKey } from '@/lib/industries';

const SRC = readFileSync(join(process.cwd(), 'lib/builder/industryCopy.ts'), 'utf8');
// Strip comments so the warning describing the old sentence doesn't fail the test that bans it.
const CODE = SRC.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

/** Claims about the business that we cannot know and a customer could rely on. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/is fully licensed and insured/i, 'asserts regulatory status of a business we have never spoken to'],
  [/\bwe are licensed\b/i, 'asserts regulatory status'],
  [/respond within the hour/i, 'invents a service-level commitment'],
  [/same day whenever possible/i, 'invents an availability promise'],
  [/free,? no-obligation quote/i, 'invents a pricing policy'],
  [/property-safe methods/i, 'invents a safety guarantee'],
  [/accept all major payment/i, 'invents a payment policy'],
  [/\bwe(?:’|')?re upfront about costs\b/i, 'invents a pricing policy'],
];

describe('scaffold FAQ copy makes no claims on the business behalf', () => {
  it.each(FORBIDDEN)('does not contain %s — %s', (pattern) => {
    expect(CODE).not.toMatch(pattern as RegExp);
  });

  // ⚠️ A scan matching nothing reports success. If the FAQ arrays are ever removed or renamed this
  // fails loudly instead of passing over an empty file.
  it('is actually scanning the FAQ copy', () => {
    expect(CODE).toMatch(/FAQS_GENERIC/);
    expect(CODE).toMatch(/Are you licensed and insured\?/);
  });
});

describe('generated FAQs, across every industry style', () => {
  const KEYS: IndustryKey[] = [
    'auto_repair', 'restaurant', 'roofing', 'towing', 'salon_spa', 'general_contractor',
  ] as IndustryKey[];

  it.each(KEYS)('%s produces no forbidden claim', (key) => {
    const items = pickFaqItems({ industryKey: key, businessName: "Carlos Auto Repair" });
    const text = items.map((i) => `${i.question} ${i.answer}`).join(' ');
    for (const [pattern, why] of FORBIDDEN) {
      if (pattern.test(text)) throw new Error(`${key}: ${why} — ${text}`);
    }
  });

  it('still answers the licensing question rather than dropping it', () => {
    // Dropping the question would be the lazy fix: people genuinely want to know, and an FAQ that
    // omits it is less useful than one that says "ask us".
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      const items = pickFaqItems({ industryKey: 'roofing' as IndustryKey, businessName: 'X' });
      found = items.some((q) => /licensed and insured/i.test(q.question));
    }
    expect(found).toBe(true);
  });

  it('leaves no unsubstituted {business} placeholder', () => {
    for (const key of KEYS) {
      const items = pickFaqItems({ industryKey: key, businessName: 'Carlos Auto Repair' });
      for (const i of items) expect(i.answer).not.toMatch(/\{business\}|\{label\}/);
    }
  });
});
