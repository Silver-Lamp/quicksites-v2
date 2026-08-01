/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/importProfile.test.ts
//
// The "About Me" profile importer (LinkedIn /in/, about.me, personal homepages).
// Pins the deterministic scrape→profile→personal-RebuildSpec mapping — no AI in this
// path, so these tests ARE the spec. Covers JSON-LD Person, OG fallbacks, the
// social-link filter, and the URL hint that routes a page down the profile branch.

import type { ScrapedSite } from '@/lib/rebuild/scrapeSite';
import {
  profileFromScrape,
  rebuildSpecFromProfile,
  looksLikeProfileUrl,
} from '@/lib/rebuild/importProfile';

const base = (over: Partial<ScrapedSite> = {}): ScrapedSite => ({
  sourceUrl: 'https://about.me/alex',
  finalUrl: 'https://about.me/alex',
  businessName: null,
  title: null,
  description: null,
  headings: [],
  navLabels: [],
  links: [],
  bodyText: '',
  heroImage: null,
  images: [],
  accentColor: null,
  colorMode: 'light',
  structuredData: [],
  productMeta: null,
  ...over,
});

describe('looksLikeProfileUrl', () => {
  it('matches about.me and linkedin /in/ profiles', () => {
    expect(looksLikeProfileUrl('https://about.me/alex')).toBe(true);
    expect(looksLikeProfileUrl('https://www.linkedin.com/in/alex-rivera')).toBe(true);
  });
  it('rejects business sites and linkedin company pages', () => {
    expect(looksLikeProfileUrl('https://acme-plumbing.com')).toBe(false);
    expect(looksLikeProfileUrl('https://linkedin.com/company/acme')).toBe(false);
    expect(looksLikeProfileUrl('not a url')).toBe(false);
  });
});

describe('profileFromScrape', () => {
  it('prefers JSON-LD Person fields', () => {
    const p = profileFromScrape(
      base({
        title: 'Alex Rivera | Product Designer',
        structuredData: [
          {
            '@type': 'Person',
            name: 'Alex Rivera',
            jobTitle: 'Product Designer',
            description: 'I design calm, humane software and mentor new designers.',
            image: 'https://cdn.example.com/alex.jpg',
            address: { addressLocality: 'Seattle' },
            sameAs: ['https://github.com/alexr', 'https://x.com/alexr'],
          },
        ],
      }),
    );
    expect(p.name).toBe('Alex Rivera');
    expect(p.headline).toBe('Product Designer');
    expect(p.bio).toContain('humane software');
    expect(p.photoUrl).toBe('https://cdn.example.com/alex.jpg');
    expect(p.location).toBe('Seattle');
    expect(p.links.map((l) => l.href)).toEqual(['https://github.com/alexr', 'https://x.com/alexr']);
  });

  it('falls back to OG/meta + title when no Person JSON-LD', () => {
    const p = profileFromScrape(
      base({
        businessName: 'Alex Rivera',
        title: 'Alex Rivera — Writer',
        description: 'Essays about cities and software.',
        heroImage: 'https://img/og.jpg',
        links: [
          { label: 'My LinkedIn', href: 'https://www.linkedin.com/in/alexr' },
          { label: 'Home', href: 'https://about.me/alex' }, // not a social host → dropped
        ],
      }),
    );
    expect(p.name).toBe('Alex Rivera');
    expect(p.bio).toBe('Essays about cities and software.');
    expect(p.photoUrl).toBe('https://img/og.jpg');
    // about.me IS a social host in the filter; linkedin too — both kept, home page label used.
    expect(p.links.some((l) => l.href.includes('linkedin.com/in/alexr'))).toBe(true);
  });

  it('degrades gracefully on a near-empty page', () => {
    const p = profileFromScrape(base({ headings: ['Jordan Lee'] }));
    expect(p.name).toBe('Jordan Lee');
    expect(p.headline).toBeNull();
  });
});

describe('rebuildSpecFromProfile', () => {
  it('maps to a personal RebuildSpec with the bio carried verbatim', () => {
    const spec = rebuildSpecFromProfile({
      name: 'Alex Rivera',
      headline: 'Product Designer',
      bio: 'I design calm software.',
      photoUrl: null,
      location: 'Seattle',
      links: [],
    });
    expect(spec.industryKey).toBe('personal');
    expect(spec.headline).toBe('Alex Rivera');
    expect(spec.subheadline).toBe('Product Designer');
    expect(spec.about).toBe('I design calm software.');
    expect(spec.services).toEqual([]);
    expect(spec.original?.about).toBe('I design calm software.'); // revertible
  });

  it('supplies structural defaults when fields are missing — but never an invented bio', () => {
    const spec = rebuildSpecFromProfile({ name: null, headline: null, bio: null, photoUrl: null, location: null, links: [] });
    // Structural defaults are fine: these are OUR labels for OUR scaffold, not claims about a
    // person, and something has to name the industry and title an untitled page.
    expect(spec.businessName).toBe('About Me');
    expect(spec.industryKey).toBe('personal');

    // ⚠️ `about` USED TO BE DEFAULTED TOO, and this test asserted it. The default was
    // 'Share who you are, what you're working on, and what you care about.' — prompt copy,
    // addressed to the owner, stored on their site in the field that holds their description of
    // themselves. It reached a real person's published page.
    //
    // A default for a LABEL is harmless. A default for someone's SELF-DESCRIPTION is text that
    // is neither theirs nor recognisably ours, which is the one kind a visitor misreads as
    // meant. Empty is honest; the gaps list is what tells them a summary is missing.
    expect(spec.about).toBe('');
  });
});
