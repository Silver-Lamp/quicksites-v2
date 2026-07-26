/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/generateHero.test.ts
//
// Pins the two pure/env bits of the optional rebuild-hero path: the flag parsing
// (off unless explicitly enabled — image gen is the priciest call) and the prompt
// shape (grounded in the business, no text/logos so it renders as a clean hero).

// Stub the metering chain — importing it for real instantiates a Supabase client at
// module load (realtime-js wants a WebSocket ctor), which the test env lacks. We only
// exercise the pure heroPrompt / flag logic here, not the metered image call.
jest.mock('@/lib/ai/meter', () => ({ meterLLMCall: jest.fn() }));

import { heroPrompt, rebuildHeroEnabled } from '@/lib/rebuild/generateHero';
import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec';

const spec: RebuildSpec = {
  businessName: 'Sunrise Bakery',
  industryKey: 'restaurant',
  industryLabel: 'Restaurant',
  headline: 'Fresh bread daily',
  subheadline: '',
  about: '',
  services: [],
  faqs: [],
};

describe('rebuildHeroEnabled', () => {
  const prev = process.env.REBUILD_HERO_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.REBUILD_HERO_ENABLED;
    else process.env.REBUILD_HERO_ENABLED = prev;
  });

  it('is off by default / when unset', () => {
    delete process.env.REBUILD_HERO_ENABLED;
    expect(rebuildHeroEnabled()).toBe(false);
  });

  it('accepts "1" and "true" (case-insensitive), rejects others', () => {
    process.env.REBUILD_HERO_ENABLED = '1';
    expect(rebuildHeroEnabled()).toBe(true);
    process.env.REBUILD_HERO_ENABLED = 'TRUE';
    expect(rebuildHeroEnabled()).toBe(true);
    process.env.REBUILD_HERO_ENABLED = 'yes';
    expect(rebuildHeroEnabled()).toBe(false);
    process.env.REBUILD_HERO_ENABLED = '0';
    expect(rebuildHeroEnabled()).toBe(false);
  });
});

describe('heroPrompt', () => {
  it('names the business + industry and forbids text/logos', () => {
    const p = heroPrompt(spec);
    expect(p).toContain('Sunrise Bakery');
    expect(p).toContain('Restaurant');
    expect(p).toMatch(/no text/i);
    expect(p).toMatch(/no logos/i);
  });

  // Rule 9 of the mesh painterly-backdrop standard, pinned on the path where it matters
  // most: this prompt runs in the listing-import pipeline, which auto-builds sites for
  // REAL, NAMED businesses. Before 2026-07-26 it constrained text/logos but said nothing
  // about people, so it happily returned staff and diners — fabricated employees on a page
  // presenting as that business's own. If someone rewrites this prompt, this test is what
  // stops that regression shipping silently.
  it('forbids people — the prompt runs against real, named businesses', () => {
    const p = heroPrompt(spec);
    expect(p).toMatch(/no people/i);
    expect(p).toMatch(/no faces/i);
  });
});
