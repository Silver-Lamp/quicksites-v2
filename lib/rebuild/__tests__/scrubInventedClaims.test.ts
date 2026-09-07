/**
 * @jest-environment node
 */
import { scrubText, scrubFaqs, makesOperationalClaim } from '@/lib/rebuild/scrubInventedClaims';

describe('the real sentences that shipped on real businesses', () => {
  // ⚠️ Every string here was generated for a named towing company we have never spoken to, and
  // read from the live DB. Not invented for the test.
  it.each([
    'We aim to reach you within 30 minutes of your call.',
    'All-In Towing is fully licensed and insured for your peace of mind.',
    'Call today for a free estimate on any tow.',
    'Over 20 years of experience serving the community.',
    'Satisfaction guaranteed on every job.',
  ])('drops: %s', (s) => {
    expect(makesOperationalClaim(s)).toBe(true);
    expect(scrubText(s).text).toBe('');
  });

  it('removes only the offending sentence — the real hero line was two', () => {
    // The actual generated subheadline. The first sentence is fine and states a real fact; only
    // the availability claim goes. Binning the whole string would lose good copy.
    const real = "Reliable towing services in Good Hope, AL. We're here for you 24/7!";
    expect(makesOperationalClaim(real)).toBe(true);
    expect(scrubText(real).text).toBe('Reliable towing services in Good Hope, AL.');
  });

  it('keeps the honest half of a mixed paragraph rather than binning the lot', () => {
    const before =
      "All-In Towing serves Good Hope, AL. We're here for you 24/7! Call us and we'll tell you what we can do today.";
    const { text } = scrubText(before);
    expect(text).toContain('All-In Towing serves Good Hope, AL.');
    expect(text).toContain("Call us and we'll tell you what we can do today.");
    expect(text).not.toMatch(/24\s*\/\s*7/);
  });

  it('leaves copy that claims nothing completely untouched', () => {
    const ok = 'All-In Towing and Recovery is a towing company in Good Hope, Alabama.';
    expect(scrubText(ok).text).toBe(ok);
    expect(makesOperationalClaim(ok)).toBe(false);
  });
});

describe('questions are not claims', () => {
  it('keeps an FAQ that ASKS about licensing but answers honestly', () => {
    // industryCopy already answers this the right way; dropping the pair would lose a good FAQ.
    const { faqs } = scrubFaqs([
      { q: 'Are you licensed and insured?', a: 'Ask us and we’ll confirm our current license and insurance details before any work starts.' },
    ]);
    expect(faqs).toHaveLength(1);
  });

  it('drops an FAQ whose ANSWER asserts it', () => {
    const { faqs, hits } = scrubFaqs([
      { q: 'Are you licensed and insured?', a: 'Yes — we are fully licensed and insured.' },
      { q: 'What areas do you serve?', a: 'Good Hope and the surrounding towns.' },
    ]);
    expect(faqs.map((f) => f.q)).toEqual(['What areas do you serve?']);
    expect(hits).toContain('licensing');
  });

  it('drops the real 30-minute FAQ that shipped', () => {
    const { faqs } = scrubFaqs([
      { q: 'How quickly can you arrive?', a: 'We aim to reach you within 30 minutes of your call.' },
    ]);
    expect(faqs).toHaveLength(0);
  });
});

describe('it does not fire on ordinary copy', () => {
  // #857's lesson: a blanket phrase replacement produced "ready around the clock where we can to
  // help you" and rewrote a question into nonsense. A filter that mangles good copy gets turned off.
  it.each([
    'Towing and roadside assistance in Grafton, WI.',
    'Call us about towing — we’ll tell you what we can do today.',
    'Ask about pricing and payment when you get in touch.',
    'We tow cars, trucks and motorcycles.',
    'Serving Bonney Lake and nearby areas.',
  ])('keeps: %s', (s) => {
    expect(makesOperationalClaim(s)).toBe(false);
    expect(scrubText(s).text).toBe(s);
  });

  it('handles empty and missing input without inventing a result', () => {
    expect(scrubText(null).text).toBe('');
    expect(scrubFaqs(null).faqs).toEqual([]);
  });
});

// ── The generators must both ask for it AND enforce it ────────────────────────────────────────
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const LISTING = read('lib/rebuild/enrichListingCopy.ts');
const REBUILD = read('lib/rebuild/inferSiteSpec.ts');

describe('both copy generators forbid operational claims and scrub their own output', () => {
  it.each([
    ['listing import', LISTING],
    ['site rebuild', REBUILD],
  ])('%s prompt forbids the specific claims that shipped', (_n, src) => {
    expect(src).toMatch(/24\/7/);
    expect(src).toMatch(/licensing, insurance, bonding/);
    expect(src).toMatch(/response or arrival times/);
  });

  it.each([
    ['listing import', LISTING],
    ['site rebuild', REBUILD],
  ])('%s scrubs the model output, not just the prompt', (_n, src) => {
    // ⚠️ The prompt is a request. The scrub is the guard. A future edit that keeps the wording and
    // drops the call would read as safe and would not be.
    expect(src).toMatch(/scrubFaqs\(/);
  });

  it('the listing path scrubs the hero copy too, not only the FAQs', () => {
    // "We're here for you 24/7!" shipped in a subheadline, not an FAQ.
    expect(LISTING).toMatch(/scrubText\(/);
  });

  it('the guard is not inert — it would notice a prompt losing the rule', () => {
    const planted = "'You write clean, human, SEO-minded website copy for a REAL local business.'";
    expect(/licensing, insurance, bonding/.test(planted)).toBe(false);
  });
});

describe('an answer is replaced, never emptied', () => {
  const { honestAnswerFor, claimKind } = require('@/lib/rebuild/scrubInventedClaims');

  // ⚠️ The dry run over 140 live sites showed sentence-removal leaving 114 EMPTY answer fields and
  // one fragment — "Yes — Restock Resale Co." A blank FAQ answer is worse than a dishonest one:
  // now the page is broken as well as unhelpful. #857 called this "ungrammatical honesty is not
  // honesty" and it is the reason answers are replaced wholesale.
  it.each([
    ['Yes — Hearth & Harbor is fully licensed and insured, so you’re covered every step of the way.', /confirm our current license/],
    ['Usually within 30 minutes.', /honest ETA/],
    ['Reach out through the contact form — we’ll get back to you quickly with a free, no-obligation quote.', /Ask about pricing/],
    ['We are available 24/7 for any emergency.', /what we can do today/],
  ])('replaces %s', (before, expected) => {
    const after = honestAnswerFor(before);
    expect(after).toMatch(expected);
    expect(after!.length).toBeGreaterThan(20); // never empty, never a fragment
    expect(after).not.toMatch(/24\/7|licensed and insured|within 30 minutes/i);
  });

  it('returns null for an answer that claims nothing, so it is left alone', () => {
    expect(honestAnswerFor('We tow cars, trucks and motorcycles across Pierce County.')).toBeNull();
  });

  it('names the kind of claim, so the replacement can answer the right question', () => {
    expect(claimKind('Usually within 30 minutes.')).toBe('response-time');
    expect(claimKind('We are fully licensed and insured.')).toBe('licensing');
    expect(claimKind('Open 24/7.')).toBe('availability');
    expect(claimKind('We tow motorcycles.')).toBeNull();
  });

  it('every replacement is itself clean — a fix that reintroduces a claim is not a fix', () => {
    for (const src of ['licensed and insured', 'within 30 minutes', '24/7', 'free quote', 'guaranteed', 'over 20 years']) {
      const out = honestAnswerFor(`We are ${src}.`);
      if (out) expect(makesOperationalClaim(out)).toBe(false);
    }
  });
});
