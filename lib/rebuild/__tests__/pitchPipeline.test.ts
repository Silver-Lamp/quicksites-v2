/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/pitchPipeline.test.ts

import { rebuildProvenance, rebuildPitch, hostFromUrl } from '@/lib/rebuild/pitchPipeline';

describe('hostFromUrl', () => {
  it('strips scheme + www', () => {
    expect(hostFromUrl('https://www.acme-plumbing.com/about')).toBe('acme-plumbing.com');
    expect(hostFromUrl('acme.com')).toBe('acme.com');
    expect(hostFromUrl('')).toBeNull();
    expect(hostFromUrl(null)).toBeNull();
  });
});

describe('rebuildProvenance', () => {
  it('detects a URL-rebuild from data.meta.rebuilt_from', () => {
    const row = { data: { meta: { rebuilt_from: 'https://oldsite.com', rebuild_source: 'ai_rebuild' } } };
    expect(rebuildProvenance(row)).toEqual({ sourceUrl: 'https://oldsite.com', sourceHost: 'oldsite.com' });
  });

  it('detects via claim_source even without a stored url', () => {
    const row = { claim_source: 'ai_rebuild', data: {} };
    expect(rebuildProvenance(row)).toEqual({ sourceUrl: null, sourceHost: null });
  });

  it('handles stringified data', () => {
    const row = { data: JSON.stringify({ meta: { rebuilt_from: 'https://x.io' } }) };
    expect(rebuildProvenance(row)?.sourceHost).toBe('x.io');
  });

  it('returns null for a non-rebuild row', () => {
    expect(rebuildProvenance({ claim_source: 'guest_build', data: { meta: {} } })).toBeNull();
    expect(rebuildProvenance({ data: { meta: { industry: 'plumbing' } } })).toBeNull();
  });
});

describe('rebuildPitch', () => {
  it('non-rebuild → empty pipeline', () => {
    const p = rebuildPitch({ data: {} });
    expect(p.isRebuild).toBe(false);
    expect(p.steps).toHaveLength(0);
    expect(p.nextStep).toBeNull();
  });

  it('draft (not live) → next is "Review & polish"', () => {
    const p = rebuildPitch({ data: { meta: { rebuilt_from: 'https://a.com' } } });
    expect(p.isRebuild).toBe(true);
    expect(p.steps.map((s) => s.done)).toEqual([false, false, false, false]);
    expect(p.nextStep?.key).toBe('polish');
  });

  it('live site (has domain) → early steps done, next is "Pitch"', () => {
    const p = rebuildPitch({ domain: 'acme.com', data: { meta: { rebuilt_from: 'https://a.com' } } });
    expect(p.steps.find((s) => s.key === 'polish')?.done).toBe(true);
    expect(p.steps.find((s) => s.key === 'publish')?.done).toBe(true);
    expect(p.nextStep?.key).toBe('pitch');
  });

  it('published flag also counts as live', () => {
    const p = rebuildPitch({ published: true, data: { meta: { rebuilt_from: 'https://a.com' } } });
    expect(p.nextStep?.key).toBe('pitch');
  });
});
